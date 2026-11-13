import React, { useEffect, useState } from 'react';

export interface ReviewAndReferralCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const ReviewAndReferralCard: React.FC<ReviewAndReferralCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [referredNeighborName, setReferredNeighborName] = useState('');
  const [referredAddress, setReferredAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/reviews/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load review & referral status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleSendReviewLink = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/reviews/${opportunityId}/send-request`, { method: 'POST' });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleRecordReferral = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/reviews/${opportunityId}/record-referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referredNeighborName, referredAddress, bountyAmount: 250 }),
      });
      setReferredNeighborName('');
      setReferredAddress('');
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>⭐ Google Review Gate & $250 Referral Bounty Engine</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Review Status: <strong>{status?.reviewRequestStatus || 'Not Sent'}</strong> • Referral Code:{' '}
        <strong>{status?.referralCode || 'PENDING'}</strong> • Bounties Paid:{' '}
        <strong>${Number(status?.referralBountyPaid ?? 0).toFixed(2)}</strong> ({status?.referralCount || 0} Referrals)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 }}>
        <input
          value={referredNeighborName}
          onChange={(e) => setReferredNeighborName(e.target.value)}
          placeholder="Referred Neighbor Name"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={referredAddress}
          onChange={(e) => setReferredAddress(e.target.value)}
          placeholder="Referred Neighbor Address"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <button
          disabled={loading}
          onClick={handleRecordReferral}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Issue $250 Referral Bounty
        </button>
      </div>
      <button
        disabled={loading}
        onClick={handleSendReviewLink}
        style={{ padding: '8px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Send Review & Referral Link via SMS
      </button>
    </div>
  );
};
export default ReviewAndReferralCard;

