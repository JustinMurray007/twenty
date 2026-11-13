const http = require('http');
const assert = require('assert');
const { calculateCommissionSettlementAndSplit } = require('./server.js');

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
  console.log('=== SALES REP COMMISSION DRAW, SPLIT & FINAL SETTLEMENT VERIFICATION  ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: calculateCommissionSettlementAndSplit Unit Matrix ---');
  const splitEval = calculateCommissionSettlementAndSplit({
    rcvApprovedAmount: 20000,
    actualMaterials: 6000,
    actualLabor: 4000,
    commissionCanvasserSplitPct: 20,
    commissionAdvanceDrawPaid: 750,
    unpaidBalance: 2500,
  });
  assert.strictEqual(splitEval.eligibleForFinalSettlement, false);
  assert.ok(splitEval.canvasserGrossShare > 0);
  assert.ok(splitEval.closerNetPayable > 0);
  console.log(`   ✓ Closer net ($${splitEval.closerNetPayable}) + 20% Canvasser split ($${splitEval.canvasserNetPayable}) & unpaid balance gate verified.`);

  const oppId = 'opp-comm-settle-2026-01';
  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    customerName: 'Dana Barrett',
    rcvApprovedAmount: 22000,
    actualMaterials: 6500,
    actualLabor: 4500,
  });

  console.log('\n--- TEST 2: E2E Record $750 Advance Draw & Block Settlement on Unpaid Balance (HTTP 403) ---');
  const drawRes = await requestJson('POST', `/api/commissions/${oppId}/record-draw`, {
    closerRepName: 'Jake Morrison',
    canvasserRepName: 'Tyler Durden',
    canvasserSplitPct: 20,
    drawAmount: 750,
    unpaidBalance: 1800,
  });
  assert.strictEqual(drawRes.status, 200);

  const blockedSettle = await requestJson('POST', `/api/commissions/${oppId}/settle`, {
    unpaidBalance: 1800,
  });
  assert.strictEqual(blockedSettle.status, 403);
  console.log('   ✓ Blocked premature commission settlement (HTTP 403):', blockedSettle.body.error);

  console.log('\n--- TEST 3: E2E Clear Balance to $0.00 & Settle Final Commission in QBO ---');
  const settleRes = await requestJson('POST', `/api/commissions/${oppId}/settle`, {
    unpaidBalance: 0,
  });
  assert.strictEqual(settleRes.status, 200);
  assert.strictEqual(settleRes.body.commissionSettlementStatus, 'Settled & Paid in QBO');
  assert.ok(settleRes.body.qboBillId);
  console.log(`   ✓ Settled Final Commission in QBO (Bill #${settleRes.body.qboBillId}).`);

  console.log('\n=========================================================================');
  console.log('=== ALL 3 SALES COMMISSION DRAW & SPLIT SETTLEMENT TESTS PASSED!      ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

