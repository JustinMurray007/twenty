import React, { useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';

const ExportButton = styled.button`
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
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const IconFileSpreadsheet = ({ size = 16, color = '#16a34a' }: { size?: number; color?: string }) => (
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
    <path d="M8 11h8v7h-8z" />
    <path d="M8 15h8" />
    <path d="M11 11v7" />
  </svg>
);

export const ExportClaimsReconciliationButton: React.FC = () => {
  const [downloading, setDownloading] = useState(false);

  const handleExport = () => {
    setDownloading(true);
    const serviceUrl =
      (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
      process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
      'http://localhost:4000';
    window.location.href = `${serviceUrl}/export/insurance/reconciliation.xlsx`;
    setTimeout(() => setDownloading(false), 2500);
  };

  return (
    <ExportButton
      type="button"
      onClick={handleExport}
      disabled={downloading}
      title="Export Insurance Financial Reconciliation Excel Workbook"
    >
      <IconFileSpreadsheet size={16} color="#16a34a" />
      <span>{downloading ? 'Compiling...' : 'Export Claims Ledger'}</span>
    </ExportButton>
  );
};
