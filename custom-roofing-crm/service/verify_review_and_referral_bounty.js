const http = require('http');
const assert = require('assert');
const { evaluateReviewSentimentAndRouting } = require('./server.js');

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
  console.log('=== GOOGLE REVIEW SENTIMENT GATE & $250 REFERRAL BOUNTY VERIFICATION  ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: evaluateReviewSentimentAndRouting Unit Matrix ---');
  const fiveStar = evaluateReviewSentimentAndRouting(5, 'Crew left our yard spotless!');
  assert.strictEqual(fiveStar.isPositive, true);
  assert.strictEqual(fiveStar.routeTo, 'GOOGLE_BUSINESS_PROFILE');
  assert.ok(fiveStar.googleReviewUrl);

  const twoStar = evaluateReviewSentimentAndRouting(2, 'Found a few nails near the downspout.');
  assert.strictEqual(twoStar.isPositive, false);
  assert.strictEqual(twoStar.routeTo, 'INTERNAL_SERVICE_RECOVERY');
  assert.strictEqual(twoStar.googleReviewUrl, null);
  assert.strictEqual(twoStar.requiresManagerEscalation, true);
  console.log('   ✓ 5-Star public Google redirect vs. 2-Star private GM service recovery verified.');

  const oppId = 'opp-review-ref-2026-01';
  console.log('\n--- TEST 2: E2E Send Review Request & Submit 5-Star Rating ---');
  const sendRes = await requestJson('POST', `/api/reviews/${oppId}/send-request`);
  assert.strictEqual(sendRes.status, 200);
  assert.ok(sendRes.body.referralCode.startsWith('REF-'));

  const rateRes = await requestJson('POST', `/api/reviews/${oppId}/submit-rating`, {
    rating: 5,
    comment: 'Best roofing experience in San Diego!',
  });
  assert.strictEqual(rateRes.status, 200);
  assert.strictEqual(rateRes.body.routing.routeTo, 'GOOGLE_BUSINESS_PROFILE');
  console.log('   ✓ Sent review link and routed 5-star submission to Google Business Profile.');

  console.log('\n--- TEST 3: E2E Record Neighbor Referral & Issue $250 QBO Bounty Bill ---');
  const refRes = await requestJson('POST', `/api/reviews/${oppId}/record-referral`, {
    referredNeighborName: 'Brian OConnor',
    referredAddress: '4835 Kensington Dr',
    bountyAmount: 250,
  });
  assert.strictEqual(refRes.status, 200);
  assert.strictEqual(refRes.body.referralCount, 1);
  assert.strictEqual(refRes.body.referralBountyEarned, 250);
  assert.strictEqual(refRes.body.referralBountyPaid, 250);
  assert.ok(refRes.body.qboBillId);
  console.log(`   ✓ Recorded neighbor referral and issued $250.00 QBO A/P Bounty Bill #${refRes.body.qboBillId}.`);

  console.log('\n=========================================================================');
  console.log('=== ALL 3 GOOGLE REVIEW & $250 REFERRAL BOUNTY TESTS PASSED!          ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

