/**
 * Verification Script: QuickBooks Online (QBO) Customer Provisioning & Deduplication
 * Tests:
 * 1. Direct unit test of findOrCreateQuickBooksCustomer:
 *    - Creation of new Customer (ID '54') with billing & street address
 *    - Deduplication lookup on existing Customer by email / displayName
 *    - Pre-seeded existing Customer resolution (ID '82')
 * 2. Real-time Twenty CRM webhook integration:
 *    - POST /webhooks/twenty with 'opportunity.created'
 *    - Verification of Opportunity update with qboCustomerId and qboSyncStatus: 'Synced'
 *    - Verification of deduplication on subsequent opportunity creation
 */

const http = require('http');
const {
  findOrCreateQuickBooksCustomer,
  seedSimulatedQuickBooksCustomer,
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

async function runCustomerProvisioningVerification() {
  console.log('================================================================================');
  console.log(' QUICKBOOKS ONLINE CUSTOMER PROVISIONING & DEDUPLICATION VERIFICATION');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Direct findOrCreateQuickBooksCustomer Helper Tests
  // --------------------------------------------------------------------------
  console.log('TEST 1: Direct Helper Unit Tests [findOrCreateQuickBooksCustomer]');

  // 1A. Pre-seed an existing customer (ID '82') to verify QueryResponse lookup
  seedSimulatedQuickBooksCustomer({
    id: '82',
    displayName: 'Sarah Connor',
    email: 'sarah.connor@example.com',
  });

  const existingCustId = await findOrCreateQuickBooksCustomer({
    displayName: 'Sarah Connor',
    email: 'sarah.connor@example.com',
    phone: '6195550199',
    address: { street: '100 Terminator Way', city: 'San Diego', state: 'CA', postalCode: '92101' },
  });

  console.log(`   1A. Existing customer lookup returned ID: ${existingCustId}`);
  if (existingCustId !== '82') {
    throw new Error(`Expected existing customer ID '82', got '${existingCustId}'`);
  }
  console.log('   ✓ 1A Passed: Existing customer found via Email/DisplayName deduplication.\n');

  // 1B. Provision new customer "Robert Miller" (not found -> creates ID '54')
  console.log('   1B. Provisioning new customer "Robert Miller" (robert@example.com):');
  const newCustId = await findOrCreateQuickBooksCustomer({
    displayName: 'Robert Miller',
    email: 'robert@example.com',
    phone: '6195550100',
    address: { street: '4120 Sunset Blvd', city: 'San Diego', state: 'CA', postalCode: '92101' },
  });

  console.log(`   1B. New customer created with ID: ${newCustId}`);
  if (!newCustId) {
    throw new Error('Expected new customer ID, got null/empty');
  }
  console.log('   ✓ 1B Passed: New customer entity created.\n');

  // 1C. Verify subsequent call with same email deduplicates to the same ID
  console.log('   1C. Verifying deduplication on second lookup for "robert@example.com":');
  const duplicateLookupId = await findOrCreateQuickBooksCustomer({
    displayName: 'Robert Miller',
    email: 'robert@example.com',
    phone: '6195550100',
    address: { street: '4120 Sunset Blvd', city: 'San Diego', state: 'CA', postalCode: '92101' },
  });

  console.log(`   1C. Deduplication check returned ID: ${duplicateLookupId}`);
  if (duplicateLookupId !== newCustId) {
    throw new Error(`Expected deduplicated ID '${newCustId}', got '${duplicateLookupId}'`);
  }
  console.log('   ✓ 1C Passed: Subsequent call reused existing customer ID without duplicate creation.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Real-Time Twenty CRM Webhook Listener (POST /webhooks/twenty)
  // --------------------------------------------------------------------------
  console.log('TEST 2: Webhook Trigger [POST /webhooks/twenty with opportunity.created]');
  const testOppId = 'opp-robert-miller-4120-test';

  const webhookPayload = JSON.stringify({
    event: 'opportunity.created',
    record: {
      id: testOppId,
      name: 'Robert Miller - 4120 Sunset Blvd',
      customerName: 'Robert Miller',
      customerEmail: 'robert@example.com',
      customerPhone: '6195550100',
      addressStreet: '4120 Sunset Blvd',
      addressCity: 'San Diego',
      addressState: 'CA',
      addressPostcode: '92101',
    },
  });

  const webhookRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/twenty',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(webhookPayload),
    },
  }, webhookPayload);

  console.log('   Webhook HTTP response status:', webhookRes.status);
  console.log('   Webhook response payload:', webhookRes.body);

  if (webhookRes.status !== 200 || !webhookRes.body?.received) {
    throw new Error(`Unexpected webhook response: ${JSON.stringify(webhookRes.body)}`);
  }
  console.log('   ✓ Webhook received and processed 200 OK.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Inspect Opportunity State in Microservice / Twenty CRM
  // --------------------------------------------------------------------------
  console.log('TEST 3: Verifying Opportunity updated with qboCustomerId and qboSyncStatus');
  const getOppRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  console.log('   GET /api/insurance/:id status:', getOppRes.status);
  const oppRecord = getOppRes.body?.claim;
  console.log('   Opportunity record state:');
  console.log('     • ID:', oppRecord?.id);
  console.log('     • Name:', oppRecord?.name || oppRecord?.customerName);
  console.log('     • qboCustomerId:', oppRecord?.qboCustomerId);
  console.log('     • qboSyncStatus:', oppRecord?.qboSyncStatus);
  console.log('     • addressStreet:', oppRecord?.addressStreet);

  if (!oppRecord?.qboCustomerId) {
    throw new Error('Expected qboCustomerId on Opportunity record, but got undefined/null');
  }

  if (oppRecord?.qboSyncStatus !== 'Synced') {
    throw new Error(`Expected qboSyncStatus 'Synced', but got '${oppRecord?.qboSyncStatus}'`);
  }
  console.log(`   ✓ Test 3 Passed: Opportunity ${testOppId} successfully synced with QBO Customer ID ${oppRecord.qboCustomerId} and status 'Synced'.\n`);

  // --------------------------------------------------------------------------
  // TEST 4: Second Opportunity for Existing Customer Robert Miller (Deduplication via Webhook)
  // --------------------------------------------------------------------------
  console.log('TEST 4: Second Opportunity for Robert Miller (robert@example.com)');
  const testOppId2 = 'opp-robert-miller-detached-garage-test';

  const webhookPayload2 = JSON.stringify({
    event: 'opportunity.created',
    record: {
      id: testOppId2,
      name: 'Robert Miller - Detached Garage Roof',
      customerName: 'Robert Miller',
      customerEmail: 'robert@example.com',
      customerPhone: '6195550100',
      addressStreet: '4120 Sunset Blvd',
      addressCity: 'San Diego',
      addressState: 'CA',
      addressPostcode: '92101',
    },
  });

  const webhookRes2 = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/twenty',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(webhookPayload2),
    },
  }, webhookPayload2);

  if (webhookRes2.status !== 200) {
    throw new Error(`Second webhook failed: ${JSON.stringify(webhookRes2.body)}`);
  }

  const getOppRes2 = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId2}`,
    method: 'GET',
  });

  const oppRecord2 = getOppRes2.body?.claim;
  console.log('   Opportunity 2 record state:');
  console.log('     • ID:', oppRecord2?.id);
  console.log('     • qboCustomerId:', oppRecord2?.qboCustomerId);
  console.log('     • qboSyncStatus:', oppRecord2?.qboSyncStatus);

  if (oppRecord2?.qboCustomerId !== oppRecord?.qboCustomerId) {
    throw new Error(`Expected deduplicated QBO Customer ID '${oppRecord?.qboCustomerId}', got '${oppRecord2?.qboCustomerId}'`);
  }

  if (oppRecord2?.qboSyncStatus !== 'Synced') {
    throw new Error(`Expected qboSyncStatus 'Synced', got '${oppRecord2?.qboSyncStatus}'`);
  }
  console.log(`   ✓ Test 4 Passed: Second opportunity successfully deduplicated to existing QBO Customer ID ${oppRecord.qboCustomerId}.\n`);

  console.log('================================================================================');
  console.log(' ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (4/4)');
  console.log('================================================================================');
}

runCustomerProvisioningVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
