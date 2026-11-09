/**
 * Comprehensive Verification Script for Direct SMS Composer & Inbound Threading
 * Tests:
 * 1. Payload validation (missing fields, nonexistent opp, missing phone)
 * 2. POST /api/sms/send-direct to Homeowner (Clear Driveway Alert template)
 * 3. POST /api/sms/send-direct to Crew Leader (Tarp & Protection template)
 * 4. Outbound SMS logging to Timeline Notes and threaded smsThread history
 * 5. Inbound Twilio reply from Homeowner completing two-way conversation thread
 */

const http = require('http');

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}`;

function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let reqBody = '';

    if (body) {
      if (typeof body === 'string') {
        reqBody = body;
      } else if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        reqBody = new URLSearchParams(body).toString();
      } else {
        reqHeaders['Content-Type'] = 'application/json';
        reqBody = JSON.stringify(body);
      }
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(responseData);
          } catch (e) {
            parsed = responseData;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runVerification() {
  console.log('===============================================================');
  console.log('🧪 Starting SMS Quick Composer & Direct SMS Dispatcher Verification');
  console.log('===============================================================\n');

  const uniqueSuffix = Date.now().toString().slice(-4);
  const oppId = `opp-composer-${Date.now()}`;
  const homeownerPhone = `+1619555${uniqueSuffix}`;
  const crewPhone = `+1619556${uniqueSuffix}`;
  const customerName = 'Robert Miller';
  const crewName = 'Apex Roofing Crew';

  // 1. Seed Opportunity in CRM service via PATCH endpoint
  console.log('[Step 1] Seeding Opportunity with Homeowner & Crew details...');
  const seedRes = await httpRequest('PATCH', `/api/insurance/${oppId}/claim`, {
    customerName,
    customerPhone: homeownerPhone,
    phone: homeownerPhone,
    crewName,
    crewLeaderPhone: crewPhone,
    subcontractorPhone: crewPhone,
    addressStreet: '742 Evergreen Terrace',
    addressCity: 'Springfield',
    addressState: 'CA',
    amount: 19500,
    stage: 'Production / In Progress',
  });
  assert(seedRes.status === 200, `Opportunity ${oppId} seeded successfully`);

  // 2. Test Validation: Missing Fields
  console.log('\n[Step 2] Testing Validation Errors...');
  const missingBodyRes = await httpRequest('POST', '/api/sms/send-direct', {
    opportunityId: oppId,
    recipientType: 'homeowner',
  });
  assert(
    missingBodyRes.status === 400 && missingBodyRes.data.error,
    'Rejects request with missing messageBody (400)'
  );

  const missingOppRes = await httpRequest('POST', '/api/sms/send-direct', {
    opportunityId: '',
    messageBody: 'Hello',
  });
  assert(
    missingOppRes.status === 400 && missingOppRes.data.error,
    'Rejects request with missing opportunityId (400)'
  );

  const nonExistentOppRes = await httpRequest('POST', '/api/sms/send-direct', {
    opportunityId: 'non-existent-opportunity-xyz',
    messageBody: 'Hello',
  });
  assert(
    nonExistentOppRes.status === 404 && nonExistentOppRes.data.error,
    'Returns 404 for non-existent Opportunity'
  );

  // 3. Test Direct SMS to Homeowner (Clear Driveway Alert template)
  console.log('\n[Step 3] Dispatching Direct SMS to Homeowner...');
  const drivewayMessage =
    `Hi ${customerName.split(' ')[0]}, please remember to move vehicles out of the driveway tonight so the material delivery truck can stage shingles tomorrow morning.`;

  const sendHomeownerRes = await httpRequest('POST', '/api/sms/send-direct', {
    opportunityId: oppId,
    recipientType: 'homeowner',
    messageBody: drivewayMessage,
  });

  assert(sendHomeownerRes.status === 200, 'Direct SMS to Homeowner returned 200 OK');
  assert(sendHomeownerRes.data.success === true, 'Response indicates success: true');
  assert(
    sendHomeownerRes.data.recipient.includes('Homeowner') &&
      sendHomeownerRes.data.recipient.includes(customerName),
    `Recipient formatted correctly: "${sendHomeownerRes.data.recipient}"`
  );
  assert(
    sendHomeownerRes.data.phone === homeownerPhone,
    `Target phone matches Homeowner: ${sendHomeownerRes.data.phone}`
  );
  assert(
    typeof sendHomeownerRes.data.sid === 'string' && sendHomeownerRes.data.sid.startsWith('SM'),
    `Dispatched with valid Twilio SID: ${sendHomeownerRes.data.sid}`
  );

  // 4. Test Direct SMS to Crew Leader (Tarp & Protection template)
  console.log('\n[Step 4] Dispatching Direct SMS to Crew Leader...');
  const crewTarpMessage =
    'Reminder: Photograph driveway protection and ground tarps before beginning tear-off. Upload to CompanyCam.';

  const sendCrewRes = await httpRequest('POST', '/api/sms/send-direct', {
    opportunityId: oppId,
    recipientType: 'crew',
    messageBody: crewTarpMessage,
  });

  assert(sendCrewRes.status === 200, 'Direct SMS to Crew Leader returned 200 OK');
  assert(sendCrewRes.data.success === true, 'Crew SMS response indicates success: true');
  assert(
    sendCrewRes.data.recipient.includes('Crew Leader') &&
      sendCrewRes.data.recipient.includes(crewName),
    `Recipient formatted correctly: "${sendCrewRes.data.recipient}"`
  );
  assert(
    sendCrewRes.data.phone === crewPhone,
    `Target phone matches Crew Leader: ${sendCrewRes.data.phone}`
  );
  assert(
    typeof sendCrewRes.data.sid === 'string' && sendCrewRes.data.sid.startsWith('SM'),
    `Dispatched with valid Twilio SID: ${sendCrewRes.data.sid}`
  );

  // 5. Verify Threaded Conversation in Opportunity History
  console.log('\n[Step 5] Checking Threaded SMS History...');
  const threadRes = await httpRequest('GET', `/api/opportunities/${oppId}/sms-thread`);
  assert(threadRes.status === 200, 'Retrieved Opportunity SMS thread (200 OK)');
  const messages = threadRes.data.smsThread || [];
  assert(messages.length >= 2, `Outbound SMS messages logged to thread: ${messages.length}`);
  
  const homeownerMsg = messages.find((m) => m.recipientType === 'homeowner');
  assert(homeownerMsg && homeownerMsg.body === drivewayMessage, 'Homeowner outbound text captured in thread');
  assert(homeownerMsg.direction === 'outbound', 'Direction correctly flagged as outbound');

  const crewMsg = messages.find((m) => m.recipientType === 'crew');
  assert(crewMsg && crewMsg.body === crewTarpMessage, 'Crew outbound text captured in thread');
  assert(crewMsg.direction === 'outbound', 'Crew direction correctly flagged as outbound');

  // 6. Test Inbound Reply from Homeowner to Complete Two-Way Thread
  console.log('\n[Step 6] Simulating Homeowner Inbound SMS Reply...');
  const homeownerReply = 'Will do, cars are parked on the street.';
  const inboundRes = await httpRequest(
    'POST',
    '/webhooks/twilio/inbound',
    {
      From: homeownerPhone,
      To: '+15551234567',
      Body: homeownerReply,
      NumMedia: '0',
      MessageSid: `SM_reply_${Date.now()}`,
    },
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  );

  assert(inboundRes.status === 200, 'Twilio Inbound Webhook accepted reply (200 OK)');
  assert(
    typeof inboundRes.data === 'string' &&
      (inboundRes.data.includes('<Response') || inboundRes.data.includes('<?xml')),
    'Twilio Inbound returned valid XML TwiML'
  );

  // 7. Verify Completed Two-Way Thread
  console.log('\n[Step 7] Verifying Completed Two-Way Thread on Opportunity...');
  const updatedThreadRes = await httpRequest('GET', `/api/opportunities/${oppId}/sms-thread`);
  const updatedMessages = updatedThreadRes.data.smsThread || [];
  const latestReply = updatedMessages.find(
    (m) => m.direction === 'inbound' && m.body === homeownerReply
  );

  assert(latestReply !== undefined, `Inbound reply "${homeownerReply}" threaded onto Opportunity`);
  assert(
    updatedThreadRes.data.lastInboundSmsBody === homeownerReply,
    `Opportunity lastInboundSmsBody updated to: "${updatedThreadRes.data.lastInboundSmsBody}"`
  );

  console.log('\n===============================================================');
  console.log('🎉 ALL SMS QUICK COMPOSER & TIMELINE THREADING TESTS PASSED!');
  console.log('===============================================================\n');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Verification Error:', err);
    process.exit(1);
  });
