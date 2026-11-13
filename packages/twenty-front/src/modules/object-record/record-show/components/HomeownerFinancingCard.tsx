import React, { useEffect, useState } from 'react';

export interface HomeownerFinancingCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const HomeownerFinancingCard: React.FC<HomeownerFinancingCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [lender, setLender] = useState('GoodLeap');
  const [planCode, setPlanCode] = useState('STD_120M_999');
  const [principalAmount, setPrincipalAmount] = useState(24000);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/financing/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load financing status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleSendPrequal = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/financing/${opportunityId}/send-prequal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lender, planCode, principalAmount }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleRecordFunding = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/financing/${opportunityId}/record-funding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lender, planCode, principalAmount }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>💳 POS Homeowner Roof Financing & Dealer-Fee Calculator</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.financingApplicationStatus || 'Not Applied'}</strong> • Est. Monthly:{' '}
        <strong>${Number(status?.offer?.monthlyPayment ?? 0).toFixed(2)}/mo</strong> • Net Funded:{' '}
        <strong>${Number(status?.offer?.netFundedAmount ?? 0).toFixed(2)}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <select
          value={lender}
          onChange={(e) => setLender(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        >
          <option value="GoodLeap">GoodLeap</option>
          <option value="Sunlight Financial">Sunlight Financial</option>
          <option value="Service Finance">Service Finance</option>
        </select>
        <select
          value={planCode}
          onChange={(e) => setPlanCode(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        >
          <option value="STD_120M_999">10-Yr 9.99% APR (5.5% Dealer Fee)</option>
          <option value="SAC_12M_0APR">12-Mo Same-As-Cash 0% (11.5% Dealer Fee)</option>
          <option value="LOW_180M_799">15-Yr 7.99% APR (8.75% Dealer Fee)</option>
        </select>
        <input
          type="number"
          value={principalAmount}
          onChange={(e) => setPrincipalAmount(Number(e.target.value))}
          placeholder="Financed Amount ($)"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading}
          onClick={handleSendPrequal}
          style={{ padding: '8px 12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Send Soft-Pull Pre-Qual Link
        </button>
        <button
          disabled={loading}
          onClick={handleRecordFunding}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Record Disbursement & Dealer Fee in QBO
        </button>
      </div>
    </div>
  );
};
export default HomeownerFinancingCard;
