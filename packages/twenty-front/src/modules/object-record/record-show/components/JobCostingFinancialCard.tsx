import React, { useState } from 'react';
import styled from '@emotion/styled';
import {
  IconCalculator,
  IconReceiptTax,
  IconShieldCheck,
  IconAlertTriangle,
  IconPlus,
  IconFileInvoice,
} from '@tabler/icons-react';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const Card = styled.div`
  background: ${({ theme }: any) => theme?.background?.secondary || '#1e293b'};
  border: 1px solid ${({ theme }: any) => theme?.border?.color?.medium || '#334155'};
  border-radius: ${({ theme }: any) => theme?.border?.radius?.md || '8px'};
  padding: 16px;
  margin-bottom: 16px;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
`;

const MarginBadge = styled.span<{ margin: number }>`
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
  background-color: ${({ margin }) => (margin >= 40 ? '#16a34a' : margin >= 30 ? '#d97706' : '#dc2626')};
`;

const ComplianceBadge = styled.span<{ compliant: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  color: ${({ compliant }) => (compliant ? '#4ade80' : '#fca5a5')};
  background: ${({ compliant }) => (compliant ? 'rgba(22, 163, 74, 0.18)' : 'rgba(220, 38, 38, 0.2)')};
  border: 1px solid ${({ compliant }) => (compliant ? '#16a34a' : '#dc2626')};
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  background: ${({ variant }) => (variant === 'primary' ? '#2563eb' : '#334155')};
  color: #f8fafc;
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;

  &:hover:not(:disabled) {
    background: ${({ variant }) => (variant === 'primary' ? '#1d4ed8' : '#475569')};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const FormBox = styled.div`
  background: ${({ theme }: any) => theme?.background?.primary || '#0f172a'};
  border: 1px solid ${({ theme }: any) => theme?.border?.color?.light || '#334155'};
  border-radius: 6px;
  padding: 10px;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Input = styled.input`
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 12px;
  color: #f8fafc;
  width: 100%;
  box-sizing: border-box;
`;

const Select = styled.select`
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 12px;
  color: #f8fafc;
  width: 100%;
`;

export interface JobCostingFinancialCardProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const JobCostingFinancialCard: React.FC<JobCostingFinancialCardProps> = ({
  objectNameSingular,
  recordId,
}) => {
  const hookRecord: any = useCurrentRecord(recordId);
  const record = hookRecord;
  const [recalculating, setRecalculating] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [vendorName, setVendorName] = useState('ABC Supply Co.');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [costCategory, setCostCategory] = useState('material');
  const [submittingBill, setSubmittingBill] = useState(false);
  const [approvingVoucher, setApprovingVoucher] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!record?.roofSquares && !record?.amount && !record?.totalClaimRcv) return null;

  const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';

  const totalRevenue = Number(record.totalClaimRcv || record.amount || 0);
  const totalCost = Number(record.totalJobCost || 0);
  const grossProfit = Number(record.grossProfit || (totalRevenue - totalCost));
  const marginPercent = Number(
    record.grossMarginPercent || (totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0)
  );
  const commission = Number(record.salesRepCommissionAmount || 0);
  const commStatus = record.commissionStatus || 'Pending';

  const w9Verified =
    String(record.subcontractorW9Status || '').toLowerCase() === 'verified' ||
    String(record.subcontractorW9Status || '').toLowerCase() === 'on file';
  const coiDateStr = record.subcontractorCoiExpirationDate;
  const coiValid = coiDateStr ? new Date(coiDateStr).getTime() >= Date.now() - 86400000 : false;
  const is1099Compliant = w9Verified && coiValid;
  const complianceLabel = is1099Compliant
    ? '1099 & COI Verified'
    : record.subcontractorComplianceStatus || (!w9Verified ? 'Missing W-9' : 'Expired/Missing COI');

  const qboBillsCount = Array.isArray(record.qboVendorBillIds) ? record.qboVendorBillIds.length : 0;

  const handleRecalculate = async () => {
    setRecalculating(true);
    setStatusMessage(null);
    try {
      await fetch(`${serviceUrl}/api/financials/${record.id}/recalculate-job-costs`, { method: 'POST' });
      window.location.reload();
    } finally {
      setRecalculating(false);
    }
  };

  const handleRecordBill = async () => {
    if (!billAmount || isNaN(Number(billAmount))) return;
    setSubmittingBill(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${serviceUrl}/api/financials/${record.id}/record-vendor-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName,
          invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-5)}`,
          billAmount: Number(billAmount),
          costCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ text: data.error || 'Failed to record bill.', isError: true });
      } else {
        setStatusMessage({
          text: `QBO Bill #${data.qboDocNumber || data.qboBillId} synced ($${Number(billAmount).toFixed(2)})`,
          isError: false,
        });
        setBillAmount('');
        setInvoiceNumber('');
        setShowBillForm(false);
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Network error connecting to financial service.', isError: true });
    } finally {
      setSubmittingBill(false);
    }
  };

  const handleApproveLaborVoucher = async () => {
    setApprovingVoucher(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${serviceUrl}/api/financials/${record.id}/approve-labor-voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ text: data.error || '1099 Compliance Lock blocked payout.', isError: true });
      } else {
        setStatusMessage({
          text: `Crew Voucher ${data.voucherNumber} ($${Number(data.laborTotal).toFixed(2)}) synced to QBO Bill #${data.qboBillId}`,
          isError: false,
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Error approving labor voucher.', isError: true });
    } finally {
      setApprovingVoucher(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconReceiptTax size={18} color="#3b82f6" />
          Job Costing & QBO A/P Ledger
        </h4>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
          }}
        >
          <IconCalculator size={14} />
          {recalculating ? 'Calculating...' : 'Recalculate'}
        </button>
      </div>

      <StatRow>
        <span style={{ color: '#94a3b8' }}>Contract Revenue (RCV)</span>
        <strong>${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
      </StatRow>

      <StatRow>
        <span style={{ color: '#94a3b8' }}>Hard Job Costs (Mats + Labor)</span>
        <span style={{ color: '#f87171' }}>-${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </StatRow>

      <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '8px 0' }} />

      <StatRow>
        <span>
          <strong>Gross Profit</strong>
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <strong style={{ color: '#34d399' }}>
            ${grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </strong>
          <MarginBadge margin={marginPercent}>{marginPercent.toFixed(1)}%</MarginBadge>
        </div>
      </StatRow>

      <StatRow>
        <span style={{ color: '#94a3b8' }}>Sales Rep Commission Payout</span>
        <div>
          <strong style={{ color: '#38bdf8' }}>
            ${commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </strong>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>({commStatus})</span>
        </div>
      </StatRow>

      <StatRow>
        <span style={{ color: '#94a3b8' }}>Subcontractor 1099 & COI Status</span>
        <ComplianceBadge compliant={is1099Compliant}>
          {is1099Compliant ? <IconShieldCheck size={12} /> : <IconAlertTriangle size={12} />}
          {complianceLabel}
        </ComplianceBadge>
      </StatRow>

      {record.lastQboBillId && (
        <StatRow>
          <span style={{ color: '#94a3b8' }}>QuickBooks A/P Bills Synced</span>
          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
            {qboBillsCount || 1} Bill(s) (Latest: #{record.lastQboBillId})
          </span>
        </StatRow>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        <ActionButton type="button" variant="secondary" onClick={() => setShowBillForm(!showBillForm)}>
          <IconPlus size={12} />
          Log Vendor Bill (QBO A/P)
        </ActionButton>
        <ActionButton
          type="button"
          variant="primary"
          onClick={handleApproveLaborVoucher}
          disabled={approvingVoucher}
        >
          <IconFileInvoice size={12} />
          {approvingVoucher ? 'Posting to QBO...' : 'Approve Crew Payout to QBO'}
        </ActionButton>
      </div>

      {showBillForm && (
        <FormBox>
          <Select value={costCategory} onChange={(e) => setCostCategory(e.target.value)}>
            <option value="material">Roofing Materials (COGS - #60)</option>
            <option value="labor">1099 Subcontractor Labor (COGS - #61)</option>
            <option value="dumpster">Dumpster & Roll-Off Disposal (COGS - #62)</option>
            <option value="permit">Municipal Permit Fees (COGS - #63)</option>
          </Select>
          <Input
            placeholder="Vendor Name (e.g., ABC Supply Co.)"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <Input
              placeholder="Invoice / Ref #"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
            <Input
              placeholder="Amount ($)"
              type="number"
              step="0.01"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
            />
          </div>
          <ActionButton
            type="button"
            variant="primary"
            onClick={handleRecordBill}
            disabled={submittingBill || !billAmount}
          >
            {submittingBill ? 'Syncing QBO Bill...' : 'Save & Create QBO Bill'}
          </ActionButton>
        </FormBox>
      )}

      {statusMessage && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: statusMessage.isError ? '#f87171' : '#4ade80',
          }}
        >
          {statusMessage.text}
        </div>
      )}
    </Card>
  );
};

export default JobCostingFinancialCard;
