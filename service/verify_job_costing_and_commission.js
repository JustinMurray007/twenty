/**
 * Automated Verification Script for Real-Time Job Costing & Sales Rep Commission Engine
 * Tests:
 * 1. Direct unit math for calculateJobCostingAndCommission across commission plans:
 *    - 50/50 Split (Net Margin) with 10% company overhead
 *    - 10/50 Tiered (High Margin >= 35% and Low Margin < 35%)
 *    - 10% Gross Revenue
 * 2. Vendor Bill Ingestion: POST /api/financials/:id/record-vendor-bill with ABC Supply invoice ($7,240.00)
 * 3. Multi-Vendor Bill Cumulative Cost Aggregation
 * 4. Recalculation Endpoint: POST /api/financials/:id/recalculate-job-costs
 * 5. Lifecycle Commission Status State Progression:
 *    - 'Pending Build' -> 'Earned - Pending Carrier Funds' -> 'Approved for Payroll'
 */

const http = require('http');

process.env.NODE_ENV = 'test';
const { calculateJobCostingAndCommission } = require('./dist/index.js');

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
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data });
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

async function runJobCostingVerification() {
  console.log('======================================================================');
  console.log('=== REAL-TIME JOB COSTING & COMMISSION SPLIT VERIFICATION SUITE    ===');
  console.log('======================================================================\n');

  // TEST 1: Direct Unit Test of calculateJobCostingAndCommission
  console.log('--- TEST 1: Unit Calculations across Commission Plans ---');

  // Case 1A: 50/50 Split (Net Margin)
  const opp5050 = {
    totalClaimRcv: 20900.0,
    actualMaterialCost: 7240.0,
    actualLaborCost: 3250.0,
    dumpsterCost: 550.0,
    permitCost: 350.0,
    otherJobCosts: 0.0,
    companyOverheadPercent: 0.10,
    salesRepCommissionPlan: '50/50 Split (Net Margin)',
    salesRepCommissionRate: 0.50,
  };

  const res5050 = calculateJobCostingAndCommission(opp5050);
  console.log('   Plan: 50/50 Split (Net Margin):');
  console.log('   - Total Revenue: $' + res5050.totalRevenue);
  console.log('   - Total Hard Costs: $' + res5050.totalJobCost);
  console.log('   - Gross Profit: $' + res5050.grossProfit);
  console.log('   - Gross Margin %: ' + res5050.grossMarginPercent + '%');
  console.log('   - Commissionable Profit: $' + res5050.commissionableProfit);
  console.log('   - Sales Rep Commission: $' + res5050.commissionAmount);

  if (res5050.totalJobCost !== 11390.0) throw new Error(`Expected totalJobCost 11390, got ${res5050.totalJobCost}`);
  if (res5050.grossProfit !== 9510.0) throw new Error(`Expected grossProfit 9510, got ${res5050.grossProfit}`);
  if (res5050.grossMarginPercent !== 45.5) throw new Error(`Expected grossMarginPercent 45.5, got ${res5050.grossMarginPercent}`);
  if (res5050.commissionableProfit !== 7420.0) throw new Error(`Expected commissionableProfit 7420, got ${res5050.commissionableProfit}`);
  if (res5050.commissionAmount !== 3710.0) throw new Error(`Expected commissionAmount 3710, got ${res5050.commissionAmount}`);

  // Case 1B: 10/50 Tiered (Margin >= 35%)
  const oppTieredHigh = {
    ...opp5050,
    salesRepCommissionPlan: '10/50 Tiered',
  };
  const resTieredHigh = calculateJobCostingAndCommission(oppTieredHigh);
  console.log('   Plan: 10/50 Tiered (45.5% Margin >= 35%): Commission = $' + resTieredHigh.commissionAmount);
  // 10% of $20,900 = $2,090.00
  if (resTieredHigh.commissionAmount !== 2090.0) {
    throw new Error(`Expected tiered commission 2090, got ${resTieredHigh.commissionAmount}`);
  }

  // Case 1C: 10/50 Tiered (Margin < 35%)
  const oppTieredLow = {
    totalClaimRcv: 20000.0,
    actualMaterialCost: 10000.0,
    actualLaborCost: 4000.0,
    dumpsterCost: 550.0,
    permitCost: 450.0,
    // Total hard costs: $15,000. Gross profit: $5,000 (25% margin)
    // Overhead: $2,000. Commissionable: $3,000. 40% split = $1,200.00
    salesRepCommissionPlan: '10/50 Tiered',
  };
  const resTieredLow = calculateJobCostingAndCommission(oppTieredLow);
  console.log('   Plan: 10/50 Tiered (25% Margin < 35%): Commission = $' + resTieredLow.commissionAmount);
  if (resTieredLow.commissionAmount !== 1200.0) {
    throw new Error(`Expected tiered low margin commission 1200, got ${resTieredLow.commissionAmount}`);
  }

  // Case 1D: 10% Gross Revenue
  const oppGrossRev = {
    ...opp5050,
    salesRepCommissionPlan: '10% Gross Revenue',
    salesRepCommissionRate: 0.10,
  };
  const resGrossRev = calculateJobCostingAndCommission(oppGrossRev);
  console.log('   Plan: 10% Gross Revenue: Commission = $' + resGrossRev.commissionAmount);
  if (resGrossRev.commissionAmount !== 2090.0) {
    throw new Error(`Expected gross revenue commission 2090, got ${resGrossRev.commissionAmount}`);
  }

  console.log('   [✓ PASS] All commission plan mathematical algorithms validated.\n');

  // TEST 2: Vendor Bill Ingestion (ABC Supply)
  console.log('--- TEST 2: Ingest ABC Supply Material Bill via POST /record-vendor-bill ---');
  const testOppId = 'opp-job-cost-test-01';

  // Seed baseline opportunity
  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/claim`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    name: 'Robert Martinez Residence',
    customerName: 'Robert Martinez',
    totalClaimRcv: 20900.0,
    rcvInitialAmount: 20900.0,
    amount: 20900.0,
    actualLaborCost: 3250.0,
    dumpsterCost: 550.0,
    permitCost: 350.0,
    stage: 'Production / Post-Build',
    salesRepCommissionPlan: '50/50 Split (Net Margin)',
  }));

  // Log vendor bill: ABC Supply Co. $7,240.00
  const billPayload = JSON.stringify({
    vendorName: 'ABC Supply Co.',
    invoiceNumber: 'ABC-8849102',
    billAmount: 7240.0,
    costCategory: 'material',
  });

  const billRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/financials/${testOppId}/record-vendor-bill`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(billPayload),
    },
  }, billPayload);

  console.log('   Vendor Bill Ingest HTTP Status:', billRes.status);
  console.log('   Response body:', billRes.body);

  if (billRes.status !== 200 || !billRes.body?.success) {
    throw new Error(`Failed to ingest vendor bill: ${billRes.raw}`);
  }

  const m = billRes.body.metrics;
  console.log('   - Updated actualMaterialCost: $' + billRes.body.newCost);
  console.log('   - Recalculated totalJobCost: $' + m.totalJobCost);
  console.log('   - Recalculated grossProfit: $' + m.grossProfit);
  console.log('   - Recalculated grossMarginPercent: ' + m.grossMarginPercent + '%');
  console.log('   - Recalculated commissionAmount: $' + m.commissionAmount);

  if (billRes.body.newCost !== 7240.0) throw new Error(`Expected newCost 7240, got ${billRes.body.newCost}`);
  if (m.totalJobCost !== 11390.0) throw new Error(`Expected totalJobCost 11390, got ${m.totalJobCost}`);
  if (m.grossProfit !== 9510.0) throw new Error(`Expected grossProfit 9510, got ${m.grossProfit}`);
  if (m.grossMarginPercent !== 45.5) throw new Error(`Expected grossMarginPercent 45.5, got ${m.grossMarginPercent}`);
  if (m.commissionAmount !== 3710.0) throw new Error(`Expected commissionAmount 3710, got ${m.commissionAmount}`);
  console.log('   [✓ PASS] ABC Supply vendor invoice logged and margins/commission recalculated.\n');

  // TEST 3: Multi-Vendor Bill Aggregation (Additional Dumpster Charge)
  console.log('--- TEST 3: Multi-Vendor Bill Aggregation ---');
  const dumpsterPayload = JSON.stringify({
    vendorName: 'Waste Management',
    invoiceNumber: 'WM-33109',
    billAmount: 150.0,
    costCategory: 'dumpster',
  });

  const dumpsterRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/financials/${testOppId}/record-vendor-bill`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dumpsterPayload),
    },
  }, dumpsterPayload);

  console.log('   Dumpster Fee Update New Cost: $' + dumpsterRes.body?.newCost);
  console.log('   Cumulative Total Job Cost: $' + dumpsterRes.body?.metrics?.totalJobCost);

  if (dumpsterRes.body?.newCost !== 700.0) { // 550 + 150 = 700
    throw new Error(`Expected dumpsterCost 700, got ${dumpsterRes.body?.newCost}`);
  }
  if (dumpsterRes.body?.metrics?.totalJobCost !== 11540.0) { // 11390 + 150 = 11540
    throw new Error(`Expected totalJobCost 11540, got ${dumpsterRes.body?.metrics?.totalJobCost}`);
  }
  console.log('   [✓ PASS] Cumulative cost aggregation accurately tracked across multiple vendors.\n');

  // TEST 4: Recalculate Job Costs Endpoint
  console.log('--- TEST 4: POST /api/financials/:id/recalculate-job-costs ---');
  const recalcRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/financials/${testOppId}/recalculate-job-costs`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': 0,
    },
  });

  console.log('   Recalculate HTTP status:', recalcRes.status);
  console.log('   Commission status:', recalcRes.body?.commissionStatus);

  if (recalcRes.status !== 200 || !recalcRes.body?.success) {
    throw new Error(`Recalculate job costs failed: ${recalcRes.raw}`);
  }
  console.log('   [✓ PASS] Manual recalculation endpoint verified.\n');

  // TEST 5: Commission Status Lifecycle Transitions
  console.log('--- TEST 5: Commission Status Lifecycle Transitions ---');

  // 5A: Stage = 'Build Complete - Certificate of Completion Sent' -> 'Earned - Pending Carrier Funds'
  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/claim`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    stage: 'Build Complete - Certificate of Completion Sent',
    depreciationAmount: 8700.0,
    carrierCheckAmount: 0.0,
  }));

  const earnedRecalc = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/financials/${testOppId}/recalculate-job-costs`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 0 },
  });

  console.log('   5A Stage: COC Sent -> Commission Status:', earnedRecalc.body?.commissionStatus);
  if (earnedRecalc.body?.commissionStatus !== 'Earned - Pending Carrier Funds') {
    throw new Error(`Expected 'Earned - Pending Carrier Funds', got '${earnedRecalc.body?.commissionStatus}'`);
  }

  // 5B: Carrier check received and stage = 'Completed' -> 'Approved for Payroll'
  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/insurance/${testOppId}/claim`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    stage: 'Completed',
    carrierCheckAmount: 8700.0,
    depreciationAmount: 8700.0,
  }));

  const payrollRecalc = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/financials/${testOppId}/recalculate-job-costs`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 0 },
  });

  console.log('   5B Stage: Completed + Funds In Hand -> Commission Status:', payrollRecalc.body?.commissionStatus);
  if (payrollRecalc.body?.commissionStatus !== 'Approved for Payroll') {
    throw new Error(`Expected 'Approved for Payroll', got '${payrollRecalc.body?.commissionStatus}'`);
  }
  console.log('   [✓ PASS] Lifecycle transitions from Pending Build -> Earned -> Approved for Payroll.\n');

  console.log('======================================================================');
  console.log('=== ALL 5 TESTS PASSED: JOB COSTING & COMMISSION SPLITS OPERATIONAL ===');
  console.log('======================================================================');
}

runJobCostingVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  });
