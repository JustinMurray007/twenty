import React, { useEffect, useState } from 'react';

export interface CanvassingNeighborhoodCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const CanvassingNeighborhoodCard: React.FC<CanvassingNeighborhoodCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [summary, setSummary] = useState<any>(null);
  const [addressStreet, setAddressStreet] = useState('');
  const [homeownerName, setHomeownerName] = useState('');
  const [pinStatus, setPinStatus] = useState('Inspection Booked');
  const [loading, setLoading] = useState(false);

  const loadPins = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/canvassing/${opportunityId}/pins`);
      const json = await res.json();
      setSummary(json);
    } catch (err) {
      console.error('Failed to load canvassing pins:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadPins();
  }, [opportunityId]);

  const handleAddPin = async () => {
    if (!addressStreet) return;
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/canvassing/${opportunityId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressStreet, homeownerName, pinStatus }),
      });
      setAddressStreet('');
      setHomeownerName('');
      await loadPins();
    } finally {
      setLoading(false);
    }
  };

  const handleConvertPin = async (pinId: string) => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/canvassing/pins/${pinId}/convert`, {
        method: 'POST',
      });
      await loadPins();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>📍 Storm Swath & Cloverleaf Neighborhood Canvassing</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Doors Knocked: <strong>{summary?.totalPins || 0}</strong> • Inspections Booked:{' '}
        <strong>{summary?.inspectionBookedCount || 0}</strong> • Conversion Rate:{' '}
        <strong>{summary?.conversionRatePct || 0}%</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 12 }}>
        <input
          value={addressStreet}
          onChange={(e) => setAddressStreet(e.target.value)}
          placeholder="Neighbor Street Address"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <input
          value={homeownerName}
          onChange={(e) => setHomeownerName(e.target.value)}
          placeholder="Neighbor Name"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <select
          value={pinStatus}
          onChange={(e) => setPinStatus(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        >
          <option value="Inspection Booked">Inspection Booked</option>
          <option value="Not Home">Not Home</option>
          <option value="Follow-Up">Follow-Up</option>
          <option value="No Damage">No Damage</option>
        </select>
        <button
          disabled={loading}
          onClick={handleAddPin}
          style={{ padding: '8px 12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Drop Pin
        </button>
      </div>
      {(summary?.pins || []).map((pin: any) => (
        <div
          key={pin.id}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #e2e8f0', fontSize: 13 }}
        >
          <span>
            <strong>{pin.addressStreet}</strong> ({pin.homeownerName}) — {pin.pinStatus}
          </span>
          {!pin.convertedOpportunityId ? (
            <button
              onClick={() => handleConvertPin(pin.id)}
              style={{ padding: '4px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
            >
              1-Click Convert to Lead
            </button>
          ) : (
            <span style={{ color: '#16a34a', fontWeight: 700 }}>Converted ({pin.convertedOpportunityId})</span>
          )}
        </div>
      ))}
    </div>
  );
};
export default CanvassingNeighborhoodCard;

