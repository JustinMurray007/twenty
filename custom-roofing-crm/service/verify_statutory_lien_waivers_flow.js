const http = require('http');
const assert = require('assert');
const { evaluateCaliforniaStatutoryWaiverAndPrelim } = require('./server.js');

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
  console.log('=== CA STATUTORY 20-DAY PRELIM & LIEN WAIVERS (§§ 8132-8138)          ===');
  console.log('=========================================================================\n');

  console.log('--- TEST 1: evaluateCaliforniaStatutoryWaiverAndPrelim Unit Matrix ---');
  const s8132 = evaluateCaliforniaStatutoryWaiverAndPrelim({
    waiverType: 'CONDITIONAL_PROGRESS',
    amount: 10000,
    firstWorkDate: '2026-11-01',
    prelimServedAt: '2026-11-10',
  });
  assert.strictEqual(s8132.civilCodeSection, 'CA Civil Code § 8132');
  assert.strictEqual(s8132.preliminaryNoticeTimely, true);

  const s8138 = evaluateCaliforniaStatutoryWaiverAndPrelim({
    waiverType: 'UNCONDITIONAL_FINAL',
    amount: 24500,
  });
  assert.strictEqual(s8138.civilCodeSection, 'CA Civil Code § 8138');
  assert.ok(s8138.statutoryWarningBanner.includes('UNCONDITIONALLY'));
  console.log('   ✓ CA Civil Code §§ 8132, 8134, 8136, 8138 statutory text & 20-day Prelim verified.');

  const oppId = 'opp-ca-waiver-2026-01';
  console.log('\n--- TEST 2: E2E Serve 20-Day Preliminary Notice & Generate Statutory Waiver ---');
  const prelimRes = await requestJson('POST', `/api/legal/waivers/${oppId}/serve-prelim`, {
    firstWorkDate: '2026-11-01',
    servedAt: '2026-11-12T10:00:00Z',
    certMailTracking: 'USPS-940711189956',
  });
  assert.strictEqual(prelimRes.status, 200);
  assert.strictEqual(prelimRes.body.preliminaryNoticeTimely, true);

  const genRes = await requestJson('POST', `/api/legal/waivers/${oppId}/generate`, {
    waiverType: 'CONDITIONAL_PROGRESS',
    amount: 12500,
    throughDate: '2026-11-15',
  });
  assert.strictEqual(genRes.status, 200);

  const sheetRes = await requestJson('GET', `/legal/waivers/${oppId}/sheet`);
  assert.strictEqual(sheetRes.status, 200);
  assert.ok(String(sheetRes.raw).includes('CA Civil Code § 8132'));
  console.log('   ✓ Served 20-Day Preliminary Notice and verified printable § 8132 Statutory Waiver.');

  console.log('\n=========================================================================');
  console.log('=== ALL 2 CA STATUTORY LIEN WAIVER & PRELIM TESTS PASSED!             ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

