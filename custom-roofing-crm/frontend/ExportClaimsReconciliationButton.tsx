import React, { useState } from 'react';
import styled from '@emotion/styled';
import { IconFileSpreadsheet, IconDownload } from '@tabler/icons-react';

const ExportButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background-color: ${({ theme }: any) => theme?.background?.secondary || '#1e293b'};
  color: ${({ theme }: any) => theme?.font?.color?.primary || '#f8fafc'};
  border: 1px solid ${({ theme }: any) => theme?.border?.color?.medium || '#334155'};
  border-radius: ${({ theme }: any) => theme?.border?.radius?.sm || '6px'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }: any) => theme?.background?.tertiary || '#334155'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ExportClaimsReconciliationButton: React.FC = () => {
  const [downloading, setDownloading] = useState(false);

  const handleExport = () => {
    setDownloading(true);
    const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';
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
