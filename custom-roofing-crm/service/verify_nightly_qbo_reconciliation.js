/**
 * Automated Verification Script for Nightly QuickBooks Online (QBO) Reconciliation Cron
 * Tests:
 * 1. getQuickBooksInvoicesBatch batch retrieval and mapping
 * 2. Scenario A: Invoice $0.00 in QBO but CRM pending -> Auto-advances to Completed, Depreciation Paid
 * 3. Scenario B: Invoice > $0.00 in QBO but CRM Completed -> Reopens to Payment Issue / Balance Due
 * 4. Scenario C: Financial ledger variance >= $1.00 -> Flags variance and updates reconciliationVariance
 * 5. Scenario D: Perfect balance match -> Reconciliation timestamp updated with zero variance
 * 6. HTTP Endpoint: POST /test/run-nightly-qbo-reconciliation execution and status check
 */

const http = require('http');
const {
  getQuickBooksInvoicesBatch,
  seedSimulatedQuickBooksInvoice,
} = require('./dist/qboClient.js');

process.env.NODE_ENV = 'test';
const { runNightlyQboReconciliation } = require('./dist/index.js');

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

async function runNightlyQboReconciliationVerification() {
  console.log('======================================================================');
  console.log('=== NIGHTLY QUICKBOOKS RECONCILIATION & AUDIT VERIFICATION SUITE   ===');
  console.log('======================================================================\n');

  // TEST 1: Direct Unit Test of getQuickBooksInvoicesBatch
  console.log('--- TEST 1: getQuickBooksInvoicesBatch Batch Entity Retrieval ---');
  seedSimulatedQuickBooksInvoice({
    Id: '9001',
    DocNumber: 'INV-9001',
    TotalAmt: 22000.0,
    Balance: 0.0,
  });

  seedSimulatedQuickBooksInvoice({
    Id: '9002',
    DocNumber: 'INV-9002',
    TotalAmt: 18500.0,
    Balance: 7500.0,
  });

  seedSimulatedQuickBooksInvoice({
    Id: '9003',
    DocNumber: 'INV-9003',
    TotalAmt: 15000.0,
    Balance: 14000.0,
  });

  const batchMap = await getQuickBooksInvoicesBatch(['9001', '9002', '9003']);
  console.log('   Batch size retrieved:', batchMap.size);

  const inv1 = batchMap.get('9001');
  const inv2 = batchMap.get('9002');
  const inv3 = batchMap.get('9003');

  console.log('   - Invoice 9001: Balance = $' + inv1?.balance + ', DocNumber = ' + inv1?.docNumber);
  console.log('   - Invoice 9002: Balance = $' + inv2?.balance + ', DocNumber = ' + inv2?.docNumber);
  console.log('   - Invoice 9003: Balance = $' + inv3?.balance + ', DocNumber = ' + inv3?.docNumber);

  if (!inv1 || inv1.balance !== 0.0) throw new Error('Invoice 9001 batch data incorrect.');
  if (!inv2 || inv2.balance !== 7500.0) throw new Error('Invoice 9002 batch data incorrect.');
  if (!inv3 || inv3.balance !== 14000.0) throw new Error('Invoice 9003 batch data incorrect.');

  console.log('   [✓ PASS] Batch query correctly retrieved and indexed multiple QBO invoices.\n');

  // TEST 2: Multi-Scenario Reconciliation via Direct Unit Invocation
  console.log('--- TEST 2: Multi-Scenario Financial Discrepancy Auditing ---');

  // Seed simulated invoices in memory
  seedSimulatedQuickBooksInvoice({
    Id: 'INV-SCENARIO-A',
    DocNumber: 'INV-SCENARIO-A',
    TotalAmt: 20000.0,
    Balance: 0.0, // QBO shows settled, CRM still pending
  });

  seedSimulatedQuickBooksInvoice({
    Id: 'INV-SCENARIO-B',
    DocNumber: 'INV-SCENARIO-B',
    TotalAmt: 25000.0,
    Balance: 8500.0, // QBO shows open balance, CRM mistakenly marked Completed
  });

  seedSimulatedQuickBooksInvoice({
    Id: 'INV-SCENARIO-C',
    DocNumber: 'INV-SCENARIO-C',
    TotalAmt: 16000.0,
    Balance: 10000.0, // QBO shows $10,000, CRM ledger expects $15,000 (variance)
  });

  seedSimulatedQuickBooksInvoice({
    Id: 'INV-SCENARIO-D',
    DocNumber: 'INV-SCENARIO-D',
    TotalAmt: 30000.0,
    Balance: 29000.0, // Both QBO and CRM agree on $29,000 balance
  });

  // Seed opportunities directly in HTTP server via PATCH /api/insurance/:id/claim
  // Scenario A: Zero balance in QBO, pending in CRM
  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-a/claim',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    name: 'Alice Cooper Roof',
    customerName: 'Alice Cooper',
    qboInvoiceId: 'INV-SCENARIO-A',
    stage: 'Build Complete - Awaiting Depreciation Check',
    depreciationStatus: 'COC Submitted',
    totalClaimRcv: 20000.0,
    acvInitialAmount: 12000.0,
    deductibleAmountCollected: 1000.0,
    carrierCheckAmount: 7000.0, // 12k + 1k + 7k = 20k -> expected balance 0
  }));

  // Scenario B: Open balance in QBO, marked Completed in CRM
  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-b/claim',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    name: 'Bob Dylan Roof',
    customerName: 'Bob Dylan',
    qboInvoiceId: 'INV-SCENARIO-B',
    stage: 'Completed',
    totalClaimRcv: 25000.0,
    acvInitialAmount: 16500.0,
    deductibleAmountCollected: 0.0,
    carrierCheckAmount: 0.0, // 25k - 16.5k = 8.5k
  }));

  // Scenario C: Balance variance ($10,000 in QBO vs $15,000 in CRM)
  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-c/claim',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    name: 'Charlie Parker Roof',
    customerName: 'Charlie Parker',
    qboInvoiceId: 'INV-SCENARIO-C',
    stage: 'Production / Post-Build',
    totalClaimRcv: 16000.0,
    acvInitialAmount: 1000.0, // 16k - 1k = 15k expected balance
  }));

  // Scenario D: Perfect balance alignment ($29,000 in QBO vs $29,000 in CRM)
  await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-d/claim',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    name: 'Diana Ross Roof',
    customerName: 'Diana Ross',
    qboInvoiceId: 'INV-SCENARIO-D',
    stage: 'Deposit Received / Scheduling',
    totalClaimRcv: 30000.0,
    depositAmountPaid: 1000.0, // 30k - 1k = 29k expected balance
  }));

  // Seed invoices into the server process via /test/qbo/seed
  for (const id of ['INV-SCENARIO-A', 'INV-SCENARIO-B', 'INV-SCENARIO-C', 'INV-SCENARIO-D']) {
    const inv = id === 'INV-SCENARIO-A' ? { Id: id, Balance: 0.0, TotalAmt: 20000.0 }
              : id === 'INV-SCENARIO-B' ? { Id: id, Balance: 8500.0, TotalAmt: 25000.0 }
              : id === 'INV-SCENARIO-C' ? { Id: id, Balance: 10000.0, TotalAmt: 16000.0 }
              : { Id: id, Balance: 29000.0, TotalAmt: 30000.0 };

    await makeRequest({
      hostname: 'localhost',
      port: 4000,
      path: '/test/qbo/seed',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ invoice: inv }));
  }

  // TEST 3: Execute Manual HTTP Trigger Endpoint
  console.log('--- TEST 3: Trigger POST /test/run-nightly-qbo-reconciliation ---');
  const triggerRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/test/run-nightly-qbo-reconciliation',
    method: 'POST',
  });

  console.log('   HTTP status:', triggerRes.status);
  console.log('   Results summary:', triggerRes.body?.results?.summary?.replace(/\n/g, ' '));
  console.log('   Discrepancies identified:', triggerRes.body?.results?.discrepanciesCount);

  if (triggerRes.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${triggerRes.status}`);
  }

  if (triggerRes.body?.results?.discrepanciesCount < 3) {
    throw new Error(`Expected at least 3 discrepancies, found ${triggerRes.body?.results?.discrepanciesCount}`);
  }
  console.log('   [✓ PASS] POST endpoint executed reconciliation successfully.\n');

  // TEST 4: Inspect Opportunity State for Scenario A (Auto-advanced to Completed)
  console.log('--- TEST 4: Inspect Scenario A (Zero Balance Auto-Advance) ---');
  const scenARes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-a',
    method: 'GET',
  });

  const oppA = scenARes.body?.claim || {};
  console.log('   - stage:', oppA.stage);
  console.log('   - depreciationStatus:', oppA.depreciationStatus);
  console.log('   - qboLiveBalance:', oppA.qboLiveBalance);
  console.log('   - reconciliationVariance:', oppA.reconciliationVariance);
  console.log('   - lastReconciledAt:', oppA.lastReconciledAt);

  if (oppA.stage !== 'Completed') {
    throw new Error(`Scenario A: Expected stage === 'Completed', got '${oppA.stage}'`);
  }
  if (oppA.depreciationStatus !== 'Released / Paid') {
    throw new Error(`Scenario A: Expected depreciationStatus === 'Released / Paid', got '${oppA.depreciationStatus}'`);
  }
  if (oppA.qboLiveBalance !== 0) {
    throw new Error(`Scenario A: Expected qboLiveBalance === 0, got ${oppA.qboLiveBalance}`);
  }
  if (!oppA.lastReconciledAt) {
    throw new Error('Scenario A: Expected lastReconciledAt timestamp.');
  }
  console.log('   [✓ PASS] Opportunity with $0 balance auto-advanced to Completed.\n');

  // TEST 5: Inspect Opportunity State for Scenario B (Reopened from Completed)
  console.log('--- TEST 5: Inspect Scenario B (Reopened to Payment Issue / Balance Due) ---');
  const scenBRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-b',
    method: 'GET',
  });

  const oppB = scenBRes.body?.claim || {};
  console.log('   - stage:', oppB.stage);
  console.log('   - qboLiveBalance:', oppB.qboLiveBalance);
  console.log('   - reconciliationVariance:', oppB.reconciliationVariance);
  console.log('   - lastReconciledAt:', oppB.lastReconciledAt);

  if (oppB.stage !== 'Payment Issue / Balance Due') {
    throw new Error(`Scenario B: Expected stage === 'Payment Issue / Balance Due', got '${oppB.stage}'`);
  }
  if (oppB.qboLiveBalance !== 8500) {
    throw new Error(`Scenario B: Expected qboLiveBalance === 8500, got ${oppB.qboLiveBalance}`);
  }
  console.log('   [✓ PASS] Prematurely completed job reopened to Payment Issue / Balance Due.\n');

  // TEST 6: Inspect Opportunity State for Scenario C (Ledger Variance Recorded)
  console.log('--- TEST 6: Inspect Scenario C (Variance Logged) ---');
  const scenCRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-c',
    method: 'GET',
  });

  const oppC = scenCRes.body?.claim || {};
  console.log('   - qboLiveBalance:', oppC.qboLiveBalance);
  console.log('   - reconciliationVariance:', oppC.reconciliationVariance);

  if (oppC.qboLiveBalance !== 10000) {
    throw new Error(`Scenario C: Expected qboLiveBalance === 10000, got ${oppC.qboLiveBalance}`);
  }
  if (Math.abs(Number(oppC.reconciliationVariance)) < 1.0) {
    throw new Error(`Scenario C: Expected non-zero reconciliationVariance, got ${oppC.reconciliationVariance}`);
  }
  console.log('   [✓ PASS] Ledger variance accurately calculated and stamped.\n');

  // TEST 7: Inspect Opportunity State for Scenario D (Zero Variance Alignment)
  console.log('--- TEST 7: Inspect Scenario D (Aligned Balances) ---');
  const scenDRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/insurance/opp-scen-d',
    method: 'GET',
  });

  const oppD = scenDRes.body?.claim || {};
  console.log('   - stage:', oppD.stage);
  console.log('   - qboLiveBalance:', oppD.qboLiveBalance);
  console.log('   - reconciliationVariance:', oppD.reconciliationVariance);
  console.log('   - lastReconciledAt:', oppD.lastReconciledAt);

  if (oppD.qboLiveBalance !== 29000) {
    throw new Error(`Scenario D: Expected qboLiveBalance === 29000, got ${oppD.qboLiveBalance}`);
  }
  if (oppD.reconciliationVariance !== 0) {
    throw new Error(`Scenario D: Expected reconciliationVariance === 0, got ${oppD.reconciliationVariance}`);
  }
  if (oppD.stage !== 'Deposit Received / Scheduling') {
    throw new Error(`Scenario D: Expected stage preserved as 'Deposit Received / Scheduling', got '${oppD.stage}'`);
  }
  console.log('   [✓ PASS] Aligned balances preserve stage and record zero variance.\n');

  console.log('======================================================================');
  console.log('=== ALL 7 TESTS PASSED: NIGHTLY QBO RECONCILIATION OPERATIONAL     ===');
  console.log('======================================================================');
}

runNightlyQboReconciliationVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  });
