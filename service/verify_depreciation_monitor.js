const http = require('http');

async function runDepreciationVerification() {
  console.log('=== STARTING DEPRECIATION 14-DAY AGING MONITOR VERIFICATION ===\n');

  const testOppId = 'opp-depr-aging-test';
  // Compute date 16 days in the past
  const sixteenDaysAgo = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString();

  console.log('1. Setting up test claim:');
  console.log('   - Claim Number: SF-49102-X (State Farm)');
  console.log('   - Depreciation Status: COC Submitted');
  console.log('   - COC Generated At (16 days ago):', sixteenDaysAgo);
  console.log('   - Adjuster Email: sjenkins@statefarmclaims.com');
  console.log('   - Financials: Total RCV $20,900, ACV $11,200, Deductible $1,000 => Depreciation Due $8,700.00');

  // Seed claim via PATCH /api/insurance/:id/claim
  const seedPayload = JSON.stringify({
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
    cocGeneratedAt: sixteenDaysAgo,
    depreciationStatus: 'COC Submitted',
  });

  const patchRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/claim`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(seedPayload),
    },
  }, seedPayload);

  console.log('   Claim Setup Response Status:', patchRes.status, 'Total RCV:', patchRes.body?.claim?.totalClaimRcv);

  // 2. Trigger the manual test route POST /test/run-depreciation-monitor
  console.log('\n2. Triggering Audit Check via POST /test/run-depreciation-monitor:');
  const triggerRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/test/run-depreciation-monitor',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('   POST /test/run-depreciation-monitor response:', triggerRes.status);
  console.log('   Status message:', triggerRes.body?.status);
  console.log('   Processed Count:', triggerRes.body?.results?.processedCount);
  console.log('   Alerted Count:', triggerRes.body?.results?.alertedCount);
  console.log('   Alerts:', JSON.stringify(triggerRes.body?.results?.alerts, null, 2));

  if (!triggerRes.body?.results?.alertedCount || triggerRes.body.results.alertedCount < 1) {
    throw new Error('Expected at least 1 aging claim alert triggered, got 0');
  }

  // 3. Inspect updated record in Twenty CRM / memory store
  console.log('\n3. Verifying Updated Opportunity Tracking Fields:');
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}`,
    method: 'GET',
  });

  const updatedClaim = getRes.body?.claim;
  console.log('   depreciationAgingDays:', updatedClaim?.depreciationAgingDays);
  console.log('   depreciationStatus:', updatedClaim?.depreciationStatus);
  console.log('   depreciationFollowUpSentAt:', updatedClaim?.depreciationFollowUpSentAt);

  if (updatedClaim?.depreciationAgingDays !== 16) {
    throw new Error(`Expected depreciationAgingDays to be 16, got ${updatedClaim?.depreciationAgingDays}`);
  }
  if (updatedClaim?.depreciationStatus !== 'Follow-Up Sent') {
    throw new Error(`Expected depreciationStatus to be 'Follow-Up Sent', got '${updatedClaim?.depreciationStatus}'`);
  }
  if (!updatedClaim?.depreciationFollowUpSentAt) {
    throw new Error('Expected depreciationFollowUpSentAt timestamp to be populated');
  }

  console.log('\n=== ALL DEPRECIATION 14-DAY AGING MONITOR TESTS PASSED SUCCESSFULLY! ===');
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

runDepreciationVerification().catch((err) => {
  console.error('\n❌ Depreciation Monitor Verification Failed:', err);
  process.exit(1);
});
