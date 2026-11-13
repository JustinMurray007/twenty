import React, { useEffect, useState } from 'react';

export interface DumpsterDispatchCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const DumpsterDispatchCard: React.FC<DumpsterDispatchCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [haulerName, setHaulerName] = useState('EDCO Waste & Recycling Services');
  const [ticketNumber, setTicketNumber] = useState('EDCO-TKT-5512');
  const [actualTons, setActualTons] = useState(4.6);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/dumpster/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load dumpster status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleDispatch = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/dumpster/${opportunityId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ haulerName }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleReconcileTicket = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/dumpster/${opportunityId}/reconcile-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ haulerName, ticketNumber, actualTons }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>🚛 Roll-Off Dumpster Dispatch & Overweight Tonnage</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.dumpsterStatus || 'Not Scheduled'}</strong> • Recommended Size:{' '}
        <strong>{status?.sizing?.recommendedContainerSizeYd || 20} YD</strong> ({status?.sizing?.estimatedTons || 3.5} Est. Tons)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          value={haulerName}
          onChange={(e) => setHaulerName(e.target.value)}
          placeholder="Roll-Off Hauler"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          placeholder="Landfill Weight Ticket #"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          type="number"
          step="0.1"
          value={actualTons}
          onChange={(e) => setActualTons(Number(e.target.value))}
          placeholder="Actual Scale Tons"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleDispatch}
          style={{ padding: '8px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Dispatch Roll-Off Container
        </button>
        <button
          disabled={loading}
          onClick={handleReconcileTicket}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Reconcile Landfill Ticket to QBO COGS #62
        </button>
      </div>
    </div>
  );
};
export default DumpsterDispatchCard;

