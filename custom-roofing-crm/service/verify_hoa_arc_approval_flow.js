const http = require('http');
const assert = require('assert');
const { evaluateHoaArcCompliance } = require('./server.js');

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
  console.log('=== HOA ARCHITECTURAL REVIEW COMMITTEE (ARC) GATE VERIFICATION        ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: evaluateHoaArcCompliance Unit Matrix ---');
  const exempt = evaluateHoaArcCompliance({ hoaRequired: false });
  assert.strictEqual(exempt.clearedForMobilization, true);

  const unapproved = evaluateHoaArcCompliance({
    hoaRequired: true,
    hoaManagementCompany: 'FirstService Residential HOA',
    hoaArcStatus: 'Pending ARC Submittal',
  });
  assert.strictEqual(unapproved.clearedForMobilization, false);
  assert.ok(unapproved.blockers.length >= 1);
  console.log('   ✓ HOA vs. Non-HOA mobilization compliance gate verified.');

  const oppId = 'opp-hoa-delmar-2026-01';
  console.log('\n--- TEST 2: E2E Submit HOA ARC Packet & Printable Spec Sheet ---');
  const subRes = await requestJson('POST', `/api/hoa-arc/${oppId}/submit-packet`, {
    hoaManagementCompany: 'FirstService Residential HOA',
    hoaCommunityName: 'Del Mar Highlands Estates HOA',
    shingleColor: 'GAF Timberline HDZ — Charcoal',
  });
  assert.strictEqual(subRes.status, 200);
  assert.strictEqual(subRes.body.hoaArcStatus, 'Submitted - Pending ARC Review');

  const packetHtml = await requestJson('GET', `/hoa-arc/${oppId}/packet`);
  assert.strictEqual(packetHtml.status, 200);
  assert.ok(String(packetHtml.raw).includes('Del Mar Highlands Estates HOA'));
  console.log('   ✓ Submitted HOA ARC packet and verified printable spec sheet.');

  console.log('\n--- TEST 3: E2E Block Mobilization Before HOA ARC Approval (HTTP 403) ---');
  const blockedRes = await requestJson('POST', `/api/hoa-arc/${oppId}/verify-mobilization`);
  assert.strictEqual(blockedRes.status, 403);
  console.log('   ✓ Blocked premature mobilization (HTTP 403):', blockedRes.body.error);

  console.log('\n--- TEST 4: E2E Record HOA ARC Approval & Clear Mobilization ---');
  const appRes = await requestJson('POST', `/api/hoa-arc/${oppId}/approve`, {
    approvedColor: 'GAF Timberline HDZ — Charcoal',
  });
  assert.strictEqual(appRes.status, 200);
  assert.strictEqual(appRes.body.compliance.clearedForMobilization, true);

  const mobRes = await requestJson('POST', `/api/hoa-arc/${oppId}/verify-mobilization`);
  assert.strictEqual(mobRes.status, 200);
  console.log('   ✓ HOA ARC Approval recorded and mobilization unlocked.');

  console.log('\n=========================================================================');
  console.log('=== ALL 4 HOA ARC SUBMITTAL & MOBILIZATION GATE TESTS PASSED!         ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

