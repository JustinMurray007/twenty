const http = require('http');
const assert = require('assert');
const { evaluateFinalQcWalkthroughCompliance } = require('./server.js');

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
  console.log('=== FINAL QC WALKTHROUGH & MAGNETIC NAIL SWEEP GATE VERIFICATION      ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: evaluateFinalQcWalkthroughCompliance Unit Matrix ---');
  const incomplete = evaluateFinalQcWalkthroughCompliance({
    qcMagneticSweepVerified: false,
    qcGutterCleanoutVerified: true,
  });
  assert.strictEqual(incomplete.allChecklistItemsVerified, false);
  assert.strictEqual(incomplete.completedCount, 1);
  assert.ok(incomplete.blockers.some((b) => b.includes('Magnetic Nail Sweep')));
  console.log('   ✓ 5-point field QC compliance gate accurately identifies missing Magnetic Nail Sweep.');

  const oppId = 'opp-qc-walkthrough-2026-01';
  console.log('\n--- TEST 2: E2E Block Sign-Off When Magnetic Nail Sweep Is Unverified (HTTP 403) ---');
  await requestJson('POST', `/api/qc-walkthrough/${oppId}/verify-checklist`, {
    qcMagneticSweepVerified: false,
    qcGutterCleanoutVerified: true,
    qcPipeBootFlashingVerified: true,
    qcAtticPenetrationChecked: true,
    qcDrivewayDebrisCleared: true,
  });

  const blockedRes = await requestJson('POST', `/api/qc-walkthrough/${oppId}/sign-off`, {
    signedBy: 'Elena Vance',
  });
  assert.strictEqual(blockedRes.status, 403);
  console.log('   ✓ Blocked premature walkthrough sign-off (HTTP 403):', blockedRes.body.error);

  console.log('\n--- TEST 3: E2E Complete 5-Point QC Checklist & Homeowner Sign-Off ---');
  const checkRes = await requestJson('POST', `/api/qc-walkthrough/${oppId}/verify-checklist`, {
    qcMagneticSweepVerified: true,
    qcGutterCleanoutVerified: true,
    qcPipeBootFlashingVerified: true,
    qcAtticPenetrationChecked: true,
    qcDrivewayDebrisCleared: true,
    qcSuperintendentName: 'Carlos Mendez (Field Supt.)',
  });
  assert.strictEqual(checkRes.status, 200);
  assert.strictEqual(checkRes.body.compliance.allChecklistItemsVerified, true);

  const signRes = await requestJson('POST', `/api/qc-walkthrough/${oppId}/sign-off`, {
    signedBy: 'Elena Vance',
  });
  assert.strictEqual(signRes.status, 200);
  assert.strictEqual(signRes.body.qcWalkthroughStatus, 'Signed Off & Complete');
  assert.strictEqual(signRes.body.compliance.eligibleForFinalCrewRetainageRelease, true);
  console.log('   ✓ All 5 QC checks verified, homeowner signed off, and final crew retainage unlocked.');

  console.log('\n=========================================================================');
  console.log('=== ALL 3 FINAL QC WALKTHROUGH & MAGNETIC SWEEP TESTS PASSED!         ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

