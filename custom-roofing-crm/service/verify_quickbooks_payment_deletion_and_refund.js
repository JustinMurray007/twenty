/**
 * Automated Verification Script for QuickBooks Online (QBO) Payment Deletion, Void, and Refund Reversion
 * Tests:
 * 1. HMAC-SHA256 signature verification & RefundReceipt entity retrieval
 * 2. Direct unit test of revertOpportunityPaymentInTwenty for final check, deposit, and generic payments
 * 3. End-to-end webhook processing for Payment Delete operation (reverts Completed Opportunity to Production / Post-Build)
 * 4. End-to-end webhook processing for Payment Void operation (reverts deposit to Unpaid and Contract Signed)
 * 5. End-to-end webhook processing for RefundReceipt Create operation (shifts stage to Payment Issue / Balance Due)
 * 6. Security verification: Rejection of tampered webhook signatures (HTTP 401)
 */

const http = require('http');
const crypto = require('crypto');
const {
  verifyQuickBooksWebhook,
  getQuickBooksPayment,
  getQuickBooksInvoice,
  getQuickBooksRefundReceipt,
  seedSimulatedQuickBooksPayment,
  seedSimulatedQuickBooksInvoice,
  seedSimulatedQuickBooksRefundReceipt,
} = require('./dist/qboClient.js');

process.env.NODE_ENV = 'test';
const { revertOpportunityPaymentInTwenty } = require('./dist/index.js');

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

async function runPaymentDeletionAndRefundVerification() {
  console.log('======================================================================');
  console.log('=== QUICKBOOKS PAYMENT DELETION, VOID & REFUND REVERSION SUITE    ===');
  console.log('======================================================================\n');

  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN || 'your_intuit_webhook_verifier_token';

  // TEST 1: HMAC Verification and RefundReceipt Retrieval
  console.log('--- TEST 1: HMAC-SHA256 & RefundReceipt Entity Lookup ---');
  const payloadTest = JSON.stringify({ event: 'test_refund_event' });
  const testSig = crypto.createHmac('sha256', verifierToken).update(payloadTest).digest('base64');

  const isValidSig = verifyQuickBooksWebhook(payloadTest, testSig);
  const isInvalidSig = verifyQuickBooksWebhook(payloadTest, 'tampered_token_base64');

  if (!isValidSig || isInvalidSig) {
    throw new Error('HMAC signature verification failed.');
  }

  seedSimulatedQuickBooksRefundReceipt({
    Id: 'REF-901',
    DocNumber: 'REF-901',
    TotalAmt: 1250.0,
    CustomerRef: {
      value: '54',
      name: 'Arthur Dent',
    },
    PaymentMethodRef: {
      name: 'Credit Card',
    },
  });

  const fetchedRefund = await getQuickBooksRefundReceipt('REF-901');
  console.log('   Fetched Refund Receipt ID:', fetchedRefund.Id, '| Amount: $' + fetchedRefund.TotalAmt, '| Customer:', fetchedRefund.CustomerRef?.name);

  if (fetchedRefund.TotalAmt !== 1250.0 || fetchedRefund.CustomerRef?.value !== '54') {
    throw new Error('RefundReceipt fetcher returned unexpected fields.');
  }
  console.log('   [✓ PASS] HMAC verification and RefundReceipt lookup succeeded.\n');

  // TEST 2: Unit Test of revertOpportunityPaymentInTwenty
  console.log('--- TEST 2: Direct Unit Test of revertOpportunityPaymentInTwenty ---');
  
  // Case A: Final Check Reversion
  const finalCheckOpp = {
    id: 'opp-unit-final-check',
    name: 'Dent Roof Replacement',
    insuranceClaimNumber: 'CLM-991',
    stage: 'Completed',
    insuranceClaimStage: 'Depreciation Released - Closed',
    depreciationStatus: 'Released / Paid',
    carrierCheckNumber: 'CHK-5022',
    carrierCheckAmount: 8700,
    carrierCheckReceivedAt: new Date().toISOString(),
    qboPaymentId: '5022',
  };

  const revertedFinal = await revertOpportunityPaymentInTwenty(finalCheckOpp, '5022', 8700.0, 'Payment was deleted in QBO');
  console.log('   Reverted Final Check Opp State:');
  console.log('   - stage:', revertedFinal.stage);
  console.log('   - insuranceClaimStage:', revertedFinal.insuranceClaimStage);
  console.log('   - depreciationStatus:', revertedFinal.depreciationStatus);
  console.log('   - carrierCheckNumber:', revertedFinal.carrierCheckNumber);
  console.log('   - carrierCheckAmount:', revertedFinal.carrierCheckAmount);
  console.log('   - qboPaymentId:', revertedFinal.qboPaymentId);
  console.log('   - finalBalanceDue:', revertedFinal.finalBalanceDue);

  if (
    revertedFinal.stage !== 'Production / Post-Build' ||
    revertedFinal.insuranceClaimStage !== 'Build Complete - Certificate of Completion Sent' ||
    revertedFinal.depreciationStatus !== 'COC Submitted' ||
    revertedFinal.carrierCheckNumber !== null ||
    revertedFinal.carrierCheckAmount !== null ||
    revertedFinal.qboPaymentId !== null ||
    revertedFinal.finalBalanceDue !== 8700.0
  ) {
    throw new Error('revertOpportunityPaymentInTwenty failed on final depreciation check reversion.');
  }

  // Case B: Initial Deposit Reversion
  const depositOpp = {
    id: 'opp-unit-deposit',
    name: 'Smith Roof Replacement',
    stage: 'Deposit Received / Scheduling',
    depositStatus: 'Paid',
    depositAmountPaid: 1000,
    qboDepositPaymentId: '7021',
  };

  const revertedDeposit = await revertOpportunityPaymentInTwenty(depositOpp, '7021', 20900.0, 'Payment was voided in QBO');
  console.log('   Reverted Deposit Opp State:');
  console.log('   - stage:', revertedDeposit.stage);
  console.log('   - depositStatus:', revertedDeposit.depositStatus);
  console.log('   - depositAmountPaid:', revertedDeposit.depositAmountPaid);
  console.log('   - qboDepositPaymentId:', revertedDeposit.qboDepositPaymentId);
  console.log('   - finalBalanceDue:', revertedDeposit.finalBalanceDue);

  if (
    revertedDeposit.stage !== 'Contract Signed' ||
    revertedDeposit.depositStatus !== 'Unpaid' ||
    revertedDeposit.depositAmountPaid !== 0 ||
    revertedDeposit.qboDepositPaymentId !== null ||
    revertedDeposit.finalBalanceDue !== 20900.0
  ) {
    throw new Error('revertOpportunityPaymentInTwenty failed on deposit payment reversion.');
  }

  // Case C: General Payment Reversion
  const generalOpp = {
    id: 'opp-unit-general',
    name: 'Johnson Retail Replacement',
    stage: 'Completed',
    qboPaymentId: 'FINAL-CHECK-100',
    qboDepositPaymentId: 'DEP-200',
  };

  const revertedGeneral = await revertOpportunityPaymentInTwenty(generalOpp, 'OTHER-PROGRESS-PAYMENT-99', 5000.0, 'General payment deleted');
  if (revertedGeneral.stage !== 'Payment Issue / Balance Due') {
    throw new Error('revertOpportunityPaymentInTwenty failed on general payment reversion.');
  }

  console.log('   [✓ PASS] Unit testing of revertOpportunityPaymentInTwenty completed successfully.\n');

  // TEST 3: End-to-End Webhook: Void/Delete Payment #5022 on Completed Opportunity
  console.log('--- TEST 3: Webhook E2E: Void/Delete Payment #5022 on Completed Opportunity ---');
  const deleteOppId = 'opp-qbo-delete-5022';

  // Seed Opportunity into server memory store via PATCH /api/insurance/:id/claim
  const completedOppSeed = JSON.stringify({
    customerName: 'Marcus Vance',
    customerPhone: '+16195550188',
    phone: '+16195550188',
    addressStreet: '100 Sunset Blvd',
    addressCity: 'San Diego',
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: 'SF-5022-CLAIM',
    stage: 'Completed',
    insuranceClaimStage: 'Depreciation Released - Closed',
    depreciationStatus: 'Released / Paid',
    carrierCheckNumber: 'CHK-5022',
    carrierCheckAmount: 8700.0,
    carrierCheckReceivedAt: new Date().toISOString(),
    qboPaymentId: '5022',
    qboInvoiceId: '8492',
    finalBalanceDue: 0.0,
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${deleteOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(completedOppSeed),
    },
  }, completedOppSeed);

  // Seed reopened invoice balance in QBO simulation
  const seedInvoicePayload = JSON.stringify({
    invoice: {
      Id: '8492',
      DocNumber: 'INV-8492',
      TotalAmt: 20900.0,
      Balance: 8700.0, // Reopened balance after payment deletion
    },
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/test/qbo/seed',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedInvoicePayload),
    },
  }, seedInvoicePayload);

  // Dispatch Intuit Webhook Notification for Payment Delete operation
  const deleteWebhookBody = JSON.stringify({
    eventNotifications: [
      {
        realmId: '4620816365338123450',
        dataChangeEvent: {
          entities: [
            {
              name: 'Payment',
              id: '5022',
              operation: 'Delete',
              lastUpdated: new Date().toISOString(),
            },
          ],
        },
      },
    ],
  });

  const deleteSig = crypto.createHmac('sha256', verifierToken).update(deleteWebhookBody).digest('base64');

  const deleteWebhookRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/quickbooks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(deleteWebhookBody),
      'intuit-signature': deleteSig,
    },
  }, deleteWebhookBody);

  console.log('   Delete Webhook HTTP status:', deleteWebhookRes.status);
  if (deleteWebhookRes.status !== 200) {
    throw new Error(`Expected HTTP 200 from QBO Delete Webhook, got ${deleteWebhookRes.status}`);
  }

  // Allow brief tick for async webhook handler to complete
  await new Promise((r) => setTimeout(r, 200));

  // Inspect Opportunity State
  const deleteVerifyRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${deleteOppId}`,
    method: 'GET',
  });

  const deletedOpp = deleteVerifyRes.body?.claim || {};
  console.log('   - stage:', deletedOpp.stage);
  console.log('   - insuranceClaimStage:', deletedOpp.insuranceClaimStage);
  console.log('   - depreciationStatus:', deletedOpp.depreciationStatus);
  console.log('   - carrierCheckNumber:', deletedOpp.carrierCheckNumber);
  console.log('   - carrierCheckAmount:', deletedOpp.carrierCheckAmount);
  console.log('   - qboPaymentId:', deletedOpp.qboPaymentId);
  console.log('   - finalBalanceDue:', deletedOpp.finalBalanceDue);

  if (deletedOpp.stage !== 'Production / Post-Build') {
    throw new Error(`Expected stage === 'Production / Post-Build', got '${deletedOpp.stage}'`);
  }
  if (deletedOpp.insuranceClaimStage !== 'Build Complete - Certificate of Completion Sent') {
    throw new Error(`Expected insuranceClaimStage === 'Build Complete - Certificate of Completion Sent', got '${deletedOpp.insuranceClaimStage}'`);
  }
  if (deletedOpp.depreciationStatus !== 'COC Submitted') {
    throw new Error(`Expected depreciationStatus === 'COC Submitted', got '${deletedOpp.depreciationStatus}'`);
  }
  if (deletedOpp.carrierCheckNumber !== null && deletedOpp.carrierCheckNumber !== undefined) {
    throw new Error(`Expected carrierCheckNumber to be null, got '${deletedOpp.carrierCheckNumber}'`);
  }
  if (deletedOpp.carrierCheckAmount !== null && deletedOpp.carrierCheckAmount !== undefined) {
    throw new Error(`Expected carrierCheckAmount to be null, got '${deletedOpp.carrierCheckAmount}'`);
  }
  if (deletedOpp.qboPaymentId !== null && deletedOpp.qboPaymentId !== undefined) {
    throw new Error(`Expected qboPaymentId to be null, got '${deletedOpp.qboPaymentId}'`);
  }
  if (deletedOpp.finalBalanceDue !== 8700.0) {
    throw new Error(`Expected finalBalanceDue === 8700, got ${deletedOpp.finalBalanceDue}`);
  }
  console.log('   [✓ PASS] Payment deletion accurately reverted Completed job to Production / Post-Build and reopened $8,700 balance.\n');

  // TEST 4: End-to-End Webhook: Void Deposit Payment #7021
  console.log('--- TEST 4: Webhook E2E: Void Deposit Payment #7021 ---');
  const voidOppId = 'opp-qbo-void-7021';

  const depositOppSeed = JSON.stringify({
    customerName: 'Elena Rostova',
    phone: '+16195550199',
    stage: 'Deposit Received / Scheduling',
    depositStatus: 'Paid',
    depositAmountPaid: 1000.0,
    qboDepositPaymentId: '7021',
    qboInvoiceId: '8495',
    finalBalanceDue: 19900.0,
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${voidOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(depositOppSeed),
    },
  }, depositOppSeed);

  // Seed QBO invoice with full open balance
  const seedDepositInv = JSON.stringify({
    invoice: {
      Id: '8495',
      DocNumber: 'INV-8495',
      TotalAmt: 20900.0,
      Balance: 20900.0,
    },
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/test/qbo/seed',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedDepositInv),
    },
  }, seedDepositInv);

  const voidWebhookBody = JSON.stringify({
    eventNotifications: [
      {
        realmId: '4620816365338123450',
        dataChangeEvent: {
          entities: [
            {
              name: 'Payment',
              id: '7021',
              operation: 'Void',
              lastUpdated: new Date().toISOString(),
            },
          ],
        },
      },
    ],
  });

  const voidSig = crypto.createHmac('sha256', verifierToken).update(voidWebhookBody).digest('base64');

  const voidWebhookRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/quickbooks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(voidWebhookBody),
      'intuit-signature': voidSig,
    },
  }, voidWebhookBody);

  console.log('   Void Webhook HTTP status:', voidWebhookRes.status);
  if (voidWebhookRes.status !== 200) {
    throw new Error(`Expected HTTP 200 from QBO Void Webhook, got ${voidWebhookRes.status}`);
  }

  await new Promise((r) => setTimeout(r, 200));

  const voidVerifyRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${voidOppId}`,
    method: 'GET',
  });

  const voidedOpp = voidVerifyRes.body?.claim || {};
  console.log('   - stage:', voidedOpp.stage);
  console.log('   - depositStatus:', voidedOpp.depositStatus);
  console.log('   - depositAmountPaid:', voidedOpp.depositAmountPaid);
  console.log('   - qboDepositPaymentId:', voidedOpp.qboDepositPaymentId);
  console.log('   - finalBalanceDue:', voidedOpp.finalBalanceDue);

  if (voidedOpp.stage !== 'Contract Signed') {
    throw new Error(`Expected stage === 'Contract Signed', got '${voidedOpp.stage}'`);
  }
  if (voidedOpp.depositStatus !== 'Unpaid') {
    throw new Error(`Expected depositStatus === 'Unpaid', got '${voidedOpp.depositStatus}'`);
  }
  if (voidedOpp.depositAmountPaid !== 0) {
    throw new Error(`Expected depositAmountPaid === 0, got ${voidedOpp.depositAmountPaid}`);
  }
  if (voidedOpp.qboDepositPaymentId !== null && voidedOpp.qboDepositPaymentId !== undefined) {
    throw new Error(`Expected qboDepositPaymentId to be null, got '${voidedOpp.qboDepositPaymentId}'`);
  }
  if (voidedOpp.finalBalanceDue !== 20900.0) {
    throw new Error(`Expected finalBalanceDue === 20900, got ${voidedOpp.finalBalanceDue}`);
  }
  console.log('   [✓ PASS] Deposit void accurately reverted status to Unpaid and stage to Contract Signed.\n');

  // TEST 5: End-to-End Webhook: RefundReceipt Created
  console.log('--- TEST 5: Webhook E2E: RefundReceipt Created ---');
  const refundOppId = 'opp-qbo-refund-901';

  const refundOppSeed = JSON.stringify({
    customerName: 'Arthur Dent',
    phone: '+16195550177',
    qboCustomerId: '54',
    stage: 'Completed',
    finalBalanceDue: 0.0,
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${refundOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(refundOppSeed),
    },
  }, refundOppSeed);

  // Seed RefundReceipt in cross-process server via /test/qbo/seed
  const seedRefundPayload = JSON.stringify({
    refundReceipt: {
      Id: 'REF-901',
      DocNumber: 'REF-901',
      TotalAmt: 1250.0,
      CustomerRef: {
        value: '54',
        name: 'Arthur Dent',
      },
      PaymentMethodRef: {
        name: 'Credit Card',
      },
    },
  });

  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/test/qbo/seed',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedRefundPayload),
    },
  }, seedRefundPayload);

  // Dispatch RefundReceipt Webhook
  const refundWebhookBody = JSON.stringify({
    eventNotifications: [
      {
        realmId: '4620816365338123450',
        dataChangeEvent: {
          entities: [
            {
              name: 'RefundReceipt',
              id: 'REF-901',
              operation: 'Create',
              lastUpdated: new Date().toISOString(),
            },
          ],
        },
      },
    ],
  });

  const refundSig = crypto.createHmac('sha256', verifierToken).update(refundWebhookBody).digest('base64');

  const refundWebhookRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/quickbooks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(refundWebhookBody),
      'intuit-signature': refundSig,
    },
  }, refundWebhookBody);

  console.log('   RefundReceipt Webhook HTTP status:', refundWebhookRes.status);
  if (refundWebhookRes.status !== 200) {
    throw new Error(`Expected HTTP 200 from QBO RefundReceipt Webhook, got ${refundWebhookRes.status}`);
  }

  await new Promise((r) => setTimeout(r, 200));

  const refundVerifyRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${refundOppId}`,
    method: 'GET',
  });

  const refundedOpp = refundVerifyRes.body?.claim || {};
  console.log('   - stage:', refundedOpp.stage);

  if (refundedOpp.stage !== 'Payment Issue / Balance Due') {
    throw new Error(`Expected stage === 'Payment Issue / Balance Due', got '${refundedOpp.stage}'`);
  }
  console.log('   [✓ PASS] RefundReceipt creation shifted Opportunity stage to Payment Issue / Balance Due.\n');

  // TEST 6: Security: Tampered Signature Rejection
  console.log('--- TEST 6: Security: Tampered Signature Rejection ---');
  const tamperedSigRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/quickbooks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(deleteWebhookBody),
      'intuit-signature': 'tampered_signature_123',
    },
  }, deleteWebhookBody);

  console.log('   Tampered signature HTTP status:', tamperedSigRes.status);
  if (tamperedSigRes.status !== 401) {
    throw new Error(`Expected HTTP 401 for tampered webhook signature, got ${tamperedSigRes.status}`);
  }
  console.log('   [✓ PASS] Unauthenticated / forged webhooks successfully rejected with HTTP 401.\n');

  console.log('======================================================================');
  console.log('=== ALL 6 TESTS PASSED: QBO PAYMENT REVERSION & REFUNDS OPERATIONAL ===');
  console.log('======================================================================');
}

runPaymentDeletionAndRefundVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  });
