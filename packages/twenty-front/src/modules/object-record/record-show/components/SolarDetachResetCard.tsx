import React, { useEffect, useState } from 'react';

export interface SolarDetachResetCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const SolarDetachResetCard: React.FC<SolarDetachResetCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [panelCount, setPanelCount] = useState(22);
  const [inverterType, setInverterType] = useState('Enphase IQ8 Microinverters');
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/solar-dnr/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load Solar D&R status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleScheduleDetach = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/solar-dnr/${opportunityId}/schedule-detach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelCount, inverterType, markDetachCompleted: true }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/solar-dnr/${opportunityId}/complete-reset`, {
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
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>☀️ Solar Panel Detach & Reset (D&R) Sub-Trade Coordinator</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.solarDnRStatus || 'No Solar Array'}</strong> • Total D&R Quote:{' '}
        <strong>${Number(status?.calculation?.totalDnRQuote ?? 0).toFixed(2)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          type="number"
          value={panelCount}
          onChange={(e) => setPanelCount(Number(e.target.value))}
          placeholder="Solar Panel Count"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={inverterType}
          onChange={(e) => setInverterType(e.target.value)}
          placeholder="Inverter Type"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleScheduleDetach}
          style={{ padding: '8px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Complete Stage 1 Solar Detach
        </button>
        <button
          disabled={loading}
          onClick={handleCompleteReset}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Complete Stage 2 Solar Reset & Sync QBO Bill
        </button>
      </div>
    </div>
  );
};
export default SolarDetachResetCard;
