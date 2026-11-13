const http = require('http');
const assert = require('assert');
const { calculateRoofFinancingOffer } = require('./server.js');

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
  console.log('=== POS HOMEOWNER ROOF FINANCING & DEALER-FEE ENGINE VERIFICATION     ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: calculateRoofFinancingOffer Unit Matrix ---');
  const sac12 = calculateRoofFinancingOffer({
    lender: 'GoodLeap',
    planCode: 'SAC_12M_0APR',
    principalAmount: 24000,
  });
  assert.strictEqual(sac12.aprPct, 0);
  assert.strictEqual(sac12.monthlyPayment, 2000);
  assert.strictEqual(sac12.dealerFeePct, 11.5);
  assert.strictEqual(sac12.dealerFeeAmount, 2760);
  assert.strictEqual(sac12.netFundedAmount, 21240);

  const fixed120 = calculateRoofFinancingOffer({
    lender: 'Sunlight Financial',
    planCode: 'STD_120M_999',
    principalAmount: 20000,
  });
  assert.strictEqual(fixed120.aprPct, 9.99);
  assert.strictEqual(fixed120.dealerFeePct, 5.5);
  assert.strictEqual(fixed120.dealerFeeAmount, 1100);
  assert.strictEqual(fixed120.netFundedAmount, 18900);
  assert.ok(fixed120.monthlyPayment > 260 && fixed120.monthlyPayment < 266);
  console.log('   ✓ GoodLeap 0% Same-As-Cash vs. Sunlight 10-Yr 9.99% amortization & dealer fee math verified.');

  const oppId = 'opp-financing-2026-01';
  console.log('\n--- TEST 2: E2E Send Soft-Pull Pre-Qualification Link ---');
  const preqRes = await requestJson('POST', `/api/financing/${oppId}/send-prequal`, {
    lender: 'GoodLeap',
    planCode: 'STD_120M_999',
    principalAmount: 25000,
  });
  assert.strictEqual(preqRes.status, 200);
  assert.strictEqual(preqRes.body.financingApplicationStatus, 'Pre-Qual Link Sent');
  console.log('   ✓ Sent GoodLeap soft-pull pre-qualification link.');

  console.log('\n--- TEST 3: E2E Record Lender Funding & Sync Dealer Fee Bill to QBO ---');
  const fundRes = await requestJson('POST', `/api/financing/${oppId}/record-funding`, {
    lender: 'GoodLeap',
    planCode: 'SAC_12M_0APR',
    principalAmount: 25000,
  });
  assert.strictEqual(fundRes.status, 200);
  assert.strictEqual(fundRes.body.offer.dealerFeeAmount, 2875);
  assert.strictEqual(fundRes.body.offer.netFundedAmount, 22125);
  assert.ok(fundRes.body.dealerFeeQboBillId);
  console.log(`   ✓ Recorded $25,000 GoodLeap disbursement ($22,125 net funded + $2,875 QBO Dealer Fee Bill #${fundRes.body.dealerFeeQboBillId}).`);

  console.log('\n=========================================================================');
  console.log('=== ALL 3 POS HOMEOWNER FINANCING & DEALER-FEE TESTS PASSED!          ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

