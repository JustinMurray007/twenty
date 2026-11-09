import React from 'react';
import { ExportClaimsReconciliationButton } from '@/object-record/record-index/components/ExportClaimsReconciliationButton';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';

export const RecordIndexActions: React.FC = () => {
  const { objectNamePlural } = useRecordIndexContextOrThrow();

  // Show the claims ledger export for opportunities/deals
  const isOpportunity = objectNamePlural === 'opportunities';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {isOpportunity && <ExportClaimsReconciliationButton />}
    </div>
  );
};
