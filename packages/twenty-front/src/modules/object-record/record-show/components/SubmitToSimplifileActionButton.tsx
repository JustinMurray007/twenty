import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { IconCloudUpload, IconLoader2, IconCheck } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

const SimplifileButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background-color: #e0e7ff;
  color: #3730a3;
  border: 1px solid #a5b4fc;
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background-color: #c7d2fe;
    border-color: #818cf8;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg {
    stroke-width: 1.75;
  }
`;

export interface SubmitToSimplifileActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const SubmitToSimplifileActionButton: React.FC<
  SubmitToSimplifileActionButtonProps
> = ({ objectNameSingular, recordId }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = async () => {
    if (!currentRecordId || submitting) return;

    const confirmed = window.confirm(
      'Submit this notarized California Full Release of Mechanic\'s Lien to Simplifile for San Diego County E-Recording (FIPS 06073)?'
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const serviceUrl =
        (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
        process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
        'http://localhost:4000';

      const response = await fetch(
        `${serviceUrl}/legal/submit-release-to-recording/${currentRecordId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed with status ${response.status}`);
      }

      const result = await response.json();
      setSubmitted(true);
      alert(
        `E-Recording package successfully submitted to Simplifile!\n\nPackage ID: ${result.packageId}\nStatus: ${result.status}\n\nStage shifted to "Recording In Progress". You will be notified via SMS/email when the County Recorder assigns the recorded document number.`
      );
      window.location.reload();
    } catch (err: any) {
      alert(`Simplifile submission error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SimplifileButton
      type="button"
      onClick={handleSubmit}
      disabled={submitting}
      title="E-record notarized California Full Release of Mechanic's Lien via Simplifile (San Diego County FIPS 06073)"
    >
      {submitting ? (
        <>
          <IconLoader2 size={16} />
          <span>Submitting...</span>
        </>
      ) : submitted ? (
        <>
          <IconCheck size={16} />
          <span>E-Recording Submitted</span>
        </>
      ) : (
        <>
          <IconCloudUpload size={16} />
          <span>E-Record Lien Release</span>
        </>
      )}
    </SimplifileButton>
  );
};

export default SubmitToSimplifileActionButton;
