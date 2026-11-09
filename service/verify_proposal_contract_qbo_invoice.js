/**
 * Verification Script: Automated QuickBooks Online (QBO) RCV Invoice Generation upon Proposal Signing
 * Tests:
 * 1. Direct unit test of createQuickBooksInvoice helper
 * 2. Full contract execution flow via POST /proposals/:id/sign:
 *    - Resolves/provisions QBO Customer ID
 *    - Generates QBO Invoice entity matching selected package, area (squares), and price
 *    - Persists qboInvoiceId ('8910') and qboInvoiceNumber ('INV-491029A') to Twenty CRM
 *    - Verifies stage updated to 'Contract Signed' and timeline event logged
 */

const http = require('http');
const { createQuickBooksInvoice } = require('./dist/qboClient');

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

async function runProposalInvoiceVerification() {
  console.log('================================================================================');
  console.log(' AUTOMATED QUICKBOOKS ONLINE INITIAL RCV INVOICE GENERATION VERIFICATION');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Direct Helper Function [createQuickBooksInvoice]
  // --------------------------------------------------------------------------
  console.log('TEST 1: Direct Helper Unit Test [createQuickBooksInvoice]');
  const helperResult = await createQuickBooksInvoice({
    customerId: '54',
    claimNumber: '491029A',
    jobAddress: '4120 Sunset Blvd, San Diego, CA 92101',
    tierTitle: 'Better - GAF Timberline HDZ',
    squares: 32,
    totalAmount: 20900.00,
    shingleColor: 'Charcoal',
  });

  console.log('   Result:', helperResult);
  if (helperResult.invoiceId !== '8910' || helperResult.docNumber !== 'INV-491029A') {
    throw new Error(`Unexpected helper result: ${JSON.stringify(helperResult)}`);
  }
  console.log('   ✓ Test 1 Passed: createQuickBooksInvoice correctly assembled and returned invoice.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Full Digital Contract Signing via POST /proposals/:id/sign
  // --------------------------------------------------------------------------
  console.log('TEST 2: Digital Proposal Signing & Automatic QBO Invoice Generation');
  const testOppId = 'opp-qbo-inv-proposal-sign-test';

  // Seed opportunity with customer and claim data
  const seedPayload = JSON.stringify({
    name: 'Robert Miller - 4120 Sunset Blvd',
    customerName: 'Robert Miller',
    customerEmail: 'robert.miller@example.com',
    customerPhone: '6195550100',
    addressStreet: '4120 Sunset Blvd',
    addressCity: 'San Diego',
    addressState: 'CA',
    addressPostcode: '92101',
    roofSquares: 32,
    totalClaimRcv: 20900,
    insuranceClaimNumber: '491029A',
    shingleColorName: 'Charcoal',
    stage: 'ESTIMATE_SENT',
  });

  const setupRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedPayload),
    },
  }, seedPayload);

  if (setupRes.status !== 200) {
    throw new Error(`Failed to seed test opportunity: ${JSON.stringify(setupRes.body)}`);
  }
  console.log('   ✓ Opportunity seeded with customer, address, and 32 SQ claim data.');

  // Submit digital signature to POST /proposals/:id/sign
  console.log('\n   Submitting digital signature to POST /proposals/:id/sign...');
  const signPayload = JSON.stringify({
    tier: 'Better - GAF Timberline HDZ',
    price: 20900.00,
    signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    shingleManufacturer: 'GAF',
    shingleColorName: 'Charcoal',
    shingleColorHex: '#26282a',
  });

  const signRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/proposals/${testOppId}/sign`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(signPayload),
    },
  }, signPayload);

  console.log('   POST /proposals/:id/sign status:', signRes.status);
  console.log('   Response payload:', signRes.body);

  if (signRes.status !== 200 || !signRes.body?.success) {
    throw new Error(`Contract signing failed: ${JSON.stringify(signRes.body)}`);
  }

  if (signRes.body.qboInvoiceId !== '8910') {
    throw new Error(`Expected qboInvoiceId '8910', got '${signRes.body.qboInvoiceId}'`);
  }

  if (signRes.body.qboInvoiceNumber !== 'INV-491029A') {
    throw new Error(`Expected qboInvoiceNumber 'INV-491029A', got '${signRes.body.qboInvoiceNumber}'`);
  }
  console.log('   ✓ Test 2 Passed: Contract executed and QBO Invoice #INV-491029A returned.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Inspect Updated Opportunity in Microservice / Twenty CRM
  // --------------------------------------------------------------------------
  console.log('TEST 3: Verifying Opportunity updated with stage, QBO customer, and QBO invoice metadata');
  const getOppRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  console.log('   GET /api/insurance/:id status:', getOppRes.status);
  const oppRecord = getOppRes.body?.claim;
  console.log('   Opportunity state:');
  console.log('     • Stage:', oppRecord?.stage);
  console.log('     • Contract Signed At:', oppRecord?.contractSignedAt);
  console.log('     • qboCustomerId:', oppRecord?.qboCustomerId);
  console.log('     • qboInvoiceId:', oppRecord?.qboInvoiceId);
  console.log('     • qboInvoiceNumber:', oppRecord?.qboInvoiceNumber);

  if (oppRecord?.stage !== 'Contract Signed') {
    throw new Error(`Expected stage 'Contract Signed', got '${oppRecord?.stage}'`);
  }

  if (oppRecord?.qboInvoiceId !== '8910') {
    throw new Error(`Expected Opportunity qboInvoiceId '8910', got '${oppRecord?.qboInvoiceId}'`);
  }

  if (oppRecord?.qboInvoiceNumber !== 'INV-491029A') {
    throw new Error(`Expected Opportunity qboInvoiceNumber 'INV-491029A', got '${oppRecord?.qboInvoiceNumber}'`);
  }

  if (!oppRecord?.qboCustomerId) {
    throw new Error('Expected qboCustomerId to be resolved and saved');
  }
  console.log('   ✓ Test 3 Passed: Opportunity verified with qboInvoiceId: 8910 and qboInvoiceNumber: INV-491029A.\n');

  console.log('================================================================================');
  console.log(' ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (3/3)');
  console.log('================================================================================');
}

runProposalInvoiceVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
