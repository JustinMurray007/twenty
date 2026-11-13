import React, { useEffect, useState } from 'react';

export interface CommercialFlatRoofCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const CommercialFlatRoofCard: React.FC<CommercialFlatRoofCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [flatRoofAreaSqFt, setFlatRoofAreaSqFt] = useState(2500);
  const [membraneMil, setMembraneMil] = useState(60);
  const [polyisoRValue, setPolyisoRValue] = useState(20);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/flat-roof/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
    } catch (err) {
      console.error('Failed to load flat roof estimate:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/flat-roof/${opportunityId}/calculate-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flatRoofAreaSqFt, membraneMil, polyisoRValue, crrcSriRating: 104 }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>🏢 Low-Slope / Commercial Flat Roof (TPO/PVC) & Title 24 Cool Roof</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Estimate: <strong>${Number(status?.estimate?.totalFlatRoofEstimate ?? 0).toFixed(2)}</strong> • Title 24 Cool Roof:{' '}
        <strong>{status?.estimate?.title24CoolRoofCompliant ? 'COMPLIANT (SRI 104)' : 'NON-COMPLIANT'}</strong> • NDL Warranty:{' '}
        <strong>{status?.estimate?.ndlWarrantyYears || 20} Years</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          type="number"
          value={flatRoofAreaSqFt}
          onChange={(e) => setFlatRoofAreaSqFt(Number(e.target.value))}
          placeholder="Flat Roof Area (Sq. Ft.)"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <select
          value={membraneMil}
          onChange={(e) => setMembraneMil(Number(e.target.value))}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        >
          <option value={60}>60-Mil TPO Cool Roof (20-Yr NDL)</option>
          <option value={80}>80-Mil TPO Heavy Duty (25-Yr NDL)</option>
        </select>
        <select
          value={polyisoRValue}
          onChange={(e) => setPolyisoRValue(Number(e.target.value))}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        >
          <option value={20}>R-20 Polyiso Rigid Insulation</option>
          <option value={30}>R-30 Title 24 High-Efficiency Polyiso</option>
        </select>
      </div>
      <button
        disabled={loading}
        onClick={handleCalculate}
        style={{ padding: '8px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Calculate TPO + Polyiso + Title 24 Estimate
      </button>
    </div>
  );
};
export default CommercialFlatRoofCard;

