import React, { useEffect, useState } from 'react';

export interface FinalWalkthroughPunchListCardProps {
  opportunityId: string;
  apiBaseUrl?: string;
}

export const FinalWalkthroughPunchListCard: React.FC<FinalWalkthroughPunchListCardProps> = ({
  opportunityId,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [checks, setChecks] = useState({
    qcMagneticSweepVerified: false,
    qcGutterCleanoutVerified: false,
    qcPipeBootFlashingVerified: false,
    qcAtticPenetrationChecked: false,
    qcDrivewayDebrisCleared: false,
  });
  const [signedBy, setSignedBy] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/qc-walkthrough/${opportunityId}/status`);
      const json = await res.json();
      setStatus(json);
      if (json?.compliance?.checklist) {
        setChecks(json.compliance.checklist);
      }
    } catch (err) {
      console.error('Failed to load QC walkthrough status:', err);
    }
  };

  useEffect(() => {
    if (opportunityId) loadStatus();
  }, [opportunityId]);

  const handleSaveChecklist = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/qc-walkthrough/${opportunityId}/verify-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checks),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleSignOff = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBaseUrl}/api/qc-walkthrough/${opportunityId}/sign-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedBy: signedBy || 'Homeowner' }),
      });
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>🧲 Final QC Walkthrough, Magnetic Nail Sweep & Punch-List Gate</h3>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        Status: <strong>{status?.qcWalkthroughStatus || 'Pending Inspection'}</strong> •Verified:{' '}
        <strong>{status?.compliance?.completedCount || 0} / 5</strong>
      </div>
      <div style={{ display: 'grid', gap: 6, marginBottom: 12, fontSize: 13 }}>
        {[
          ['qcMagneticSweepVerified', '3-Pass Magnetic Nail Sweep (Driveway, Lawn & Perimeter Beds)'],
          ['qcGutterCleanoutVerified', 'Gutters & Downspouts Flushed of Granules & Tear-Off Nails'],
          ['qcPipeBootFlashingVerified', 'Pipe Boots, Step Flashings & Counter-Flashings Sealed'],
          ['qcAtticPenetrationChecked', 'Attic Deck Penetrations & HVAC Exhaust Vents Checked'],
          ['qcDrivewayDebrisCleared', 'Roll-Off Container Removed & Driveway Swept Clean'],
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          disabled={loading}
          onClick={handleSaveChecklist}
          style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Save 5-Point QC Checklist
        </button>
        <input
          value={signedBy}
          onChange={(e) => setSignedBy(e.target.value)}
          placeholder="Homeowner Digital Signature"
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <button
          disabled={loading}
          onClick={handleSignOff}
          style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Complete Final Walkthrough Sign-Off
        </button>
      </div>
    </div>
  );
};
export default FinalWalkthroughPunchListCard;
