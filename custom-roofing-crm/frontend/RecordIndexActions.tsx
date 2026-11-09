import React from 'react';
import { ExportClaimsReconciliationButton } from './ExportClaimsReconciliationButton';

export const RecordIndexActions: React.FC<{ objectNamePlural?: string }> = ({ objectNamePlural = 'opportunities' }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {objectNamePlural === 'opportunities' && <ExportClaimsReconciliationButton />}
    </div>
  );
};
