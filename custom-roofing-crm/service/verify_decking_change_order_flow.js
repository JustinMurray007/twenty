const http = require('http');
const assert = require('assert');
const {
  parseCrewDeckingCommand,
  calculateDeckingChangeOrderPricing,
  appendChangeOrderLineToQuickBooksInvoice,
  seedSimulatedQuickBooksInvoice,
  getQuickBooksInvoice,
} = require('./server.js');

function requestHttp(method, path, body = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    let payload = null;
    if (body) {
      payload =
        contentType === 'application/x-www-form-urlencoded'
          ? new URLSearchParams(body).toString()
          : JSON.stringify(body);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path,
        method,
        headers: {
          'Content-Type': contentType,
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
  console.log('=== POST-TEAR-OFF ROTTED DECKING & FASCIA CHANGE ORDER VERIFICATION   ===');
  console.log('=========================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Crew SMS Command Parser & Pricing Matrix Unit Tests
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: parseCrewDeckingCommand & Pricing Matrix ---');

  const cmd1 = parseCrewDeckingCommand('WOOD 6');
  assert.strictEqual(cmd1.sheets, 6);
  assert.strictEqual(cmd1.fasciaLf, 0);

  const cmd2 = parseCrewDeckingCommand('OSB 4 FASCIA 20');
  assert.strictEqual(cmd2.sheets, 4);
  assert.strictEqual(cmd2.fasciaLf, 20);

  const cmd3 = parseCrewDeckingCommand('8 sheets plywood');
  assert.strictEqual(cmd3.sheets, 8);
  assert.strictEqual(cmd3.fasciaLf, 0);

  const cmd4 = parseCrewDeckingCommand('FASCIA 18');
  assert.strictEqual(cmd4.sheets, 0);
  assert.strictEqual(cmd4.fasciaLf, 18);

  const nonDecking = parseCrewDeckingCommand('ON SITE');
  assert.strictEqual(nonDecking, null);

  const pricing = calculateDeckingChangeOrderPricing({
    sheets: 6,
    fasciaLf: 20,
    includedFreeSheets: 2,
    ratePerSheet: 85,
    ratePerLf: 14,
  });
  // 6 discovered - 2 free = 4 billable sheets @ $85 ($340) + 20 LF fascia @ $14 ($280) = $620.00
  assert.strictEqual(pricing.billableSheets, 4);
  assert.strictEqual(pricing.deckingCustomerTotal, 340.0);
  assert.strictEqual(pricing.fasciaCustomerTotal, 280.0);
  assert.strictEqual(pricing.totalChangeOrderAmount, 620.0);
  // Crew labor adder: 6 * $35 ($210) + 20 * $5 ($100) = $310.00
  assert.strictEqual(pricing.crewLaborAdder, 310.0);
  // Material cost adder: 6 * $28 ($168) + 20 * $4 ($80) = $248.00
  assert.strictEqual(pricing.materialCostAdder, 248.0);
  console.log('   ✓ Crew SMS command parser & contract allowance pricing matrix verified.\n');

  // ---------------------------------------------------------------------------
  // TEST 2: QuickBooks Online Invoice Change Order Line Item Unit Test
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: appendChangeOrderLineToQuickBooksInvoice Unit Test ---');
  seedSimulatedQuickBooksInvoice({
    Id: '9601',
    DocNumber: 'INV-9601',
    TotalAmt: 18500.0,
    Balance: 9500.0,
    Line: [
      {
        Id: '1',
        DetailType: 'SalesItemLineDetail',
        Amount: 18500.0,
        Description: 'Base Roof Replacement Contract',
      },
    ],
  });

  const qboUpdate = await appendChangeOrderLineToQuickBooksInvoice({
    invoiceId: '9601',
    customerId: '77',
    description: 'Change Order #1: 4 Billable OSB Sheets + 20 LF Fascia',
    amount: 620.0,
  });

  assert.strictEqual(qboUpdate.newTotalAmt, 19120.0);
  assert.strictEqual(qboUpdate.newBalance, 10120.0);
  assert.strictEqual(qboUpdate.lineCount, 2);

  const fetchedInv = await getQuickBooksInvoice('9601');
  assert.strictEqual(fetchedInv.TotalAmt, 19120.0);
  assert.strictEqual(fetchedInv.Balance, 10120.0);
  console.log('   ✓ QBO Invoice #INV-9601 updated from $18,500.00 -> $19,120.00 with Change Order line item.\n');

  // ---------------------------------------------------------------------------
  // TEST 3: E2E Crew Texts "WOOD 6 FASCIA 20" with MMS Photo -> Sends Homeowner 1-Tap Link
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: E2E Crew SMS "WOOD 6 FASCIA 20" -> Homeowner 1-Tap Link Dispatch ---');
  const oppId = 'opp-decking-co-001';
  const homeownerPhone = '+16195550811';
  const crewPhone = '+16195550812';

  const seedRes = await requestHttp('PATCH', `/api/insurance/${oppId}/claim`, {
    name: '1420 Oceanfront Walk Roof Tear-Off',
    customerName: 'Daniel Craig',
    customerPhone: homeownerPhone,
    phone: homeownerPhone,
    assignedCrew: 'Mendoza Master Roofers',
    crewName: 'Mendoza Master Roofers',
    crewLeadPhone: crewPhone,
    crewLeaderPhone: crewPhone,
    addressStreet: '1420 Oceanfront Walk',
    addressCity: 'San Diego',
    addressState: 'CA',
    addressPostcode: '92109',
    stage: 'Production / In Progress',
    qboCustomerId: '88',
    qboInvoiceId: '9701',
    amount: 21500.0,
    totalClaimRcv: 21500.0,
    actualMaterialCost: 6800.0,
    actualLaborCost: 3400.0,
    dumpsterCost: 500.0,
    permitCost: 300.0,
    includedFreeDeckingSheets: 2,
    deckingRatePerSheet: 85.0,
    fasciaRatePerLf: 14.0,
  });
  assert.strictEqual(seedRes.status, 200);

  // Crew texts "WOOD 6 FASCIA 20" with a tear-off photo to /webhooks/twilio/inbound
  const crewSmsRes = await requestHttp(
    'POST',
    '/webhooks/twilio/inbound',
    {
      From: crewPhone,
      To: '+15551234567',
      Body: 'WOOD 6 FASCIA 20',
      NumMedia: '1',
      MediaUrl0: 'https://app.companycam.com/photos/rotted-osb-sheathing-01.jpg',
    },
    'application/x-www-form-urlencoded'
  );

  assert.strictEqual(crewSmsRes.status, 200);
  assert.ok(crewSmsRes.raw.includes('CHANGE ORDER LOGGED: 6 OSB sheet(s) &amp; 20 LF fascia') || crewSmsRes.raw.includes('CHANGE ORDER LOGGED: 6 OSB sheet(s)'));

  // Inspect Change Order status via GET /api/change-orders/:id
  const coStatusRes = await requestHttp('GET', `/api/change-orders/${oppId}`);
  assert.strictEqual(coStatusRes.status, 200);
  assert.strictEqual(coStatusRes.body.changeOrderStatus, 'Pending Homeowner Approval');
  assert.strictEqual(coStatusRes.body.pricing.sheets, 6);
  assert.strictEqual(coStatusRes.body.pricing.includedFreeSheets, 2);
  assert.strictEqual(coStatusRes.body.pricing.billableSheets, 4);
  assert.strictEqual(coStatusRes.body.pricing.fasciaLf, 20);
  assert.strictEqual(coStatusRes.body.pricing.totalChangeOrderAmount, 620.0);
  assert.ok(coStatusRes.body.approvalUrl.includes(`/change-orders/${oppId}/approve-view?token=`));
  assert.ok(coStatusRes.body.photoUrls.includes('https://app.companycam.com/photos/rotted-osb-sheathing-01.jpg'));

  // Verify 1-Tap Mobile Portal HTML page renders
  const portalViewRes = await requestHttp(
    'GET',
    `/change-orders/${oppId}/approve-view?token=${coStatusRes.body.changeOrderToken}`
  );
  assert.strictEqual(portalViewRes.status, 200);
  assert.ok(portalViewRes.raw.includes('Rotted Wood Decking Change Order'));
  assert.ok(portalViewRes.raw.includes('+$620.00'));
  assert.ok(portalViewRes.raw.includes('rotted-osb-sheathing-01.jpg'));

  console.log('   ✓ Crew SMS triggered Change Order (+$620.00), texted Homeowner 1-Tap Link, and rendered mobile approval portal.\n');

  // ---------------------------------------------------------------------------
  // TEST 4: E2E Homeowner 1-Tap Approval -> QBO Invoice + Job Costing + Crew Green-Light SMS
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: E2E Homeowner 1-Tap Approval -> QBO Invoice, Job Costing & Crew SMS ---');
  const approveRes = await requestHttp('POST', `/api/change-orders/${oppId}/approve`, {
    token: coStatusRes.body.changeOrderToken,
    signedBy: 'Daniel Craig',
    approvalMethod: '1-Tap Mobile Portal',
  });

  assert.strictEqual(approveRes.status, 200);
  assert.strictEqual(approveRes.body.success, true);
  assert.strictEqual(approveRes.body.changeOrderStatus, 'Approved & Signed');
  assert.strictEqual(approveRes.body.previousContractAmount, 21500.0);
  assert.strictEqual(approveRes.body.newContractAmount, 22120.0);
  assert.strictEqual(approveRes.body.laborAdder, 310.0);
  assert.strictEqual(approveRes.body.newLaborCost, 3710.0);
  assert.strictEqual(approveRes.body.materialAdder, 248.0);
  assert.strictEqual(approveRes.body.newMaterialCost, 7048.0);
  assert.strictEqual(approveRes.body.qboInvoice.newTotalAmt, 22120.0);
  assert.ok(approveRes.body.crewSmsSid, 'Expected Crew Lead green-light SMS SID');

  // Verify SMS thread contains both Homeowner request SMS and Crew approval green-light SMS
  const threadRes = await requestHttp('GET', `/api/opportunities/${oppId}/sms-thread`);
  assert.strictEqual(threadRes.status, 200);
  const threadBodies = (threadRes.body.smsThread || []).map((m) => m.body).join(' || ');
  assert.ok(threadBodies.includes('ROOF DECKING INSPECTION UPDATE'), 'Expected Homeowner Change Order SMS');
  assert.ok(threadBodies.includes('WOOD CHANGE ORDER APPROVED'), 'Expected Crew Lead Green-Light SMS');

  console.log('   ✓ Homeowner 1-Tap approval updated Contract ($21,500 -> $22,120), QBO Invoice, Crew Payout (+$310), and texted Crew Lead.\n');

  // ---------------------------------------------------------------------------
  // TEST 5: E2E Homeowner SMS Reply "APPROVE" Flow
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5: E2E Homeowner Replies "APPROVE" via SMS ---');
  const oppId2 = 'opp-decking-co-002';
  const homeownerPhone2 = '+16195550821';
  const crewPhone2 = '+16195550822';

  await requestHttp('PATCH', `/api/insurance/${oppId2}/claim`, {
    name: '550 Sunset Cliffs Blvd Tear-Off',
    customerName: 'Sarah Connor',
    customerPhone: homeownerPhone2,
    phone: homeownerPhone2,
    assignedCrew: 'Alpha Decking Crew',
    crewLeadPhone: crewPhone2,
    addressStreet: '550 Sunset Cliffs Blvd',
    addressCity: 'San Diego',
    addressState: 'CA',
    stage: 'Production / In Progress',
    amount: 16000.0,
    actualMaterialCost: 5000.0,
    actualLaborCost: 2800.0,
  });

  // Office / PM initiates request for 4 rotted OSB sheets @ $85 = $340
  const reqRes2 = await requestHttp('POST', `/api/change-orders/${oppId2}/request-decking`, {
    sheets: 4,
    fasciaLf: 0,
    ratePerSheet: 85,
  });
  assert.strictEqual(reqRes2.status, 200);
  assert.strictEqual(reqRes2.body.pricing.totalChangeOrderAmount, 340.0);

  // Homeowner texts back "APPROVE" to /webhooks/twilio/inbound
  const smsApproveRes = await requestHttp(
    'POST',
    '/webhooks/twilio/inbound',
    {
      From: homeownerPhone2,
      To: '+15551234567',
      Body: 'APPROVE',
      NumMedia: '0',
    },
    'application/x-www-form-urlencoded'
  );
  assert.strictEqual(smsApproveRes.status, 200);
  assert.ok(smsApproveRes.raw.includes('CHANGE ORDER APPROVED'));

  const finalCheck2 = await requestHttp('GET', `/api/change-orders/${oppId2}`);
  assert.strictEqual(finalCheck2.body.changeOrderStatus, 'Approved & Signed');
  console.log('   ✓ Homeowner "APPROVE" SMS reply automatically authorized Change Order and notified Crew.\n');

  console.log('=========================================================================');
  console.log('=== ALL 5 POST-TEAR-OFF CHANGE ORDER & DECKING TESTS PASSED!          ===');
  console.log('=========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  });
