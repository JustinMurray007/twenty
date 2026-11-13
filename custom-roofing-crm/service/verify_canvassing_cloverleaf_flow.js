const http = require('http');
const assert = require('assert');

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
  console.log('=== STORM SWATH CANVASSING & CLOVERLEAF DOOR-KNOCKING VERIFICATION    ===');
  console.log('=========================================================================\n');

  const parentOppId = 'opp-canvass-anchor-01';
  console.log('--- TEST 1: Log Cloverleaf Door-Knocking Pins Around Active Build ---');
  const pin1Res = await requestJson('POST', `/api/canvassing/${parentOppId}/pin`, {
    addressStreet: '4822 Kensington Dr',
    homeownerName: 'David Miller',
    homeownerPhone: '+16195550311',
    pinStatus: 'Inspection Booked',
    repName: 'Jake Morrison',
    stormDate: '2026-10-28',
    hailSizeInches: 1.5,
    windSpeedMph: 62,
  });
  assert.strictEqual(pin1Res.status, 200);

  const pin2Res = await requestJson('POST', `/api/canvassing/${parentOppId}/pin`, {
    addressStreet: '4826 Kensington Dr',
    homeownerName: 'Neighbor 2',
    pinStatus: 'Not Home',
    repName: 'Jake Morrison',
  });
  assert.strictEqual(pin2Res.status, 200);
  assert.strictEqual(pin2Res.body.metrics.totalPins, 2);
  console.log('   ✓ Logged 2 neighborhood cloverleaf pins around active job site.');

  console.log('\n--- TEST 2: 1-Click Convert Canvass Pin to Twenty CRM Opportunity ---');
  const pinId = pin1Res.body.pin.id;
  const convRes = await requestJson('POST', `/api/canvassing/pins/${pinId}/convert`);
  assert.strictEqual(convRes.status, 200);
  assert.ok(convRes.body.convertedOpportunity.id.includes(pinId));
  assert.strictEqual(convRes.body.convertedOpportunity.canvassHailSizeInches, 1.5);
  assert.strictEqual(convRes.body.convertedOpportunity.canvassWindSpeedMph, 62);
  console.log(`   ✓ Converted Canvass Pin #${pinId} -> Opportunity #${convRes.body.convertedOpportunity.id}.`);

  console.log('\n=========================================================================');
  console.log('=== ALL 2 STORM CANVASSING & CLOVERLEAF TESTS PASSED!                 ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

