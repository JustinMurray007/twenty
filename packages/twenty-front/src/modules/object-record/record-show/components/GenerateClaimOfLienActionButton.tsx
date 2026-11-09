import React from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconScale } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

const LegalButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #f87171;
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background-color: #fecaca;
    border-color: #ef4444;
  }

  svg {
    stroke-width: 1.75;
  }
`;

export interface GenerateClaimOfLienActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const GenerateClaimOfLienActionButton: React.FC<
  GenerateClaimOfLienActionButtonProps
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

  // Restrict button visibility to Opportunity and Job records
  const targetObjects = ['opportunity', 'job'];
  if (!currentObject || !targetObjects.includes(currentObject)) {
    return null;
  }

  const handleOpenPdf = () => {
    if (!currentRecordId) return;
    const serviceUrl =
      (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
      process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
      'http://localhost:4000';
    window.open(`${serviceUrl}/legal/claim-of-lien/${currentRecordId}/pdf`, '_blank', 'noopener,noreferrer');
  };

  return (
    <LegalButton
      type="button"
      onClick={handleOpenPdf}
      title="Export recorded California Claim of Mechanic's Lien (Cal. Civ. Code §§ 8416–8448)"
    >
      <IconScale size={16} />
      <span>Claim of Lien</span>
    </LegalButton>
  );
};

export default GenerateClaimOfLienActionButton;
