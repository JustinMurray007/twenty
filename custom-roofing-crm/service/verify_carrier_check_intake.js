const http = require('http');

async function runCheckIntakeVerification() {
  console.log('=== STARTING CARRIER CHECK INTAKE & CLAIM CLOSEOUT VERIFICATION ===\n');

  const testOppId = 'opp-claim-check-intake-9812401';

  // 1. Seed Opportunity with COC Submitted & $8,700 depreciation
  console.log('1. Setting up Opportunity with submitted COC ($8,700 expected depreciation):');
  const setupPayload = JSON.stringify({
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: 'SF-49102-X',
    customerName: 'Marcus Vance',
    customerEmail: 'm.vance@example.com',
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
    depreciationStatus: 'COC Submitted',
    insuranceClaimStage: 'Build Complete - Certificate of Completion Sent',
    stage: 'INSPECTION_COMPLETE',
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

  console.log('   Setup response status:', setupRes.status);
  console.log('   Initial depreciationStatus:', setupRes.body?.claim?.depreciationStatus);

  // 2. Issue check intake test submission: POST /api/insurance/:id/record-check
  console.log('\n2. Submitting Carrier Check Intake via POST /api/insurance/:id/record-check:');
  const checkPayload = JSON.stringify({
    checkNumber: '9812401',
    checkAmount: 8700.0,
    notes: 'Check received and deposited into Chase.',
  });

  const checkRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/record-check`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(checkPayload),
    },
  }, checkPayload);

  console.log('   POST /api/insurance/:id/record-check status:', checkRes.status);
  console.log('   Response payload:', JSON.stringify(checkRes.body));

  if (!checkRes.body?.success || checkRes.body?.message !== 'Check recorded and claim closed.') {
    throw new Error(`Unexpected response: ${JSON.stringify(checkRes.body)}`);
  }

  // 3. Inspect updated Opportunity in Twenty CRM / memory store
  console.log('\n3. Verifying Opportunity closeout and reconciliation fields:');
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  const updatedClaim = getRes.body?.claim;
  console.log('   carrierCheckNumber:', updatedClaim?.carrierCheckNumber);
  console.log('   carrierCheckAmount:', updatedClaim?.carrierCheckAmount);
  console.log('   carrierCheckReceivedAt:', updatedClaim?.carrierCheckReceivedAt);
  console.log('   depreciationStatus:', updatedClaim?.depreciationStatus);
  console.log('   insuranceClaimStage:', updatedClaim?.insuranceClaimStage);
  console.log('   qboJournalEntryId:', updatedClaim?.qboJournalEntryId);
  console.log('   stage:', updatedClaim?.stage);

  if (updatedClaim?.carrierCheckNumber !== '9812401') {
    throw new Error(`Expected carrierCheckNumber '9812401', got '${updatedClaim?.carrierCheckNumber}'`);
  }
  if (Number(updatedClaim?.carrierCheckAmount) !== 8700) {
    throw new Error(`Expected carrierCheckAmount 8700, got ${updatedClaim?.carrierCheckAmount}`);
  }
  if (updatedClaim?.depreciationStatus !== 'Released / Paid') {
    throw new Error(`Expected depreciationStatus 'Released / Paid', got '${updatedClaim?.depreciationStatus}'`);
  }
  if (updatedClaim?.insuranceClaimStage !== 'Depreciation Released - Closed') {
    throw new Error(`Expected insuranceClaimStage 'Depreciation Released - Closed', got '${updatedClaim?.insuranceClaimStage}'`);
  }
  if (!updatedClaim?.qboJournalEntryId) {
    throw new Error('Expected qboJournalEntryId to be populated on Opportunity');
  }
  if (updatedClaim?.stage !== 'Completed') {
    throw new Error(`Expected stage 'Completed', got '${updatedClaim?.stage}'`);
  }

  // 4. Run aging monitor to verify claim is now ignored (cron halted)
  console.log('\n4. Running Depreciation Aging Monitor to confirm cron halts for closed claim:');
  const monitorRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/test/run-depreciation-monitor',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const alertedIds = (monitorRes.body?.results?.alerts || []).map((a) => a.id);
  console.log('   Active alerts in aging monitor:', alertedIds);
  if (alertedIds.includes(testOppId)) {
    throw new Error('Closed claim was unexpectedly alerted by aging monitor!');
  }
  console.log('   ✓ Verified: Closed claim correctly ignored by aging monitor cron.');

  console.log('\n=== ALL CARRIER CHECK INTAKE & CLAIM CLOSEOUT TESTS PASSED SUCCESSFULLY! ===');
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

runCheckIntakeVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
