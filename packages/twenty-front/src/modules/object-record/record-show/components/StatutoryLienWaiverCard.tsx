import React, { useEffect, useState } from 'react';

export interface StatutoryLienWaiverCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const StatutoryLienWaiverCard: React.FC<StatutoryLienWaiverCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [waiverType, setWaiverType] = useState('CONDITIONAL_PROGRESS');
  const [amount, setAmount] = useState(12500);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/legal/waivers/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load statutory waiver status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleServePrelim = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/legal/waivers/${opportunityId}/serve-prelim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWaiver = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/legal/waivers/${opportunityId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiverType, amount }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>⚖️ CA Statutory 20-Day Prelim & Civil Code §§ 8132–8138 Lien Waivers</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        20-Day Prelim Served: <strong>{status?.evaluation?.preliminaryNoticeServed ? 'YES (Timely)' : 'Pending'}</strong> • Active Form:{' '}
        <strong>{status?.evaluation?.civilCodeSection || 'CA Civil Code § 8132'}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <select
          value={waiverType}
          onChange={(e) => setWaiverType(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        >
          <option value="CONDITIONAL_PROGRESS">Conditional Progress Waiver (§ 8132)</option>
          <option value="UNCONDITIONAL_PROGRESS">Unconditional Progress Waiver (§ 8134)</option>
          <option value="CONDITIONAL_FINAL">Conditional Final Waiver (§ 8136)</option>
          <option value="UNCONDITIONAL_FINAL">Unconditional Final Waiver (§ 8138)</option>
        </select>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          placeholder="Waiver Payment Amount ($)"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleServePrelim}
          style={{ padding: '8px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Record 20-Day Preliminary Notice (§ 8200)
        </button>
        <button
          disabled={loading}
          onClick={handleGenerateWaiver}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Generate Statutory Waiver & Release
        </button>
      </div>
    </div>
  );
};
export default StatutoryLienWaiverCard;
