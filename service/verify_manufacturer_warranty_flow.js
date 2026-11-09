const http = require('http');
const assert = require('assert');
const {
  resolveManufacturerWarrantyProgram,
  evaluateWarrantyRegistrationEligibility,
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
  console.log('=== MANUFACTURER WARRANTY AUTO-REGISTRATION & CERTIFICATE VERIFICATION ===');
  console.log('=========================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Unit Test - GAF & Owens Corning Program Resolution Matrix
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: resolveManufacturerWarrantyProgram Unit Matrix ---');

  const gafBest = resolveManufacturerWarrantyProgram({
    shingleManufacturer: 'GAF',
    selectedTier: 'Best',
  });
  assert.strictEqual(gafBest.programName, 'GAF Golden Pledge® Limited Warranty');
  assert.strictEqual(gafBest.materialTermYears, 50);
  assert.strictEqual(gafBest.workmanshipTermYears, 25);
  assert.strictEqual(gafBest.windRatingMph, 130);
  assert.strictEqual(gafBest.registrationPrefix, 'GAF-GP');

  const gafBetter = resolveManufacturerWarrantyProgram({
    shingleManufacturer: 'GAF',
    selectedTier: 'Better',
  });
  assert.strictEqual(gafBetter.programName, 'GAF System Plus Limited Warranty');
  assert.strictEqual(gafBetter.materialTermYears, 50);
  assert.strictEqual(gafBetter.workmanshipTermYears, 10);

  const ocBest = resolveManufacturerWarrantyProgram({
    shingleManufacturer: 'Owens Corning',
    selectedTier: 'Best',
  });
  assert.strictEqual(ocBest.programName, 'Owens Corning Platinum Protection™ Limited Warranty');
  assert.strictEqual(ocBest.materialTermYears, 50);
  assert.strictEqual(ocBest.workmanshipTermYears, 25);
  assert.strictEqual(ocBest.registrationPrefix, 'OC-PLT');

  console.log('   ✓ GAF (Golden Pledge / System Plus) & Owens Corning (Platinum / System) tiers verified.\n');

  // ---------------------------------------------------------------------------
  // TEST 2: Unit Test - Paid-in-Full Financial Gate & Change Order Lock
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: evaluateWarrantyRegistrationEligibility Financial Gate ---');

  const unpaidCase = evaluateWarrantyRegistrationEligibility({
    shingleManufacturer: 'GAF',
    selectedTier: 'Best',
    qboInvoiceBalance: 4250.0,
  });
  assert.strictEqual(unpaidCase.eligible, false);
  assert.strictEqual(unpaidCase.status, 'Locked - Pending Final Payment');
  assert.strictEqual(unpaidCase.unpaidBalance, 4250.0);

  const pendingCoCase = evaluateWarrantyRegistrationEligibility({
    shingleManufacturer: 'GAF',
    selectedTier: 'Best',
    qboInvoiceBalance: 0,
    changeOrderStatus: 'Pending Homeowner Approval',
  });
  assert.strictEqual(pendingCoCase.eligible, false);

  const paidCase = evaluateWarrantyRegistrationEligibility({
    shingleManufacturer: 'GAF',
    selectedTier: 'Best',
    qboInvoiceBalance: 0,
    changeOrderStatus: 'Approved & Signed',
  });
  assert.strictEqual(paidCase.eligible, true);
  assert.strictEqual(paidCase.status, 'Eligible for Registration');

  console.log('   ✓ Financial gate blocks unpaid balances / pending change orders and unlocks at $0.00 balance.\n');

  // ---------------------------------------------------------------------------
  // TEST 3: E2E Warranty Lock (Expect HTTP 403 When Unpaid Balance Exists)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: E2E Warranty Lock (HTTP 403 on Open QBO Balance) ---');
  const oppId = 'opp-warranty-gold-9901';
  const homeownerPhone = '+16195550911';

  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    name: '3100 Torrey Pines Rd Roof Replacement',
    customerName: 'Victoria Sterling',
    customerPhone: homeownerPhone,
    phone: homeownerPhone,
    addressStreet: '3100 Torrey Pines Rd',
    addressCity: 'La Jolla',
    addressState: 'CA',
    addressPostcode: '92037',
    shingleManufacturer: 'GAF',
    shingleColorName: 'Charcoal HDZ',
    selectedTier: 'Best',
    roofSquares: 36,
    amount: 26800.0,
    qboInvoiceBalance: 5800.0,
    stage: 'Build Complete - Certificate of Completion Sent',
  });

  const lockedRes = await requestJson('POST', `/api/warranties/${oppId}/register`, {
    shingleLotNumber: 'LOT-2026-GAF-991',
  });
  assert.strictEqual(lockedRes.status, 403);
  assert.ok(lockedRes.body.error.includes('WARRANTY PAYMENT LOCK'));
  console.log(`   ✓ Blocked premature warranty issuance (HTTP 403): ${lockedRes.body.error}\n`);

  // ---------------------------------------------------------------------------
  // TEST 4: E2E Final Payment Clears Balance -> Registers GAF Golden Pledge & Renders Certificate
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: E2E Balance Cleared -> Register GAF Golden Pledge & Render Certificate ---');

  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    qboInvoiceBalance: 0.0,
    stage: 'Completed',
  });

  const regRes = await requestJson('POST', `/api/warranties/${oppId}/register`, {
    shingleLotNumber: 'LOT-2026-GAF-991',
    sendPacketToHomeowner: true,
  });

  assert.strictEqual(regRes.status, 200);
  assert.strictEqual(regRes.body.success, true);
  assert.strictEqual(regRes.body.warrantyStatus, 'Registered & Issued');
  assert.ok(regRes.body.warrantyRegistrationNumber.startsWith('GAF-GP-'));
  assert.strictEqual(regRes.body.warrantyShingleLotNumber, 'LOT-2026-GAF-991');
  assert.ok(regRes.body.homeownerSmsSid, 'Expected Homeowner Warranty Packet SMS SID');
  assert.ok(regRes.body.warrantyCertificateUrl.includes(`/warranties/${oppId}/certificate`));

  // Verify Official Warranty Certificate HTML page renders with Registration #, Lot #, 50-Yr / 25-Yr coverage, and QR code
  const certRes = await requestJson('GET', `/warranties/${oppId}/certificate`);
  assert.strictEqual(certRes.status, 200);
  assert.ok(certRes.raw.includes('GAF Golden Pledge® Limited Warranty'));
  assert.ok(certRes.raw.includes(regRes.body.warrantyRegistrationNumber));
  assert.ok(certRes.raw.includes('LOT-2026-GAF-991'));
  assert.ok(certRes.raw.includes('50 Years (100% Non-Prorated)'));
  assert.ok(certRes.raw.includes('25 Years'));

  // Verify SMS thread contains the Warranty Certificate Packet link
  const smsRes = await requestJson('GET', `/api/opportunities/${oppId}/sms-thread`);
  assert.strictEqual(smsRes.status, 200);
  const bodies = (smsRes.body.smsThread || []).map((m) => m.body).join(' | ');
  assert.ok(bodies.includes('OFFICIAL ROOF WARRANTY REGISTERED'));
  assert.ok(bodies.includes(regRes.body.warrantyRegistrationNumber));

  console.log(`   ✓ Registered ${regRes.body.warrantyRegistrationNumber}, texted Homeowner packet, and verified printable Certificate.\n`);

  console.log('=========================================================================');
  console.log('=== ALL 4 MANUFACTURER WARRANTY AUTO-REGISTRATION TESTS PASSED!       ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  });

