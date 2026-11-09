import React from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconFileCheck } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

const ProposalButton = styled.button`
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

export interface OpenProposalActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const OpenProposalActionButton: React.FC<
  OpenProposalActionButtonProps
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

  // Show on Opportunity (sales proposal) and Job records
  const targetObjects = ['opportunity', 'job'];
  if (!currentObject || !targetObjects.includes(currentObject)) {
    return null;
  }

  const handleOpenProposal = () => {
    if (!currentRecordId) return;

    const serviceUrl =
      (window as any)?._env_?.REACT_APP_PROPOSAL_SERVICE_URL ||
      process.env.REACT_APP_PROPOSAL_SERVICE_URL ||
      'http://localhost:4000';
    const proposalUrl = `${serviceUrl}/proposals/${currentRecordId}`;

    window.open(proposalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <ProposalButton
      type="button"
      onClick={handleOpenProposal}
      title="Open customer-facing tiered proposal & e-sign page"
    >
      <IconFileCheck size={16} />
      <span>View Proposal</span>
    </ProposalButton>
  );
};

export default OpenProposalActionButton;
