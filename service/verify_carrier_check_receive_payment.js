/**
 * Verification Script: QuickBooks Online (QBO) ReceivePayment & Journal Entry Fallback
 * Tests:
 * 1. Direct unit verification of recordQuickBooksReceivePayment helper in server.js
 * 2. POST /api/insurance/:id/record-check dual-mode sync:
 *    - Mode A (Preferred): Opportunity has qboCustomerId & qboInvoiceId -> creates ReceivePayment linked to Invoice
 *    - Mode B (Graceful Fallback): Opportunity has NO qboInvoiceId -> posts balanced General Journal Entry
 */

const http = require('http');
const {
  recordQuickBooksReceivePayment,
  postQuickBooksDepreciationJournalEntry,
} = require('./dist/qboClient');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseBody ? JSON.parse(responseBody) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseBody,
          });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================================');
  console.log(' QUICKBOOKS ONLINE RECEIVEPAYMENT & INVOICE CLOSING AUTOMATION VERIFICATION');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Direct helper function test for recordQuickBooksReceivePayment
  // --------------------------------------------------------------------------
  console.log('TEST 1: Direct Helper Function [recordQuickBooksReceivePayment]');
  const helperResult = await recordQuickBooksReceivePayment({
    customerId: '1',
    invoiceId: '142',
    checkNumber: 'CHK-9812401',
    amount: 8700.00,
    memo: 'State Farm check applied to balance',
  });

  console.log('   Result:', helperResult);
  if (!helperResult.paymentId || helperResult.totalAmt !== 8700) {
    throw new Error(`Helper test failed: ${JSON.stringify(helperResult)}`);
  }
  console.log('   ✓ Test 1 Passed: recordQuickBooksReceivePayment helper operational.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Preferred Flow (Opportunity with qboCustomerId & qboInvoiceId)
  // --------------------------------------------------------------------------
  console.log('TEST 2: Preferred Flow - ReceivePayment linked to existing Invoice #142');
  const testOppIdWithInvoice = 'opp-qbo-inv-142-test';

  const seedPayloadA = JSON.stringify({
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: 'SF-49102-X',
    customerName: 'Robert Martinez',
    qboCustomerId: '1',
    qboInvoiceId: '142',
    rcvInitialAmount: 18500,
    acvInitialAmount: 11200,
    deductibleAmount: 1000,
    totalClaimRcv: 20900,
    depreciationAmount: 8700,
    depreciationStatus: 'COC Submitted',
    insuranceClaimStage: 'Build Complete - Certificate of Completion Sent',
    stage: 'INSPECTION_COMPLETE',
  });

  const setupResA = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppIdWithInvoice}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedPayloadA),
    },
  }, seedPayloadA);

  if (setupResA.status !== 200) {
    throw new Error(`Failed to seed test opp A: ${JSON.stringify(setupResA.body)}`);
  }
  console.log('   ✓ Opportunity seeded with qboCustomerId: "1", qboInvoiceId: "142".');

  // Submit check intake via POST /api/insurance/:id/record-check
  const checkPayloadA = JSON.stringify({
    checkNumber: 'CHK-9812401',
    checkAmount: 8700.00,
    notes: 'State Farm check applied to balance',
  });

  const checkResA = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppIdWithInvoice}/record-check`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(checkPayloadA),
    },
  }, checkPayloadA);

  console.log('   POST /api/insurance/:id/record-check status:', checkResA.status);
  console.log('   Response:', checkResA.body);

  if (checkResA.status !== 200 || !checkResA.body?.success) {
    throw new Error(`Check intake failed: ${JSON.stringify(checkResA.body)}`);
  }

  if (checkResA.body.mode !== 'ReceivePayment') {
    throw new Error(`Expected mode 'ReceivePayment', got '${checkResA.body.mode}'`);
  }

  if (!checkResA.body.qboPaymentId) {
    throw new Error('Expected qboPaymentId in response');
  }

  // Verify updated opportunity record
  const getResA = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppIdWithInvoice}`,
    method: 'GET',
  });

  const oppA = getResA.body?.claim;
  console.log('   Verified Opportunity state:');
  console.log('     • qboPaymentId:', oppA?.qboPaymentId);
  console.log('     • depreciationStatus:', oppA?.depreciationStatus);
  console.log('     • insuranceClaimStage:', oppA?.insuranceClaimStage);
  console.log('     • stage:', oppA?.stage);
  console.log('     • carrierCheckNumber:', oppA?.carrierCheckNumber);
  console.log('     • carrierCheckAmount:', oppA?.carrierCheckAmount);

  if (oppA?.qboPaymentId !== checkResA.body.qboPaymentId) {
    throw new Error(`Opportunity qboPaymentId mismatch: expected ${checkResA.body.qboPaymentId}, got ${oppA?.qboPaymentId}`);
  }
  if (oppA?.depreciationStatus !== 'Released / Paid') {
    throw new Error(`Expected depreciationStatus 'Released / Paid', got '${oppA?.depreciationStatus}'`);
  }
  if (oppA?.stage !== 'Completed') {
    throw new Error(`Expected stage 'Completed', got '${oppA?.stage}'`);
  }
  console.log('   ✓ Test 2 Passed: Preferred ReceivePayment flow executed and recorded.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Fallback Flow (Opportunity with NO qboInvoiceId)
  // --------------------------------------------------------------------------
  console.log('TEST 3: Fallback Flow - Balanced Journal Entry when no QBO Invoice exists');
  const testOppIdFallback = 'opp-qbo-fallback-no-inv';

  const seedPayloadB = JSON.stringify({
    insuranceCarrier: 'Allstate',
    insuranceClaimNumber: 'ALL-55910',
    customerName: 'Jennifer Walsh',
    qboCustomerId: null,
    qboInvoiceId: null,
    rcvInitialAmount: 16000,
    acvInitialAmount: 10000,
    deductibleAmount: 1000,
    totalClaimRcv: 16000,
    depreciationAmount: 5000,
    depreciationStatus: 'COC Submitted',
    insuranceClaimStage: 'Build Complete - Certificate of Completion Sent',
    stage: 'INSPECTION_COMPLETE',
  });

  const setupResB = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppIdFallback}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedPayloadB),
    },
  }, seedPayloadB);

  if (setupResB.status !== 200) {
    throw new Error(`Failed to seed test opp B: ${JSON.stringify(setupResB.body)}`);
  }
  console.log('   ✓ Opportunity seeded with NO qboInvoiceId (Triggering Journal Entry Fallback).');

  const checkPayloadB = JSON.stringify({
    checkNumber: 'CHK-449102',
    checkAmount: 5000.00,
    notes: 'Depreciation settlement without preliminary invoice',
  });

  const checkResB = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppIdFallback}/record-check`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(checkPayloadB),
    },
  }, checkPayloadB);

  console.log('   POST /api/insurance/:id/record-check status:', checkResB.status);
  console.log('   Response:', checkResB.body);

  if (checkResB.status !== 200 || !checkResB.body?.success) {
    throw new Error(`Fallback check intake failed: ${JSON.stringify(checkResB.body)}`);
  }

  if (checkResB.body.mode !== 'JournalEntry') {
    throw new Error(`Expected mode 'JournalEntry', got '${checkResB.body.mode}'`);
  }

  if (!checkResB.body.qboJournalEntryId) {
    throw new Error('Expected qboJournalEntryId in fallback response');
  }

  const getResB = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppIdFallback}`,
    method: 'GET',
  });

  const oppB = getResB.body?.claim;
  console.log('   Verified Opportunity state:');
  console.log('     • qboJournalEntryId:', oppB?.qboJournalEntryId);
  console.log('     • depreciationStatus:', oppB?.depreciationStatus);
  console.log('     • insuranceClaimStage:', oppB?.insuranceClaimStage);
  console.log('     • stage:', oppB?.stage);

  if (oppB?.qboJournalEntryId !== checkResB.body.qboJournalEntryId) {
    throw new Error(`Opportunity qboJournalEntryId mismatch: expected ${checkResB.body.qboJournalEntryId}, got ${oppB?.qboJournalEntryId}`);
  }
  if (oppB?.depreciationStatus !== 'Released / Paid') {
    throw new Error(`Expected depreciationStatus 'Released / Paid', got '${oppB?.depreciationStatus}'`);
  }
  console.log('   ✓ Test 3 Passed: Journal Entry fallback gracefully handled.\n');

  console.log('================================================================================');
  console.log(' ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (3/3)');
  console.log('================================================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
