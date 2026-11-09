import React from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconFileCertificate } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

const ReleaseButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background-color: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background-color: #bbf7d0;
    border-color: #4ade80;
  }

  svg {
    stroke-width: 1.75;
  }
`;

export interface GenerateReleaseOfLienActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const GenerateReleaseOfLienActionButton: React.FC<
  GenerateReleaseOfLienActionButtonProps
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
    window.open(`${serviceUrl}/legal/release-of-lien/${currentRecordId}/pdf`, '_blank', 'noopener,noreferrer');
  };

  return (
    <ReleaseButton
      type="button"
      onClick={handleOpenPdf}
      title="Export recorded California Full Release of Mechanic's Lien (Cal. Civ. Code § 8490)"
    >
      <IconFileCertificate size={16} />
      <span>Release Lien</span>
    </ReleaseButton>
  );
};

export default GenerateReleaseOfLienActionButton;
