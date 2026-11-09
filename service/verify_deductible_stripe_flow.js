const http = require('http');

async function runDeductibleStripeVerification() {
  console.log('=== STARTING STRIPE DEDUCTIBLE CHECKOUT & SMS VERIFICATION ===\n');

  const testOppId = 'opp-stripe-deductible-90182';

  // 1. Setup Opportunity with Unpaid Deductible and Customer Phone
  console.log('1. Setting up Opportunity with Unpaid Deductible & homeowner phone:');
  const setupPayload = JSON.stringify({
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: 'SF-90182-D',
    customerName: 'Marcus Vance',
    customerEmail: 'm.vance@example.com',
    customerPhone: '+16195550198',
    phone: '+16195550198',
    addressStreet: '742 Evergreen Terrace',
    addressCity: 'San Diego',
    adjusterName: 'Sarah Jenkins',
    adjusterEmail: 'sjenkins@statefarmclaims.com',
    rcvInitialAmount: 18500,
    acvInitialAmount: 11200,
    supplementApprovedAmount: 2400,
    deductibleAmount: 1000,
    totalClaimRcv: 20900,
    depreciationAmount: 8700,
    deductiblePaymentStatus: 'Unpaid',
    deductibleAmountCollected: 0,
    insuranceClaimStage: 'Build Complete - Awaiting Deductible Collection',
  });

  const setupRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(setupPayload),
    },
  }, setupPayload);

  console.log('   Setup status:', setupRes.status);
  console.log('   Initial deductiblePaymentStatus:', setupRes.body?.claim?.deductiblePaymentStatus);

  // 2. Verify COC is blocked before payment
  console.log('\n2. Verifying COC Compliance Lock (Expect 403):');
  const lockRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('   Lock check status:', lockRes.status, '| Error:', lockRes.body?.error);
  if (lockRes.status !== 403) {
    throw new Error(`Expected HTTP 403, got ${lockRes.status}`);
  }
  console.log('   ✓ Verified: COC is locked before deductible payment.');

  // 3. Dispatch Stripe Deductible Text-to-Pay Link via POST /api/insurance/:id/send-deductible-link
  console.log('\n3. Dispatching Stripe Deductible Link via Twilio SMS:');
  const sendRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/send-deductible-link`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   send-deductible-link status:', sendRes.status);
  console.log('   Response payload:', JSON.stringify(sendRes.body));

  if (sendRes.status !== 200 || !sendRes.body?.success || !sendRes.body?.checkoutUrl) {
    throw new Error(`Unexpected send-deductible-link response: ${JSON.stringify(sendRes.body)}`);
  }
  console.log('   ✓ Verified: Stripe Checkout URL generated:', sendRes.body.checkoutUrl);
  console.log('   ✓ Verified: Twilio Message SID:', sendRes.body.sid);

  // 4. Inspect Opportunity after dispatch
  console.log('\n4. Verifying Opportunity status updated to "Payment Link Sent":');
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });
  console.log('   deductiblePaymentStatus:', getRes.body?.claim?.deductiblePaymentStatus);
  if (getRes.body?.claim?.deductiblePaymentStatus !== 'Payment Link Sent') {
    throw new Error(`Expected 'Payment Link Sent', got '${getRes.body?.claim?.deductiblePaymentStatus}'`);
  }
  console.log('   ✓ Verified: Status shifted to "Payment Link Sent".');

  // 5. Simulate Stripe Webhook checkout.session.completed with INSURANCE_DEDUCTIBLE
  console.log('\n5. Simulating Stripe Webhook: checkout.session.completed (paymentType: INSURANCE_DEDUCTIBLE):');
  const webhookEvent = JSON.stringify({
    id: 'evt_test_deductible_webhook_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_deductible_session_123',
        payment_intent: 'pi_3MtwadLkdIwHu7ix28a3tqZ8',
        amount_total: 100000, // $1,000.00
        customer_details: { email: 'm.vance@example.com' },
        metadata: {
          opportunityId: testOppId,
          paymentType: 'INSURANCE_DEDUCTIBLE',
          claimNumber: 'SF-90182-D',
          amount: '1000',
        },
      },
    },
  });

  const webhookRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/stripe',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(webhookEvent),
    },
  }, webhookEvent);

  console.log('   Stripe webhook status:', webhookRes.status);
  console.log('   Stripe webhook response:', JSON.stringify(webhookRes.body));

  if (webhookRes.status !== 200 || !webhookRes.body?.received) {
    throw new Error(`Unexpected webhook response: ${JSON.stringify(webhookRes.body)}`);
  }
  console.log('   ✓ Verified: Stripe webhook processed successfully.');

  // 6. Inspect Opportunity compliance fields after webhook confirmation
  console.log('\n6. Verifying Opportunity updated to "Verified & Collected" with Stripe Charge Ref:');
  const finalGetRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  const updatedClaim = finalGetRes.body?.claim;
  console.log('   deductiblePaymentStatus:', updatedClaim?.deductiblePaymentStatus);
  console.log('   deductibleAmountCollected:', updatedClaim?.deductibleAmountCollected);
  console.log('   deductiblePaymentMethod:', updatedClaim?.deductiblePaymentMethod);
  console.log('   deductiblePaymentRef:', updatedClaim?.deductiblePaymentRef);
  console.log('   deductibleVerifiedBy:', updatedClaim?.deductibleVerifiedBy);
  console.log('   deductibleCollectedAt:', updatedClaim?.deductibleCollectedAt);

  if (updatedClaim?.deductiblePaymentStatus !== 'Verified & Collected') {
    throw new Error(`Expected 'Verified & Collected', got '${updatedClaim?.deductiblePaymentStatus}'`);
  }
  if (Number(updatedClaim?.deductibleAmountCollected) !== 1000) {
    throw new Error(`Expected 1000, got ${updatedClaim?.deductibleAmountCollected}`);
  }
  if (updatedClaim?.deductiblePaymentRef !== 'pi_3MtwadLkdIwHu7ix28a3tqZ8') {
    throw new Error(`Expected 'pi_3MtwadLkdIwHu7ix28a3tqZ8', got '${updatedClaim?.deductiblePaymentRef}'`);
  }
  console.log('   ✓ Verified: Stripe Charge ID & full statutory compliance recorded.');

  // 7. Verify Certificate of Completion now unlocks and generates successfully
  console.log('\n7. Generating Certificate of Completion (Compliance Lock Unlocked):');
  const cocRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   generate-coc status:', cocRes.status);
  console.log('   cocUrl:', cocRes.body?.cocUrl);

  if (cocRes.status !== 200 || !cocRes.body?.cocUrl) {
    throw new Error(`Expected 200 OK from generate-coc, got ${cocRes.status}: ${JSON.stringify(cocRes.body)}`);
  }
  console.log('   ✓ Verified: COC generated successfully with Stripe payment certification!');

  console.log('\n=== ALL STRIPE DEDUCTIBLE & SMS FLOW TESTS PASSED! ===');
}

function makeRequest(options, data) {
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

runDeductibleStripeVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  });
