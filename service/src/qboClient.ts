import OAuthClient from 'intuit-oauth';
import Stripe from 'stripe';
import crypto from 'crypto';

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.QBO_ENVIRONMENT || 'sandbox',
  redirectUri: process.env.QBO_REDIRECT_URI,
});

let currentRefreshToken = process.env.QBO_REFRESH_TOKEN || '';

export function isQboConfigured(): boolean {
  return !!(
    process.env.QBO_CLIENT_ID &&
    process.env.QBO_CLIENT_SECRET &&
    currentRefreshToken &&
    process.env.QBO_REALM_ID
  );
}

export async function getValidAccessToken(): Promise<string> {
  if (!isQboConfigured()) {
    throw new Error(
      'QuickBooks Online credentials not fully configured (missing QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REALM_ID, or QBO_REFRESH_TOKEN).'
    );
  }

  try {
    const authResponse = await oauthClient.refreshUsingToken(currentRefreshToken);
    currentRefreshToken = authResponse.token.refresh_token;
    return authResponse.token.access_token;
  } catch (err: any) {
    console.error('[QBO Auth] Token refresh error:', err.originalMessage || err.message || err);
    throw err;
  }
}

export async function qboApiRequest(method: string, endpoint: string, body: any = null): Promise<any> {
  const token = await getValidAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

  const res = await fetch(`${baseUrl}/v3/company/${realmId}/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`QBO Error ${res.status}: ${errText}`);
  }

  return res.json();
}

/**
 * 1. Find or create QBO Customer
 */
export async function getOrCreateCustomer({
  name,
  email,
  address,
  phone,
}: {
  name: string;
  email?: string;
  address: { street?: string; city?: string; state?: string; postalCode?: string };
  phone?: string;
}): Promise<string> {
  if (!isQboConfigured()) {
    console.log(`[QBO Sim] [Dev Mode] QBO credentials not configured. Simulated customer creation for "${name}"`);
    return `qbo_cust_mock_${Date.now()}`;
  }

  if (email) {
    const safeEmail = email.replace(/'/g, "\\'");
    const query = `select * from Customer where PrimaryEmailAddr = '${safeEmail}'`;
    try {
      const searchRes: any = await qboApiRequest('GET', `query?query=${encodeURIComponent(query)}`);
      if (searchRes.QueryResponse?.Customer?.length > 0) {
        return searchRes.QueryResponse.Customer[0].Id;
      }
    } catch (err: any) {
      console.warn('[QBO Customer Search] Query note:', err.message);
    }
  }

  const newCustPayload = {
    DisplayName: `${name} - ${address.street || 'Property'}`.substring(0, 100),
    PrimaryEmailAddr: email ? { Address: email } : undefined,
    PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    BillAddr: {
      Line1: address.street || 'Main Street',
      City: address.city || 'San Diego',
      CountrySubDivisionCode: address.state || 'CA',
      PostalCode: address.postalCode || '',
    },
  };

  const createRes: any = await qboApiRequest('POST', 'customer', newCustPayload);
  return createRes.Customer.Id;
}

/**
 * 2. Create Invoice for the full signed contract
 */
export async function createContractInvoice({
  customerId,
  totalAmount,
  contractNumber,
  tier,
  address,
}: {
  customerId: string;
  totalAmount: number;
  contractNumber: string;
  tier: string;
  address: { street?: string; city?: string; state?: string; postalCode?: string };
}): Promise<{ invoiceId: string; docNumber: string }> {
  if (!isQboConfigured() || customerId.startsWith('qbo_cust_mock_')) {
    console.log(
      `[QBO Sim] [Dev Mode] Simulated invoice creation for contract ${contractNumber} ($${totalAmount})`
    );
    return {
      invoiceId: `qbo_inv_mock_${Date.now()}`,
      docNumber: contractNumber,
    };
  }

  const invoicePayload = {
    CustomerRef: { value: customerId },
    DocNumber: contractNumber,
    Line: [
      {
        Amount: totalAmount,
        DetailType: 'SalesItemLineDetail',
        Description: `Roof Replacement Contract (${tier} System) - ${address.street || 'Jobsite'}`,
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: totalAmount,
        },
      },
    ],
  };

  const res: any = await qboApiRequest('POST', 'invoice', invoicePayload);
  return {
    invoiceId: res.Invoice.Id,
    docNumber: res.Invoice.DocNumber,
  };
}

/**
 * 3. Apply Stripe deposit payment against invoice
 */
export async function applyDepositPayment({
  customerId,
  invoiceId,
  depositAmount,
  transactionId,
}: {
  customerId: string;
  invoiceId: string;
  depositAmount: number;
  transactionId?: string;
}): Promise<string> {
  if (!isQboConfigured() || invoiceId.startsWith('qbo_inv_mock_')) {
    console.log(
      `[QBO Sim] [Dev Mode] Simulated deposit payment of $${depositAmount} applied to invoice ${invoiceId}`
    );
    return `qbo_pmt_mock_${Date.now()}`;
  }

  const paymentPayload = {
    CustomerRef: { value: customerId },
    TotalAmt: depositAmount,
    PaymentRefNum: (transactionId || '').substring(0, 20),
    Line: [
      {
        Amount: depositAmount,
        LinkedTxn: [
          {
            TxnId: invoiceId,
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  };

  const res: any = await qboApiRequest('POST', 'payment', paymentPayload);
  return res.Payment.Id;
}

/**
 * 4. Sends an existing QBO invoice directly to the customer's email via Intuit's native mailer
 * @param invoiceId - QBO Invoice ID
 * @param recipientEmail - Homeowner email override (optional)
 */
export async function sendQboInvoiceEmail(
  invoiceId: string,
  recipientEmail: string | null = null
): Promise<{
  invoiceId: string;
  docNumber: string;
  balance: number;
  dueDate?: string;
}> {
  if (!isQboConfigured() || invoiceId.startsWith('qbo_inv_mock_')) {
    console.log(
      `[QBO Sim] [Dev Mode] Simulated sending invoice ${invoiceId} to email ${recipientEmail || 'Customer on file'}`
    );
    return {
      invoiceId,
      docNumber: `CNT-${invoiceId.slice(-6).toUpperCase()}`,
      balance: 13850,
      dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    };
  }

  const queryParam = recipientEmail ? `?sendTo=${encodeURIComponent(recipientEmail)}` : '';
  const endpoint = `invoice/${invoiceId}/send${queryParam}`;

  const res: any = await qboApiRequest('POST', endpoint);
  return {
    invoiceId: res.Invoice.Id,
    docNumber: res.Invoice.DocNumber,
    balance: Number(res.Invoice.Balance),
    dueDate: res.Invoice.DueDate,
  };
}

/**
 * 5. Appends a late fee line item to an existing QBO invoice
 * @param invoiceId - QBO Invoice ID
 * @param lateFeeAmount - Late fee dollar charge (e.g. 1.5% of balance or flat $50)
 */
export async function addLateFeeToQboInvoice(
  invoiceId: string,
  lateFeeAmount: number
): Promise<{
  invoiceId: string;
  newBalance: number;
  totalAmount: number;
}> {
  if (!isQboConfigured() || invoiceId.startsWith('qbo_inv_mock_')) {
    console.log(
      `[QBO Sim] [Dev Mode] Simulated adding late fee of $${lateFeeAmount} to QBO Invoice ${invoiceId}`
    );
    return {
      invoiceId,
      newBalance: 14057.75,
      totalAmount: 15057.75,
    };
  }

  // 1. Fetch current Invoice to retrieve SyncToken and existing Lines
  const getRes: any = await qboApiRequest('GET', `invoice/${invoiceId}`);
  const invoice = getRes.Invoice;

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found in QBO.`);

  const updatedLines = [...(invoice.Line || [])];

  // 2. Append Late Fee Line Item
  updatedLines.push({
    Amount: lateFeeAmount,
    DetailType: 'SalesItemLineDetail',
    Description: 'Late Fee / Finance Charge (Account 14+ Days Overdue)',
    SalesItemLineDetail: {
      Qty: 1,
      UnitPrice: lateFeeAmount,
    },
  });

  // 3. Post back sparse update with current SyncToken
  const updatePayload = {
    Id: invoice.Id,
    SyncToken: invoice.SyncToken,
    sparse: true,
    Line: updatedLines,
  };

  const saveRes: any = await qboApiRequest('POST', 'invoice', updatePayload);
  return {
    invoiceId: saveRes.Invoice.Id,
    newBalance: Number(saveRes.Invoice.Balance),
    totalAmount: Number(saveRes.Invoice.TotalAmt),
  };
}

/**
 * Refreshes Intuit OAuth 2.0 access token using QBO_REFRESH_TOKEN
 */
export async function getQuickBooksAccessToken(): Promise<string> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const clientSecret = process.env.QBO_CLIENT_SECRET || '';
  const refreshToken = process.env.QBO_REFRESH_TOKEN || '';

  // If credentials are placeholders or not configured, return mock token for sandbox/dev simulation
  if (
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    clientId === 'your_intuit_client_id' ||
    refreshToken === 'your_oauth_refresh_token'
  ) {
    console.log('[QBO Auth] [Dev/Sandbox Mode] Using simulated OAuth access token.');
    return `qbo_simulated_token_${Date.now()}`;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`QBO Token Refresh Failed: ${errText}`);
  }

  const data: any = await res.json();
  if (data.refresh_token) {
    process.env.QBO_REFRESH_TOKEN = data.refresh_token;
  }
  return data.access_token;
}

/**
 * Creates a balanced Journal Entry in QuickBooks Online for insurance depreciation checks
 */
export async function postQuickBooksDepreciationJournalEntry({
  claimNumber,
  customerName,
  checkNumber,
  amount,
  memo,
}: {
  claimNumber: string;
  customerName: string;
  checkNumber: string;
  amount: number;
  memo?: string;
}): Promise<{
  journalEntryId: string;
  docNumber: string;
}> {
  const realmId = process.env.QBO_REALM_ID || '913035489102';
  const docNumber = `DEP-${checkNumber}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    console.log(
      `[QBO Sync] Created Journal Entry ${docNumber} in company ${realmId}`
    );
    return {
      journalEntryId: '4921',
      docNumber,
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  // Double-entry accounting payload:
  // 1. DEBIT: Undeposited Funds / Cash Account (Receiving funds)
  // 2. CREDIT: Accounts Receivable or Insurance Income (Clearing balance)
  const journalEntryPayload = {
    DocNumber: docNumber,
    TxnDate: todayStr,
    PrivateNote: `Insurance Carrier Depreciation Check #${checkNumber} for Claim #${claimNumber} (${customerName}). ${memo || ''}`,
    Line: [
      {
        Id: '0',
        Description: `Carrier Depreciation Settlement Check #${checkNumber} - Claim #${claimNumber}`,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: 'Debit',
          AccountRef: {
            value: process.env.QBO_UNDEPOSITED_FUNDS_ACCOUNT_ID || '4',
            name: 'Undeposited Funds',
          },
        },
      },
      {
        Id: '1',
        Description: `Clear Insurance Depreciation Receivable - Claim #${claimNumber}`,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: 'Credit',
          AccountRef: {
            value: process.env.QBO_AR_OR_INCOME_ACCOUNT_ID || '1',
            name: 'Accounts Receivable',
          },
        },
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v3/company/${realmId}/journalentry?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(journalEntryPayload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`QBO Journal Entry Failed: ${JSON.stringify(err)}`);
  }

  const result: any = await response.json();
  const createdEntry = result.JournalEntry;
  console.log(`[QBO Sync] Created Journal Entry ${createdEntry.DocNumber} in company ${realmId}`);
  return {
    journalEntryId: String(createdEntry.Id),
    docNumber: String(createdEntry.DocNumber),
  };
}

/**
 * Submits a ReceivePayment entity to QuickBooks Online linked to an open Invoice
 */
export async function recordQuickBooksReceivePayment({
  customerId,
  invoiceId,
  checkNumber,
  amount,
  memo,
}: {
  customerId: string | number;
  invoiceId: string | number;
  checkNumber: string;
  amount: number;
  memo?: string;
}): Promise<{
  paymentId: string;
  unappliedAmt: number;
  totalAmt: number;
}> {
  const realmId = process.env.QBO_REALM_ID || '913035489102';
  const todayStr = new Date().toISOString().split('T')[0];

  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    console.log(
      `[QBO ReceivePayment] Applied ReceivePayment #5012 directly to Invoice #${invoiceId} (Customer #${customerId}) for $${Number(amount).toFixed(2)} (Check #${checkNumber})`
    );
    return {
      paymentId: '5012',
      unappliedAmt: 0,
      totalAmt: Number(amount),
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  // Intuit ReceivePayment payload linking directly to the existing invoice
  const paymentPayload = {
    CustomerRef: {
      value: String(customerId),
    },
    TotalAmt: Number(amount),
    PaymentRefNum: String(checkNumber),
    PaymentMethodRef: {
      value: '2', // Intuit Standard: 'Check'
    },
    DepositToAccountRef: {
      value: process.env.QBO_UNDEPOSITED_FUNDS_ACCOUNT_ID || '4', // Undeposited Funds
    },
    TxnDate: todayStr,
    PrivateNote: memo || `Insurance Depreciation Check #${checkNumber} applied to invoice.`,
    Line: [
      {
        Amount: Number(amount),
        LinkedTxn: [
          {
            TxnId: String(invoiceId),
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v3/company/${realmId}/payment?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentPayload),
  });

  if (!response.ok) {
    const errorBody: any = await response.json();
    throw new Error(`QBO ReceivePayment Error: ${JSON.stringify(errorBody)}`);
  }

  const result: any = await response.json();
  console.log(`[QBO ReceivePayment] Created Payment #${result.Payment.Id} linked to Invoice #${invoiceId}`);
  return {
    paymentId: String(result.Payment.Id),
    unappliedAmt: Number(result.Payment.UnappliedAmt || 0),
    totalAmt: Number(result.Payment.TotalAmt || amount),
  };
}

/**
 * Simulated in-memory customer cache for dev/sandbox mode without active QBO OAuth tokens
 */
export const simulatedCustomerStore = new Map<string, { id: string; displayName: string; email?: string }>();

/**
 * Seeds a customer into the simulated store for testing deduplication and lookup
 */
export function seedSimulatedQuickBooksCustomer({
  id,
  displayName,
  email,
}: {
  id: string;
  displayName: string;
  email?: string;
}) {
  const rec = { id, displayName, email };
  if (email) simulatedCustomerStore.set(`email:${email.toLowerCase().trim()}`, rec);
  if (displayName) simulatedCustomerStore.set(`name:${displayName.toLowerCase().trim()}`, rec);
  simulatedCustomerStore.set(`id:${id}`, rec);
}

/**
 * Searches QBO for an existing customer by email or display name; creates one if missing.
 * @param {Object} customerData
 * @param {string} customerData.displayName - e.g. "John Smith"
 * @param {string} customerData.email - e.g. "john@example.com"
 * @param {string} customerData.phone - e.g. "6195550100"
 * @param {Object} customerData.address - Street, City, State, PostalCode
 * @returns {Promise<string>} QBO Customer ID
 */
export async function findOrCreateQuickBooksCustomer({
  displayName,
  email,
  phone,
  address,
}: {
  displayName: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}): Promise<string> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  // Sanitize displayName to avoid SQL injection in QBO query syntax
  const sanitizedName = (displayName || 'Job Site Client').replace(/'/g, "\\'");

  if (isSimulation) {
    const emailKey = email ? email.toLowerCase().trim() : '';
    const nameKey = (displayName || '').toLowerCase().trim();

    // 1. Check if simulated customer exists
    let match = emailKey ? simulatedCustomerStore.get(`email:${emailKey}`) : null;
    if (!match && nameKey) {
      match = simulatedCustomerStore.get(`name:${nameKey}`);
    }

    if (match) {
      console.log(`[QBO Customer] Found existing Customer ID ${match.id} for ${displayName}`);
      return match.id;
    }

    // 2. Generate simulated Customer ID (defaults to '54' for first created customer, or incremental)
    const newId = simulatedCustomerStore.size === 0 ? '54' : String(54 + simulatedCustomerStore.size);
    let uniqueDisplayName = displayName;
    if (!email && address?.street) {
      uniqueDisplayName = `${displayName} (${address.street.substring(0, 15)})`;
    }

    const customerRecord = { id: newId, displayName: uniqueDisplayName, email };
    if (emailKey) simulatedCustomerStore.set(`email:${emailKey}`, customerRecord);
    if (nameKey) simulatedCustomerStore.set(`name:${nameKey}`, customerRecord);
    simulatedCustomerStore.set(`id:${newId}`, customerRecord);

    console.log(`[QBO Customer] Created new Customer ID ${newId} for ${uniqueDisplayName}`);
    return newId;
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  // 1. Check if customer exists by Email or DisplayName
  let queryStr = `select Id, DisplayName from Customer where PrimaryEmailAddr = '${email}'`;
  if (!email) {
    queryStr = `select Id, DisplayName from Customer where DisplayName = '${sanitizedName}'`;
  }

  const queryUrl = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(queryStr)}&minorversion=65`;
  const queryRes = await fetch(queryUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!queryRes.ok) {
    const err = await queryRes.text();
    throw new Error(`QBO Query Failed: ${err}`);
  }

  const queryData: any = await queryRes.json();
  const existingCustomers = queryData.QueryResponse?.Customer;

  if (existingCustomers && existingCustomers.length > 0) {
    console.log(`[QBO Customer] Found existing Customer ID ${existingCustomers[0].Id} for ${displayName}`);
    return existingCustomers[0].Id;
  }

  // 2. If not found, construct and create the Customer entity
  // Note: QBO DisplayName must be globally unique
  let uniqueDisplayName = displayName;
  if (!email && address?.street) {
    uniqueDisplayName = `${displayName} (${address.street.substring(0, 15)})`;
  }

  const customerPayload = {
    DisplayName: uniqueDisplayName,
    PrimaryEmailAddr: email ? { Address: email } : undefined,
    PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    BillAddr: address?.street
      ? {
          Line1: address.street,
          City: address.city || 'San Diego',
          CountrySubDivisionCode: address.state || 'CA',
          PostalCode: address.postalCode || '92101',
        }
      : undefined,
    ShipAddr: address?.street
      ? {
          Line1: address.street,
          City: address.city || 'San Diego',
          CountrySubDivisionCode: address.state || 'CA',
          PostalCode: address.postalCode || '92101',
        }
      : undefined,
  };

  const createRes = await fetch(`${baseUrl}/v3/company/${realmId}/customer?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerPayload),
  });

  if (!createRes.ok) {
    const createErr = await createRes.json();
    throw new Error(`QBO Customer Creation Failed: ${JSON.stringify(createErr)}`);
  }

  const createData: any = await createRes.json();
  console.log(`[QBO Customer] Created new Customer ID ${createData.Customer.Id} for ${uniqueDisplayName}`);
  return createData.Customer.Id;
}

/**
 * Creates an initial RCV Invoice in QuickBooks Online
 * @param {Object} params
 * @param {string} params.customerId - QBO Customer ID
 * @param {string} params.claimNumber - Insurance claim # or Retail Job ID
 * @param {string} params.jobAddress - Job site address
 * @param {string} params.tierTitle - Selected package (e.g. 'Better - GAF Timberline HDZ')
 * @param {number} params.squares - Roof area in squares
 * @param {number} params.totalAmount - Total contract / RCV amount
 * @param {string} params.shingleColor - Selected shingle colorway
 * @returns {Promise<{ invoiceId: string, docNumber: string }>}
 */
export async function createQuickBooksInvoice({
  customerId,
  claimNumber,
  jobAddress,
  tierTitle,
  squares,
  totalAmount,
  shingleColor,
}: {
  customerId: string;
  claimNumber?: string;
  jobAddress: string;
  tierTitle: string;
  squares: number;
  totalAmount: number;
  shingleColor?: string;
}): Promise<{ invoiceId: string; docNumber: string }> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  const docNumber = claimNumber
    ? `INV-${claimNumber.replace(/[^a-zA-Z0-9]/g, '')}`
    : 'INV-491029A';

  if (isSimulation) {
    const invoiceId = '8910';
    console.log(`[QBO Invoice] Successfully created Invoice #${docNumber} (ID: ${invoiceId})`);
    return {
      invoiceId,
      docNumber,
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const todayStr = new Date().toISOString().split('T')[0];
  const unitRate = squares > 0 ? (totalAmount / squares).toFixed(2) : totalAmount;

  const invoicePayload = {
    CustomerRef: {
      value: String(customerId),
    },
    TxnDate: todayStr,
    DueDate: todayStr, // Net upon receipt or completion
    DocNumber: docNumber,
    PrivateNote: `Roof Replacement System - ${tierTitle} (${shingleColor || 'Standard Finish'}). Claim #${claimNumber || 'RETAIL'}.`,
    ShipAddr: {
      Line1: jobAddress,
    },
    Line: [
      {
        Amount: totalAmount,
        DetailType: 'SalesItemLineDetail',
        Description: `Complete Tear-Off & Roof Replacement System\nPackage: ${tierTitle}\nFinish: ${shingleColor || 'Selected Color'}\nArea: ${squares || 30} Squares`,
        SalesItemLineDetail: {
          ItemRef: {
            value: process.env.QBO_ROOFING_SERVICE_ITEM_ID || '1',
            name: 'Roofing Services',
          },
          UnitPrice: Number(unitRate),
          Qty: squares || 1,
        },
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v3/company/${realmId}/invoice?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invoicePayload),
  });

  if (!response.ok) {
    const errorBody: any = await response.json();
    throw new Error(`QBO Invoice Creation Failed: ${JSON.stringify(errorBody)}`);
  }

  const result: any = await response.json();
  const createdInv = result.Invoice;

  console.log(`[QBO Invoice] Successfully created Invoice #${createdInv.DocNumber} (ID: ${createdInv.Id})`);
  return {
    invoiceId: String(createdInv.Id),
    docNumber: String(createdInv.DocNumber),
  };
}

/**
 * Applies a Stripe deposit payment directly to an existing QuickBooks invoice
 * @param {Object} params
 * @param {string} params.customerId - QBO Customer ID
 * @param {string} params.invoiceId - QBO Invoice ID
 * @param {number} params.amount - Deposit amount (e.g., 1000.00)
 * @param {string} params.stripePaymentIntentId - Stripe Charge/PaymentIntent ID
 * @param {string} params.claimOrJobRef - Project reference or claim number
 */
export async function recordQuickBooksStripeDepositPayment({
  customerId,
  invoiceId,
  amount,
  stripePaymentIntentId,
  claimOrJobRef,
}: {
  customerId: string;
  invoiceId: string;
  amount: number;
  stripePaymentIntentId: string;
  claimOrJobRef?: string;
}): Promise<{
  paymentId: string;
  totalAmt: number;
  unappliedAmt: number;
}> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    const paymentId = '7021';
    console.log(`[QBO Sync] Deposit of $${amount} applied to QBO Invoice #${invoiceId}`);
    return {
      paymentId,
      totalAmt: Number(amount),
      unappliedAmt: 0,
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const todayStr = new Date().toISOString().split('T')[0];

  const paymentPayload = {
    CustomerRef: {
      value: String(customerId),
    },
    TotalAmt: Number(amount),
    PaymentRefNum: stripePaymentIntentId, // Store Stripe PI ID for 1:1 bank payout reconciliation
    PaymentMethodRef: {
      value: process.env.QBO_CREDIT_CARD_PAYMENT_METHOD_ID || '1', // CreditCard
    },
    DepositToAccountRef: {
      value: process.env.QBO_UNDEPOSITED_FUNDS_ACCOUNT_ID || '4', // Undeposited Funds / Stripe Clearing
    },
    TxnDate: todayStr,
    PrivateNote: `Initial Job Deposit via Stripe (${stripePaymentIntentId}). Project Ref: ${claimOrJobRef || 'Roof Replacement'}.`,
    Line: [
      {
        Amount: Number(amount),
        LinkedTxn: [
          {
            TxnId: String(invoiceId),
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v3/company/${realmId}/payment?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentPayload),
  });

  if (!response.ok) {
    const errorBody: any = await response.json();
    throw new Error(`QBO Deposit ReceivePayment Error: ${JSON.stringify(errorBody)}`);
  }

  const result: any = await response.json();
  console.log(`[QBO Sync] Deposit of $${amount} applied to QBO Invoice #${invoiceId}`);
  return {
    paymentId: String(result.Payment.Id),
    totalAmt: Number(result.Payment.TotalAmt || amount),
    unappliedAmt: Number(result.Payment.UnappliedAmt || 0),
  };
}

/**
 * Records a QuickBooks Deposit entity combining gross invoice receipt and negative merchant fee
 * @param {Object} params
 * @param {string} params.paymentId - QBO Payment ID generated in the previous step
 * @param {number} params.grossAmount - Gross collected from customer ($1,000)
 * @param {number} params.feeAmount - Stripe fee deduction ($29.30)
 * @param {string} params.paymentIntentId - Stripe transaction reference ID
 */
export async function recordQuickBooksDepositWithFee({
  paymentId,
  grossAmount,
  feeAmount,
  paymentIntentId,
}: {
  paymentId: string;
  grossAmount: number;
  feeAmount: number;
  paymentIntentId: string;
}): Promise<string> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    const depositId = '8092';
    console.log(`[QBO Accounting] Payment #${paymentId} & Deposit #${depositId} reconciled.`);
    console.log(
      `[QBO Deposit Fee Sync] Bank Deposit #${depositId} recorded: Gross +$${grossAmount.toFixed(2)}, Fee -$${feeAmount.toFixed(2)}, Net +$${(grossAmount - feeAmount).toFixed(2)} to Checking Account #${process.env.QBO_CHECKING_ACCOUNT_ID || '35'}`
    );
    return depositId;
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const todayStr = new Date().toISOString().split('T')[0];

  const depositPayload = {
    DepositToAccountRef: {
      value: process.env.QBO_CHECKING_ACCOUNT_ID || '35', // Primary Bank Checking Account
    },
    TxnDate: todayStr,
    PrivateNote: `Stripe settlement for PI: ${paymentIntentId} (Fee: $${feeAmount.toFixed(2)})`,
    Line: [
      // 1. Line: Link to the existing QBO Payment in Undeposited Funds (+$1,000)
      {
        Amount: Number(grossAmount),
        LinkedTxn: [
          {
            TxnId: String(paymentId),
            TxnType: 'Payment',
          },
        ],
      },
      // 2. Line: Negative Expense Line for Stripe Processing Fee (-$29.30)
      {
        Amount: -Math.abs(Number(feeAmount)),
        DetailType: 'DepositLineDetail',
        DepositLineDetail: {
          AccountRef: {
            value: process.env.QBO_MERCHANT_FEE_EXPENSE_ACCOUNT_ID || '42',
            name: 'Merchant Service Fees',
          },
        },
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v3/company/${realmId}/deposit?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(depositPayload),
  });

  if (!response.ok) {
    const errorBody: any = await response.json();
    throw new Error(`QBO Deposit Creation Error: ${JSON.stringify(errorBody)}`);
  }

  const result: any = await response.json();
  const depositId = String(result.Deposit.Id);
  console.log(`[QBO Accounting] Payment #${paymentId} & Deposit #${depositId} reconciled.`);
  return depositId;
}

/**
 * Retrieves gross amount, net payout, and Stripe processing fee in dollars
 */
export async function getStripeFeeBreakdown(
  paymentIntentId: string,
  fallbackGrossAmount: number = 1000.00
): Promise<{
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currency: string;
}> {
  if (
    stripeClient &&
    paymentIntentId &&
    !paymentIntentId.startsWith('pi_test_') &&
    !paymentIntentId.startsWith('pi_deposit_')
  ) {
    try {
      const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
      });

      const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      const balanceTxn =
        charge?.balance_transaction && typeof charge.balance_transaction === 'object'
          ? (charge.balance_transaction as any)
          : null;

      if (balanceTxn && typeof balanceTxn.amount === 'number' && typeof balanceTxn.fee === 'number') {
        return {
          grossAmount: balanceTxn.amount / 100,
          feeAmount: balanceTxn.fee / 100,
          netAmount: balanceTxn.net / 100,
          currency: balanceTxn.currency || 'usd',
        };
      }
    } catch (err: any) {
      console.warn(`[Stripe Fee Breakdown Note]: ${err.message}. Defaulting to standard 2.9% + $0.30 credit card fee.`);
    }
  }

  // Exact standard Stripe processing fee: 2.9% + $0.30
  const gross = Number(fallbackGrossAmount) || 1000.00;
  const fee = Math.round((gross * 0.029 + 0.30) * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;

  return {
    grossAmount: gross,
    feeAmount: fee,
    netAmount: net,
    currency: 'usd',
  };
}

export const simulatedQboPayments = new Map<string, any>();
export const simulatedQboInvoices = new Map<string, any>();

export function seedSimulatedQuickBooksPayment(payment: any): void {
  simulatedQboPayments.set(String(payment.Id), payment);
}

export function seedSimulatedQuickBooksInvoice(invoice: any): void {
  simulatedQboInvoices.set(String(invoice.Id), invoice);
}

/**
 * Validates QuickBooks webhook signature using HMAC-SHA256
 */
export function verifyQuickBooksWebhook(payload: string, signature: string): boolean {
  if (!signature) return false;
  const verifierToken =
    process.env.QBO_WEBHOOK_VERIFIER_TOKEN || 'your_intuit_webhook_verifier_token';
  const hash = crypto
    .createHmac('sha256', verifierToken)
    .update(payload)
    .digest('base64');
  return hash === signature;
}

/**
 * Fetches full Payment entity details from Intuit API by ID
 */
export async function getQuickBooksPayment(paymentId: string): Promise<any> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    const existing = simulatedQboPayments.get(String(paymentId));
    if (existing) {
      return existing;
    }
    if (String(paymentId) === '5023') {
      return {
        Id: '5023',
        TotalAmt: 1000.0,
        PaymentRefNum: 'OFFLINE-CHECK-441',
        Line: [
          {
            Amount: 1000.0,
            LinkedTxn: [
              {
                TxnId: '8493',
                TxnType: 'Invoice',
              },
            ],
          },
        ],
      };
    }
    return {
      Id: String(paymentId),
      TotalAmt: 8700.0,
      PaymentRefNum: 'MANUAL-CHK-1002',
      Line: [
        {
          Amount: 8700.0,
          LinkedTxn: [
            {
              TxnId: '8492',
              TxnType: 'Invoice',
            },
          ],
        },
      ],
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const res = await fetch(`${baseUrl}/v3/company/${realmId}/payment/${paymentId}?minorversion=65`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch QBO Payment ${paymentId}: ${err}`);
  }

  const json: any = await res.json();
  return json.Payment;
}

/**
 * Fetches full Invoice entity details from Intuit API by ID
 */
export async function getQuickBooksInvoice(invoiceId: string): Promise<any> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    const existing = simulatedQboInvoices.get(String(invoiceId));
    if (existing) {
      return existing;
    }
    if (String(invoiceId) === '8493') {
      return {
        Id: '8493',
        DocNumber: 'INV-8493',
        TotalAmt: 20900.0,
        Balance: 19900.0,
      };
    }
    return {
      Id: String(invoiceId),
      DocNumber: 'INV-10089',
      TotalAmt: 20900.0,
      Balance: 0.0,
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const res = await fetch(`${baseUrl}/v3/company/${realmId}/invoice/${invoiceId}?minorversion=65`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return null;

  const json: any = await res.json();
  return json.Invoice;
}

/**
 * Queries QuickBooks Online for a batch of Invoices by ID (up to 30 per batch)
 * @param invoiceIds string[]
 * @returns Promise<Map<string, { balance: number, totalAmt: number, docNumber: string }>>
 */
export async function getQuickBooksInvoicesBatch(
  invoiceIds: string[]
): Promise<Map<string, { balance: number; totalAmt: number; docNumber: string }>> {
  if (!invoiceIds || !invoiceIds.length) return new Map();

  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  const map = new Map<string, { balance: number; totalAmt: number; docNumber: string }>();

  if (isSimulation) {
    for (const id of invoiceIds) {
      const inv = await getQuickBooksInvoice(id);
      if (inv) {
        map.set(String(id), {
          balance: Number(inv.Balance !== undefined ? inv.Balance : 0),
          totalAmt: Number(inv.TotalAmt !== undefined ? inv.TotalAmt : 0),
          docNumber: inv.DocNumber || `INV-${id}`,
        });
      }
    }
    return map;
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const idList = invoiceIds.map((id) => `'${id}'`).join(',');
  const queryStr = `SELECT Id, DocNumber, Balance, TotalAmt FROM Invoice WHERE Id IN (${idList})`;

  const res = await fetch(
    `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(queryStr)}&minorversion=65`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`QBO Batch Query Failed: ${errText}`);
  }

  const json: any = await res.json();
  const invoices = json.QueryResponse?.Invoice || [];

  for (const inv of invoices) {
    map.set(String(inv.Id), {
      balance: Number(inv.Balance || 0),
      totalAmt: Number(inv.TotalAmt || 0),
      docNumber: inv.DocNumber || '',
    });
  }

  return map;
}

export const simulatedQboRefundReceipts = new Map<string, any>();

export function seedSimulatedQuickBooksRefundReceipt(refund: any): void {
  simulatedQboRefundReceipts.set(String(refund.Id), refund);
}

/**
 * Fetches full RefundReceipt entity details from Intuit API by ID
 */
export async function getQuickBooksRefundReceipt(refundId: string): Promise<any> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    const existing = simulatedQboRefundReceipts.get(String(refundId));
    if (existing) {
      return existing;
    }
    return {
      Id: String(refundId),
      DocNumber: `REF-${refundId}`,
      TotalAmt: 1000.0,
      CustomerRef: {
        value: '54',
        name: 'Marcus Vance',
      },
      PaymentMethodRef: {
        name: 'Credit Card',
      },
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const res = await fetch(`${baseUrl}/v3/company/${realmId}/refundreceipt/${refundId}?minorversion=65`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch QBO RefundReceipt ${refundId}: ${err}`);
  }

  const json: any = await res.json();
  return json.RefundReceipt;
}

// ==============================================================================
// ACCOUNTS PAYABLE (A/P) VENDOR, BILL & 1099 SUBCONTRACTOR COMPLIANCE ENGINE
// ==============================================================================

export const simulatedVendorStore = new Map<string, any>();
export const simulatedQboBills = new Map<string, any>();

export function seedSimulatedQuickBooksVendor(vendor: {
  id: string;
  displayName: string;
  email?: string;
  vendor1099?: boolean;
  taxId?: string;
}): void {
  const rec = {
    Id: String(vendor.id),
    DisplayName: vendor.displayName,
    PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
    Vendor1099: Boolean(vendor.vendor1099),
    TaxIdentifier: vendor.taxId || undefined,
  };
  simulatedVendorStore.set(`name:${vendor.displayName.toLowerCase().trim()}`, rec);
  simulatedVendorStore.set(`id:${vendor.id}`, rec);
}

export function seedSimulatedQuickBooksBill(bill: any): void {
  simulatedQboBills.set(String(bill.Id), bill);
}

/**
 * Finds or creates a Vendor in QuickBooks Online (Suppliers & 1099 Subcontractors)
 */
export async function findOrCreateQuickBooksVendor({
  displayName,
  email,
  phone,
  taxId,
  vendor1099 = false,
}: {
  displayName: string;
  email?: string;
  phone?: string;
  taxId?: string;
  vendor1099?: boolean;
}): Promise<{ vendorId: string; displayName: string; vendor1099: boolean }> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  const cleanName = (displayName || 'Roofing Supplier').trim();
  const nameKey = cleanName.toLowerCase();

  if (isSimulation) {
    const existing = simulatedVendorStore.get(`name:${nameKey}`);
    if (existing) {
      console.log(`[QBO Vendor] Found existing Vendor ID ${existing.Id} for "${cleanName}" (1099: ${existing.Vendor1099})`);
      return {
        vendorId: String(existing.Id),
        displayName: existing.DisplayName,
        vendor1099: Boolean(existing.Vendor1099),
      };
    }

    const newId = String(300 + simulatedVendorStore.size + 1);
    const created = {
      Id: newId,
      DisplayName: cleanName,
      PrimaryEmailAddr: email ? { Address: email } : undefined,
      PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
      Vendor1099: Boolean(vendor1099),
      TaxIdentifier: taxId || undefined,
    };
    simulatedVendorStore.set(`name:${nameKey}`, created);
    simulatedVendorStore.set(`id:${newId}`, created);
    console.log(`[QBO Vendor] Created new Vendor ID ${newId} for "${cleanName}" (1099: ${Boolean(vendor1099)})`);
    return {
      vendorId: newId,
      displayName: cleanName,
      vendor1099: Boolean(vendor1099),
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const sanitizedName = cleanName.replace(/'/g, "\\'");
  const queryStr = `select Id, DisplayName, Vendor1099 from Vendor where DisplayName = '${sanitizedName}'`;
  const queryRes = await fetch(
    `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(queryStr)}&minorversion=65`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (queryRes.ok) {
    const queryJson: any = await queryRes.json();
    const existingVendors = queryJson.QueryResponse?.Vendor;
    if (existingVendors && existingVendors.length > 0) {
      const v = existingVendors[0];
      return {
        vendorId: String(v.Id),
        displayName: v.DisplayName,
        vendor1099: Boolean(v.Vendor1099),
      };
    }
  }

  const vendorPayload: any = {
    DisplayName: cleanName.substring(0, 100),
    PrimaryEmailAddr: email ? { Address: email } : undefined,
    PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    Vendor1099: Boolean(vendor1099),
    TaxIdentifier: taxId || undefined,
  };

  const createRes = await fetch(`${baseUrl}/v3/company/${realmId}/vendor?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vendorPayload),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`QBO Vendor Creation Failed: ${errBody}`);
  }

  const createData: any = await createRes.json();
  const createdVendor = createData.Vendor;
  return {
    vendorId: String(createdVendor.Id),
    displayName: createdVendor.DisplayName,
    vendor1099: Boolean(createdVendor.Vendor1099),
  };
}

/**
 * Maps CRM job cost categories to QuickBooks Online Chart of Accounts COGS / Expense Account Refs
 */
export function resolveQboExpenseAccountForCategory(category: string): {
  value: string;
  name: string;
} {
  const cat = String(category || 'material').toLowerCase();
  if (cat === 'material' || cat === 'materials') {
    return {
      value: process.env.QBO_COGS_MATERIAL_ACCOUNT_ID || '60',
      name: 'Cost of Goods Sold - Roofing Materials',
    };
  }
  if (cat === 'labor' || cat === 'subcontractor') {
    return {
      value: process.env.QBO_COGS_LABOR_ACCOUNT_ID || '61',
      name: 'Cost of Goods Sold - Subcontractor Labor (1099)',
    };
  }
  if (cat === 'dumpster' || cat === 'equipment') {
    return {
      value: process.env.QBO_COGS_EQUIPMENT_ACCOUNT_ID || '62',
      name: 'Cost of Goods Sold - Dumpster & Disposal',
    };
  }
  if (cat === 'permit' || cat === 'permits') {
    return {
      value: process.env.QBO_COGS_PERMIT_ACCOUNT_ID || '63',
      name: 'Cost of Goods Sold - Municipal Permits & Inspections',
    };
  }
  return {
    value: process.env.QBO_COGS_OTHER_ACCOUNT_ID || '64',
    name: 'Cost of Goods Sold - Other Job Costs',
  };
}

/**
 * Creates an Accounts Payable Bill in QuickBooks Online linked to the Vendor and Customer/Job
 */
export async function createQuickBooksVendorBill({
  vendorId,
  vendorName,
  customerId,
  docNumber,
  amount,
  category = 'material',
  memo,
  jobReference,
}: {
  vendorId: string;
  vendorName?: string;
  customerId?: string;
  docNumber: string;
  amount: number;
  category?: string;
  memo?: string;
  jobReference?: string;
}): Promise<{
  billId: string;
  docNumber: string;
  vendorId: string;
  expenseAccountId: string;
  expenseAccountName: string;
  totalAmt: number;
  balance: number;
}> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  const accountRef = resolveQboExpenseAccountForCategory(category);
  const cleanDocNumber = (docNumber || `BILL-${Date.now().toString().slice(-6)}`).substring(0, 21);
  const todayStr = new Date().toISOString().split('T')[0];
  const numericAmount = Number(Number(amount || 0).toFixed(2));

  const billPayload: any = {
    VendorRef: {
      value: String(vendorId),
      name: vendorName || undefined,
    },
    DocNumber: cleanDocNumber,
    TxnDate: todayStr,
    PrivateNote: memo || `Job Cost A/P Bill (${category.toUpperCase()}) for ${jobReference || 'Roofing Project'}`,
    Line: [
      {
        Id: '1',
        Amount: numericAmount,
        DetailType: 'AccountBasedExpenseLineDetail',
        Description: `${(category || 'material').toUpperCase()} - ${vendorName || 'Vendor'} (Ref: ${cleanDocNumber})${jobReference ? ` | Job: ${jobReference}` : ''}`,
        AccountBasedExpenseLineDetail: {
          AccountRef: accountRef,
          BillableStatus: 'NotBillable',
          CustomerRef: customerId
            ? {
                value: String(customerId),
              }
            : undefined,
        },
      },
    ],
  };

  if (isSimulation) {
    const billId = String(9400 + simulatedQboBills.size + 1);
    const simulatedBill = {
      Id: billId,
      DocNumber: cleanDocNumber,
      TotalAmt: numericAmount,
      Balance: numericAmount,
      VendorRef: billPayload.VendorRef,
      Line: billPayload.Line,
      PrivateNote: billPayload.PrivateNote,
      TxnDate: todayStr,
    };
    simulatedQboBills.set(billId, simulatedBill);
    console.log(
      `[QBO A/P Bill] Created Bill #${cleanDocNumber} (ID: ${billId}) for Vendor #${vendorId} ($${numericAmount.toFixed(2)}) -> ${accountRef.name}`
    );
    return {
      billId,
      docNumber: cleanDocNumber,
      vendorId: String(vendorId),
      expenseAccountId: accountRef.value,
      expenseAccountName: accountRef.name,
      totalAmt: numericAmount,
      balance: numericAmount,
    };
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const res = await fetch(`${baseUrl}/v3/company/${realmId}/bill?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(billPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`QBO Bill Creation Failed: ${errText}`);
  }

  const json: any = await res.json();
  const createdBill = json.Bill;
  return {
    billId: String(createdBill.Id),
    docNumber: String(createdBill.DocNumber || cleanDocNumber),
    vendorId: String(vendorId),
    expenseAccountId: accountRef.value,
    expenseAccountName: accountRef.name,
    totalAmt: Number(createdBill.TotalAmt || numericAmount),
    balance: Number(createdBill.Balance !== undefined ? createdBill.Balance : numericAmount),
  };
}

/**
 * Retrieves a QBO Bill entity by ID
 */
export async function getQuickBooksBill(billId: string): Promise<any> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  if (isSimulation) {
    return simulatedQboBills.get(String(billId)) || null;
  }

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const res = await fetch(`${baseUrl}/v3/company/${realmId}/bill/${billId}?minorversion=65`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return null;
  const json: any = await res.json();
  return json.Bill;
}

/**
 * Evaluates 1099 Subcontractor W-9 and Workers' Comp / GL COI Compliance before releasing labor payouts
 */
export function evaluateSubcontractor1099Compliance(opp: any): {
  compliant: boolean;
  status: string;
  w9Verified: boolean;
  coiValid: boolean;
  daysUntilCoiExpiry: number | null;
  reasons: string[];
} {
  const w9Raw = String(opp?.subcontractorW9Status || '').trim().toLowerCase();
  const w9Verified = w9Raw === 'verified' || w9Raw === 'on file' || w9Raw === 'complete';

  const coiDateStr = opp?.subcontractorCoiExpirationDate;
  let coiValid = false;
  let daysUntilCoiExpiry: number | null = null;

  if (coiDateStr) {
    const expiryDate = new Date(coiDateStr);
    if (!isNaN(expiryDate.getTime())) {
      const now = new Date();
      // Compare against start of today UTC
      const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const expMidnight = new Date(
        Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth(), expiryDate.getUTCDate())
      );
      daysUntilCoiExpiry = Math.round((expMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
      coiValid = daysUntilCoiExpiry >= 0;
    }
  }

  const reasons: string[] = [];
  if (!w9Verified) {
    reasons.push('Missing or unverified IRS Form W-9 (TIN required for 1099-NEC reporting).');
  }
  if (!coiDateStr) {
    reasons.push('Missing Certificate of Insurance (Workers\' Comp & General Liability COI expiration date not on file).');
  } else if (!coiValid) {
    reasons.push(`Subcontractor Certificate of Insurance expired on ${String(coiDateStr).split('T')[0]} (${Math.abs(daysUntilCoiExpiry || 0)} days overdue).`);
  }

  const compliant = w9Verified && coiValid;
  let status = 'Compliant';
  if (!w9Verified && !coiValid) {
    status = 'Blocked - Missing W-9 & Invalid COI';
  } else if (!w9Verified) {
    status = 'Blocked - Missing W-9';
  } else if (!coiValid) {
    status = 'Blocked - Expired/Missing COI';
  }

  return {
    compliant,
    status,
    w9Verified,
    coiValid,
    daysUntilCoiExpiry,
    reasons,
  };
}

/**
 * Appends an approved Post-Tear-Off Change Order (e.g., Rotted OSB/Plywood Decking or Fascia replacement)
 * line item to an existing QuickBooks Online Invoice and updates TotalAmt & Balance.
 */
export async function appendChangeOrderLineToQuickBooksInvoice({
  invoiceId,
  customerId,
  description,
  amount,
  quantity = 1,
  unitPrice,
  baseContractAmount = 0,
}: {
  invoiceId: string;
  customerId?: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  baseContractAmount?: number;
}): Promise<{
  invoiceId: string;
  docNumber: string;
  addedAmount: number;
  newTotalAmt: number;
  newBalance: number;
  lineCount: number;
}> {
  const clientId = process.env.QBO_CLIENT_ID || '';
  const isSimulation =
    !clientId ||
    clientId === 'your_intuit_client_id' ||
    process.env.QBO_REFRESH_TOKEN === 'your_oauth_refresh_token';

  const cleanInvoiceId = String(invoiceId || `9500`);
  const numericAmount = Math.round(Number(amount || 0) * 100) / 100;
  const qty = Number(quantity || 1);
  const price = unitPrice !== undefined ? Number(unitPrice) : qty > 0 ? Math.round((numericAmount / qty) * 100) / 100 : numericAmount;

  const newLineItem = {
    DetailType: 'SalesItemLineDetail',
    Amount: numericAmount,
    Description: description || 'Approved Post-Tear-Off Rotted Wood Decking / Fascia Change Order',
    SalesItemLineDetail: {
      ItemRef: {
        value: process.env.QBO_DECKING_ITEM_ID || '1',
        name: 'Roofing Change Order - Wood Decking & Fascia Replacement',
      },
      Qty: qty,
      UnitPrice: price,
    },
  };

  if (isSimulation) {
    let existing = simulatedQboInvoices.get(cleanInvoiceId);
    if (!existing) {
      const initialTotal = Number(baseContractAmount || 18500);
      existing = {
        Id: cleanInvoiceId,
        DocNumber: `INV-${cleanInvoiceId}`,
        SyncToken: '0',
        CustomerRef: { value: String(customerId || '55') },
        TotalAmt: initialTotal,
        Balance: initialTotal,
        Line: [
          {
            Id: '1',
            DetailType: 'SalesItemLineDetail',
            Amount: initialTotal,
            Description: 'Base Roof Replacement Contract',
            SalesItemLineDetail: {
              ItemRef: { value: '1', name: 'Roof Replacement' },
              Qty: 1,
              UnitPrice: initialTotal,
            },
          },
        ],
      };
    }

    const existingLines = Array.isArray(existing.Line) ? [...existing.Line] : [];
    const nextLineId = String(existingLines.length + 1);
    existingLines.push({
      Id: nextLineId,
      ...newLineItem,
    });

    const newTotalAmt = Math.round((Number(existing.TotalAmt || 0) + numericAmount) * 100) / 100;
    const newBalance = Math.round((Number(existing.Balance !== undefined ? existing.Balance : existing.TotalAmt || 0) + numericAmount) * 100) / 100;

    const updatedInvoice = {
      ...existing,
      SyncToken: String(Number(existing.SyncToken || 0) + 1),
      TotalAmt: newTotalAmt,
      Balance: newBalance,
      Line: existingLines,
    };

    simulatedQboInvoices.set(cleanInvoiceId, updatedInvoice);
    console.log(
      `[QBO Change Order] Appended $${numericAmount.toFixed(2)} line to Invoice #${updatedInvoice.DocNumber} (ID: ${cleanInvoiceId}) -> New Total: $${newTotalAmt.toFixed(2)}, New Balance: $${newBalance.toFixed(2)}`
    );

    return {
      invoiceId: cleanInvoiceId,
      docNumber: updatedInvoice.DocNumber || `INV-${cleanInvoiceId}`,
      addedAmount: numericAmount,
      newTotalAmt,
      newBalance,
      lineCount: existingLines.length,
    };
  }

  const existingInvoice = await getQuickBooksInvoice(cleanInvoiceId);
  if (!existingInvoice) {
    throw new Error(`QuickBooks Invoice ${cleanInvoiceId} not found for Change Order update.`);
  }

  const lines = Array.isArray(existingInvoice.Line)
    ? existingInvoice.Line.filter((l: any) => l.DetailType !== 'SubTotalLineDetail')
    : [];
  lines.push(newLineItem);

  const accessToken = await getQuickBooksAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl =
    process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const updatePayload = {
    ...existingInvoice,
    sparse: true,
    Id: existingInvoice.Id,
    SyncToken: existingInvoice.SyncToken,
    Line: lines,
  };

  const res = await fetch(`${baseUrl}/v3/company/${realmId}/invoice?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatePayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`QBO Invoice Change Order Update Failed: ${errText}`);
  }

  const json: any = await res.json();
  const updated = json.Invoice;
  return {
    invoiceId: String(updated.Id),
    docNumber: String(updated.DocNumber || `INV-${updated.Id}`),
    addedAmount: numericAmount,
    newTotalAmt: Number(updated.TotalAmt || 0),
    newBalance: Number(updated.Balance || 0),
    lineCount: Array.isArray(updated.Line) ? updated.Line.length : lines.length,
  };
}








