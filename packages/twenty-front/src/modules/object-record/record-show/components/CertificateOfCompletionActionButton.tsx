import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const Button = styled.button`
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

  &:hover:not(:disabled) {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg {
    stroke-width: 1.75;
  }
`;

// Crisp SVG Icons matching Tabler design
const IconCertificate = ({ size = 16, color = '#22c55e' }: { size?: number; color?: string }) => (
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
    <circle cx="15" cy="15" r="3" />
    <path d="M13 17.5v4.5l2 -1.5l2 1.5v-4.5" />
    <path d="M10 19h-5a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v5" />
    <path d="M6 9h12" />
    <path d="M6 12h3" />
    <path d="M6 15h2" />
  </svg>
);

const IconSend = ({ size = 16, color = '#38bdf8' }: { size?: number; color?: string }) => (
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
    <path d="M10 14l11 -11" />
    <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
  </svg>
);

const IconCheck = ({ size = 16, color = '#22c55e' }: { size?: number; color?: string }) => (
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
    <path d="M5 12l5 5l10 -10" />
  </svg>
);

export interface CertificateOfCompletionActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
  record?: any;
}

export const CertificateOfCompletionActionButton: React.FC<
  CertificateOfCompletionActionButtonProps
> = ({ objectNameSingular, recordId, record: propRecord }) => {
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
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cocUrl, setCocUrl] = useState<string | null>(record?.cocDocumentUrl || null);

  if (!record?.insuranceClaimNumber) {
    return null;
  }

  const effectiveRecordId = currentRecordId || record.id;
  const serviceUrl =
    (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
    process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
    'http://localhost:4000';

  const handleGenerateCoc = async () => {
    if (!effectiveRecordId) return;
    setLoading(true);
    try {
      const res = await fetch(`${serviceUrl}/api/insurance/${effectiveRecordId}/generate-coc`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error generating Certificate of Completion');
        return;
      }
      if (data.cocUrl) {
        setCocUrl(data.cocUrl);
        window.open(data.cocUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      alert('Error generating Certificate of Completion');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAdjuster = async () => {
    if (!effectiveRecordId) return;
    setLoading(true);
    try {
      const res = await fetch(`${serviceUrl}/api/insurance/${effectiveRecordId}/send-coc`, {
        method: 'POST',
      });
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

  const hasCocDoc = Boolean(cocUrl || record.cocDocumentUrl);

  return (
    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
      <Button
        type="button"
        onClick={handleGenerateCoc}
        disabled={loading}
        title="Compile Certificate of Completion PDF & Final Depreciation Release Invoice"
      >
        <IconCertificate size={16} color="#22c55e" />
        <span>{loading ? 'Building...' : 'Generate COC'}</span>
      </Button>

      {hasCocDoc && (
        <Button
          type="button"
          onClick={handleSendToAdjuster}
          disabled={loading}
          title="Email COC and final invoice directly to desk adjuster"
        >
          {sent ? <IconCheck size={16} color="#22c55e" /> : <IconSend size={16} color="#38bdf8" />}
          <span>{sent ? 'Sent to Adjuster!' : 'Send to Adjuster'}</span>
        </Button>
      )}
    </div>
  );
};

export default CertificateOfCompletionActionButton;
