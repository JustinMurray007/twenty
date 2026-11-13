const http = require('http');
const assert = require('assert');
const { evaluateServiceTicketTriage } = require('./server.js');

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
  console.log('=== POST-INSTALL LEAK SERVICE TICKET & TUNE-UP PLAN VERIFICATION      ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: evaluateServiceTicketTriage Unit Matrix ---');
  const emergency = evaluateServiceTicketTriage({
    category: 'Active Rain Leak - Flashing/Pipe Boot',
    isActiveRain: true,
    workmanshipWarrantyActive: true,
    estimatedRepairCost: 350,
  });
  assert.strictEqual(emergency.priority, 'EMERGENCY_24HR_SLA');
  assert.strictEqual(emergency.slaHours, 24);
  assert.strictEqual(emergency.warrantyCovered, true);
  assert.strictEqual(emergency.crewBackchargeAmount, 350);
  console.log('   ✓ 24-Hr Emergency Leak SLA & $350 crew workmanship back-charge verified.');

  const oppId = 'opp-service-ticket-2026-01';
  console.log('\n--- TEST 2: E2E Enroll in $299/yr Annual Roof Tune-Up Membership ---');
  const enrRes = await requestJson('POST', `/api/service-tickets/${oppId}/enroll-maintenance`, {
    annualFee: 299,
  });
  assert.strictEqual(enrRes.status, 200);
  assert.strictEqual(enrRes.body.maintenancePlanEnrolled, true);
  assert.strictEqual(enrRes.body.maintenanceAnnualFee, 299);
  console.log(`   ✓ Enrolled in $299/yr Roof Tune-Up Plan (Next Tune-Up: ${enrRes.body.maintenanceNextTuneUpDate}).`);

  console.log('\n--- TEST 3: E2E Dispatch Emergency Leak Ticket & Resolve ---');
  const dispRes = await requestJson('POST', `/api/service-tickets/${oppId}/dispatch`, {
    category: 'Active Rain Leak - Flashing/Pipe Boot',
    isActiveRain: true,
    estimatedRepairCost: 350,
  });
  assert.strictEqual(dispRes.status, 200);
  assert.strictEqual(dispRes.body.triage.priority, 'EMERGENCY_24HR_SLA');
  assert.strictEqual(dispRes.body.triage.crewBackchargeAmount, 350);

  const resTicket = await requestJson('POST', `/api/service-tickets/${oppId}/resolve`, {});
  assert.strictEqual(resTicket.status, 200);
  assert.strictEqual(resTicket.body.serviceTicketStatus, 'Resolved & Water-Tested');
  console.log(`   ✓ Dispatched Emergency Ticket #${dispRes.body.ticketId} and marked Resolved & Water-Tested.`);

  console.log('\n=========================================================================');
  console.log('=== ALL 3 LEAK SERVICE TICKET & ANNUAL TUNE-UP TESTS PASSED!          ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

