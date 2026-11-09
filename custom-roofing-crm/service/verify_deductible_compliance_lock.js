const http = require('http');
const fs = require('fs');
const path = require('path');

async function runDeductibleComplianceVerification() {
  console.log('=== STARTING DEDUCTIBLE COMPLIANCE LOCK VERIFICATION ===\n');

  const testOppId = 'opp-compliance-lock-chk-40291';

  // 1. Setup Opportunity with Unpaid Deductible ($1,000 statutory deductible)
  console.log('1. Setting up Opportunity with Unpaid Deductible ($1,000 policy deductible):');
  const setupPayload = JSON.stringify({
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: 'SF-88219-D',
    customerName: 'Eleanor Vance',
    customerEmail: 'evance@example.com',
    addressStreet: '1044 Ocean Crest Blvd',
    addressCity: 'La Jolla',
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
    insuranceClaimStage: 'Build Complete - Pending Deductible Verification',
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
  console.log('   Initial deductiblePaymentStatus:', setupRes.body?.claim?.deductiblePaymentStatus);

  // 2. Rep attempts to generate COC before deductible is verified (Expect 403 Forbidden)
  console.log('\n2. Attempting to generate COC while deductible is Unpaid (Compliance Lock Check):');
  const lockedRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   POST /api/insurance/:id/generate-coc status:', lockedRes.status);
  console.log('   Response payload:', JSON.stringify(lockedRes.body));

  if (lockedRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden, but received ${lockedRes.status}`);
  }
  if (!lockedRes.body?.error || !lockedRes.body.error.includes('COMPLIANCE LOCK')) {
    throw new Error(`Expected COMPLIANCE LOCK error message, got: ${JSON.stringify(lockedRes.body)}`);
  }
  console.log('   ✓ Verified: Blocked by 403 Compliance Lock as expected.');

  // 3. Partial payment test ($500 collected of $1,000 required)
  console.log('\n3. Testing partial deductible payment ($500 collected of $1,000 required):');
  const partialPayload = JSON.stringify({
    amountCollected: 500,
    paymentMethod: 'Credit Card (Stripe)',
    referenceNumber: 'ch_partial_9281',
    verifiedBy: 'Office Desk',
  });

  const partialRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/verify-deductible`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(partialPayload),
    },
  }, partialPayload);

  console.log('   Partial verify status:', partialRes.status);
  console.log('   Partial compliance flag:', partialRes.body?.isCompliant, '| Status:', partialRes.body?.status);

  if (partialRes.body?.isCompliant !== false || partialRes.body?.status !== 'Partial') {
    throw new Error(`Expected isCompliant=false and status='Partial', got: ${JSON.stringify(partialRes.body)}`);
  }

  // Confirm still locked under partial payment
  const partialLockRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (partialLockRes.status !== 403) {
    throw new Error(`Expected partial payment to remain locked (403), got: ${partialLockRes.status}`);
  }
  console.log('   ✓ Verified: Partial payment remains locked.');

  // 4. Record full statutory policy deductible ($1,000 via Personal Check)
  console.log('\n4. Submitting full statutory deductible collection ($1,000 via Personal Check CHK-40291):');
  const fullPayload = JSON.stringify({
    amountCollected: 1000,
    paymentMethod: 'Personal Check',
    referenceNumber: 'CHK-40291',
    verifiedBy: 'Office Manager',
    proofUrl: 'https://app.companycam.com/photos/doc-chk-40291',
    notes: 'Check deposited into operating account; funds cleared.',
  });

  const verifyRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/verify-deductible`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(fullPayload),
    },
  }, fullPayload);

  console.log('   Verify endpoint status:', verifyRes.status);
  console.log('   Response payload:', JSON.stringify(verifyRes.body));

  if (!verifyRes.body?.success || !verifyRes.body?.isCompliant || verifyRes.body?.status !== 'Verified & Collected') {
    throw new Error(`Unexpected verify response: ${JSON.stringify(verifyRes.body)}`);
  }
  console.log('   ✓ Verified: Full deductible marked "Verified & Collected".');

  // 5. Query updated Opportunity
  console.log('\n5. Inspecting Opportunity metadata after verification:');
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  const claim = getRes.body?.claim;
  console.log('   deductiblePaymentStatus:', claim?.deductiblePaymentStatus);
  console.log('   deductibleAmountCollected:', claim?.deductibleAmountCollected);
  console.log('   deductiblePaymentMethod:', claim?.deductiblePaymentMethod);
  console.log('   deductiblePaymentRef:', claim?.deductiblePaymentRef);
  console.log('   deductibleProofUrl:', claim?.deductibleProofUrl);
  console.log('   deductibleCollectedAt:', claim?.deductibleCollectedAt);
  console.log('   deductibleVerifiedBy:', claim?.deductibleVerifiedBy);

  if (claim?.deductiblePaymentStatus !== 'Verified & Collected') {
    throw new Error(`Expected deductiblePaymentStatus 'Verified & Collected', got '${claim?.deductiblePaymentStatus}'`);
  }
  if (Number(claim?.deductibleAmountCollected) !== 1000) {
    throw new Error(`Expected deductibleAmountCollected 1000, got ${claim?.deductibleAmountCollected}`);
  }
  if (claim?.deductiblePaymentRef !== 'CHK-40291') {
    throw new Error(`Expected deductiblePaymentRef 'CHK-40291', got '${claim?.deductiblePaymentRef}'`);
  }

  // 6. Attempt generate-coc now that compliance lock is cleared
  console.log('\n6. Generating Certificate of Completion with statutory deductible unlocked:');
  const genRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   generate-coc status:', genRes.status);
  console.log('   cocUrl:', genRes.body?.cocUrl);
  console.log('   depreciationDue:', genRes.body?.depreciationDue);

  if (genRes.status !== 200 || !genRes.body?.cocUrl) {
    throw new Error(`Expected successful COC generation, got status: ${genRes.status}, body: ${JSON.stringify(genRes.body)}`);
  }

  // Check generated PDF file exists and is non-empty
  const pdfFilename = path.basename(genRes.body.cocUrl);
  const pdfFilePath = path.join(__dirname, 'public', 'reports', pdfFilename);
  if (fs.existsSync(pdfFilePath)) {
    const stats = fs.statSync(pdfFilePath);
    console.log(`   ✓ PDF File created at: ${pdfFilePath} (${stats.size} bytes)`);
  }

  console.log('\n=== ALL DEDUCTIBLE COMPLIANCE LOCK TESTS PASSED SUCCESSFULLY! ===');
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

runDeductibleComplianceVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
