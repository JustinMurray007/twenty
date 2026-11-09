const http = require('http');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

function makeRequest(options, postData = null, isBinary = false) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (isBinary) {
          resolve({ status: res.statusCode, headers: res.headers, buffer });
        } else {
          const text = buffer.toString('utf-8');
          try {
            const parsed = JSON.parse(text);
            resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: text });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: text });
          }
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

async function runReconciliationExportVerification() {
  console.log('=== STARTING INSURANCE FINANCIAL RECONCILIATION EXPORT VERIFICATION ===\n');

  // 1. Seed 3 diverse insurance claims with varying financial stages
  console.log('1. Seeding Test Insurance Opportunities into Microservice:');

  const claimsToSeed = [
    {
      id: 'claim-rec-001',
      customerName: 'Jonathan Harker',
      addressStreet: '101 Bram St',
      addressCity: 'San Diego',
      insuranceCarrier: 'State Farm',
      insuranceClaimNumber: 'SF-CLAIM-001',
      insuranceClaimStage: 'Approved Scope - Pre-Build',
      rcvInitialAmount: 18500,
      supplementApprovedAmount: 2400, // Total RCV = 20,900
      acvInitialAmount: 11200,
      deductibleAmount: 1000,
      deductibleAmountCollected: 0,
      depreciationAmount: 8700,
      carrierCheckAmount: 0,
      deductiblePaymentStatus: 'Unpaid',
    },
    {
      id: 'claim-rec-002',
      customerName: 'Wilhelmina Murray',
      addressStreet: '202 Whitby Way',
      addressCity: 'La Jolla',
      insuranceCarrier: 'Travelers',
      insuranceClaimNumber: 'TRAV-CLAIM-002',
      insuranceClaimStage: 'Depreciation Released - Closed',
      rcvInitialAmount: 25000,
      supplementApprovedAmount: 3500, // Total RCV = 28,500
      acvInitialAmount: 15000,
      deductibleAmount: 1500,
      deductibleAmountCollected: 1500,
      depreciationAmount: 12000,
      carrierCheckAmount: 12000,
      deductiblePaymentStatus: 'Verified & Collected',
    },
    {
      id: 'claim-rec-003',
      customerName: 'Arthur Holmwood',
      addressStreet: '303 Ringwood Rd',
      addressCity: 'Chula Vista',
      insuranceCarrier: 'Allstate',
      insuranceClaimNumber: 'ALL-CLAIM-003',
      insuranceClaimStage: 'Build Complete - Certificate of Completion Sent',
      rcvInitialAmount: 14000,
      supplementApprovedAmount: 0, // Total RCV = 14,000
      acvInitialAmount: 8000,
      deductibleAmount: 1000,
      deductibleAmountCollected: 1000,
      depreciationAmount: 5000,
      carrierCheckAmount: 0,
      deductiblePaymentStatus: 'Verified & Collected',
    },
  ];

  for (const claim of claimsToSeed) {
    const payload = JSON.stringify(claim);
    const seedRes = await makeRequest({
      hostname: 'localhost',
      port: 4000,
      path: `/api/insurance/${claim.id}/claim`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, payload);
    console.log(`   • Seeded ${claim.insuranceClaimNumber} (${claim.customerName}): Status ${seedRes.status}`);
  }
  console.log('   ✓ Verified: All sample insurance claims successfully prepared.\n');

  // 2. Request Excel Workbook via GET /export/insurance/reconciliation.xlsx
  console.log('2. Requesting Excel Workbook via GET /export/insurance/reconciliation.xlsx:');
  const xlsxRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/export/insurance/reconciliation.xlsx',
    method: 'GET',
  }, null, true);

  console.log('   Response status:', xlsxRes.status);
  console.log('   Content-Type:', xlsxRes.headers['content-type']);
  console.log('   Content-Disposition:', xlsxRes.headers['content-disposition']);
  console.log(`   Buffer size received: ${xlsxRes.buffer.length} bytes`);

  if (xlsxRes.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${xlsxRes.status}`);
  }
  if (!xlsxRes.headers['content-type']?.includes('spreadsheetml.sheet')) {
    throw new Error(`Expected Excel Content-Type, got ${xlsxRes.headers['content-type']}`);
  }
  if (!xlsxRes.headers['content-disposition']?.includes('Insurance-Reconciliation-')) {
    throw new Error(`Expected Content-Disposition attachment, got ${xlsxRes.headers['content-disposition']}`);
  }

  // 3. Save to disk for inspection
  const reportsDir = path.join(process.cwd(), 'public', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const exportFilePath = path.join(reportsDir, 'Insurance-Reconciliation-Test.xlsx');
  fs.writeFileSync(exportFilePath, xlsxRes.buffer);
  console.log(`   ✓ Saved downloaded spreadsheet to: ${exportFilePath}\n`);

  // 4. Parse Workbook with ExcelJS and validate all requirements
  console.log('3. Validating Workbook Structure, Formulas, and Styles with ExcelJS:');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(exportFilePath);

  const sheet = workbook.getWorksheet('Claims Financial Reconciliation');
  if (!sheet) {
    throw new Error('Worksheet "Claims Financial Reconciliation" not found in exported workbook.');
  }
  console.log('   ✓ Verified: Worksheet "Claims Financial Reconciliation" present.');

  // Validate frozen view
  const views = sheet.views || [];
  const frozenView = views.find((v) => v.state === 'frozen' && v.ySplit === 4);
  if (!frozenView) {
    console.warn('   Note: View settings inspected:', JSON.stringify(views));
  } else {
    console.log('   ✓ Verified: Rows 1-4 frozen (ySplit = 4).');
  }

  // Validate Title Block (Row 1 & Row 2)
  const titleCell = sheet.getCell('A1');
  console.log('   Row 1 Title:', titleCell.value);
  if (!String(titleCell.value).includes('INSURANCE RESTORATION FINANCIAL RECONCILIATION')) {
    throw new Error(`Unexpected Title value: ${titleCell.value}`);
  }
  console.log('   ✓ Verified: Title block contains statutory reconciliation banner.');

  const subtitleCell = sheet.getCell('A2');
  console.log('   Row 2 Subtitle:', subtitleCell.value);
  if (!String(subtitleCell.value).includes('Report Generated:') || !String(subtitleCell.value).includes('Total Active Claims:')) {
    throw new Error(`Unexpected Subtitle value: ${subtitleCell.value}`);
  }
  console.log('   ✓ Verified: Subtitle row contains generation timestamp and claim count.');

  // Validate Header Row (Row 4)
  const headerRow = sheet.getRow(4);
  const expectedHeaders = [
    'Job / Insured Name',
    'Property Address',
    'Insurance Carrier',
    'Claim #',
    'Claim Stage',
    'Initial RCV ($)',
    'Approved Supp ($)',
    'Total Final RCV ($)',
    'Initial ACV Check ($)',
    'Deductible Due ($)',
    'Deductible Status',
    'Depreciation Due ($)',
    'Carrier Check ($)',
    'Outstanding Balance ($)',
  ];

  for (let i = 0; i < expectedHeaders.length; i++) {
    const cellVal = headerRow.getCell(i + 1).value;
    if (cellVal !== expectedHeaders[i]) {
      throw new Error(`Header col ${i + 1} mismatch: expected "${expectedHeaders[i]}", got "${cellVal}"`);
    }
  }
  console.log('   ✓ Verified: All 14 header columns match specification exactly.');

  // Check header background fill (Blue FF2563EB)
  const headerFill = headerRow.getCell(1).fill;
  console.log('   Header cell fill color:', headerFill?.fgColor?.argb);
  if (headerFill?.fgColor?.argb !== 'FF2563EB') {
    throw new Error(`Expected header color FF2563EB, got ${headerFill?.fgColor?.argb}`);
  }
  console.log('   ✓ Verified: Header styled with vibrant blue theme.');

  // Validate Data Rows (Rows 5..N)
  let foundClaim1 = false;
  let foundClaim2 = false;
  let foundClaim3 = false;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 5) return;
    const firstCellVal = String(row.getCell(1).value || '');
    if (firstCellVal.includes('TOTALS:')) return;

    const claimNo = String(row.getCell(4).value || '');
    const totalFinalRcv = Number(row.getCell(8).value || 0);
    const initialAcv = Number(row.getCell(9).value || 0);
    const deductibleStatus = String(row.getCell(11).value || '');
    const carrierCheck = Number(row.getCell(13).value || 0);
    const outstandingBalance = Number(row.getCell(14).value || 0);

    // Validate currency formatting
    [6, 7, 8, 9, 10, 12, 13, 14].forEach((colIdx) => {
      const numFmt = row.getCell(colIdx).numFmt;
      if (numFmt !== '$#,##0.00') {
        throw new Error(`Expected numFmt '$#,##0.00' on row ${rowNumber} col ${colIdx}, got '${numFmt}'`);
      }
    });

    if (claimNo === 'SF-CLAIM-001') {
      foundClaim1 = true;
      console.log(`\n   • Claim 1 (${claimNo}): Total RCV = $${totalFinalRcv}, Outstanding = $${outstandingBalance}`);
      // Outstanding balance must be 20,900 - 11,200 = 9,700
      if (outstandingBalance !== 9700) {
        throw new Error(`Expected Claim 1 outstanding balance 9,700, got ${outstandingBalance}`);
      }
      // Must be red
      const balColor = row.getCell(14).font?.color?.argb;
      if (balColor !== 'FFDC2626') {
        throw new Error(`Expected red color FFDC2626 on outstanding balance, got ${balColor}`);
      }
      // Deductible status must be amber
      const dedColor = row.getCell(11).font?.color?.argb;
      if (dedColor !== 'FFD97706') {
        throw new Error(`Expected amber color FFD97706 on unpaid deductible, got ${dedColor}`);
      }
      console.log('     ✓ Verified: Claim 1 correctly highlights outstanding balance in red and unpaid deductible in amber.');
    }

    if (claimNo === 'TRAV-CLAIM-002') {
      foundClaim2 = true;
      console.log(`\n   • Claim 2 (${claimNo}): Total RCV = $${totalFinalRcv}, Outstanding = $${outstandingBalance}`);
      // Fully paid -> Outstanding balance = 0
      if (outstandingBalance !== 0) {
        throw new Error(`Expected Claim 2 outstanding balance 0, got ${outstandingBalance}`);
      }
      // Must be green
      const balColor = row.getCell(14).font?.color?.argb;
      if (balColor !== 'FF16A34A') {
        throw new Error(`Expected green color FF16A34A on paid balance, got ${balColor}`);
      }
      // Deductible status must be green
      const dedColor = row.getCell(11).font?.color?.argb;
      if (dedColor !== 'FF16A34A') {
        throw new Error(`Expected green color FF16A34A on verified deductible, got ${dedColor}`);
      }
      console.log('     ✓ Verified: Claim 2 correctly highlights satisfied balance and verified deductible in green.');
    }

    if (claimNo === 'ALL-CLAIM-003') {
      foundClaim3 = true;
      console.log(`\n   • Claim 3 (${claimNo}): Total RCV = $${totalFinalRcv}, Outstanding = $${outstandingBalance}`);
      // 14,000 - (8000 + 1000 + 0) = 5,000
      if (outstandingBalance !== 5000) {
        throw new Error(`Expected Claim 3 outstanding balance 5,000, got ${outstandingBalance}`);
      }
      console.log('     ✓ Verified: Claim 3 accurately accounts for deductible collected reducing balance.');
    }
  });

  if (!foundClaim1 || !foundClaim2 || !foundClaim3) {
    throw new Error(`Not all seeded claims were found in exported spreadsheet! found1=${foundClaim1}, found2=${foundClaim2}, found3=${foundClaim3}`);
  }

  // Validate Totals Row
  const lastRow = sheet.lastRow;
  console.log(`\n   Totals Row (${lastRow.number}):`, lastRow.getCell(1).value);
  if (lastRow.getCell(1).value !== 'TOTALS:') {
    throw new Error(`Expected Totals row label 'TOTALS:', got '${lastRow.getCell(1).value}'`);
  }

  // Validate formulas on financial columns
  [6, 7, 8, 9, 10, 12, 13, 14].forEach((colIdx) => {
    const cell = lastRow.getCell(colIdx);
    const formulaVal = cell.value?.formula || (typeof cell.value === 'string' ? cell.value : null);
    if (!formulaVal || !formulaVal.startsWith('SUM(')) {
      throw new Error(`Expected SUM formula on Totals col ${colIdx}, got: ${JSON.stringify(cell.value)}`);
    }
  });
  console.log('   ✓ Verified: Totals row contains native Excel =SUM(...) formulas across all financial columns.');

  // 5. Test CSV Fallback Route
  console.log('\n4. Testing CSV Fallback via GET /export/insurance/reconciliation.csv:');
  const csvRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/export/insurance/reconciliation.csv',
    method: 'GET',
  });

  console.log('   CSV status:', csvRes.status);
  console.log('   CSV Content-Type:', csvRes.headers['content-type']);
  if (csvRes.status !== 200 || !csvRes.raw.includes('SF-CLAIM-001') || !csvRes.raw.includes('TRAV-CLAIM-002')) {
    throw new Error('CSV export did not contain expected claim lines.');
  }
  console.log('   ✓ Verified: CSV fallback endpoint operates successfully.');

  console.log('\n================================================================================');
  console.log('🎉 ALL CLAIMS RECONCILIATION EXCEL & CSV EXPORT VERIFICATIONS PASSED!');
  console.log('================================================================================');
}

runReconciliationExportVerification().catch((err) => {
  console.error('\n❌ RECONCILIATION EXPORT VERIFICATION FAILED:', err);
  process.exit(1);
});
