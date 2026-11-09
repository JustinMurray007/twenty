import React, { useState } from 'react';
import styled from '@emotion/styled';

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
`;

const Badge = styled.span<{ status: string }>`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: ${({ status }) =>
    status.includes('Passed') && status.includes('Closed')
      ? '#dcfce7'
      : status.includes('Failed')
      ? '#fee2e2'
      : '#dbeafe'};
  color: ${({ status }) =>
    status.includes('Passed') && status.includes('Closed')
      ? '#166534'
      : status.includes('Failed')
      ? '#991b1b'
      : '#1e40af'};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 14px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Label = styled.label`
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
`;

const Input = styled.input`
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 14px;
  color: #0f172a;
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 12px;
`;

const Button = styled.button<{ color?: string }>`
  padding: 9px 12px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: #ffffff;
  background: ${({ color }) => color || '#2563eb'};
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export interface PermitInspectionTrackerCardProps {
  opportunityId: string;
  initialJurisdiction?: string;
  initialPermitNumber?: string;
  initialPermitFee?: number;
  initialPermitStatus?: string;
  initialMidRoofStatus?: string;
  initialFinalStatus?: string;
  permitCardUrl?: string;
  apiBaseUrl?: string;
  onUpdated?: (data: any) => void;
}

export const PermitInspectionTrackerCard: React.FC<PermitInspectionTrackerCardProps> = ({
  opportunityId,
  initialJurisdiction = 'City of San Diego Development Services Dept.',
  initialPermitNumber = '',
  initialPermitFee = 350,
  initialPermitStatus = 'Not Applied',
  initialMidRoofStatus = 'Pending',
  initialFinalStatus = 'Pending',
  permitCardUrl: initialCardUrl = '',
  apiBaseUrl = 'http://localhost:4000',
  onUpdated,
}) => {
  const [jurisdiction, setJurisdiction] = useState<string>(initialJurisdiction);
  const [permitNumber, setPermitNumber] = useState<string>(initialPermitNumber);
  const [fee, setFee] = useState<number>(initialPermitFee);
  const [permitStatus, setPermitStatus] = useState<string>(initialPermitStatus);
  const [midRoofStatus, setMidRoofStatus] = useState<string>(initialMidRoofStatus);
  const [finalStatus, setFinalStatus] = useState<string>(initialFinalStatus);
  const [cardUrl, setCardUrl] = useState<string>(initialCardUrl);
  const [loading, setLoading] = useState<boolean>(false);

  const handleIssuePermit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/permits/${opportunityId}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permitJurisdiction: jurisdiction,
          permitNumber,
          permitFeeAmount: fee,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPermitStatus(data.permitStatus);
        setCardUrl(data.permitCardPdfUrl || '');
        if (onUpdated) onUpdated(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecordResult = async (inspectionType: 'mid-roof' | 'final', result: 'Passed' | 'Failed') => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/permits/${opportunityId}/record-inspection-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionType,
          result,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPermitStatus(data.permitStatus);
        if (inspectionType === 'mid-roof') setMidRoofStatus(data.result);
        else setFinalStatus(data.result);
        if (onUpdated) onUpdated(data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Header>
        <Title>🏛️ Municipal Building Permit & City Inspection Tracker</Title>
        <Badge status={permitStatus}>{permitStatus}</Badge>
      </Header>

      <Grid>
        <FieldGroup>
          <Label>Municipal Authority</Label>
          <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <Label>Permit Number</Label>
          <Input
            placeholder="e.g. PRMT-SD-2026-44109"
            value={permitNumber}
            onChange={(e) => setPermitNumber(e.target.value)}
          />
        </FieldGroup>
        <FieldGroup>
          <Label>Permit Fee ($ — Syncs to QBO A/P)</Label>
          <Input
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
          />
        </FieldGroup>
      </Grid>

      <div style={{ fontSize: 13, color: '#334155', marginBottom: 10 }}>
        <strong>Mid-Roof Decking Nailing:</strong> {midRoofStatus} •{' '}
        <strong>Final Building Inspection:</strong> {finalStatus}
        {cardUrl && (
          <>
            {' '}
            •{' '}
            <a href={cardUrl} target="_blank" rel="noreferrer">
              Printable Job-Site Permit Card
            </a>
          </>
        )}
      </div>

      <ActionGrid>
        <Button color="#2563eb" disabled={loading || !permitNumber} onClick={handleIssuePermit}>
          📋 Issue Permit & Post QBO Bill (${fee.toFixed(2)})
        </Button>
        <Button
          color="#0284c7"
          disabled={loading || !permitNumber}
          onClick={() => handleRecordResult('mid-roof', 'Passed')}
        >
          🔨 Pass Mid-Roof Nailing
        </Button>
        <Button
          color="#16a34a"
          disabled={loading || midRoofStatus !== 'Passed'}
          onClick={() => handleRecordResult('final', 'Passed')}
        >
          🏛️ Pass Final City Inspection
        </Button>
      </ActionGrid>
    </Card>
  );
};

export default PermitInspectionTrackerCard;

