import React, { useState } from 'react';

export interface CertificateOfCompletionActionButtonProps {
  record?: {
    id?: string;
    insuranceClaimNumber?: string;
    cocDocumentUrl?: string;
    [key: string]: any;
  };
}

export const CertificateOfCompletionActionButton: React.FC<
  CertificateOfCompletionActionButtonProps
> = ({ record }) => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';

  if (!record?.insuranceClaimNumber) return null;

  const handleGenerateCoc = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serviceUrl}/api/insurance/${record.id}/generate-coc`, { method: 'POST' });
      const data = await res.json();
      if (data.cocUrl) {
        window.open(data.cocUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      alert('Error generating Certificate of Completion');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAdjuster = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serviceUrl}/api/insurance/${record.id}/send-coc`, { method: 'POST' });
      if (res.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
    } catch (e) {
      alert('Error emailing COC to adjuster');
    } finally {
      setLoading(false);
    }
  };

  const buttonStyle: React.CSSProperties = {
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
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  return (
    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
      <button
        type="button"
        style={buttonStyle}
        onClick={handleGenerateCoc}
        disabled={loading}
        title="Compile Certificate of Completion PDF"
      >
        <span style={{ color: '#22c55e', fontSize: '14px' }}>📜</span>
        <span>{loading ? 'Building...' : 'Generate COC'}</span>
      </button>

      {record.cocDocumentUrl && (
        <button
          type="button"
          style={buttonStyle}
          onClick={handleSendToAdjuster}
          disabled={loading}
          title="Email COC and final invoice directly to desk adjuster"
        >
          <span style={{ color: sent ? '#22c55e' : '#38bdf8', fontSize: '14px' }}>
            {sent ? '✓' : '✉'}
          </span>
          <span>{sent ? 'Sent to Adjuster!' : 'Send to Adjuster'}</span>
        </button>
      )}
    </div>
  );
};

export default CertificateOfCompletionActionButton;
