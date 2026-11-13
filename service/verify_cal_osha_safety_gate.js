const http = require('http');
const assert = require('assert');
const { evaluateCalOshaJobSiteSafety } = require('./server.js');

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
  console.log('=== CAL/OSHA 1926.501 FALL-PROTECTION & HEAT-ILLNESS GATE VERIFICATION===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: evaluateCalOshaJobSiteSafety Unit Matrix ---');
  const unsafe = evaluateCalOshaJobSiteSafety({
    oshaAnchorPointsInstalled: true,
    oshaHarnessesInspected: false,
    oshaAmbientTempF: 88,
  });
  assert.strictEqual(unsafe.clearedForTearOff, false);
  assert.strictEqual(unsafe.heatIllnessTriggerActive, true);
  assert.ok(unsafe.blockers.length >= 2);
  console.log('   ✓ Cal/OSHA Title 8 § 1730 Fall Protection & § 3395 Heat Illness triggers verified.');

  const oppId = 'opp-osha-safety-2026-01';
  console.log('\n--- TEST 2: E2E Block Tear-Off Before Morning JSA / Tailgate Check (HTTP 403) ---');
  const blockedRes = await requestJson('POST', `/api/safety/${oppId}/verify-tearoff-gate`, {});
  assert.strictEqual(blockedRes.status, 403);
  console.log('   ✓ Blocked premature tear-off (HTTP 403):', blockedRes.body.error);

  console.log('\n--- TEST 3: E2E Complete 5-Point Cal/OSHA Tailgate Log & Clear Tear-Off Gate ---');
  const logRes = await requestJson('POST', `/api/safety/${oppId}/log-tailgate`, {
    oshaAnchorPointsInstalled: true,
    oshaHarnessesInspected: true,
    oshaLadderThreeFeetAboveEave: true,
    oshaPerimeterCautionTapeSet: true,
    oshaHeatIllnessWaterShadeVerified: true,
    oshaAmbientTempF: 85,
    oshaTailgateSignedByCrewCount: 6,
  });
  assert.strictEqual(logRes.status, 200);
  assert.strictEqual(logRes.body.evaluation.clearedForTearOff, true);

  const gateRes = await requestJson('POST', `/api/safety/${oppId}/verify-tearoff-gate`, {});
  assert.strictEqual(gateRes.status, 200);

  const jsaRes = await requestJson('GET', `/safety/${oppId}/jsa-sheet`);
  assert.strictEqual(jsaRes.status, 200);
  assert.ok(String(jsaRes.raw).includes('CAL/OSHA TITLE 8'));
  console.log('   ✓ Logged 6-worker JSA Tailgate, verified printable sheet, and unlocked Tear-Off.');

  console.log('\n=========================================================================');
  console.log('=== ALL 3 CAL/OSHA FALL-PROTECTION & HEAT-ILLNESS TESTS PASSED!       ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

