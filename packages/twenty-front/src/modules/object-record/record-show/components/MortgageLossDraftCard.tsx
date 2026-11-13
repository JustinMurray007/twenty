import React, { useEffect, useState } from 'react';

export interface MortgageLossDraftCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const MortgageLossDraftCard: React.FC<MortgageLossDraftCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [data, setData] = useState<any>(null);
  const [mortgageCompanyName, setMortgageCompanyName] = useState('Wells Fargo Home Mortgage');
  const [mortgageLoanNumber, setMortgageLoanNumber] = useState('LN-884120');
  const [checkNumber, setCheckNumber] = useState('CHK-90210');
  const [checkAmount, setCheckAmount] = useState(16500);
  const [courierTrackingNumber, setCourierTrackingNumber] = useState('FDX-774920184');
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/loss-draft/${opportunityId}/status`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load mortgage loss draft status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleGeneratePacket = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/loss-draft/${opportunityId}/generate-packet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mortgageCompanyName,
          mortgageLoanNumber,
          checkNumber,
          checkAmount,
          courierTrackingNumber,
        }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseCheck = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/loss-draft/${opportunityId}/release-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkNumber, endorsedAmount: checkAmount }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>🏦 Mortgage Loss Draft & Two-Party Check Tracker</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{data?.lossDraftStatus || 'Pending Endorsement'}</strong> • Escrow Holdback:{' '}
        <strong>${Number(data?.lossDraftHoldbackAmount ?? 0).toFixed(2)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          value={mortgageCompanyName}
          onChange={(e) => setMortgageCompanyName(e.target.value)}
          placeholder="Mortgage Servicer"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={mortgageLoanNumber}
          onChange={(e) => setMortgageLoanNumber(e.target.value)}
          placeholder="Loan Number"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={checkNumber}
          onChange={(e) => setCheckNumber(e.target.value)}
          placeholder="Two-Party Check #"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          type="number"
          value={checkAmount}
          onChange={(e) => setCheckAmount(Number(e.target.value))}
          placeholder="Check Amount ($)"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleGeneratePacket}
          style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Generate Loss Draft Packet
        </button>
        <button
          disabled={loading}
          onClick={handleReleaseCheck}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Release Endorsed Check to QBO
        </button>
      </div>
    </div>
  );
};
export default MortgageLossDraftCard;
