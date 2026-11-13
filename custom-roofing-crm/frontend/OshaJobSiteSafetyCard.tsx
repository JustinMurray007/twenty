import React, { useEffect, useState } from 'react';

export interface OshaJobSiteSafetyCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const OshaJobSiteSafetyCard: React.FC<OshaJobSiteSafetyCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [checks, setChecks] = useState({
    oshaAnchorPointsInstalled: false,
    oshaHarnessesInspected: false,
    oshaLadderThreeFeetAboveEave: false,
    oshaPerimeterCautionTapeSet: false,
    oshaHeatIllnessWaterShadeVerified: false,
  });
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/safety/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
      if (json?.evaluation?.checklist) {
        setChecks(json.evaluation.checklist);
      }
    } catch (err) {
      console.error('Failed to load Cal/OSHA safety status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleSaveTailgate = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/safety/${opportunityId}/log-tailgate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...checks, oshaTailgateSignedByCrewCount: 5 }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>🦺 Cal/OSHA 1926.501 Fall-Protection & Heat-Illness Tailgate Log</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.oshaSafetyStatus || 'Pending Pre-Shift Check'}</strong> • Tear-Off Gate:{' '}
        <strong>{status?.evaluation?.clearedForTearOff ? 'CLEARED' : 'HOLD'}</strong>
      </div>
      <div style={{ display: 'grid', gap: 6, marginBottom: 12, fontSize: 13 }}>
        {[
          ['oshaAnchorPointsInstalled', '5,000-lb Roof Ridge Fall-Arrest Anchors Installed'],
          ['oshaHarnessesInspected', 'Full-Body PFAS Harnesses & Shock Lanyards Inspected'],
          ['oshaLadderThreeFeetAboveEave', 'Access Extension Ladder Tied Off >= 36" Above Eave'],
          ['oshaPerimeterCautionTapeSet', 'Drop-Zone Perimeter Caution Tape & Hardhat Zone Set'],
          ['oshaHeatIllnessWaterShadeVerified', 'Cal/OSHA § 3395 Potable Water & Shade Canopy Verified'],
        ].map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={Boolean((checks as any)[key])}
              onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>
      <button
        disabled={loading}
        onClick={handleSaveTailgate}
        style={{ padding: '8px 12px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Log Daily JSA & Clear Tear-Off Gate
      </button>
    </div>
  );
};
export default OshaJobSiteSafetyCard;

