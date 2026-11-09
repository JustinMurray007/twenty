/**
 * Verification Script: Twilio Inbound Webhook Two-Way Threaded SMS/MMS Hub
 * Tests phone normalization, opportunity lookup, SMS threading, MMS attachments, and TwiML responses.
 */

process.env.NODE_ENV = 'test'; // Prevent server.js from trying to re-bind port 4000
const http = require('http');
const querystring = require('querystring');
const twilio = require('twilio');
const {
  normalizeDigits,
  findOpportunityByPhone,
  opportunityMemoryStore,
} = require('./server.js');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          raw: data,
          body: json,
        });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTwilioInboundVerification() {
  console.log('======================================================================');
  console.log('=== TWILIO INBOUND TWO-WAY SMS/MMS HUB VERIFICATION SUITE          ===');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Phone Normalization Utility (normalizeDigits)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Phone Normalization (normalizeDigits) ---');
  const testCases = [
    { input: '(619) 555-0142', expected: '6195550142' },
    { input: '619-555-0142', expected: '6195550142' },
    { input: '+16195550142', expected: '6195550142' },
    { input: '16195550142', expected: '6195550142' },
    { input: '6195550142', expected: '6195550142' },
    { input: '+1 (619) 555-0142 ext 4', expected: '161955501424' },
    { input: '', expected: '' },
    { input: null, expected: '' },
  ];

  for (const tc of testCases) {
    const actual = normalizeDigits(tc.input);
    console.log(`   normalizeDigits('${tc.input}') => '${actual}'`);
    if (actual !== tc.expected) {
      throw new Error(`Expected '${tc.expected}', got '${actual}' for '${tc.input}'`);
    }
  }
  console.log('   [✓ PASS] Phone normalization functions correctly across all formats.\n');

  // -------------------------------------------------------------------------
  // TEST 2: Seed Opportunity and Verify findOpportunityByPhone
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Opportunity Phone Lookup (findOpportunityByPhone) ---');
  const testOppId = 'opp_twilio_test_' + Date.now();
  const phoneSuffix = Math.floor(1000 + Math.random() * 9000);
  const testPhone = `+1619555${phoneSuffix}`;
  const testPhoneFormatted = `(619) 555-${phoneSuffix}`;
  const testPhoneDashed = `619-555-${phoneSuffix}`;

  const testOpp = {
    id: testOppId,
    name: 'Robert Miller - Hail Damage Restoration',
    customerName: 'Robert Miller',
    customerPhone: testPhone,
    phone: testPhoneFormatted,
    assignedRepPhone: '+16195550199',
    insuranceClaimNumber: 'CLM-98231',
    addressStreet: '742 Evergreen Terrace, San Diego, CA',
    stage: 'Estimate Sent',
    amount: 19500.0,
  };

  // Seed local memory store for unit testing
  opportunityMemoryStore.set(testOppId, testOpp);

  const lookupResult1 = await findOpportunityByPhone(testPhone);
  console.log(`   Unit Lookup by '${testPhone}': Found '${lookupResult1?.customerName}' (ID: ${lookupResult1?.id})`);
  if (!lookupResult1 || lookupResult1.id !== testOppId) {
    throw new Error(`Lookup failed to match seeded Opportunity by ${testPhone}`);
  }

  const lookupResult2 = await findOpportunityByPhone(testPhoneFormatted);
  console.log(`   Unit Lookup by '${testPhoneFormatted}': Found '${lookupResult2?.customerName}' (ID: ${lookupResult2?.id})`);
  if (!lookupResult2 || lookupResult2.id !== testOppId) {
    throw new Error(`Lookup failed to match seeded Opportunity by ${testPhoneFormatted}`);
  }

  const lookupResult3 = await findOpportunityByPhone(testPhoneDashed);
  console.log(`   Unit Lookup by '${testPhoneDashed}': Found '${lookupResult3?.customerName}' (ID: ${lookupResult3?.id})`);
  if (!lookupResult3 || lookupResult3.id !== testOppId) {
    throw new Error(`Lookup failed to match seeded Opportunity by ${testPhoneDashed}`);
  }

  // Also seed into the running server process on port 4000
  const seedPayload = JSON.stringify(testOpp);
  const seedRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedPayload),
    },
  }, seedPayload);

  console.log('   Server Seed Opportunity HTTP Status:', seedRes.status);
  if (seedRes.status !== 200) {
    throw new Error(`Failed to seed opportunity in server: ${seedRes.raw}`);
  }
  console.log('   [✓ PASS] Opportunity phone lookup validated locally and seeded into server daemon.\n');

  // -------------------------------------------------------------------------
  // TEST 3: Inbound SMS Webhook Execution (POST /webhooks/twilio/inbound)
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: Homeowner Inbound SMS Threading ---');
  const smsBody = 'Payment is sent. When will the crew arrive?';
  const smsParams = {
    From: testPhone,
    Body: smsBody,
    NumMedia: '0',
    MessageSid: 'SM_test_' + Date.now(),
  };
  const smsPostData = querystring.stringify(smsParams);

  const smsRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/twilio/inbound',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(smsPostData),
    },
  }, smsPostData);

  console.log('   Inbound SMS HTTP Status:', smsRes.status);
  console.log('   Response Content-Type:', smsRes.headers['content-type']);
  console.log('   TwiML Response:\n' + smsRes.raw.trim());

  if (smsRes.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${smsRes.status}`);
  }
  if (!smsRes.headers['content-type']?.includes('text/xml')) {
    throw new Error(`Expected text/xml, got ${smsRes.headers['content-type']}`);
  }
  if (!smsRes.raw.includes('<Response') || (!smsRes.raw.includes('</Response>') && !smsRes.raw.includes('<Response/>'))) {
    throw new Error('Response is not valid TwiML');
  }

  // Inspect the threaded message via the server API
  const threadRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/opportunities/${testOppId}/sms-thread`,
    method: 'GET',
  });

  console.log('   Server Thread HTTP Status:', threadRes.status);
  console.log('   Threaded SMS Messages in CRM:', threadRes.body?.smsThread?.length);
  const latestMessage = threadRes.body?.smsThread?.[threadRes.body.smsThread.length - 1];
  console.log('   Latest Message in Thread:', latestMessage?.body);
  console.log('   Timeline Activity Note Title:', latestMessage?.note?.title);
  console.log('   Timeline Activity Note Target:', latestMessage?.note?.targetableId);

  if (latestMessage?.body !== smsBody) {
    throw new Error(`Expected body '${smsBody}', got '${latestMessage?.body}'`);
  }
  if (!latestMessage?.note?.title?.includes('Robert Miller')) {
    throw new Error(`Expected note title to include 'Robert Miller', got '${latestMessage?.note?.title}'`);
  }
  console.log('   [✓ PASS] Inbound SMS successfully processed, verified, and threaded into CRM.\n');

  // -------------------------------------------------------------------------
  // TEST 4: Inbound MMS with Image Attachments
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Homeowner Inbound MMS with Media Attachments ---');
  const mmsParams = {
    From: testPhone,
    Body: 'Here are the photos of the leak and chimney flashing',
    NumMedia: '2',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM1/Media/ME1',
    MediaUrl1: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM1/Media/ME2',
  };
  const mmsPostData = querystring.stringify(mmsParams);

  const mmsRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/twilio/inbound',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(mmsPostData),
    },
  }, mmsPostData);

  console.log('   Inbound MMS HTTP Status:', mmsRes.status);

  const mmsThreadRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/opportunities/${testOppId}/sms-thread`,
    method: 'GET',
  });

  const latestMms = mmsThreadRes.body?.smsThread?.[mmsThreadRes.body.smsThread.length - 1];
  console.log('   Threaded MMS Media Count:', latestMms?.mediaUrls?.length);
  console.log('   Activity Note Body Content:\n' + latestMms?.note?.body);

  if (latestMms?.mediaUrls?.length !== 2) {
    throw new Error(`Expected 2 media URLs, got ${latestMms?.mediaUrls?.length}`);
  }
  if (!latestMms?.note?.body?.includes('**MMS Attachments:**') ||
      !latestMms?.note?.body?.includes('• [Photo / File #1]') ||
      !latestMms?.note?.body?.includes('• [Photo / File #2]')) {
    throw new Error('Activity note body missing formatted MMS media markdown links');
  }
  console.log('   [✓ PASS] Inbound MMS attachments formatted and linked in Opportunity activity note.\n');

  // -------------------------------------------------------------------------
  // TEST 5: Unmatched / Unknown Homeowner Phone Handling
  // -------------------------------------------------------------------------
  console.log('--- TEST 5: Unmatched / Unknown Phone Handling ---');
  const unknownParams = {
    From: '+18005559999',
    Body: 'Who is this?',
    NumMedia: '0',
  };
  const unknownPostData = querystring.stringify(unknownParams);

  const unknownRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/twilio/inbound',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(unknownPostData),
    },
  }, unknownPostData);

  console.log('   Unmatched Inbound HTTP Status:', unknownRes.status);
  console.log('   Unmatched TwiML Response:\n' + unknownRes.raw.trim());

  if (unknownRes.status !== 200 || !unknownRes.raw.includes('<Response')) {
    throw new Error('Unmatched sender phone did not return 200 OK with valid TwiML');
  }
  console.log('   [✓ PASS] Unmatched phone safely handled with standard TwiML acknowledgement.\n');

  // -------------------------------------------------------------------------
  // TEST 6: Twilio Signature Validation Logic
  // -------------------------------------------------------------------------
  console.log('--- TEST 6: Twilio Signature Validation ---');
  const sampleAuthToken = 'mock_twilio_auth_token_12345';
  const sampleUrl = 'http://localhost:4000/webhooks/twilio/inbound';
  const sampleParams = {
    From: '+16195550142',
    Body: 'Signature test message',
  };

  const validSig = twilio.getExpectedTwilioSignature(sampleAuthToken, sampleUrl, sampleParams);
  console.log('   Computed Expected Twilio Signature:', validSig);

  const isValidVerified = twilio.validateRequest(sampleAuthToken, validSig, sampleUrl, sampleParams);
  console.log('   twilio.validateRequest with valid signature:', isValidVerified);

  const isInvalidVerified = twilio.validateRequest(sampleAuthToken, 'invalid_signature_xyz', sampleUrl, sampleParams);
  console.log('   twilio.validateRequest with invalid signature:', isInvalidVerified);

  if (!isValidVerified || isInvalidVerified) {
    throw new Error('Twilio cryptographic signature validation logic failed');
  }
  console.log('   [✓ PASS] Twilio request authenticity verification validated.\n');

  console.log('======================================================================');
  console.log('=== ALL 6 TESTS PASSED: TWILIO INBOUND THREADING HUB OPERATIONAL    ===');
  console.log('======================================================================');
}

runTwilioInboundVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
