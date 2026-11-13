import React, { useEffect, useState } from 'react';

export interface MaterialReturnCreditCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const MaterialReturnCreditCard: React.FC<MaterialReturnCreditCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [returnedBundlesCount, setReturnedBundlesCount] = useState(6);
  const [returnedUnderlaymentRolls, setReturnedUnderlaymentRolls] = useState(1);
  const [creditMemoNumber, setCreditMemoNumber] = useState('ABC-CM-99210');
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/material-returns/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load material return credit status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleReconcile = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/material-returns/${opportunityId}/reconcile-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditMemoNumber,
          returnedBundlesCount,
          returnedUnderlaymentRolls,
        }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>📦 Leftover Material Return & Supplier Credit Memo Reconciliation</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Credit Memo: <strong>{status?.supplierCreditMemoNumber || 'None'}</strong> • Net Credit:{' '}
        <strong>-${Number(status?.calculation?.netCreditAmount ?? 0).toFixed(2)}</strong> • Adjusted Material Cost:{' '}
        <strong>${Number(status?.calculation?.adjustedMaterialCost ?? 0).toFixed(2)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          value={creditMemoNumber}
          onChange={(e) => setCreditMemoNumber(e.target.value)}
          placeholder="ABC Credit Memo #"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          type="number"
          value={returnedBundlesCount}
          onChange={(e) => setReturnedBundlesCount(Number(e.target.value))}
          placeholder="Returned Shingle Bundles"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          type="number"
          value={returnedUnderlaymentRolls}
          onChange={(e) => setReturnedUnderlaymentRolls(Number(e.target.value))}
          placeholder="Returned Underlayment Rolls"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <button
        disabled={loading}
        onClick={handleReconcile}
        style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Apply Supplier Credit Memo & Recalculate Job Margin
      </button>
    </div>
  );
};
export default MaterialReturnCreditCard;

