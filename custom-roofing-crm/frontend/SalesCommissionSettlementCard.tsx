import React, { useEffect, useState } from 'react';

export interface SalesCommissionSettlementCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const SalesCommissionSettlementCard: React.FC<SalesCommissionSettlementCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [closerRepName, setCloserRepName] = useState('Jake Morrison');
  const [canvasserRepName, setCanvasserRepName] = useState('Tyler Durden');
  const [canvasserSplitPct, setCanvasserSplitPct] = useState(20);
  const [drawAmount, setDrawAmount] = useState(750);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/commissions/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load commission settlement status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleRecordDraw = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/commissions/${opportunityId}/record-draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closerRepName, canvasserRepName, canvasserSplitPct, drawAmount }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/commissions/${opportunityId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>💵 Sales Rep Commission Draw, Canvasser Split & Final Settlement</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.commissionSettlementStatus || 'Pending Final Collection'}</strong> • Closer Net:{' '}
        <strong>${Number(status?.settlement?.closerNetPayable ?? 0).toFixed(2)}</strong> • Canvasser Split:{' '}
        <strong>${Number(status?.settlement?.canvasserNetPayable ?? 0).toFixed(2)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          value={closerRepName}
          onChange={(e) => setCloserRepName(e.target.value)}
          placeholder="Closer Rep"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={canvasserRepName}
          onChange={(e) => setCanvasserRepName(e.target.value)}
          placeholder="Canvasser Rep"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          type="number"
          value={canvasserSplitPct}
          onChange={(e) => setCanvasserSplitPct(Number(e.target.value))}
          placeholder="Canvasser Split %"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          type="number"
          value={drawAmount}
          onChange={(e) => setDrawAmount(Number(e.target.value))}
          placeholder="Advance Draw ($)"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleRecordDraw}
          style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Record Draw & Split
        </button>
        <button
          disabled={loading}
          onClick={handleSettle}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Settle Final Commission to QBO 1099 Bill
        </button>
      </div>
    </div>
  );
};
export default SalesCommissionSettlementCard;

