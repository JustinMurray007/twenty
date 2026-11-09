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

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: ${({ status }) =>
    status === 'Approved & Signed'
      ? '#dcfce7'
      : status === 'Pending Homeowner Approval'
      ? '#fef3c7'
      : '#f1f5f9'};
  color: ${({ status }) =>
    status === 'Approved & Signed'
      ? '#166534'
      : status === 'Pending Homeowner Approval'
      ? '#92400e'
      : '#475569'};
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

const SummaryBox = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  font-size: 13px;
  color: #334155;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button<{ variant?: 'primary' | 'success' }>`
  flex: 1;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  color: #ffffff;
  background: ${({ variant }) => (variant === 'success' ? '#16a34a' : '#2563eb')};
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export interface DeckingChangeOrderCardProps {
  opportunityId: string;
  initialSheets?: number;
  initialFasciaLf?: number;
  includedFreeSheets?: number;
  ratePerSheet?: number;
  ratePerLf?: number;
  changeOrderStatus?: string;
  approvalUrl?: string;
  apiBaseUrl?: string;
  onUpdated?: (data: any) => void;
}

export const DeckingChangeOrderCard: React.FC<DeckingChangeOrderCardProps> = ({
  opportunityId,
  initialSheets = 0,
  initialFasciaLf = 0,
  includedFreeSheets = 0,
  ratePerSheet = 85,
  ratePerLf = 14,
  changeOrderStatus = 'None',
  approvalUrl: initialApprovalUrl = '',
  apiBaseUrl = 'http://localhost:4000',
  onUpdated,
}) => {
  const [sheets, setSheets] = useState<number>(initialSheets);
  const [fasciaLf, setFasciaLf] = useState<number>(initialFasciaLf);
  const [freeSheets, setFreeSheets] = useState<number>(includedFreeSheets);
  const [status, setStatus] = useState<string>(changeOrderStatus);
  const [approvalUrl, setApprovalUrl] = useState<string>(initialApprovalUrl);
  const [loading, setLoading] = useState<boolean>(false);

  const billableSheets = Math.max(0, sheets - freeSheets);
  const deckingTotal = billableSheets * ratePerSheet;
  const fasciaTotal = fasciaLf * ratePerLf;
  const grandTotal = deckingTotal + fasciaTotal;
  const crewLaborAdder = sheets * 35 + fasciaLf * 5;

  const handleSendChangeOrderSms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/change-orders/${opportunityId}/request-decking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheets,
          fasciaLf,
          includedFreeSheets: freeSheets,
          ratePerSheet,
          ratePerLf,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.changeOrderStatus);
        setApprovalUrl(data.approvalUrl || '');
        if (onUpdated) onUpdated(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/change-orders/${opportunityId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalMethod: 'CRM Office Override',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.changeOrderStatus);
        if (onUpdated) onUpdated(data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Header>
        <Title>🪵 Post-Tear-Off Rotted Decking & Fascia Change Order</Title>
        <StatusBadge status={status}>{status}</StatusBadge>
      </Header>

      <Grid>
        <FieldGroup>
          <Label>Rotted OSB / Plywood Sheets</Label>
          <Input
            type="number"
            min={0}
            value={sheets}
            onChange={(e) => setSheets(Number(e.target.value))}
          />
        </FieldGroup>
        <FieldGroup>
          <Label>Contract Free Sheets</Label>
          <Input
            type="number"
            min={0}
            value={freeSheets}
            onChange={(e) => setFreeSheets(Number(e.target.value))}
          />
        </FieldGroup>
        <FieldGroup>
          <Label>Rotted Fascia (LF)</Label>
          <Input
            type="number"
            min={0}
            value={fasciaLf}
            onChange={(e) => setFasciaLf(Number(e.target.value))}
          />
        </FieldGroup>
      </Grid>

      <SummaryBox>
        <div>
          <strong>Homeowner Billable Addition:</strong> {billableSheets} sheet(s) @ ${ratePerSheet}/sh ($
          {deckingTotal.toFixed(2)}) + {fasciaLf} LF fascia @ ${ratePerLf}/LF (${fasciaTotal.toFixed(2)}) ={' '}
          <strong>+${grandTotal.toFixed(2)}</strong>
        </div>
        <div style={{ marginTop: 4, color: '#64748b' }}>
          Crew Labor Voucher Addition: +${crewLaborAdder.toFixed(2)} ($35/sheet, $5/LF) • Syncs to QuickBooks Online Invoice on approval
        </div>
        {approvalUrl && (
          <div style={{ marginTop: 6 }}>
            1-Tap Link: <a href={approvalUrl} target="_blank" rel="noreferrer">{approvalUrl}</a>
          </div>
        )}
      </SummaryBox>

      <ActionRow>
        <Button
          variant="primary"
          disabled={loading || (sheets <= 0 && fasciaLf <= 0)}
          onClick={handleSendChangeOrderSms}
        >
          📲 Text 1-Tap Approval Link to Homeowner (+${grandTotal.toFixed(2)})
        </Button>
        {status === 'Pending Homeowner Approval' && (
          <Button variant="success" disabled={loading} onClick={handleManualApprove}>
            ✓ Approve & Sync QBO Invoice
          </Button>
        )}
      </ActionRow>
    </Card>
  );
};

export default DeckingChangeOrderCard;
