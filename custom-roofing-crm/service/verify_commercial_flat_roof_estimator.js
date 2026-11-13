const http = require('http');
const assert = require('assert');
const { calculateLowSlopeFlatRoofEstimate } = require('./server.js');

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
  console.log('=== LOW-SLOPE / COMMERCIAL FLAT ROOF (TPO) & TITLE 24 VERIFICATION    ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: calculateLowSlopeFlatRoofEstimate Unit Matrix ---');
  const tpo60 = calculateLowSlopeFlatRoofEstimate({
    flatRoofAreaSqFt: 3000,
    membraneMil: 60,
    polyisoRValue: 20,
    crrcSriRating: 104,
    scupperCount: 2,
  });
  assert.strictEqual(tpo60.roofSquares, 30);
  assert.strictEqual(tpo60.title24CoolRoofCompliant, true);
  assert.strictEqual(tpo60.ndlWarrantyYears, 20);
  assert.strictEqual(tpo60.totalFlatRoofEstimate, 26950);
  console.log('   ✓ 30 SQ 60-Mil TPO + R-20 Polyiso ($26,950.00) & Title 24 Cool Roof SRI 104 verified.');

  const oppId = 'opp-flat-tpo-2026-01';
  console.log('\n--- TEST 2: E2E Calculate 80-Mil TPO + R-30 Polyiso Commercial Quote ---');
  const quoteRes = await requestJson('POST', `/api/flat-roof/${oppId}/calculate-quote`, {
    flatRoofAreaSqFt: 4000,
    systemType: '80-Mil Fully Adhered TPO',
    membraneMil: 80,
    polyisoRValue: 30,
    crrcSriRating: 108,
    scupperCount: 4,
  });
  assert.strictEqual(quoteRes.status, 200);
  assert.strictEqual(quoteRes.body.estimate.ndlWarrantyYears, 25);
  assert.strictEqual(quoteRes.body.estimate.title24CoolRoofCompliant, true);
  assert.strictEqual(quoteRes.body.estimate.totalFlatRoofEstimate, 45300);
  console.log(`   ✓ Saved 40 SQ 80-Mil TPO + R-30 Polyiso quote ($45,300.00 • 25-Yr NDL Warranty).`);

  console.log('\n=========================================================================');
  console.log('=== ALL 2 COMMERCIAL FLAT ROOF & TITLE 24 COOL ROOF TESTS PASSED!     ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

