import React, { useState } from 'react';
import styled from '@emotion/styled';
import { IconShieldCheck, IconAlertTriangle, IconReceipt2 } from '@tabler/icons-react';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const ComplianceButton = styled.button<{ isVerified?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background-color: ${({ isVerified, theme }) => (isVerified ? '#065f46' : theme.background.secondary)};
  color: ${({ isVerified, theme }) => (isVerified ? '#a7f3d0' : theme.font.color.primary)};
  border: 1px solid ${({ isVerified, theme }) => (isVerified ? '#10b981' : theme.border.color.medium)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background-color: ${({ isVerified, theme }) => (isVerified ? '#047857' : theme.background.tertiary)};
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const ModalContent = styled.div`
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 24px;
  width: 420px;
  color: #f8fafc;
`;

export const DeductibleComplianceModalButton: React.FC = () => {
  const record = useCurrentRecord();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(record?.deductibleAmount || 1000);
  const [method, setMethod] = useState('Personal Check');
  const [refNum, setRefNum] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('Production Desk');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!record?.insuranceClaimNumber) return null;

  const isVerified = record.deductiblePaymentStatus === 'Verified & Collected';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';
      const res = await fetch(`${serviceUrl}/api/insurance/${record.id}/verify-deductible`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCollected: Number(amount),
          paymentMethod: method,
          referenceNumber: refNum,
          proofUrl,
          verifiedBy,
        }),
      });

      if (res.ok) {
        setIsOpen(false);
        window.location.reload();
      } else {
        alert('Failed to log deductible verification.');
      }
    } catch (err) {
      alert('Network error verifying deductible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const handleDownloadReceipt = async () => {
    if (!record?.id) return;
    setIsGeneratingReceipt(true);
    try {
      const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';
      const res = await fetch(`${serviceUrl}/api/insurance/${record.id}/generate-deductible-receipt`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.receiptUrl) {
        window.open(data.receiptUrl, '_blank');
      } else {
        alert(data.error || 'Failed to generate deductible receipt.');
      }
    } catch (err) {
      alert('Network error generating deductible receipt.');
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <ComplianceButton type="button" isVerified={isVerified} onClick={() => setIsOpen(true)}>
          {isVerified ? <IconShieldCheck size={16} /> : <IconAlertTriangle size={16} color="#f59e0b" />}
          <span>{isVerified ? 'Deductible Verified' : 'Verify Deductible'}</span>
        </ComplianceButton>

        {isVerified && (
          <ComplianceButton
            type="button"
            onClick={handleDownloadReceipt}
            disabled={isGeneratingReceipt}
            title="Download official deductible receipt PDF"
            style={{ backgroundColor: '#0f172a', borderColor: '#0284c7', color: '#38bdf8' }}
          >
            <IconReceipt2 size={16} />
            <span>{isGeneratingReceipt ? 'Generating...' : 'Receipt PDF'}</span>
          </ComplianceButton>
        )}
      </div>

      {isOpen && (
        <ModalOverlay onClick={() => setIsOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Deductible Compliance Audit</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8' }}>
              State law requires verified physical collection of the homeowner policy deductible ($
              {Number(record.deductibleAmount || 1000).toLocaleString()}).
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1' }}>
                  Amount Collected ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1' }}>
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="Personal Check">Personal Check</option>
                  <option value="Credit Card (Stripe)">Credit Card (Stripe)</option>
                  <option value="ACH Transfer">ACH / Bank Transfer</option>
                  <option value="Bank Financing (Wisetack)">Consumer Financing (Wisetack)</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1' }}>
                  Transaction / Check #
                </label>
                <input
                  type="text"
                  required
                  value={refNum}
                  onChange={(e) => setRefNum(e.target.value)}
                  placeholder="e.g. Check #2081 or Stripe Charge ID"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1' }}>
                  Proof Document Link / URL
                </label>
                <input
                  type="url"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="e.g. CompanyCam or file attachment URL"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{ padding: '8px 14px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {isSubmitting ? 'Verifying...' : 'Record Proof'}
                </button>
              </div>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};
