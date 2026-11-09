/**
 * Automated Verification Script for QuickBooks Online (QBO) Two-Way Webhook Sync
 * Tests:
 * 1. HMAC-SHA256 signature verification and tampering rejection
 * 2. QBO Payment & Invoice entity retrieval (with LinkedTxn inspection)
 * 3. End-to-end full invoice settlement (Balance = $0.00) -> Stage: Completed, Depreciation: Released/Paid
 * 4. End-to-end partial offline payment (Balance > $0.00) -> Stage: Deposit Received / Scheduling
 * 5. Rejection of unauthenticated webhooks (HTTP 401)
 */

const http = require('http');
const crypto = require('crypto');
const {
  verifyQuickBooksWebhook,
  getQuickBooksPayment,
  getQuickBooksInvoice,
  seedSimulatedQuickBooksPayment,
  seedSimulatedQuickBooksInvoice,
} = require('./dist/qboClient.js');

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

async function runTwoWayWebhookVerification() {
  console.log('======================================================================');
  console.log('=== QUICKBOOKS TWO-WAY WEBHOOK & CRM SYNCHRONIZATION SUITE        ===');
  console.log('======================================================================\n');

  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN || 'your_intuit_webhook_verifier_token';

  // TEST 1: Direct Unit Test of HMAC-SHA256 Signature Verification
  console.log('--- TEST 1: verifyQuickBooksWebhook HMAC-SHA256 Verification ---');
  const testPayload = JSON.stringify({ test: 'quickbooks_webhook_payload_123' });
  const validSignature = crypto
    .createHmac('sha256', verifierToken)
    .update(testPayload)
    .digest('base64');

  const isValid = verifyQuickBooksWebhook(testPayload, validSignature);
  const isInvalid = verifyQuickBooksWebhook(testPayload, 'tampered_signature_xyz');

  console.log('   Valid signature check result:', isValid);
  console.log('   Tampered signature check result:', isInvalid);

  if (!isValid || isInvalid) {
    throw new Error('HMAC verification unit test failed.');
  }
  console.log('   [✓ PASS] Signature verification correctly authenticates valid payloads and rejects tampering.\n');

  // TEST 2: Direct Unit Test of Payment & Invoice Fetchers
  console.log('--- TEST 2: QBO Payment and Invoice Entity Fetchers ---');
  seedSimulatedQuickBooksPayment({
    Id: '5022',
    TotalAmt: 8700.0,
    PaymentRefNum: 'MANUAL-CHK-1002',
    Line: [
      {
        Amount: 8700.0,
        LinkedTxn: [
          {
            TxnId: '8492',
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  });

  seedSimulatedQuickBooksInvoice({
    Id: '8492',
    DocNumber: 'INV-8492',
    TotalAmt: 20900.0,
    Balance: 0.0,
  });

  const fetchedPayment = await getQuickBooksPayment('5022');
  const fetchedInvoice = await getQuickBooksInvoice('8492');

  console.log('   Payment #5022 TotalAmt:', fetchedPayment.TotalAmt, '| RefNum:', fetchedPayment.PaymentRefNum);
  console.log('   Invoice #8492 TotalAmt:', fetchedInvoice.TotalAmt, '| Balance:', fetchedInvoice.Balance);

  if (fetchedPayment.TotalAmt !== 8700.0 || fetchedPayment.PaymentRefNum !== 'MANUAL-CHK-1002') {
    throw new Error('Payment fetcher returned unexpected fields.');
  }
  if (fetchedInvoice.Balance !== 0.0) {
    throw new Error('Invoice fetcher returned unexpected balance.');
  }
  console.log('   [✓ PASS] Intuit entity lookup functions accurately extract payment lines and invoice balances.\n');

  // TEST 3: Full Settlement Webhook -> Project Paid In Full (Balance = $0.00)
  const fullOppId = 'opp-qbo-webhook-full-8492';
  console.log(`--- TEST 3: Full Settlement Webhook (Opportunity ${fullOppId}) ---`);

  // Seed Opportunity with open invoice
  const oppSeed = JSON.stringify({
    customerName: 'Arthur Dent',
    customerEmail: 'adent@example.com',
    customerPhone: '+16195550177',
    phone: '+16195550177',
    addressStreet: '42 Galaxy Way',
    addressCity: 'Islington',
    insuranceCarrier: 'Allstate',
    insuranceClaimNumber: 'ALL-8492-CLAIM',
    totalClaimRcv: 20900.0,
    acvInitialAmount: 11200.0,
    depreciationAmount: 8700.0,
    depositStatus: 'Paid',
    depositAmountPaid: 1000.0,
    qboCustomerId: '54',
    qboInvoiceId: '8492',
    qboInvoiceNumber: 'INV-8492',
    stage: 'Build Complete - Awaiting Depreciation Check',
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${fullOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(oppSeed),
    },
  }, oppSeed);

  // Send Intuit Webhook Notification for Payment 5022
  const fullWebhookBody = JSON.stringify({
    eventNotifications: [
      {
        realmId: '4620816365338123450',
        dataChangeEvent: {
          entities: [
            {
              name: 'Payment',
              id: '5022',
              operation: 'Create',
              lastUpdated: new Date().toISOString(),
            },
          ],
        },
      },
    ],
  });

  const fullSig = crypto
    .createHmac('sha256', verifierToken)
    .update(fullWebhookBody)
    .digest('base64');

  const webhookRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/quickbooks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(fullWebhookBody),
      'intuit-signature': fullSig,
    },
  }, fullWebhookBody);

  console.log('   Webhook HTTP status:', webhookRes.status, '| Response:', webhookRes.raw);
  if (webhookRes.status !== 200) {
    throw new Error(`Expected HTTP 200 from QBO Webhook, got ${webhookRes.status}`);
  }

  await new Promise((r) => setTimeout(r, 200));

  // Inspect Opportunity State
  const fullVerifyRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${fullOppId}`,
    method: 'GET',
  });

  const fullClaim = fullVerifyRes.body?.claim || {};
  console.log('   - stage:', fullClaim.stage);
  console.log('   - depreciationStatus:', fullClaim.depreciationStatus);
  console.log('   - carrierCheckNumber:', fullClaim.carrierCheckNumber);
  console.log('   - carrierCheckAmount:', fullClaim.carrierCheckAmount);
  console.log('   - finalBalanceDue:', fullClaim.finalBalanceDue);

  if (fullClaim.stage !== 'Completed') {
    throw new Error(`Expected stage === 'Completed', got '${fullClaim.stage}'`);
  }
  if (fullClaim.depreciationStatus !== 'Released / Paid') {
    throw new Error(`Expected depreciationStatus === 'Released / Paid', got '${fullClaim.depreciationStatus}'`);
  }
  if (fullClaim.carrierCheckNumber !== 'MANUAL-CHK-1002') {
    throw new Error(`Expected carrierCheckNumber === 'MANUAL-CHK-1002', got '${fullClaim.carrierCheckNumber}'`);
  }
  if (fullClaim.carrierCheckAmount !== 8700) {
    throw new Error(`Expected carrierCheckAmount === 8700, got ${fullClaim.carrierCheckAmount}`);
  }
  if (fullClaim.finalBalanceDue !== 0) {
    throw new Error(`Expected finalBalanceDue === 0, got ${fullClaim.finalBalanceDue}`);
  }
  console.log('   [✓ PASS] Full invoice closure verified: Stage is Completed, Depreciation is Released/Paid, Balance is $0.00.\n');

  // TEST 4: Partial Payment Webhook (Offline Deposit Received) -> Stage: Deposit Received / Scheduling
  const partialOppId = 'opp-qbo-webhook-partial-8493';
  console.log(`--- TEST 4: Partial Deposit Webhook (Opportunity ${partialOppId}) ---`);

  seedSimulatedQuickBooksPayment({
    Id: '5023',
    TotalAmt: 1000.0,
    PaymentRefNum: 'OFFLINE-CHECK-441',
    Line: [
      {
        Amount: 1000.0,
        LinkedTxn: [
          {
            TxnId: '8493',
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  });

  seedSimulatedQuickBooksInvoice({
    Id: '8493',
    DocNumber: 'INV-8493',
    TotalAmt: 20900.0,
    Balance: 19900.0, // Partial balance remains
  });

  const partialSeed = JSON.stringify({
    customerName: 'Ford Prefect',
    customerEmail: 'fprefect@example.com',
    customerPhone: '+16195550166',
    phone: '+16195550166',
    addressStreet: '101 Betelgeuse Way',
    addressCity: 'London',
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: 'SF-8493-CLAIM',
    totalClaimRcv: 20900.0,
    acvInitialAmount: 11200.0,
    depreciationAmount: 8700.0,
    depositStatus: 'Unpaid',
    depositAmountPaid: 0,
    qboCustomerId: '55',
    qboInvoiceId: '8493',
    qboInvoiceNumber: 'INV-8493',
    stage: 'Contract Signed - Awaiting Deposit',
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${partialOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(partialSeed),
    },
  }, partialSeed);

  const partialWebhookBody = JSON.stringify({
    eventNotifications: [
      {
        realmId: '4620816365338123450',
        dataChangeEvent: {
          entities: [
            {
              name: 'Payment',
              id: '5023',
              operation: 'Create',
              lastUpdated: new Date().toISOString(),
            },
          ],
        },
      },
    ],
  });

  const partialSig = crypto
    .createHmac('sha256', verifierToken)
    .update(partialWebhookBody)
    .digest('base64');

  const partialRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/quickbooks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(partialWebhookBody),
      'intuit-signature': partialSig,
    },
  }, partialWebhookBody);

  console.log('   Partial Webhook HTTP status:', partialRes.status);
  if (partialRes.status !== 200) {
    throw new Error(`Expected HTTP 200 from QBO Webhook, got ${partialRes.status}`);
  }

  await new Promise((r) => setTimeout(r, 200));

  const partialVerifyRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${partialOppId}`,
    method: 'GET',
  });

  const partialClaim = partialVerifyRes.body?.claim || {};
  console.log('   - depositStatus:', partialClaim.depositStatus);
  console.log('   - depositAmountPaid:', partialClaim.depositAmountPaid);
  console.log('   - stage:', partialClaim.stage);
  console.log('   - finalBalanceDue:', partialClaim.finalBalanceDue);

  if (partialClaim.depositStatus !== 'Paid') {
    throw new Error(`Expected depositStatus === 'Paid', got '${partialClaim.depositStatus}'`);
  }
  if (partialClaim.depositAmountPaid !== 1000) {
    throw new Error(`Expected depositAmountPaid === 1000, got ${partialClaim.depositAmountPaid}`);
  }
  if (partialClaim.stage !== 'Deposit Received / Scheduling') {
    throw new Error(`Expected stage === 'Deposit Received / Scheduling', got '${partialClaim.stage}'`);
  }
  if (partialClaim.finalBalanceDue !== 19900) {
    throw new Error(`Expected finalBalanceDue === 19900, got ${partialClaim.finalBalanceDue}`);
  }
  console.log('   [✓ PASS] Partial payment correctly updated depositStatus to Paid and advanced stage to Scheduling.\n');

  // TEST 5: Unauthorized Signature Rejection
  console.log('--- TEST 5: Unauthorized Signature Rejection ---');
  const forgedRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/quickbooks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(fullWebhookBody),
      'intuit-signature': 'forged_unauthorized_signature',
    },
  }, fullWebhookBody);

  console.log('   Forged request HTTP status:', forgedRes.status);
  if (forgedRes.status !== 401) {
    throw new Error(`Expected HTTP 401 for forged signature, got ${forgedRes.status}`);
  }
  console.log('   [✓ PASS] Webhook endpoint strictly enforces HMAC-SHA256 authentication.\n');

  console.log('======================================================================');
  console.log('=== ALL QUICKBOOKS TWO-WAY WEBHOOK CHECKS PASSED (5/5)             ===');
  console.log('======================================================================');
}

runTwoWayWebhookVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n[FATAL VERIFICATION ERROR]:', err);
    process.exit(1);
  });
