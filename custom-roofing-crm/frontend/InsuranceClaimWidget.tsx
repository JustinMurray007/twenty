import React from 'react';

export interface InsuranceClaimWidgetProps {
  record?: {
    insuranceCarrier?: string;
    insuranceClaimNumber?: string;
    totalClaimRcv?: number;
    rcvInitialAmount?: number;
    acvInitialAmount?: number;
    depreciationAmount?: number;
    deductibleAmount?: number;
    supplementApprovedAmount?: number;
    supplementRequestedAmount?: number;
    insuranceClaimStage?: string;
  };
}

export const InsuranceClaimWidget: React.FC<InsuranceClaimWidgetProps> = ({ record }) => {
  if (!record?.insuranceClaimNumber) {
    return null;
  }

  const rcv = Number(record.totalClaimRcv || record.rcvInitialAmount || 0);
  const acv = Number(record.acvInitialAmount || 0);
  const depreciation = Number(record.depreciationAmount || 0);
  const deductible = Number(record.deductibleAmount || 0);
  const supplement = Number(record.supplementApprovedAmount || 0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '18px',
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '12px 18px',
        marginTop: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
          Carrier & Claim
        </span>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
          {record.insuranceCarrier || 'Carrier'} #{record.insuranceClaimNumber}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
          Total RCV
        </span>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8' }}>
          ${rcv.toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
          ACV First Check
        </span>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
          ${acv.toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
          Deductible
        </span>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b' }}>
          ${deductible.toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
          Depreciation Held
        </span>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#22c55e' }}>
          ${depreciation.toLocaleString()}
        </span>
      </div>

      {supplement > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Approved Supplement
          </span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#a855f7' }}>
            +${supplement.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default InsuranceClaimWidget;
