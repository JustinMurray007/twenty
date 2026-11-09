import React from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconPrinter } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

const StyledActionButton = styled.button`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: 6px;
  height: 32px;
  padding: 0 12px;
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

export interface PrintWorkOrderActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const PrintWorkOrderActionButton: React.FC<
  PrintWorkOrderActionButtonProps
> = ({ objectNameSingular, recordId }) => {
  const params = useParams<{
    objectNameSingular?: string;
    objectRecordId?: string;
  }>();

  // Resolve object name and record ID from props or active route parameters
  const currentObject = (
    objectNameSingular ||
    params.objectNameSingular ||
    ''
  ).toLowerCase();
  const currentRecordId = recordId || params.objectRecordId;

  // Restrict button visibility strictly to roofing sales and production records
  const targetObjects = ['opportunity', 'job', 'workorder'];
  if (!currentObject || !targetObjects.includes(currentObject)) {
    return null;
  }

  const handlePrintClick = () => {
    if (!currentRecordId) return;

    // Direct route to local Node.js microservice endpoint
    const serviceUrl =
      (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
      process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
      'http://localhost:4000';
    const pdfUrl = `${serviceUrl}/work-orders/${currentRecordId}/pdf`;

    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <StyledActionButton
      type="button"
      onClick={handlePrintClick}
      title="Open and print roofing crew work order PDF"
    >
      <IconPrinter size={16} />
      <span>Print Work Order</span>
    </StyledActionButton>
  );
};

export default PrintWorkOrderActionButton;
