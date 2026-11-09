import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';

const Button = styled.button`
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

// Tabler-equivalent SVG Icons
const IconClipboardCheck = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
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
    <path d="M9 5H7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2V7a2 2 0 0 0 -2 -2h-2" />
    <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
    <path d="M9 14l2 2l4 -4" />
  </svg>
);

const IconFileDownload = ({ size = 16, color = '#38bdf8' }: { size?: number; color?: string }) => (
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
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
    <path d="M12 17v-6" />
    <path d="M9.5 14.5l2.5 2.5l2.5 -2.5" />
  </svg>
);

export interface RoofInspectionActionButtonProps {
  objectNameSingular?: string;
  recordId?: string;
  inspectionReportUrl?: string;
}

export const RoofInspectionActionButton: React.FC<RoofInspectionActionButtonProps> = ({
  objectNameSingular,
  recordId,
  inspectionReportUrl: initialReportUrl,
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
  const currentRecordId = recordId || params.objectRecordId;

  const [reportUrl, setReportUrl] = useState<string | null>(initialReportUrl || null);

  const serviceUrl =
    (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
    process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
    'http://localhost:4000';

  // Check if inspection report URL exists for this record
  useEffect(() => {
    if (!currentRecordId) return;

    if (initialReportUrl) {
      setReportUrl(initialReportUrl);
      return;
    }

    // Default inspection PDF path if already compiled
    const expectedUrl = `${serviceUrl}/reports/Roof-Inspection-${currentRecordId.substring(0, 8)}.pdf`;
    
    // Check if the report PDF exists
    fetch(expectedUrl, { method: 'HEAD' })
      .then((res) => {
        if (res.ok) {
          setReportUrl(expectedUrl);
        }
      })
      .catch(() => {});
  }, [currentRecordId, initialReportUrl, serviceUrl]);

  // Show only on Opportunity and Job records
  const targetObjects = ['opportunity', 'job'];
  if (currentObject && !targetObjects.includes(currentObject)) {
    return null;
  }

  if (!currentRecordId) return null;

  const handleOpenForm = () => {
    window.open(`${serviceUrl}/inspect/${currentRecordId}`, '_blank');
  };

  const handleViewReport = () => {
    const targetUrl =
      reportUrl || `${serviceUrl}/reports/Roof-Inspection-${currentRecordId.substring(0, 8)}.pdf`;
    window.open(targetUrl, '_blank');
  };

  return (
    <div style={{ display: 'inline-flex', gap: '8px' }}>
      <Button
        type="button"
        onClick={handleOpenForm}
        title="Open mobile inspection checklist"
      >
        <IconClipboardCheck size={16} />
        <span>Roof Inspection</span>
      </Button>

      {reportUrl && (
        <Button
          type="button"
          onClick={handleViewReport}
          title="Download Inspection Report PDF"
        >
          <IconFileDownload size={16} color="#38bdf8" />
          <span>Report PDF</span>
        </Button>
      )}
    </div>
  );
};

export default RoofInspectionActionButton;
