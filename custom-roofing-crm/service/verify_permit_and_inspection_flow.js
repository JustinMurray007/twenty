const http = require('http');
const assert = require('assert');
const { evaluatePermitInspectionCompliance } = require('./server.js');

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
  console.log('=== MUNICIPAL ROOF PERMIT & CITY INSPECTION TRACKER VERIFICATION      ===');
  console.log('=========================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Unit Test - evaluatePermitInspectionCompliance Lifecycle Matrix
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: evaluatePermitInspectionCompliance Unit Matrix ---');

  const unapplied = evaluatePermitInspectionCompliance({});
  assert.strictEqual(unapplied.permitIssued, false);
  assert.strictEqual(unapplied.readyForCloseout, false);

  const issuedOnly = evaluatePermitInspectionCompliance({
    permitNumber: 'PRMT-SD-2026-1001',
    permitStatus: 'Permit Issued',
    midRoofInspectionStatus: 'Pending',
  });
  assert.strictEqual(issuedOnly.permitIssued, true);
  assert.strictEqual(issuedOnly.midRoofCleared, false);
  assert.strictEqual(issuedOnly.readyForCloseout, false);

  const midPassed = evaluatePermitInspectionCompliance({
    permitNumber: 'PRMT-SD-2026-1001',
    permitStatus: 'Mid-Roof Passed',
    midRoofInspectionStatus: 'Passed',
    finalInspectionStatus: 'Pending',
  });
  assert.strictEqual(midPassed.permitIssued, true);
  assert.strictEqual(midPassed.midRoofCleared, true);
  assert.strictEqual(midPassed.finalInspectionPassed, false);
  assert.strictEqual(midPassed.readyForCloseout, false);

  const allPassed = evaluatePermitInspectionCompliance({
    permitNumber: 'PRMT-SD-2026-1001',
    permitStatus: 'Final Inspection Passed - Permit Closed',
    midRoofInspectionStatus: 'Passed',
    finalInspectionStatus: 'Passed',
  });
  assert.strictEqual(allPassed.readyForCloseout, true);
  console.log('   ✓ Permit issuance, Mid-Roof Nailing gate, and Final Sign-Off compliance matrix verified.\n');

  // ---------------------------------------------------------------------------
  // TEST 2: E2E Permit Issuance -> QBO A/P Permit Fee Bill & Printable Card
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: E2E Issue Municipal Permit -> QBO A/P Bill & Job-Site Card ---');
  const oppId = 'opp-permit-sd-2026-01';
  const homeownerPhone = '+16195550711';
  const crewPhone = '+16195550712';

  await requestJson('PATCH', `/api/insurance/${oppId}/claim`, {
    name: '4820 Kensington Dr Roof Replacement',
    customerName: 'Arthur Pendelton',
    customerPhone: homeownerPhone,
    phone: homeownerPhone,
    assignedCrew: 'Pacific Crest Roofers',
    crewLeadPhone: crewPhone,
    addressStreet: '4820 Kensington Dr',
    addressCity: 'San Diego',
    addressState: 'CA',
    addressPostcode: '92116',
    roofSquares: 30,
    amount: 22000.0,
    actualMaterialCost: 7000.0,
    actualLaborCost: 3500.0,
    dumpsterCost: 500.0,
    permitCost: 0.0,
    qboCustomerId: '64',
    stage: 'Production / Scheduled',
  });

  const issueRes = await requestJson('POST', `/api/permits/${oppId}/issue`, {
    permitJurisdiction: 'City of San Diego Development Services Dept.',
    permitNumber: 'PRMT-SD-2026-88412',
    permitFeeAmount: 385.0,
  });

  assert.strictEqual(issueRes.status, 200);
  assert.strictEqual(issueRes.body.success, true);
  assert.strictEqual(issueRes.body.permitNumber, 'PRMT-SD-2026-88412');
  assert.strictEqual(issueRes.body.permitFeeAmount, 385.0);
  assert.ok(issueRes.body.qboBillId, 'Expected QBO A/P Bill ID for permit fee');
  assert.strictEqual(
    issueRes.body.qboExpenseAccount,
    'Cost of Goods Sold - Municipal Permits & Inspections'
  );
  // Total Job Cost: 7000 material + 3500 labor + 500 dumpster + 385 permit = 11385
  assert.strictEqual(issueRes.body.metrics.totalJobCost, 11385.0);
  assert.ok(issueRes.body.crewSmsSid, 'Expected Crew Lead Permit Card SMS SID');

  // Verify Printable Job-Site Building Permit Card HTML renders
  const cardRes = await requestJson('GET', `/permits/${oppId}/card`);
  assert.strictEqual(cardRes.status, 200);
  assert.ok(cardRes.raw.includes('JOB-SITE BUILDING PERMIT RECORD'));
  assert.ok(cardRes.raw.includes('PRMT-SD-2026-88412'));
  assert.ok(cardRes.raw.includes('4820 Kensington Dr'));

  console.log('   ✓ Issued Permit #PRMT-SD-2026-88412 ($385.00), synced QBO COGS Account #63 Bill, and verified Job-Site Permit Card.\n');

  // ---------------------------------------------------------------------------
  // TEST 3: E2E Mid-Roof Inspection Gate (Blocks Final Inspection Before Mid-Roof Passes)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: E2E Mid-Roof Inspection Gate (Expect HTTP 403 on Premature Final) ---');

  const prematureFinal = await requestJson('POST', `/api/permits/${oppId}/schedule-inspection`, {
    inspectionType: 'final',
    scheduledAt: '2026-11-15T16:00:00.000Z',
  });
  assert.strictEqual(prematureFinal.status, 403);
  assert.ok(prematureFinal.body.error.includes('MID-ROOF INSPECTION GATE'));
  console.log(`   ✓ Blocked premature Final Inspection (HTTP 403): ${prematureFinal.body.error}\n`);

  // ---------------------------------------------------------------------------
  // TEST 4: E2E Schedule & Pass Mid-Roof Decking Nailing Inspection
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: E2E Schedule & Pass Mid-Roof Decking Nailing Inspection ---');

  const schedMidRes = await requestJson('POST', `/api/permits/${oppId}/schedule-inspection`, {
    inspectionType: 'mid-roof',
    scheduledAt: '2026-11-12T15:00:00.000Z',
    inspectorName: 'Inspector R. Vance (City of SD)',
  });
  assert.strictEqual(schedMidRes.status, 200);
  assert.strictEqual(schedMidRes.body.permitStatus, 'Mid-Roof Inspection Scheduled');

  const passMidRes = await requestJson('POST', `/api/permits/${oppId}/record-inspection-result`, {
    inspectionType: 'mid-roof',
    result: 'Passed',
    inspectorName: 'Inspector R. Vance (City of SD)',
    notes: '6-inch perimeter nail pattern verified on all OSB sheathing.',
  });
  assert.strictEqual(passMidRes.status, 200);
  assert.strictEqual(passMidRes.body.permitStatus, 'Mid-Roof Passed');
  assert.strictEqual(passMidRes.body.compliance.midRoofCleared, true);
  assert.ok(passMidRes.body.crewSmsSid, 'Expected Crew Lead Mid-Roof Passed SMS');
  console.log('   ✓ Mid-Roof Decking Nailing Inspection Passed & Crew cleared to install shingles.\n');

  // ---------------------------------------------------------------------------
  // TEST 5: E2E Schedule & Pass Final Municipal Building Inspection -> Permit Closed
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5: E2E Schedule & Pass Final Municipal Building Inspection ---');

  const schedFinalRes = await requestJson('POST', `/api/permits/${oppId}/schedule-inspection`, {
    inspectionType: 'final',
    scheduledAt: '2026-11-14T17:00:00.000Z',
    inspectorName: 'Inspector R. Vance (City of SD)',
  });
  assert.strictEqual(schedFinalRes.status, 200);
  assert.strictEqual(schedFinalRes.body.permitStatus, 'Final Inspection Scheduled');

  const passFinalRes = await requestJson('POST', `/api/permits/${oppId}/record-inspection-result`, {
    inspectionType: 'final',
    result: 'Passed',
    inspectorName: 'Inspector R. Vance (City of SD)',
    notes: 'Ridge vent, step flashing, drip edge, and Class A fire rating signed off.',
  });
  assert.strictEqual(passFinalRes.status, 200);
  assert.strictEqual(passFinalRes.body.permitStatus, 'Final Inspection Passed - Permit Closed');
  assert.strictEqual(passFinalRes.body.compliance.readyForCloseout, true);
  assert.ok(passFinalRes.body.homeownerSmsSid, 'Expected Homeowner Final Inspection Passed SMS');
  assert.ok(passFinalRes.body.crewSmsSid, 'Expected Crew Lead Final Inspection Passed SMS');

  console.log('   ✓ Final Building Inspection Passed, Permit Closed, and Homeowner + Crew notified via SMS.\n');

  console.log('=========================================================================');
  console.log('=== ALL 5 MUNICIPAL ROOF PERMIT & CITY INSPECTION TESTS PASSED!       ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  });

