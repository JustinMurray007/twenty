import React, { useEffect, useState } from 'react';

export interface MaintenanceAndServiceTicketCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const MaintenanceAndServiceTicketCard: React.FC<MaintenanceAndServiceTicketCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [category, setCategory] = useState('Active Rain Leak - Flashing/Pipe Boot');
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/service-tickets/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load service ticket status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/service-tickets/${opportunityId}/enroll-maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annualFee: 299 }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchTicket = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/service-tickets/${opportunityId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, isActiveRain: true, estimatedRepairCost: 350 }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>🛠️ Post-Install Leak Service Dispatcher & $299/yr Tune-Up Plan</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Ticket Status: <strong>{status?.serviceTicketStatus || 'None'}</strong> • Membership:{' '}
        <strong>{status?.maintenancePlanEnrolled ? 'Enrolled ($299/yr)' : 'Not Enrolled'}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Leak / Service Category"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <button
          disabled={loading}
          onClick={handleDispatchTicket}
          style={{ padding: '8px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Dispatch 24-Hr Emergency Leak Tech
        </button>
        <button
          disabled={loading}
          onClick={handleEnroll}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Enroll $299/yr Roof Tune-Up
        </button>
      </div>
    </div>
  );
};
export default MaintenanceAndServiceTicketCard;

