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
  transition: all 0.15s ease;
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

const IconDeviceMobileMessage = ({ size = 16, color = '#38bdf8' }: { size?: number; color?: string }) => (
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
    <path d="M11 3h10v8h-3l-4 2v-2h-3z" />
    <path d="M15 16v4a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1h2" />
    <path d="M10 18v.01" />
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

export interface SendDeductibleLinkButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const SendDeductibleLinkButton: React.FC<SendDeductibleLinkButtonProps> = ({
  objectNameSingular,
  recordId,
}) => {
  const params = useParams<{ objectRecordId?: string }>();
  const activeRecordId = recordId || params.objectRecordId || '';
  const record = useCurrentRecord(activeRecordId);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (objectNameSingular && objectNameSingular !== 'opportunity') {
    return null;
  }

  if (!record?.insuranceClaimNumber || record?.deductiblePaymentStatus === 'Verified & Collected') {
    return null;
  }

  const effectiveRecordId = activeRecordId || record.id;

  const handleSendLink = async () => {
    if (!effectiveRecordId) return;
    setLoading(true);

    try {
      const serviceUrl =
        (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
        process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
        'http://localhost:4000';

      const res = await fetch(`${serviceUrl}/api/insurance/${effectiveRecordId}/send-deductible-link`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } else {
        alert(data.error || 'Failed to dispatch deductible link.');
      }
    } catch (e) {
      alert('Network error connecting to microservice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionButton
      type="button"
      onClick={handleSendLink}
      disabled={loading}
      title="Text Stripe payment link for policy deductible"
    >
      {sent ? <IconCheck size={16} color="#22c55e" /> : <IconDeviceMobileMessage size={16} color="#38bdf8" />}
      <span>{sent ? 'Link Dispatched!' : loading ? 'Sending...' : 'Text Deductible Pay'}</span>
    </ActionButton>
  );
};
