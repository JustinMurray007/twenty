const http = require('http');
const assert = require('assert');
const { calculateDumpsterSizingAndTonnage } = require('./server.js');

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
  console.log('=== DUMPSTER DISPATCH & OVERWEIGHT TONNAGE RECONCILIATION VERIFICATION ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: calculateDumpsterSizingAndTonnage Unit Matrix ---');
  const asphalt28Sq = calculateDumpsterSizingAndTonnage({
    roofSquares: 28,
    shingleLayers: 1,
    roofMaterialType: 'Asphalt Shingle',
    baseHaulFee: 450,
    includedTons: 3.0,
    overageRatePerTon: 95,
    actualTons: 4.5,
  });
  assert.strictEqual(asphalt28Sq.recommendedContainerSizeYd, 20);
  assert.strictEqual(asphalt28Sq.overageTons, 1.5);
  assert.strictEqual(asphalt28Sq.overageFeeAmount, 142.5);
  assert.strictEqual(asphalt28Sq.totalDumpsterCost, 592.5);

  const concreteTile32Sq = calculateDumpsterSizingAndTonnage({
    roofSquares: 32,
    shingleLayers: 1,
    roofMaterialType: 'Concrete Tile',
  });
  assert.strictEqual(concreteTile32Sq.recommendedContainerSizeYd, 40);
  assert.ok(concreteTile32Sq.estimatedTons > 14);
  console.log('   ✓ Asphalt (20YD) vs. Concrete Tile (40YD) tonnage & overage math verified.');

  const oppId = 'opp-dumpster-sd-2026-01';
  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    customerName: 'Arthur Pendelton',
    addressStreet: '3120 Ocean Front Walk',
    addressCity: 'San Diego',
    roofSquares: 30,
    rcvApprovedAmount: 22000,
  });

  console.log('\n--- TEST 2: E2E Dispatch Roll-Off Dumpster ---');
  const dispRes = await requestJson('POST', `/api/dumpster/${oppId}/dispatch`, {
    haulerName: 'EDCO Waste & Recycling Services',
    containerSizeYd: 20,
    deliveryDate: '2026-11-15',
  });
  assert.strictEqual(dispRes.status, 200);
  assert.strictEqual(dispRes.body.dumpsterStatus, 'Dispatched - On Site');
  console.log('   ✓ 20-Yard Roll-Off Container dispatched with EDCO Waste & Recycling.');

  console.log('\n--- TEST 3: E2E Reconcile Landfill Weight Ticket & Sync QBO COGS Account #62 ---');
  const recRes = await requestJson('POST', `/api/dumpster/${oppId}/reconcile-ticket`, {
    haulerName: 'EDCO Waste & Recycling Services',
    ticketNumber: 'EDCO-88419',
    baseHaulFee: 450,
    includedTons: 3.0,
    overageRatePerTon: 95,
    actualTons: 5.0,
  });
  assert.strictEqual(recRes.status, 200);
  assert.strictEqual(recRes.body.overageTons, 2.0);
  assert.strictEqual(recRes.body.overageFeeAmount, 190);
  assert.strictEqual(recRes.body.totalDumpsterCost, 640);
  assert.ok(recRes.body.qboBillId);
  assert.strictEqual(recRes.body.opportunity.dumpsterExpense, 640);
  console.log(`   ✓ Reconciled Landfill Ticket #EDCO-88419 (5.0 Tons -> $640.00) to QBO Bill #${recRes.body.qboBillId}.`);

  console.log('\n=========================================================================');
  console.log('=== ALL 3 DUMPSTER DISPATCH & TONNAGE TESTS PASSED!                   ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

