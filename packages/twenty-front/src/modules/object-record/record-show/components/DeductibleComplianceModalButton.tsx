import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const BaseButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;

  svg {
    stroke-width: 1.75;
  }
`;

const UnverifiedButton = styled(BaseButton)`
  background-color: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const VerifiedButton = styled(BaseButton)`
  background-color: #065f46;
  color: #a7f3d0;
  border: 1px solid #10b981;

  &:hover {
    background-color: #047857;
    border-color: #34d399;
  }
`;

const ComplianceButton = styled(BaseButton)`
  background-color: #0f172a;
  color: #38bdf8;
  border: 1px solid #0284c7;

  &:hover {
    background-color: #0369a1;
    color: #ffffff;
    border-color: #38bdf8;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
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
  max-width: 90vw;
  color: #f8fafc;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
`;

const IconShieldCheck = ({ size = 16, color = '#10b981' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
    <path d="M9 12l2 2l4 -4" />
  </svg>
);

const IconAlertTriangle = ({ size = 16, color = '#f59e0b' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 9v4" />
    <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
    <path d="M12 16h.01" />
  </svg>
);

const IconReceipt2 = ({ size = 16, color = '#38bdf8' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
    <path d="M9 7h6" />
    <path d="M9 11h6" />
    <path d="M13 15h2" />
  </svg>
);

export interface DeductibleComplianceModalButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const DeductibleComplianceModalButton: React.FC<DeductibleComplianceModalButtonProps> = ({
  objectNameSingular,
  recordId,
}) => {
  const params = useParams<{ objectRecordId?: string }>();
  const activeRecordId = recordId || params.objectRecordId || '';
  const record = useCurrentRecord(activeRecordId);

  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState<number | string>(record?.deductibleAmount || 1000);
  const [method, setMethod] = useState('Personal Check');
  const [refNum, setRefNum] = useState(record?.deductiblePaymentRef || '');
  const [proofUrl, setProofUrl] = useState(record?.deductibleProofUrl || '');
  const [verifiedBy, setVerifiedBy] = useState('Production Desk');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial state when record changes
  React.useEffect(() => {
    if (record?.deductibleAmount) {
      setAmount(record.deductibleAmount);
    }
    if (record?.deductiblePaymentRef) {
      setRefNum(record.deductiblePaymentRef);
    }
    if (record?.deductibleProofUrl) {
      setProofUrl(record.deductibleProofUrl);
    }
  }, [record]);

  if (objectNameSingular && objectNameSingular !== 'opportunity') {
    return null;
  }

  if (!record?.insuranceClaimNumber) {
    return null;
  }

  const isVerified = record.deductiblePaymentStatus === 'Verified & Collected';
  const effectiveRecordId = activeRecordId || record.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRecordId) return;
    setIsSubmitting(true);

    try {
      const serviceUrl =
        (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
        process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
        'http://localhost:4000';

      const res = await fetch(`${serviceUrl}/api/insurance/${effectiveRecordId}/verify-deductible`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCollected: Number(amount),
          paymentMethod: method,
          referenceNumber: refNum,
          proofUrl: proofUrl || undefined,
          verifiedBy: verifiedBy || 'Billing Compliance Desk',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsOpen(false);
        window.location.reload();
      } else {
        alert(data.error || 'Failed to log deductible verification.');
      }
    } catch (err) {
      alert('Network error verifying deductible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const handleDownloadReceipt = async () => {
    if (!effectiveRecordId) return;
    setIsGeneratingReceipt(true);
    try {
      const serviceUrl =
        (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
        process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
        'http://localhost:4000';
      const res = await fetch(`${serviceUrl}/api/insurance/${effectiveRecordId}/generate-deductible-receipt`, {
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

  const policyDeductible = Number(record.deductibleAmount || 1000);

  return (
    <>
      {isVerified ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <VerifiedButton
            type="button"
            onClick={() => setIsOpen(true)}
            title="Homeowner statutory deductible verified and compliant"
          >
            <IconShieldCheck size={16} color="#34d399" />
            <span>Deductible Verified</span>
          </VerifiedButton>

          <ComplianceButton
            type="button"
            onClick={handleDownloadReceipt}
            disabled={isGeneratingReceipt}
            title="Download official deductible receipt PDF"
          >
            <IconReceipt2 size={16} color="#38bdf8" />
            <span>{isGeneratingReceipt ? 'Generating...' : 'Receipt PDF'}</span>
          </ComplianceButton>
        </div>
      ) : (
        <UnverifiedButton
          type="button"
          onClick={() => setIsOpen(true)}
          title="Verify physical collection of policy deductible before COC can be issued"
        >
          <IconAlertTriangle size={16} color="#f59e0b" />
          <span>Verify Deductible</span>
        </UnverifiedButton>
      )}

      {isOpen && (
        <ModalOverlay onClick={() => setIsOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <IconShieldCheck size={20} color="#3b82f6" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Deductible Compliance Audit</h3>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
              State law (CA Ins Code § 550, TX HB 2102, FL § 817.234) requires verified physical collection of the homeowner policy deductible (${policyDeductible.toLocaleString()}). No deductibles may be waived or rebated.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1', fontWeight: 600 }}>
                  Amount Collected ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1', fontWeight: 600 }}>
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                >
                  <option value="Personal Check">Personal Check</option>
                  <option value="Credit Card (Stripe)">Credit Card (Stripe)</option>
                  <option value="ACH Transfer">ACH / Bank Transfer</option>
                  <option value="Bank Financing (Wisetack)">Consumer Financing (Wisetack)</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1', fontWeight: 600 }}>
                  Transaction / Check #
                </label>
                <input
                  type="text"
                  required
                  value={refNum}
                  onChange={(e) => setRefNum(e.target.value)}
                  placeholder="e.g. Check #2081 or Stripe Charge ID"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1', fontWeight: 600 }}>
                  Proof Document Link / URL
                </label>
                <input
                  type="url"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="e.g. CompanyCam check photo or scan URL"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1', fontWeight: 600 }}>
                  Verified By (Compliance Desk)
                </label>
                <input
                  type="text"
                  value={verifiedBy}
                  onChange={(e) => setVerifiedBy(e.target.value)}
                  placeholder="e.g. Production Desk or Billing Manager"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '8px 14px',
                    background: '#334155',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 14px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
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
