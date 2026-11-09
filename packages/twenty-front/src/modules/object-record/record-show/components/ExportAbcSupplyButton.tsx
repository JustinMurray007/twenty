import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconFileSpreadsheet, IconSend, IconLoader2, IconCheck } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

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

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg {
    stroke-width: 1.75;
  }
`;

const CsvButton = styled(BaseButton)`
  background-color: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};

  &:hover:not(:disabled) {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const TransmitButton = styled(BaseButton)`
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;

  &:hover:not(:disabled) {
    background-color: #fde68a;
    border-color: #f59e0b;
  }
`;

/**
 * Hook to retrieve current active record ID from route parameters
 */
export const useCurrentRecordId = (): string | undefined => {
  const params = useParams<{ objectRecordId?: string }>();
  return params.objectRecordId;
};

export interface ExportAbcSupplyButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

/**
 * ExportAbcSupplyButton
 * Downloads ready-to-upload CSV for the ABC Supply 24/7 ProFile Portal
 */
export const ExportAbcSupplyButton: React.FC<ExportAbcSupplyButtonProps> = ({
  objectNameSingular,
  recordId: propRecordId,
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

  const activeRecordId = propRecordId || params.objectRecordId;

  if (currentObject && !['opportunity', 'job'].includes(currentObject)) {
    return null;
  }

  const handleExport = () => {
    if (!activeRecordId) return;
    const bridgeUrl =
      (window as any)?.__ROOFING_BRIDGE_URL__ || 'http://localhost:4000';
    window.location.href = `${bridgeUrl}/export/abc-supply/${activeRecordId}/csv`;
  };

  return (
    <CsvButton
      type="button"
      onClick={handleExport}
      title="Download CSV for ABC Supply 24/7 Portal"
    >
      <IconFileSpreadsheet size={16} />
      <span>ABC Supply CSV</span>
    </CsvButton>
  );
};

/**
 * TransmitAbcOrderButton
 * Transmits authenticated cXML OrderRequest directly to ABC Supply B2B Gateway
 */
export const TransmitAbcOrderButton: React.FC<ExportAbcSupplyButtonProps> = ({
  objectNameSingular,
  recordId: propRecordId,
}) => {
  const [transmitting, setTransmitting] = useState(false);
  const [transmitted, setTransmitted] = useState(false);

  const params = useParams<{
    objectNameSingular?: string;
    objectRecordId?: string;
  }>();

  const currentObject = (
    objectNameSingular ||
    params.objectNameSingular ||
    ''
  ).toLowerCase();

  const activeRecordId = propRecordId || params.objectRecordId;

  if (currentObject && !['opportunity', 'job'].includes(currentObject)) {
    return null;
  }

  const handleTransmit = async () => {
    if (!activeRecordId || transmitting) return;

    const confirmed = window.confirm(
      'Transmit this material order directly to ABC Supply electronic B2B gateway via authenticated cXML?'
    );
    if (!confirmed) return;

    setTransmitting(true);
    try {
      const bridgeUrl =
        (window as any)?.__ROOFING_BRIDGE_URL__ || 'http://localhost:4000';

      const response = await fetch(
        `${bridgeUrl}/api/abc-supply/orders/${activeRecordId}/transmit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed with status ${response.status}`);
      }

      const result = await response.json();
      setTransmitted(true);
      alert(
        `Order successfully transmitted to ABC Supply B2B Gateway!\n\nPurchase Order: ${result.poNumber}\nStatus: Transmitted to ABC\n\nA branch order specialist will acknowledge the order via EDI 855.`
      );
    } catch (err: any) {
      alert(`ABC Gateway transmission error: ${err.message}`);
    } finally {
      setTransmitting(false);
    }
  };

  return (
    <TransmitButton
      type="button"
      onClick={handleTransmit}
      disabled={transmitting}
      title="Transmit cXML Order directly to ABC Supply B2B Gateway"
    >
      {transmitting ? (
        <IconLoader2 size={16} />
      ) : transmitted ? (
        <IconCheck size={16} />
      ) : (
        <IconSend size={16} />
      )}
      <span>{transmitting ? 'Transmitting...' : transmitted ? 'Order Sent' : 'Send to ABC Gateway'}</span>
    </TransmitButton>
  );
};

export default ExportAbcSupplyButton;
