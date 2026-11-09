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
    status === 'Registered & Issued'
      ? '#dcfce7'
      : status === 'Eligible for Registration'
      ? '#dbeafe'
      : '#fee2e2'};
  color: ${({ status }) =>
    status === 'Registered & Issued'
      ? '#166534'
      : status === 'Eligible for Registration'
      ? '#1e40af'
      : '#991b1b'};
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

const Select = styled.select`
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 14px;
  color: #0f172a;
`;

const SummaryBox = styled.div`
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  font-size: 13px;
  color: #78350f;
`;

const ErrorAlert = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #991b1b;
`;

const Button = styled.button`
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  color: #ffffff;
  background: #b45309;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export interface WarrantyRegistrationCardProps {
  opportunityId: string;
  initialManufacturer?: 'GAF' | 'Owens Corning';
  initialTier?: 'Good' | 'Better' | 'Best';
  initialLotNumber?: string;
  initialStatus?: string;
  registrationNumber?: string;
  certificateUrl?: string;
  qboInvoiceBalance?: number;
  apiBaseUrl?: string;
  onRegistered?: (data: any) => void;
}

export const WarrantyRegistrationCard: React.FC<WarrantyRegistrationCardProps> = ({
  opportunityId,
  initialManufacturer = 'GAF',
  initialTier = 'Best',
  initialLotNumber = '',
  initialStatus = 'Pending Final Payment',
  registrationNumber: initialRegNum = '',
  certificateUrl: initialCertUrl = '',
  qboInvoiceBalance = 0,
  apiBaseUrl = 'http://localhost:4000',
  onRegistered,
}) => {
  const [manufacturer, setManufacturer] = useState<'GAF' | 'Owens Corning'>(initialManufacturer);
  const [tier, setTier] = useState<'Good' | 'Better' | 'Best'>(initialTier);
  const [lotNumber, setLotNumber] = useState<string>(initialLotNumber);
  const [status, setStatus] = useState<string>(initialStatus);
  const [regNumber, setRegNumber] = useState<string>(initialRegNum);
  const [certUrl, setCertUrl] = useState<string>(initialCertUrl);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleRegisterWarranty = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/warranties/${opportunityId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer,
          selectedTier: tier,
          shingleLotNumber: lotNumber || undefined,
          sendPacketToHomeowner: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Warranty registration locked.');
      } else {
        setStatus(data.warrantyStatus);
        setRegNumber(data.warrantyRegistrationNumber || '');
        setCertUrl(data.warrantyCertificateUrl || '');
        if (onRegistered) onRegistered(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const programLabel =
    manufacturer === 'Owens Corning'
      ? tier === 'Best'
        ? 'Owens Corning Platinum Protection™ (50-Yr Material / 25-Yr Workmanship)'
        : tier === 'Better'
        ? 'Owens Corning System Protection™ (50-Yr Material / 10-Yr Workmanship)'
        : 'Owens Corning Standard Product & 5-Yr Workmanship'
      : tier === 'Best'
      ? 'GAF Golden Pledge® Limited Warranty (50-Yr Material / 25-Yr Workmanship)'
      : tier === 'Better'
      ? 'GAF System Plus Limited Warranty (50-Yr Material / 10-Yr Workmanship)'
      : 'GAF Shingle & Accessory Limited Warranty (30-Yr Material / 5-Yr Workmanship)';

  return (
    <Card>
      <Header>
        <Title>🛡️ Manufacturer & Workmanship Warranty Registration</Title>
        <Badge status={status}>{status}</Badge>
      </Header>

      <Grid>
        <FieldGroup>
          <Label>Manufacturer</Label>
          <Select value={manufacturer} onChange={(e) => setManufacturer(e.target.value as any)}>
            <option value="GAF">GAF (Master Elite®)</option>
            <option value="Owens Corning">Owens Corning (Platinum)</option>
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label>Package Tier</Label>
          <Select value={tier} onChange={(e) => setTier(e.target.value as any)}>
            <option value="Best">Best (Golden Pledge / Platinum)</option>
            <option value="Better">Better (System Plus / System)</option>
            <option value="Good">Good (Standard 5-Yr Workmanship)</option>
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label>ABC Supply Shingle Lot #</Label>
          <Input
            type="text"
            placeholder="e.g. LOT-2026-8841"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
          />
        </FieldGroup>
      </Grid>

      <SummaryBox>
        <div>
          <strong>Selected Program:</strong> {programLabel}
        </div>
        <div style={{ marginTop: 4 }}>
          <strong>Financial Gate:</strong>{' '}
          {qboInvoiceBalance > 0
            ? `Locked — $${qboInvoiceBalance.toFixed(2)} Open QBO Invoice Balance`
            : 'Unlocked — Contract Paid in Full ($0.00 Balance)'}
        </div>
        {regNumber && (
          <div style={{ marginTop: 6 }}>
            <strong>Registration #:</strong> {regNumber} •{' '}
            {certUrl && (
              <a href={certUrl} target="_blank" rel="noreferrer">
                View Official Warranty Certificate
              </a>
            )}
          </div>
        )}
      </SummaryBox>

      {errorMsg && <ErrorAlert>{errorMsg}</ErrorAlert>}

      <Button disabled={loading} onClick={handleRegisterWarranty}>
        {regNumber
          ? `✓ Re-Send Warranty Certificate Packet (${regNumber})`
          : `🛡️ Register ${manufacturer} Warranty & Text Certificate to Homeowner`}
      </Button>
    </Card>
  );
};

export default WarrantyRegistrationCard;

