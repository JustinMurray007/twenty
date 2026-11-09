import React from 'react';
import { useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const Deck = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  padding: 10px 16px;
  margin-top: 10px;
  width: 100%;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatLabel = styled.span`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: ${themeCssVariables.font.color.light};
  letter-spacing: 0.5px;
`;

const StatValue = styled.span`
  font-size: 15px;
  font-weight: 800;
  color: ${themeCssVariables.font.color.primary};
`;

// Shield icon for insurance claim verification
const IconShieldCheck = ({ size = 18, color = '#38bdf8' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
    <path d="M9 12l2 2l4 -4" />
  </svg>
);

export interface InsuranceClaimWidgetProps {
  objectNameSingular?: string;
  recordId?: string;
  record?: any;
}

export const InsuranceClaimWidget: React.FC<InsuranceClaimWidgetProps> = ({
  objectNameSingular,
  recordId,
  record: propRecord,
}) => {
  const params = useParams<{ objectNameSingular?: string; objectRecordId?: string }>();
  const currentObject = (objectNameSingular || params.objectNameSingular || '').toLowerCase();
  const currentRecordId = recordId || params.objectRecordId;

  // Filter visibility to Opportunity or Job records
  if (currentObject && !['opportunity', 'job'].includes(currentObject)) {
    return null;
  }

  const hookRecord = useCurrentRecord(currentRecordId);
  const record = propRecord || hookRecord;

  if (!record?.insuranceClaimNumber) {
    return null;
  }

  const rcv = Number(record.totalClaimRcv || record.rcvInitialAmount || 0);
  const acv = Number(record.acvInitialAmount || 0);
  const depreciation = Number(record.depreciationAmount || 0);
  const deductible = Number(record.deductibleAmount || 0);
  const supplement = Number(record.supplementApprovedAmount || 0);

  return (
    <Deck data-testid="insurance-claim-widget">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '8px', borderRight: `1px solid ${themeCssVariables.border.color.light}` }}>
        <IconShieldCheck size={20} color="#38bdf8" />
        <Stat>
          <StatLabel>Carrier & Claim</StatLabel>
          <StatValue>
            {record.insuranceCarrier || 'Carrier'} #{record.insuranceClaimNumber}
          </StatValue>
        </Stat>
      </div>

      <Stat>
        <StatLabel>Total RCV</StatLabel>
        <StatValue style={{ color: '#38bdf8' }}>${rcv.toLocaleString()}</StatValue>
      </Stat>

      <Stat>
        <StatLabel>ACV First Check</StatLabel>
        <StatValue>${acv.toLocaleString()}</StatValue>
      </Stat>

      <Stat>
        <StatLabel>Deductible</StatLabel>
        <StatValue style={{ color: '#f59e0b' }}>${deductible.toLocaleString()}</StatValue>
      </Stat>

      <Stat>
        <StatLabel>Depreciation Held</StatLabel>
        <StatValue style={{ color: '#22c55e' }}>${depreciation.toLocaleString()}</StatValue>
      </Stat>

      {supplement > 0 && (
        <Stat>
          <StatLabel>Approved Supplement</StatLabel>
          <StatValue style={{ color: '#a855f7' }}>+${supplement.toLocaleString()}</StatValue>
        </Stat>
      )}
    </Deck>
  );
};

export default InsuranceClaimWidget;
