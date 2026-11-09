const http = require('http');
const assert = require('assert');
const {
  evaluateWeatherRiskForRoofing,
  seedSimulatedWeatherForecast,
  fetch48HourForecastForOpportunity,
} = require('./server.js');

function requestJson(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (err) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runVerification() {
  console.log('=== Starting Automated Weather / Rain Delay Radar & Rescheduling Verification ===\n');

  // ---------------------------------------------------------------------------
  // Test 1: Unit Test - Weather Risk Evaluation Thresholds (Rain % & Wind MPH)
  // ---------------------------------------------------------------------------
  console.log('Test 1: Unit Test - evaluateWeatherRiskForRoofing thresholds...');

  const lowRisk = evaluateWeatherRiskForRoofing({ rainProbability: 10, windGustMph: 14 });
  assert.strictEqual(lowRisk.riskLevel, 'LOW');
  assert.strictEqual(lowRisk.weatherRiskStatus, 'Clear - Safe for Tear-Off');
  assert.strictEqual(lowRisk.safeToTearOff, true);

  const moderateRainRisk = evaluateWeatherRiskForRoofing({ rainProbability: 25, windGustMph: 15 });
  assert.strictEqual(moderateRainRisk.riskLevel, 'MODERATE');
  assert.strictEqual(moderateRainRisk.weatherRiskStatus, 'Advisory - Monitor Radar & Stage Tarps');
  assert.strictEqual(moderateRainRisk.safeToTearOff, true);

  const highRainRisk = evaluateWeatherRiskForRoofing({ rainProbability: 65, windGustMph: 18 });
  assert.strictEqual(highRainRisk.riskLevel, 'HIGH');
  assert.strictEqual(highRainRisk.weatherRiskStatus, 'High Rain Risk - Delay Recommended');
  assert.strictEqual(highRainRisk.safeToTearOff, false);

  const highWindRisk = evaluateWeatherRiskForRoofing({ rainProbability: 15, windGustMph: 36 });
  assert.strictEqual(highWindRisk.riskLevel, 'HIGH');
  assert.strictEqual(highWindRisk.weatherRiskStatus, 'High Rain Risk - Delay Recommended');
  assert.strictEqual(highWindRisk.safeToTearOff, false);

  // Unit test for simulated forecast store in-process
  seedSimulatedWeatherForecast({
    locationKey: '92101',
    rainProbability: 75,
    windGustMph: 34,
    condition: 'Heavy Rain & Thunderstorms',
  });
  const unitForecast = await fetch48HourForecastForOpportunity({
    id: 'unit-opp-1',
    addressPostalCode: '92101',
    addressPostcode: '92101',
    scheduledStartDate: '2026-11-10',
  });
  assert.strictEqual(unitForecast.rainProbability, 75);
  assert.strictEqual(unitForecast.windGustMph, 34);

  console.log('  [PASS] LOW (<20% rain, <20 MPH wind), MODERATE (20-39%), and HIGH (>=40% rain or >=30 MPH wind) classified accurately.\n');

  // ---------------------------------------------------------------------------
  // Test 2: Live 48-Hour Weather Radar Check Endpoint (GET /api/weather/:id/check)
  // ---------------------------------------------------------------------------
  console.log('Test 2: Live 48-Hour Weather Radar Check (GET /api/weather/:id/check)...');
  const oppId = 'opp-weather-radar-001';

  // Seed Opportunity via PATCH /api/insurance/:id/claim
  const seedRes = await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    name: '742 Evergreen Terrace Roof Replacement',
    customerName: 'Homer Simpson',
    customerPhone: '+16195550191',
    crewLeadPhone: '+16195550192',
    assignedCrew: 'Carlos Mendez Crew',
    addressStreet: '742 Evergreen Terrace',
    addressCity: 'San Diego',
    addressState: 'CA',
    addressPostcode: '92101',
    stage: 'Production / Scheduled',
    scheduledStartDate: '2026-11-10',
    materialDropScheduledTime: '2026-11-10T14:30:00.000Z',
    drivewayClearanceReminderSentAt: '2026-11-09T23:00:00.000Z',
    weatherRainProbability: 75,
    weatherWindGustMph: 34,
  });
  assert.strictEqual(seedRes.status, 200);

  const radarCheckRes = await requestJson('GET', `/api/weather/${oppId}/check`);
  assert.strictEqual(radarCheckRes.status, 200);
  assert.strictEqual(radarCheckRes.body.success, true);
  assert.strictEqual(radarCheckRes.body.forecast.rainProbability, 75);
  assert.strictEqual(radarCheckRes.body.forecast.windGustMph, 34);
  assert.strictEqual(radarCheckRes.body.evaluation.riskLevel, 'HIGH');
  assert.strictEqual(radarCheckRes.body.evaluation.weatherRiskStatus, 'High Rain Risk - Delay Recommended');
  assert.strictEqual(radarCheckRes.body.evaluation.safeToTearOff, false);

  console.log('  [PASS] 48-hour radar check synced 75% Rain / 34 MPH Wind -> "High Rain Risk - Delay Recommended".\n');

  // ---------------------------------------------------------------------------
  // Test 3: 1-Click Rain Delay Push (+2 Days) with Homeowner & Crew SMS Alerts
  // ---------------------------------------------------------------------------
  console.log('Test 3: 1-Click Rain Delay Push (+2 Days) via POST /api/weather/:id/reschedule-rain-delay...');

  const rescheduleRes = await requestJson('POST', `/api/weather/${oppId}/reschedule-rain-delay`, {
    delayDays: 2,
    rainProbability: 75,
    windGustMph: 34,
    reason: 'Heavy Coastal Rain Squall',
  });

  assert.strictEqual(rescheduleRes.status, 200);
  assert.strictEqual(rescheduleRes.body.success, true);
  assert.strictEqual(rescheduleRes.body.originalStartDate, '2026-11-10');
  assert.strictEqual(rescheduleRes.body.revisedStartDate, '2026-11-12');
  assert.strictEqual(rescheduleRes.body.delayDays, 2);
  assert.strictEqual(rescheduleRes.body.materialDropScheduledTime, '2026-11-12T14:30:00.000Z');
  assert.strictEqual(rescheduleRes.body.weatherDelayCount, 1);
  assert.strictEqual(rescheduleRes.body.weatherRiskStatus, 'Rescheduled - Weather Hold');
  assert.ok(rescheduleRes.body.homeownerSmsSid, 'Expected homeownerSmsSid to be generated');
  assert.ok(rescheduleRes.body.crewSmsSid, 'Expected crewSmsSid to be generated');

  // Verify SMS messages were logged to the Opportunity SMS conversation thread
  const smsThreadRes = await requestJson('GET', `/api/opportunities/${oppId}/sms-thread`);
  assert.strictEqual(smsThreadRes.status, 200);
  const messages = smsThreadRes.body.smsThread || [];
  assert.ok(messages.length >= 2, 'Expected both Homeowner and Crew SMS messages in thread');
  const bodies = messages.map((m) => m.body).join(' | ');
  assert.ok(bodies.includes('WEATHER HOLD & SCHEDULE UPDATE'), 'Expected Homeowner Weather Hold SMS');
  assert.ok(bodies.includes('RAIN DELAY HOLD'), 'Expected Crew Lead Rain Hold SMS');
  assert.ok(bodies.includes('2026-11-12'), 'Expected new build date 2026-11-12 in SMS body');

  console.log('  [PASS] Build date shifted 2026-11-10 -> 2026-11-12, originalStartDate preserved, material drop shifted, and Homeowner + Crew SMS alerts dispatched.\n');

  // ---------------------------------------------------------------------------
  // Test 4: Automated 48-Hour Radar Scan & Auto-Reschedule Engine
  // ---------------------------------------------------------------------------
  console.log('Test 4: Automated 48-Hour Weather Radar Batch Scan (POST /test/run-weather-radar)...');
  const oppAutoId = 'opp-weather-auto-002';
  const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await requestJson('PATCH', `/api/insurance/${oppAutoId}/claim`, {
    name: '880 Coastal Blvd Tear-Off',
    customerName: 'Elena Vance',
    customerPhone: '+16195550199',
    crewLeadPhone: '+16195550198',
    assignedCrew: 'Marco Polo Crew',
    addressStreet: '880 Coastal Blvd',
    addressCity: 'La Jolla',
    addressState: 'CA',
    addressPostcode: '92037',
    stage: 'Production / Scheduled',
    scheduledStartDate: tomorrowIso,
    materialDropScheduledTime: `${tomorrowIso}T14:30:00.000Z`,
    weatherRainProbability: 80,
    weatherWindGustMph: 38,
  });

  const batchRadarRes = await requestJson('POST', '/test/run-weather-radar', {
    autoReschedule: true,
    delayDays: 1,
  });

  assert.strictEqual(batchRadarRes.status, 200);
  assert.ok(batchRadarRes.body.results.highRiskCount >= 1, 'Expected at least 1 high-risk job flagged');
  assert.ok(batchRadarRes.body.results.rescheduledCount >= 1, 'Expected at least 1 high-risk job auto-rescheduled');

  const autoResult = batchRadarRes.body.results.flaggedJobs.find((r) => r.id === oppAutoId);
  assert.ok(autoResult, 'Expected opp-weather-auto-002 in radar scan flaggedJobs');
  assert.strictEqual(autoResult.weatherRiskStatus, 'Rescheduled - Weather Hold');
  assert.ok(autoResult.rescheduledTo, 'Expected rescheduledTo date to be populated');

  console.log('  [PASS] Automated 48-hour radar scan detected high-risk build and auto-rescheduled by +1 day.\n');

  console.log('=== ALL WEATHER RADAR & CREW RESCHEDULING TESTS PASSED ===');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  });
