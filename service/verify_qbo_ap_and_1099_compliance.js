/**
 * Automated Verification Suite:
 * QuickBooks Online Accounts Payable (A/P) Bill Sync & 1099 Subcontractor Compliance Lock
 *
 * Tests:
 * 1. Unit verification of evaluateSubcontractor1099Compliance (Missing W-9, Expired COI, Valid W-9 + COI)
 * 2. Unit verification of findOrCreateQuickBooksVendor, resolveQboExpenseAccountForCategory, and createQuickBooksVendorBill
 * 3. E2E Supplier Material Bill (POST /api/financials/:id/record-vendor-bill -> QBO Vendor + QBO Bill + Job P&L CustomerRef)
 * 4. E2E 1099 Subcontractor Compliance Lock (POST /api/financials/:id/approve-labor-voucher -> 403 Forbidden when non-compliant)
 * 5. E2E Subcontractor Compliance Verification (POST /api/financials/:id/verify-subcontractor-compliance)
 * 6. E2E Labor Voucher Approval & QBO 1099 Bill Sync (POST /api/financials/:id/approve-labor-voucher -> 200 OK + QBO Bill + Margin Recalc)
 */

process.env.NODE_ENV = 'test';
const http = require('http');
const {
  findOrCreateQuickBooksVendor,
  createQuickBooksVendorBill,
  getQuickBooksBill,
  resolveQboExpenseAccountForCategory,
  evaluateSubcontractor1099Compliance,
} = require('./dist/index.js');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`   ✓ ${message}`);
}

async function runApAnd1099Verification() {
  console.log('=========================================================================');
  console.log('=== QBO ACCOUNTS PAYABLE (A/P) BILL & 1099 SUBCONTRACTOR VERIFICATION ===');
  console.log('=========================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Unit Tests for 1099 W-9 & COI Compliance Evaluator
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: evaluateSubcontractor1099Compliance Unit Matrix ---');

  const futureDate = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const pastDate = '2020-01-15';

  const caseNone = evaluateSubcontractor1099Compliance({});
  assert(!caseNone.compliant, `Blocks when W-9 and COI are missing (${caseNone.status})`);

  const caseMissingW9 = evaluateSubcontractor1099Compliance({
    subcontractorW9Status: 'Pending',
    subcontractorCoiExpirationDate: futureDate,
  });
  assert(
    !caseMissingW9.compliant && caseMissingW9.status === 'Blocked - Missing W-9',
    `Blocks when W-9 is Pending despite valid COI (${caseMissingW9.status})`
  );

  const caseExpiredCoi = evaluateSubcontractor1099Compliance({
    subcontractorW9Status: 'Verified',
    subcontractorCoiExpirationDate: pastDate,
  });
  assert(
    !caseExpiredCoi.compliant && caseExpiredCoi.status === 'Blocked - Expired/Missing COI',
    `Blocks when COI is expired despite Verified W-9 (${caseExpiredCoi.status})`
  );

  const caseCompliant = evaluateSubcontractor1099Compliance({
    subcontractorW9Status: 'Verified',
    subcontractorCoiExpirationDate: futureDate,
  });
  assert(
    caseCompliant.compliant && caseCompliant.status === 'Compliant',
    `Approves when W-9 is Verified and COI is active (${caseCompliant.daysUntilCoiExpiry} days remaining)`
  );

  // ---------------------------------------------------------------------------
  // TEST 2: QBO Vendor Deduplication & COGS Account Mapping
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: QBO Vendor Provisioning & COGS Account Mapping ---');

  const matAcct = resolveQboExpenseAccountForCategory('material');
  const labAcct = resolveQboExpenseAccountForCategory('labor');
  const dumpAcct = resolveQboExpenseAccountForCategory('dumpster');
  const permAcct = resolveQboExpenseAccountForCategory('permit');

  assert(matAcct.value === '60', `Material category maps to COGS Account #${matAcct.value} (${matAcct.name})`);
  assert(labAcct.value === '61', `Labor category maps to COGS Account #${labAcct.value} (${labAcct.name})`);
  assert(dumpAcct.value === '62', `Dumpster category maps to COGS Account #${dumpAcct.value} (${dumpAcct.name})`);
  assert(permAcct.value === '63', `Permit category maps to COGS Account #${permAcct.value} (${permAcct.name})`);

  const v1 = await findOrCreateQuickBooksVendor({
    displayName: 'ABC Supply Co. - Branch #0264',
    vendor1099: false,
  });
  const v2 = await findOrCreateQuickBooksVendor({
    displayName: 'ABC Supply Co. - Branch #0264',
    vendor1099: false,
  });
  assert(v1.vendorId === v2.vendorId, `Vendor lookup deduplicates existing supplier (ID: ${v1.vendorId})`);

  const unitBill = await createQuickBooksVendorBill({
    vendorId: v1.vendorId,
    vendorName: v1.displayName,
    customerId: '54',
    docNumber: 'ABC-UNIT-991',
    amount: 4850.0,
    category: 'material',
    jobReference: 'SF-99102',
  });
  const fetchedBill = await getQuickBooksBill(unitBill.billId);
  assert(
    fetchedBill && fetchedBill.TotalAmt === 4850.0,
    `QBO Bill #${unitBill.docNumber} (ID: ${unitBill.billId}) stored with CustomerRef #${fetchedBill.Line[0].AccountBasedExpenseLineDetail.CustomerRef.value}`
  );

  // ---------------------------------------------------------------------------
  // TEST 3: E2E Supplier Material Bill via POST /api/financials/:id/record-vendor-bill
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: E2E Supplier Material Bill & QBO A/P Sync ---');
  const testOppId = 'opp-qbo-ap-1099-test-01';

  await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/insurance/${testOppId}/claim`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      name: 'Henderson Hail Replacement',
      customerName: 'Marcus Henderson',
      qboCustomerId: '54',
      qboInvoiceId: '8910',
      insuranceClaimNumber: 'SF-77410-AP',
      totalClaimRcv: 24500.0,
      amount: 24500.0,
      roofSquares: 32,
      pitch: '8/12',
      layers: 1,
      assignedCrew: 'Ramirez Roofing Crew',
      crewLeadPhone: '+16195550199',
      dumpsterCost: 550.0,
      permitCost: 350.0,
      subcontractorW9Status: 'Pending',
      subcontractorCoiExpirationDate: pastDate,
      stage: 'Production / Post-Build',
    })
  );

  const abcBillPayload = JSON.stringify({
    vendorName: 'ABC Supply Co.',
    invoiceNumber: 'ABC-77410-M',
    billAmount: 7600.0,
    costCategory: 'material',
  });

  const abcBillRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/financials/${testOppId}/record-vendor-bill`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(abcBillPayload),
      },
    },
    abcBillPayload
  );

  assert(abcBillRes.status === 200 && abcBillRes.body?.success, 'POST /record-vendor-bill returned 200 OK');
  assert(Boolean(abcBillRes.body?.qboBillId), `Created QBO A/P Bill ID: ${abcBillRes.body?.qboBillId}`);
  assert(Boolean(abcBillRes.body?.qboVendorId), `Linked to QBO Vendor ID: ${abcBillRes.body?.qboVendorId}`);
  assert(
    abcBillRes.body?.qboExpenseAccount === 'Cost of Goods Sold - Roofing Materials',
    `Categorized under "${abcBillRes.body?.qboExpenseAccount}"`
  );

  // ---------------------------------------------------------------------------
  // TEST 4: E2E 1099 Subcontractor Compliance Lock (Expect HTTP 403)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: E2E 1099 Subcontractor Compliance Lock (Expect 403) ---');

  const blockedVoucherRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/financials/${testOppId}/approve-labor-voucher`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({})
  );

  assert(
    blockedVoucherRes.status === 403,
    `Blocked labor voucher payout when W-9 is Pending and COI is expired (HTTP ${blockedVoucherRes.status})`
  );
  console.log('   Lock Message:', blockedVoucherRes.body?.error);

  // Also verify direct labor bill via /record-vendor-bill is blocked when non-compliant
  const blockedLaborBillRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/financials/${testOppId}/record-vendor-bill`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      vendorName: 'Ramirez Roofing Crew',
      invoiceNumber: 'CREW-001',
      billAmount: 4000.0,
      costCategory: 'labor',
    })
  );
  assert(
    blockedLaborBillRes.status === 403,
    `Blocked direct labor bill on /record-vendor-bill while subcontractor is non-compliant (HTTP ${blockedLaborBillRes.status})`
  );

  // ---------------------------------------------------------------------------
  // TEST 5: E2E Subcontractor W-9 & COI Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: E2E Verify Subcontractor W-9 & Active COI ---');

  const verifyPayload = JSON.stringify({
    assignedCrew: 'Ramirez Roofing Crew',
    subcontractorW9Status: 'Verified',
    subcontractorTinLast4: '8842',
    subcontractorCoiExpirationDate: futureDate,
  });

  const verifyCompRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/financials/${testOppId}/verify-subcontractor-compliance`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(verifyPayload),
      },
    },
    verifyPayload
  );

  assert(verifyCompRes.status === 200 && verifyCompRes.body?.compliance?.compliant === true, 'Subcontractor compliance updated to Compliant');

  // ---------------------------------------------------------------------------
  // TEST 6: E2E Approve Crew Labor Voucher -> QBO 1099 Vendor + Bill + Job Margin Recalc
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: E2E Approve Labor Voucher & Sync 1099 Bill to QBO ---');

  const approveRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/financials/${testOppId}/approve-labor-voucher`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({})
  );

  assert(approveRes.status === 200 && approveRes.body?.success, 'POST /approve-labor-voucher returned 200 OK');
  // 32 SQ: Install ($75 * 32 = $2400) + Tear-Off 1 Layer ($35 * 32 = $1120) + Steep 8/12 ($15 * 32 = $480) = $4,000.00
  assert(
    approveRes.body?.laborTotal === 4000.0,
    `Calculated exact piece-rate labor payout for 32 SQ @ 8/12 pitch: $${approveRes.body?.laborTotal}`
  );
  assert(approveRes.body?.qboVendor1099 === true, 'Provisioned QBO Vendor with Vendor1099 = true');
  assert(Boolean(approveRes.body?.qboBillId), `Created QBO 1099 Labor Bill ID: ${approveRes.body?.qboBillId}`);
  assert(
    approveRes.body?.qboExpenseAccount === 'Cost of Goods Sold - Subcontractor Labor (1099)',
    `Mapped to "${approveRes.body?.qboExpenseAccount}"`
  );

  // Total Job Cost: $7,600 (Materials) + $4,000 (Labor) + $550 (Dumpster) + $350 (Permit) = $12,500
  // Gross Profit: $24,500 - $12,500 = $12,000 (48.98% Margin)
  assert(
    approveRes.body?.metrics?.totalJobCost === 12500.0,
    `Updated Total Hard Job Cost to $${approveRes.body?.metrics?.totalJobCost}`
  );
  assert(
    approveRes.body?.metrics?.grossProfit === 12000.0,
    `Recalculated Gross Profit to $${approveRes.body?.metrics?.grossProfit} (${approveRes.body?.metrics?.grossMarginPercent}% Margin)`
  );

  console.log('\n=========================================================================');
  console.log('=== ALL 6 TESTS PASSED: QBO A/P BILLS & 1099 COMPLIANCE OPERATIONAL   ===');
  console.log('=========================================================================');
}

runApAnd1099Verification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
  });

