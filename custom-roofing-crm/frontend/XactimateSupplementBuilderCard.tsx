import React, { useEffect, useState } from 'react';

export interface XactimateSupplementBuilderCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const XactimateSupplementBuilderCard: React.FC<XactimateSupplementBuilderCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [initialRcv, setInitialRcv] = useState(18000);
  const [tradesCount, setTradesCount] = useState(3);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/supplements/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load Xactimate supplement status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/supplements/${opportunityId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialRcv, tradesCount }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/supplements/${opportunityId}/approve`, {
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
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>📐 Xactimate Code-Upgrade & 10%/10% O&P Supplement Builder</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.supplementStatus || 'Draft'}</strong> • Requested Supplement:{' '}
        <strong>+${Number(status?.calculation?.totalSupplementRequested ?? 0).toFixed(2)}</strong> • Revised RCV:{' '}
        <strong>${Number(status?.calculation?.revisedRcvTotal ?? 0).toFixed(2)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          type="number"
          value={initialRcv}
          onChange={(e) => setInitialRcv(Number(e.target.value))}
          placeholder="Initial Carrier RCV ($)"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          type="number"
          value={tradesCount}
          onChange={(e) => setTradesCount(Number(e.target.value))}
          placeholder="Coordinated Trades Count (>=3 for O&P)"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleGenerate}
          style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Generate CBC R905 Code & O&P Rebuttal Packet
        </button>
        <button
          disabled={loading}
          onClick={handleApprove}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Record Carrier Supplement Approval & Sync QBO
        </button>
      </div>
    </div>
  );
};
export default XactimateSupplementBuilderCard;

