const http = require('http');

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

async function runQboSyncVerification() {
  console.log('=== STARTING QUICKBOOKS ONLINE (QBO) DEPRECIATION CHECK SYNC VERIFICATION ===\n');

  const testOppId = 'opp-qbo-check-sync-9812401';
  const claimNo = 'SF-49102-X';
  const checkNo = '9812401';
  const checkAmt = 8700.00;

  // 1. Seed Opportunity with COC Submitted & $8,700 expected depreciation
  console.log('1. Setting up Opportunity awaiting depreciation check release ($8,700):');
  const setupPayload = JSON.stringify({
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: claimNo,
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
    depreciationAmount: checkAmt,
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
  console.log('   depreciationStatus:', setupRes.body?.claim?.depreciationStatus);

  if (setupRes.status !== 200) {
    throw new Error(`Failed to seed opportunity: ${JSON.stringify(setupRes.body)}`);
  }
  console.log('   ✓ Verified: Opportunity prepared.\n');

  // 2. Submit Carrier Check Intake via POST /api/insurance/:id/record-check
  console.log('2. Recording Carrier Check & Triggering QuickBooks Online Journal Entry Sync:');
  const checkPayload = JSON.stringify({
    checkNumber: checkNo,
    checkAmount: checkAmt,
    notes: 'Delivered by mail from State Farm Claims Desk',
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

  if (checkRes.status !== 200 || !checkRes.body?.success) {
    throw new Error(`Unexpected record-check response: ${JSON.stringify(checkRes.body)}`);
  }

  // Validate QBO Journal Entry attributes in response
  console.log('   qboJournalEntryId:', checkRes.body?.qboJournalEntryId);
  console.log('   qboDocNumber:', checkRes.body?.qboDocNumber);

  if (!checkRes.body?.qboJournalEntryId) {
    throw new Error('Expected qboJournalEntryId in response, but received null/undefined');
  }
  if (checkRes.body?.qboDocNumber !== `DEP-${checkNo}`) {
    throw new Error(`Expected qboDocNumber 'DEP-${checkNo}', got '${checkRes.body?.qboDocNumber}'`);
  }
  console.log(`   ✓ Verified: QBO Journal Entry #${checkRes.body.qboDocNumber} (ID: ${checkRes.body.qboJournalEntryId}) created.\n`);

  // 3. Inspect updated Opportunity in Twenty CRM / memory store
  console.log('3. Verifying Opportunity record updated with QBO sync metadata and closed claim stage:');
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

  if (updatedClaim?.carrierCheckNumber !== checkNo) {
    throw new Error(`Expected carrierCheckNumber '${checkNo}', got '${updatedClaim?.carrierCheckNumber}'`);
  }
  if (Number(updatedClaim?.carrierCheckAmount) !== checkAmt) {
    throw new Error(`Expected carrierCheckAmount ${checkAmt}, got ${updatedClaim?.carrierCheckAmount}`);
  }
  if (updatedClaim?.depreciationStatus !== 'Released / Paid') {
    throw new Error(`Expected depreciationStatus 'Released / Paid', got '${updatedClaim?.depreciationStatus}'`);
  }
  if (updatedClaim?.insuranceClaimStage !== 'Depreciation Released - Closed') {
    throw new Error(`Expected insuranceClaimStage 'Depreciation Released - Closed', got '${updatedClaim?.insuranceClaimStage}'`);
  }
  if (updatedClaim?.qboJournalEntryId !== checkRes.body?.qboJournalEntryId) {
    throw new Error(`Expected opportunity qboJournalEntryId '${checkRes.body?.qboJournalEntryId}', got '${updatedClaim?.qboJournalEntryId}'`);
  }
  if (updatedClaim?.stage !== 'Completed') {
    throw new Error(`Expected stage 'Completed', got '${updatedClaim?.stage}'`);
  }
  console.log('   ✓ Verified: Opportunity fields reconciled and claim closed out.\n');

  console.log('================================================================================');
  console.log('🎉 ALL QUICKBOOKS ONLINE DEPRECIATION CHECK SYNC CHECKS PASSED!');
  console.log('================================================================================');
}

runQboSyncVerification().catch((err) => {
  console.error('\n❌ QBO SYNC VERIFICATION FAILED:', err);
  process.exit(1);
});
