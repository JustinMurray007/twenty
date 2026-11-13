const http = require('http');
const assert = require('assert');
const {
  calculateXactimateCodeSupplement,
  seedSimulatedQuickBooksInvoice,
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
  console.log('=== XACTIMATE CODE-UPGRADE & 10%/10% O&P SUPPLEMENT VERIFICATION      ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: calculateXactimateCodeSupplement Unit Matrix ---');
  const calc = calculateXactimateCodeSupplement({
    initialRcv: 18000,
    eaveLf: 180,
    rakeLf: 140,
    valleyLf: 60,
    stepFlashingLf: 45,
    steepSquares: 10,
    ridgeLf: 110,
    tradesCount: 3,
  });
  assert.strictEqual(calc.opEligible, true);
  assert.strictEqual(calc.lineItems.length, 5);
  assert.ok(calc.codeUpgradeSubtotal > 3800);
  assert.ok(calc.overheadAndProfitAmount > 4300);
  assert.strictEqual(calc.revisedRcvTotal, Math.round((18000 + calc.totalSupplementRequested) * 100) / 100);
  console.log(`   ✓ 5 CBC R905 Xactimate code items ($${calc.codeUpgradeSubtotal}) + 20% O&P ($${calc.overheadAndProfitAmount}) verified.`);

  const oppId = 'opp-xact-supp-2026-01';
  seedSimulatedQuickBooksInvoice({
    Id: '9801',
    DocNumber: 'INV-9801',
    TotalAmt: 18000,
    Balance: 18000,
    Line: [],
  });

  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    customerName: 'Walter Peck',
    claimNumber: 'ALLSTATE-88412',
    rcvApprovedAmount: 18000,
    qboInvoiceId: '9801',
  });

  console.log('\n--- TEST 2: E2E Generate Supplement & Printable CBC Rebuttal Packet ---');
  const genRes = await requestJson('POST', `/api/supplements/${oppId}/generate`, {
    initialRcv: 18000,
    tradesCount: 3,
  });
  assert.strictEqual(genRes.status, 200);
  assert.strictEqual(genRes.body.supplementStatus, 'Submitted to Carrier Adjuster');

  const packetRes = await requestJson('GET', `/supplements/${oppId}/rebuttal-packet`);
  assert.strictEqual(packetRes.status, 200);
  assert.ok(String(packetRes.raw).includes('RFG DRIP'));
  assert.ok(String(packetRes.raw).includes('CBC R905.2.8.5'));
  console.log('   ✓ Generated Xactimate supplement and verified CBC R905 Rebuttal Packet.');

  console.log('\n--- TEST 3: E2E Approve Supplement & Sync Revised RCV to QBO Invoice ---');
  const appRes = await requestJson('POST', `/api/supplements/${oppId}/approve`, {
    approvedAmount: genRes.body.calculation.totalSupplementRequested,
  });
  assert.strictEqual(appRes.status, 200);
  assert.strictEqual(appRes.body.supplementStatus, 'Approved by Carrier');
  assert.strictEqual(appRes.body.revisedRcv, genRes.body.calculation.revisedRcvTotal);
  console.log(`   ✓ Carrier supplement approved (+$${appRes.body.approvedAmount}) -> Revised RCV $${appRes.body.revisedRcv}.`);

  console.log('\n=========================================================================');
  console.log('=== ALL 3 XACTIMATE CODE & O&P SUPPLEMENT TESTS PASSED!               ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

