import React, { useState } from 'react';

export interface RecordCarrierCheckModalButtonProps {
  record?: {
    id?: string;
    insuranceClaimNumber?: string;
    depreciationAmount?: number;
    depreciationStatus?: string;
    [key: string]: any;
  };
}

export const RecordCarrierCheckModalButton: React.FC<
  RecordCarrierCheckModalButtonProps
> = ({ record }) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';
      const res = await fetch(`${serviceUrl}/api/insurance/${record.id}/record-check`, {
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

  const actionButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '32px',
    padding: '0 12px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  return (
    <>
      <button
        type="button"
        style={actionButtonStyle}
        onClick={() => setIsOpen(true)}
        title="Record carrier depreciation check"
      >
        <span style={{ color: '#22c55e', fontSize: '14px' }}>💵</span>
        <span>Record Check</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
              width: '380px',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
          </div>
        </div>
      )}
    </>
  );
};

export default RecordCarrierCheckModalButton;
