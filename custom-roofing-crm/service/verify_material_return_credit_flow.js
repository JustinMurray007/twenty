const http = require('http');
const assert = require('assert');
const { calculateMaterialReturnCredit } = require('./server.js');

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
  console.log('=== LEFTOVER MATERIAL RETURN & SUPPLIER CREDIT MEMO VERIFICATION      ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: calculateMaterialReturnCredit Unit Matrix ---');
  const calc = calculateMaterialReturnCredit({
    returnedBundlesCount: 6,
    returnedUnderlaymentRolls: 2,
    returnedRidgeCapBundles: 1,
    bundleUnitCredit: 42,
    underlaymentUnitCredit: 95,
    ridgeCapUnitCredit: 58,
    restockingFeePct: 10,
    originalMaterialCost: 8000,
  });
  assert.strictEqual(calc.grossReturnCredit, 500);
  assert.strictEqual(calc.restockingFeeAmount, 50);
  assert.strictEqual(calc.netCreditAmount, 450);
  assert.strictEqual(calc.adjustedMaterialCost, 7550);
  console.log('   ✓ Leftover bundle/roll credit ($500 gross - 10% restock = $450 net credit) verified.');

  const oppId = 'opp-mat-return-2026-01';
  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    customerName: 'Peter Venkman',
    rcvApprovedAmount: 20000,
    actualMaterials: 7500,
    actualLabor: 4000,
  });

  console.log('\n--- TEST 2: E2E Reconcile ABC Supply Credit Memo & Recalculate Gross Profit ---');
  const recRes = await requestJson('POST', `/api/material-returns/${oppId}/reconcile-credit`, {
    creditMemoNumber: 'ABC-CM-77412',
    returnedBundlesCount: 5,
    returnedUnderlaymentRolls: 1,
    returnedRidgeCapBundles: 0,
    bundleUnitCredit: 42,
    underlaymentUnitCredit: 95,
    restockingFeePct: 0,
    originalMaterialCost: 7500,
  });
  assert.strictEqual(recRes.status, 200);
  assert.strictEqual(recRes.body.calculation.netCreditAmount, 305);
  assert.strictEqual(recRes.body.calculation.adjustedMaterialCost, 7195);
  assert.strictEqual(recRes.body.opportunity.actualMaterials, 7195);
  console.log(`   ✓ Reconciled Credit Memo #ABC-CM-77412 (-$305.00) -> Adjusted Material Cost: $7,195.00.`);

  console.log('\n=========================================================================');
  console.log('=== ALL 2 LEFTOVER MATERIAL RETURN & CREDIT MEMO TESTS PASSED!        ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

