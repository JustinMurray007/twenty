import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconShare, IconCheck } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

const ShareButton = styled.button`
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
  font-weight: ${themeCssVariables.font.weight.medium};
  cursor: pointer;
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

export interface CopyPortalLinkActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const CopyPortalLinkActionButton: React.FC<
  CopyPortalLinkActionButtonProps
> = ({ objectNameSingular, recordId }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // Show on Opportunity and Job records
  const targetObjects = ['opportunity', 'job'];
  if (currentObject && !targetObjects.includes(currentObject)) {
    return null;
  }

  const handleShareClick = async () => {
    if (!currentRecordId) return;

    try {
      setLoading(true);
      // Fetch or generate portal URL from microservice
      const serviceUrl =
        (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
        process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
        'http://localhost:4000';
      const res = await fetch(`${serviceUrl}/portal/link/${currentRecordId}`);
      const data = await res.json();

      if (data.portalUrl) {
        await navigator.clipboard.writeText(data.portalUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (e) {
      alert('Failed to generate tracking portal link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ShareButton
      type="button"
      onClick={handleShareClick}
      title="Copy live customer project tracker link (Job Share)"
      disabled={loading}
    >
      {copied ? <IconCheck size={16} color="#22c55e" /> : <IconShare size={16} />}
      <span>{copied ? 'Link Copied!' : 'Job Share'}</span>
    </ShareButton>
  );
};

export default CopyPortalLinkActionButton;
