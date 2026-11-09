import React, { useState } from 'react';
import styled from '@emotion/styled';
import { IconDeviceMobileMessage, IconCheck } from '@tabler/icons-react';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background-color: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

export const SendDeductibleLinkButton: React.FC = () => {
  const record = useCurrentRecord();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (!record?.insuranceClaimNumber || record?.deductiblePaymentStatus === 'Verified & Collected') {
    return null;
  }

  const handleSendLink = async () => {
    setLoading(true);
    try {
      const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';
      const res = await fetch(`${serviceUrl}/api/insurance/${record.id}/send-deductible-link`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
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
    <ActionButton type="button" onClick={handleSendLink} disabled={loading} title="Text Stripe payment link for policy deductible">
      {sent ? <IconCheck size={16} color="#22c55e" /> : <IconDeviceMobileMessage size={16} color="#38bdf8" />}
      <span>{sent ? 'Link Dispatched!' : loading ? 'Sending...' : 'Text Deductible Pay'}</span>
    </ActionButton>
  );
};
