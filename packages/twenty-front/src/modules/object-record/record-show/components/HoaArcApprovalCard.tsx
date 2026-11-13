import React, { useEffect, useState } from 'react';

export interface HoaArcApprovalCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const HoaArcApprovalCard: React.FC<HoaArcApprovalCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [hoaManagementCompany, setHoaManagementCompany] = useState('FirstService Residential HOA');
  const [hoaCommunityName, setHoaCommunityName] = useState('Del Mar Highlands Estates HOA');
  const [shingleColor, setShingleColor] = useState('GAF Timberline HDZ — Charcoal');
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/hoa-arc/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load HOA ARC status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleSubmitPacket = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/hoa-arc/${opportunityId}/submit-packet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hoaManagementCompany, hoaCommunityName, shingleColor }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/hoa-arc/${opportunityId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedColor: shingleColor }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>🏘️ HOA Architectural Review Committee (ARC) Gate</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.compliance?.hoaArcStatus || 'No HOA / Exempt'}</strong> • Mobilization Cleared:{' '}
        <strong>{status?.compliance?.clearedForMobilization ? 'YES' : 'BLOCKED'}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          value={hoaManagementCompany}
          onChange={(e) => setHoaManagementCompany(e.target.value)}
          placeholder="HOA Management Co."
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={hoaCommunityName}
          onChange={(e) => setHoaCommunityName(e.target.value)}
          placeholder="HOA Community Name"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={shingleColor}
          onChange={(e) => setShingleColor(e.target.value)}
          placeholder="Proposed CC&R Shingle Color"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleSubmitPacket}
          style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Submit 1-Click HOA ARC Packet
        </button>
        <button
          disabled={loading}
          onClick={handleApprove}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Record HOA ARC Approval
        </button>
      </div>
    </div>
  );
};
export default HoaArcApprovalCard;
