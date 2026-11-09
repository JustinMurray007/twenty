import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconPackageExport, IconCheck } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';
import { MaterialOrderModal } from './MaterialOrderModal';

const StyledOrderButton = styled.button`
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
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }

  &[data-success='true'] {
    background-color: ${themeCssVariables.color.green};
    border-color: ${themeCssVariables.color.green};
    color: #ffffff;

    &:hover {
      background-color: ${themeCssVariables.color.green};
      border-color: ${themeCssVariables.color.green};
    }
  }

  svg {
    stroke-width: 1.75;
  }
`;

export interface GenerateMaterialOrderActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const GenerateMaterialOrderActionButton: React.FC<
  GenerateMaterialOrderActionButtonProps
> = ({ objectNameSingular, recordId }) => {
  const params = useParams<{
    objectNameSingular?: string;
    objectRecordId?: string;
  }>();

  const [modalOpen, setModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  // Resolve object name and record ID from props or active route parameters
  const currentObject = (
    objectNameSingular ||
    params.objectNameSingular ||
    ''
  ).toLowerCase();
  const currentRecordId = recordId || params.objectRecordId;

  // Show only on roofing opportunities and jobs
  const targetObjects = ['opportunity', 'job', 'workorder'];
  if (!currentObject || !targetObjects.includes(currentObject)) {
    return null;
  }

  const handleOrderSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 5000);
  };

  return (
    <>
      <StyledOrderButton
        type="button"
        onClick={() => setModalOpen(true)}
        data-success={success ? 'true' : 'false'}
        title="Open supplier purchase order dispatch dialog"
      >
        {success ? <IconCheck size={16} /> : <IconPackageExport size={16} />}
        <span>{success ? 'PO Dispatched' : 'Order Materials'}</span>
      </StyledOrderButton>

      {currentRecordId && (
        <MaterialOrderModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          recordId={currentRecordId}
          onSuccess={handleOrderSuccess}
        />
      )}
    </>
  );
};
