const http = require('http');
const assert = require('assert');
const { calculateSolarDetachResetQuote } = require('./server.js');

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
            resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
          } catch (err) {
            resolve({ status: res.statusCode, body: data, raw: data });
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
  console.log('=========================================================================');
  console.log('=== SOLAR PANEL DETACH & RESET (D&R) SUB-TRADE VERIFICATION           ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: calculateSolarDetachResetQuote Unit Matrix ---');
  const quote = calculateSolarDetachResetQuote({
    hasRooftopSolar: true,
    solarPanelCount: 24,
    solarDnRPerPanelRate: 225,
    solarStandoffKitFee: 450,
    permitNumber: 'PRMT-2026-991',
    finalInspectionStatus: 'Pending',
  });
  assert.strictEqual(quote.panelLaborSubtotal, 5400);
  assert.strictEqual(quote.totalDnRQuote, 5850);
  assert.strictEqual(quote.readyForRoofTearOff, false);
  assert.strictEqual(quote.readyForSolarReset, false);
  console.log('   ✓ 24-Panel Solar D&R quote ($5,850.00) & 2-stage production gate verified.');

  const oppId = 'opp-solar-dnr-2026-01';
  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    customerName: 'Dr. Raymond Stantz',
    permitNumber: 'PRMT-SD-SOLAR-01',
    finalInspectionStatus: 'Pending',
  });

  console.log('\n--- TEST 2: E2E Complete Stage 1 Solar Detach & Block Premature Reset (HTTP 403) ---');
  const detRes = await requestJson('POST', `/api/solar-dnr/${oppId}/schedule-detach`, {
    panelCount: 20,
    perPanelRate: 225,
    standoffKitFee: 450,
    markDetachCompleted: true,
  });
  assert.strictEqual(detRes.status, 200);
  assert.strictEqual(detRes.body.calculation.readyForRoofTearOff, true);
  assert.strictEqual(detRes.body.calculation.totalDnRQuote, 4950);

  const blockedReset = await requestJson('POST', `/api/solar-dnr/${oppId}/complete-reset`, {});
  assert.strictEqual(blockedReset.status, 403);
  console.log('   ✓ Blocked Stage 2 Solar Reset before City Final Roof Inspection (HTTP 403):', blockedReset.body.error);

  console.log('\n--- TEST 3: E2E Pass Final Roof Inspection, Reset Solar Array & Sync QBO Bill ---');
  await requestJson('POST', `/api/permits/${oppId}/record-inspection-result`, {
    inspectionType: 'final',
    result: 'Passed',
    inspectorName: 'Inspector R. Vance',
  });

  const resetRes = await requestJson('POST', `/api/solar-dnr/${oppId}/complete-reset`, {
    solarProviderName: 'Sunline Solar D&R Specialists',
  });
  assert.strictEqual(resetRes.status, 200);
  assert.strictEqual(resetRes.body.totalDnRQuote, 4950);
  assert.ok(resetRes.body.qboBillId);
  assert.strictEqual(resetRes.body.calculation.ptoRecommissioned, true);
  console.log(`   ✓ Stage 2 Solar Reset & PTO recommissioning completed; synced QBO Bill #${resetRes.body.qboBillId} ($4,950.00).`);

  console.log('\n=========================================================================');
  console.log('=== ALL 3 SOLAR PANEL DETACH & RESET (D&R) TESTS PASSED!              ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

