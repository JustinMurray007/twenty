const http = require('http');
const assert = require('assert');
const { evaluateMortgageLossDraftRequirements } = require('./server.js');

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
  console.log('=== MORTGAGE LOSS DRAFT & TWO-PARTY CHECK TRACKER VERIFICATION        ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: evaluateMortgageLossDraftRequirements Unit Matrix ---');
  const highValueUnassigned = evaluateMortgageLossDraftRequirements({
    lossDraftCheckAmount: 18500,
    lossDraftHoldbackAmount: 9250,
  });
  assert.strictEqual(highValueUnassigned.isMortgageEndorsementRequired, true);
  assert.strictEqual(highValueUnassigned.readyForRelease, false);
  assert.ok(highValueUnassigned.blockers.length >= 2);
  console.log('   ✓ High-value check ($18,500) requires mortgage servicer endorsement & inspection.');

  const oppId = 'opp-loss-draft-2026-01';
  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    customerName: 'Marcus & Elena Vance',
    addressStreet: '7420 La Jolla Blvd',
    addressCity: 'San Diego',
    insuranceCarrier: 'State Farm',
    claimNumber: 'SF-992014-LD',
    rcvApprovedAmount: 24000,
    acvReceivedAmount: 16500,
  });

  console.log('\n--- TEST 2: E2E Generate Loss Draft Submission Packet & Printable Sheet ---');
  const genRes = await requestJson('POST', `/api/loss-draft/${oppId}/generate-packet`, {
    mortgageCompanyName: 'Wells Fargo Home Mortgage Loss Draft Dept.',
    mortgageLoanNumber: 'WF-88412099',
    checkNumber: 'CHK-2026-771',
    checkAmount: 16500,
    holdbackAmount: 8250,
    courierTrackingNumber: 'FDX-9901827364',
  });
  assert.strictEqual(genRes.status, 200);
  assert.strictEqual(genRes.body.lossDraftStatus, 'Packet Submitted to Mortgage Servicer');

  const sheetRes = await requestJson('GET', `/loss-draft/${oppId}/packet`);
  assert.strictEqual(sheetRes.status, 200);
  assert.ok(String(sheetRes.raw).includes('Wells Fargo Home Mortgage Loss Draft Dept.'));
  assert.ok(String(sheetRes.raw).includes('WF-88412099'));
  console.log('   ✓ Loss Draft Packet generated and printable cover sheet verified.');

  console.log('\n--- TEST 3: E2E Escrow Holdback Gate (Expect HTTP 403 Before 100% Inspection) ---');
  const blockedRelease = await requestJson('POST', `/api/loss-draft/${oppId}/release-check`, {
    checkNumber: 'CHK-2026-771',
    endorsedAmount: 16500,
  });
  assert.strictEqual(blockedRelease.status, 403);
  console.log('   ✓ Blocked premature mortgage escrow release before 100% inspection:', blockedRelease.body.error);

  console.log('\n--- TEST 4: E2E Pass 100% Mortgage Inspection & Release Endorsed Check ---');
  const inspRes = await requestJson('POST', `/api/loss-draft/${oppId}/schedule-inspection`, {
    scheduledDate: '2026-11-18',
    completionPct: 100,
    notes: '100% Roof Completion verified by Safeguard Properties Inspector.',
  });
  assert.strictEqual(inspRes.status, 200);
  assert.strictEqual(inspRes.body.lossDraftStatus, 'Inspection Passed');

  const releaseRes = await requestJson('POST', `/api/loss-draft/${oppId}/release-check`, {
    checkNumber: 'CHK-2026-771-END',
    endorsedAmount: 16500,
  });
  assert.strictEqual(releaseRes.status, 200);
  assert.strictEqual(releaseRes.body.lossDraftStatus, 'Endorsed Check Released');
  assert.strictEqual(releaseRes.body.evaluation.escrowHoldbackBalance, 0);
  console.log('   ✓ Mortgage inspection passed and $16,500 endorsed check released from escrow.');

  console.log('\n=========================================================================');
  console.log('=== ALL 4 MORTGAGE LOSS DRAFT TESTS PASSED!                           ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

