const http = require('http');
const fs = require('fs');
const path = require('path');

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
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

async function runDeductibleReceiptVerification() {
  console.log('=== STARTING DEDUCTIBLE PAYMENT RECEIPT & COMPLIANCE BUNDLE VERIFICATION ===\n');

  const testOppId = 'opp-receipt-audit-77102';
  const claimNumber = 'SF-77102-R';
  const claimClean = claimNumber.replace(/[^a-zA-Z0-9]/g, '');

  // 1. Setup Opportunity with Verified Deductible
  console.log('1. Seeding Insurance Opportunity with deductiblePaymentStatus: "Verified & Collected":');
  const setupPayload = JSON.stringify({
    insuranceCarrier: 'State Farm',
    insuranceClaimNumber: claimNumber,
    customerName: 'Evelyn Sterling',
    customerEmail: 'evelyn.sterling@example.com',
    customerPhone: '+16195550188',
    phone: '+16195550188',
    addressStreet: '450 Coronado Blvd',
    addressCity: 'San Diego',
    adjusterName: 'Sarah Jenkins',
    adjusterEmail: 'sjenkins@statefarmclaims.com',
    rcvInitialAmount: 18500,
    acvInitialAmount: 11200,
    supplementApprovedAmount: 2400,
    totalClaimRcv: 20900,
    depreciationAmount: 8700,
    deductibleAmount: 1000,
    deductibleAmountCollected: 1000,
    deductiblePaymentMethod: 'Credit Card (Stripe)',
    deductiblePaymentRef: 'pi_3NreceiptAudit77102',
    deductibleCollectedAt: new Date().toISOString(),
    deductiblePaymentStatus: 'Verified & Collected',
    insuranceClaimStage: 'Build Complete - Awaiting COC Release',
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
  console.log('   deductiblePaymentStatus:', setupRes.body?.claim?.deductiblePaymentStatus);
  console.log('   deductibleAmountCollected:', setupRes.body?.claim?.deductibleAmountCollected);
  console.log('   deductiblePaymentRef:', setupRes.body?.claim?.deductiblePaymentRef);

  if (setupRes.status !== 200 || setupRes.body?.claim?.deductiblePaymentStatus !== 'Verified & Collected') {
    throw new Error(`Failed to seed opportunity in Verified & Collected state: ${JSON.stringify(setupRes.body)}`);
  }
  console.log('   ✓ Verified: Opportunity state prepared.\n');

  // 2. Generate Certificate of Completion (COC)
  console.log('2. Generating Certificate of Completion (COC) PDF:');
  const cocRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   POST /api/insurance/:id/generate-coc status:', cocRes.status);
  console.log('   COC URL:', cocRes.body?.cocUrl);
  if (cocRes.status !== 200 || !cocRes.body?.success) {
    throw new Error(`Failed to generate COC: ${JSON.stringify(cocRes.body)}`);
  }

  const expectedCocPath = path.join(process.cwd(), 'public', 'reports', `Certificate-of-Completion-${claimClean}.pdf`);
  if (!fs.existsSync(expectedCocPath)) {
    throw new Error(`Expected COC file not found on disk at: ${expectedCocPath}`);
  }
  console.log(`   ✓ Verified: COC PDF compiled at ${expectedCocPath} (${fs.statSync(expectedCocPath).size} bytes)\n`);

  // 3. Generate Deductible Payment Receipt via POST /api/insurance/:id/generate-deductible-receipt
  console.log('3. Triggering Deductible Payment Receipt & Statutory Compliance PDF Generation:');
  const receiptRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/generate-deductible-receipt`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   POST /api/insurance/:id/generate-deductible-receipt status:', receiptRes.status);
  console.log('   Generated Receipt URL:', receiptRes.body?.receiptUrl);

  if (receiptRes.status !== 200 || !receiptRes.body?.success || !receiptRes.body?.receiptUrl) {
    throw new Error(`Failed to generate receipt: ${JSON.stringify(receiptRes.body)}`);
  }

  const expectedReceiptPath = path.join(process.cwd(), 'public', 'reports', `Deductible-Receipt-${claimClean}.pdf`);
  if (!fs.existsSync(expectedReceiptPath)) {
    throw new Error(`Expected Receipt file not found on disk at: ${expectedReceiptPath}`);
  }

  const receiptStats = fs.statSync(expectedReceiptPath);
  console.log(`   ✓ Verified: Receipt PDF compiled on disk: ${expectedReceiptPath} (${receiptStats.size} bytes)`);

  const fileHead = fs.readFileSync(expectedReceiptPath).slice(0, 10).toString();
  if (!fileHead.startsWith('%PDF')) {
    throw new Error(`File is not a valid PDF: ${fileHead}`);
  }
  console.log('   ✓ Verified: File has valid PDF header signature.\n');

  // 4. Verify Opportunity record in CRM has deductibleReceiptUrl updated
  console.log('4. Verifying Opportunity record contains updated deductibleReceiptUrl:');
  const getOppRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  console.log('   Opportunity deductibleReceiptUrl:', getOppRes.body?.claim?.deductibleReceiptUrl);
  if (!getOppRes.body?.claim?.deductibleReceiptUrl || !getOppRes.body?.claim?.deductibleReceiptUrl.includes(`Deductible-Receipt-${claimClean}.pdf`)) {
    throw new Error(`Opportunity deductibleReceiptUrl not properly updated: ${getOppRes.body?.claim?.deductibleReceiptUrl}`);
  }
  console.log('   ✓ Verified: Twenty CRM Opportunity field updated with public receipt link.\n');

  // 5. Send COC Packet to Adjuster via POST /api/insurance/:id/send-coc
  console.log('5. Dispatched COC & Proof of Deductible Packet to Carrier Claims Desk:');
  const sendRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/send-coc`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   POST /api/insurance/:id/send-coc status:', sendRes.status);
  console.log('   Message:', sendRes.body?.message);

  if (sendRes.status !== 200 || !sendRes.body?.success) {
    throw new Error(`Failed to send COC packet: ${JSON.stringify(sendRes.body)}`);
  }
  console.log('   ✓ Verified: Desk adjuster packet dispatched successfully.');

  // 6. Verify Final State
  console.log('\n6. Checking Final Claim State:');
  const finalRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  console.log('   insuranceClaimStage:', finalRes.body?.claim?.insuranceClaimStage);
  console.log('   depreciationStatus:', finalRes.body?.claim?.depreciationStatus);
  console.log('   cocDocumentUrl:', finalRes.body?.claim?.cocDocumentUrl);
  console.log('   deductibleReceiptUrl:', finalRes.body?.claim?.deductibleReceiptUrl);

  if (finalRes.body?.claim?.insuranceClaimStage !== 'Build Complete - Certificate of Completion Sent' ||
      finalRes.body?.claim?.depreciationStatus !== 'COC Submitted') {
    throw new Error(`Claim state mismatch: stage=${finalRes.body?.claim?.insuranceClaimStage}, depStatus=${finalRes.body?.claim?.depreciationStatus}`);
  }

  console.log('\n================================================================================');
  console.log('🎉 ALL DEDUCTIBLE RECEIPT GENERATOR & COC PACKET BUNDLE CHECKS PASSED!');
  console.log('================================================================================');
}

runDeductibleReceiptVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
