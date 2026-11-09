import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background-color: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }

  svg {
    stroke-width: 1.75;
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
  width: 380px;
  color: #f8fafc;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
`;

const IconCurrencyDollar = ({ size = 16, color = '#22c55e' }: { size?: number; color?: string }) => (
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
    <path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" />
    <path d="M12 3v3m0 12v3" />
  </svg>
);

export interface RecordCarrierCheckModalButtonProps {
  objectNameSingular?: string;
  recordId?: string;
  record?: any;
}

export const RecordCarrierCheckModalButton: React.FC<RecordCarrierCheckModalButtonProps> = ({
  objectNameSingular,
  recordId,
  record: propRecord,
}) => {
  const params = useParams<{
    objectNameSingular?: string;
    objectRecordId?: string;
  }>();

  const currentObject = (
    objectNameSingular ||
    params.objectNameSingular ||
    ''
  ).toLowerCase();
  const currentRecordId = recordId || params.objectRecordId;

  // Filter visibility to Opportunity or Job records
  if (currentObject && !['opportunity', 'job'].includes(currentObject)) {
    return null;
  }

  const hookRecord = useCurrentRecord(currentRecordId);
  const record = propRecord || hookRecord;

  const [isOpen, setIsOpen] = useState(false);
  const [checkNumber, setCheckNumber] = useState('');
  const [amount, setAmount] = useState<string | number>(
    record?.depreciationAmount || 8700
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!record?.insuranceClaimNumber || record?.depreciationStatus === 'Released / Paid') {
    return null;
  }

  const effectiveRecordId = currentRecordId || record?.id;
  const serviceUrl =
    (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
    process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
    'http://localhost:4000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRecordId) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`${serviceUrl}/api/insurance/${effectiveRecordId}/record-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkNumber,
          checkAmount: Number(amount),
          notes,
        }),
      });

      if (res.ok) {
        setIsOpen(false);
        window.location.reload();
      } else {
        alert('Failed to log check.');
      }
    } catch (err) {
      alert('Error connecting to check intake endpoint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ActionButton
        type="button"
        onClick={() => setIsOpen(true)}
        title="Record carrier final recoverable depreciation check"
      >
        <IconCurrencyDollar size={16} color="#22c55e" />
        <span>Record Check</span>
      </ActionButton>

      {isOpen && (
        <ModalOverlay onClick={() => setIsOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#fff' }}>
              Record Carrier Payment
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    marginBottom: '4px',
                    color: '#cbd5e1',
                  }}
                >
                  Carrier Check #
                </label>
                <input
                  type="text"
                  required
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="e.g. 0089241"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    marginBottom: '4px',
                    color: '#cbd5e1',
                  }}
                >
                  Check Amount ($)
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
                    padding: '8px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    marginBottom: '4px',
                    color: '#cbd5e1',
                  }}
                >
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Delivered via USPS regular mail, deposited to operating acct"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};

export default RecordCarrierCheckModalButton;
