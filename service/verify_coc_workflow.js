const http = require('http');
const fs = require('fs');
const path = require('path');

async function runCocVerification() {
  console.log('=== STARTING CERTIFICATE OF COMPLETION (COC) WORKFLOW VERIFICATION ===\n');

  const testOppId = 'opp-coc-claim-491029';

  // 1. Seed Claim Figures via PATCH /api/insurance/:id/claim
  console.log('1. Setting Up Claim with Approved Supplement:');
  console.log('   rcvInitialAmount: 18500, acvInitialAmount: 11200, supplementApprovedAmount: 2400, deductibleAmount: 1000');
  
  const setupPayload = JSON.stringify({
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: '49-1029-A',
    rcvInitialAmount: 18500,
    acvInitialAmount: 11200,
    supplementApprovedAmount: 2400,
    deductibleAmount: 1000,
    adjusterName: 'Sarah Jenkins',
    adjusterEmail: 'sjenkins@statefarmclaims.com',
    customerName: 'Marcus Vance',
    customerEmail: 'm.vance@example.com',
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

  console.log('   Claim Setup Response:', setupRes.status, 'Total RCV:', setupRes.body?.claim?.totalClaimRcv);
  if (setupRes.body?.claim?.totalClaimRcv !== 20900) {
    throw new Error(`Expected Total RCV 20,900, got ${setupRes.body?.claim?.totalClaimRcv}`);
  }

  // 2. Generate COC via POST /api/insurance/:id/generate-coc
  console.log('\n2. Generating Certificate of Completion (COC) & Depreciation Release PDF:');
  const genRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   POST /api/insurance/:id/generate-coc status:', genRes.status);
  console.log('   Generated COC URL:', genRes.body?.cocUrl);
  console.log('   Recoverable Depreciation Due Callout:', genRes.body?.depreciationDue);

  if (genRes.body?.depreciationDue !== 8700) {
    throw new Error(`Expected Recoverable Depreciation Due $8,700.00, got $${genRes.body?.depreciationDue}`);
  }

  // Verify PDF file on disk
  const expectedPdfFile = path.join(process.cwd(), 'public', 'reports', 'Certificate-of-Completion-491029A.pdf');
  if (fs.existsSync(expectedPdfFile)) {
    const stats = fs.statSync(expectedPdfFile);
    console.log(`   ✓ COC PDF verified on disk: ${expectedPdfFile} (${stats.size} bytes)`);
  } else {
    throw new Error(`Expected PDF not found at ${expectedPdfFile}`);
  }

  // 3. Dispatch to Desk Adjuster via POST /api/insurance/:id/send-coc
  console.log('\n3. Dispatching COC Packet to Desk Adjuster:');
  const sendRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/send-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   POST /api/insurance/:id/send-coc status:', sendRes.status);
  console.log('   Message:', sendRes.body?.message);

  // 4. Inspect Updated Claim Milestone in CRM
  console.log('\n4. Verifying Updated Insurance Milestones in Twenty CRM:');
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  console.log('   Stage:', getRes.body?.claim?.insuranceClaimStage);
  console.log('   Depreciation Status:', getRes.body?.claim?.depreciationStatus);
  console.log('   COC Document URL:', getRes.body?.claim?.cocDocumentUrl);
  console.log('   COC Generated At:', getRes.body?.claim?.cocGeneratedAt);

  if (getRes.body?.claim?.insuranceClaimStage !== 'Build Complete - Certificate of Completion Sent') {
    throw new Error(`Expected stage 'Build Complete - Certificate of Completion Sent', got '${getRes.body?.claim?.insuranceClaimStage}'`);
  }
  if (getRes.body?.claim?.depreciationStatus !== 'COC Submitted') {
    throw new Error(`Expected depreciationStatus 'COC Submitted', got '${getRes.body?.claim?.depreciationStatus}'`);
  }

  console.log('\n=== ALL CERTIFICATE OF COMPLETION (COC) TESTS PASSED SUCCESSFULLY! ===');
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

runCocVerification().catch((err) => {
  console.error('\n❌ COC Verification Failed:', err);
  process.exit(1);
});
