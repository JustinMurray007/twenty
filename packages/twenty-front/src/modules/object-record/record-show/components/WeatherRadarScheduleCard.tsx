import React, { useState } from 'react';
import styled from '@emotion/styled';
import {
  IconCloudRain,
  IconSun,
  IconWind,
  IconCalendarTime,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
} from '@tabler/icons-react';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const Card = styled.div`
  background: ${({ theme }: any) => theme?.background?.secondary || '#1e293b'};
  border: 1px solid ${({ theme }: any) => theme?.border?.color?.medium || '#334155'};
  border-radius: ${({ theme }: any) => theme?.border?.radius?.md || '8px'};
  padding: 16px;
  margin-bottom: 16px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const Title = styled.h4`
  margin: 0;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }: any) => theme?.font?.color?.primary || '#f8fafc'};
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
`;

const RiskBadge = styled.span<{ level: 'LOW' | 'MODERATE' | 'HIGH' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  color: ${({ level }) =>
    level === 'HIGH' ? '#fca5a5' : level === 'MODERATE' ? '#fde68a' : '#4ade80'};
  background: ${({ level }) =>
    level === 'HIGH'
      ? 'rgba(220, 38, 38, 0.22)'
      : level === 'MODERATE'
      ? 'rgba(217, 119, 6, 0.22)'
      : 'rgba(22, 163, 74, 0.18)'};
  border: 1px solid
    ${({ level }) =>
      level === 'HIGH' ? '#dc2626' : level === 'MODERATE' ? '#d97706' : '#16a34a'};
`;

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #334155;
`;

const SelectDays = styled.select`
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  color: #f8fafc;
`;

const PushButton = styled.button<{ danger?: boolean }>`
  background: ${({ danger }) => (danger ? '#dc2626' : '#2563eb')};
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;

  &:hover:not(:disabled) {
    background: ${({ danger }) => (danger ? '#b91c1c' : '#1d4ed8')};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export interface WeatherRadarScheduleCardProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const WeatherRadarScheduleCard: React.FC<WeatherRadarScheduleCardProps> = ({
  objectNameSingular,
  recordId,
}) => {
  if (objectNameSingular && objectNameSingular !== 'opportunity') {
    return null;
  }

  const record: any = useCurrentRecord(recordId);
  const oppId = record?.id || recordId;

  const [checking, setChecking] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [delayDays, setDelayDays] = useState<number>(2);
  const [liveData, setLiveData] = useState<any>(null);
  const [statusBanner, setStatusBanner] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!record) return null;

  const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';

  const rainProb = Number(
    liveData?.forecast?.rainProbability ?? record.weatherRainProbability ?? 5
  );
  const windGust = Number(
    liveData?.forecast?.windGustMph ?? record.weatherWindGustMph ?? 9
  );
  const startDate =
    liveData?.revisedStartDate ||
    liveData?.scheduledStartDate ||
    (record.scheduledStartDate ? String(record.scheduledStartDate).substring(0, 10) : 'Unscheduled');
  const riskStatus =
    liveData?.weatherRiskStatus ||
    liveData?.evaluation?.weatherRiskStatus ||
    record.weatherRiskStatus ||
    (rainProb >= 40 || windGust >= 30
      ? 'High Rain Risk - Delay Recommended'
      : rainProb >= 20
      ? 'Advisory - Monitor Radar & Stage Tarps'
      : 'Clear - Safe for Tear-Off');

  const riskLevel: 'LOW' | 'MODERATE' | 'HIGH' =
    rainProb >= 40 || windGust >= 30 ? 'HIGH' : rainProb >= 20 || windGust >= 20 ? 'MODERATE' : 'LOW';

  const handleCheckRadar = async () => {
    if (!oppId) return;
    setChecking(true);
    setStatusBanner(null);
    try {
      const res = await fetch(`${serviceUrl}/api/weather/${oppId}/check`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLiveData(data);
        setStatusBanner({
          text: data.evaluation?.recommendation || '48-hour forecast refreshed.',
          isError: !data.evaluation?.safeToTearOff,
        });
      }
    } catch (e: any) {
      setStatusBanner({ text: 'Unable to reach weather radar service.', isError: true });
    } finally {
      setChecking(false);
    }
  };

  const handlePushRainDelay = async () => {
    if (!oppId) return;
    setRescheduling(true);
    setStatusBanner(null);
    try {
      const res = await fetch(`${serviceUrl}/api/weather/${oppId}/reschedule-rain-delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delayDays }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLiveData((prev: any) => ({
          ...prev,
          revisedStartDate: data.revisedStartDate,
          weatherRiskStatus: data.weatherRiskStatus,
        }));
        setStatusBanner({
          text: `Schedule shifted to ${data.revisedStartDate} (+${data.delayDays}d). Homeowner, Crew & ABC Supply notified.`,
          isError: false,
        });
      } else {
        setStatusBanner({ text: data.error || 'Failed to reschedule job.', isError: true });
      }
    } catch (e: any) {
      setStatusBanner({ text: 'Network error pushing rain delay.', isError: true });
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <Card>
      <Header>
        <Title>
          {riskLevel === 'HIGH' ? (
            <IconCloudRain size={18} color="#f87171" />
          ) : (
            <IconSun size={18} color="#facc15" />
          )}
          48-Hr Weather Radar & Rain Delay Guard
        </Title>
        <button
          type="button"
          onClick={handleCheckRadar}
          disabled={checking}
          style={{
            background: 'none',
            border: 'none',
            color: '#38bdf8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
          }}
        >
          <IconRefresh size={14} />
          {checking ? 'Scanning...' : 'Check Radar'}
        </button>
      </Header>

      <Row>
        <span style={{ color: '#94a3b8' }}>Scheduled Tear-Off & ABC Drop</span>
        <strong>{startDate}</strong>
      </Row>

      <Row>
        <span style={{ color: '#94a3b8' }}>48-Hr Precipitation / Wind Gusts</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <span style={{ color: rainProb >= 40 ? '#f87171' : '#e2e8f0' }}>
            🌧️ {rainProb}% Rain
          </span>
          <span style={{ color: windGust >= 30 ? '#f87171' : '#cbd5e1' }}>
            <IconWind size={13} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
            {windGust} MPH
          </span>
        </span>
      </Row>

      <Row>
        <span style={{ color: '#94a3b8' }}>Decking Exposure Status</span>
        <RiskBadge level={riskLevel}>
          {riskLevel === 'HIGH' ? <IconAlertTriangle size={12} /> : <IconCheck size={12} />}
          {riskStatus}
        </RiskBadge>
      </Row>

      <ActionBar>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Push Schedule:</span>
          <SelectDays
            value={delayDays}
            onChange={(e) => setDelayDays(Number(e.target.value))}
            disabled={rescheduling}
          >
            <option value={1}>+1 Day</option>
            <option value={2}>+2 Days (Recommended)</option>
            <option value={3}>+3 Days</option>
            <option value={5}>+5 Days</option>
          </SelectDays>
        </div>

        <PushButton
          type="button"
          danger={riskLevel === 'HIGH'}
          onClick={handlePushRainDelay}
          disabled={rescheduling}
        >
          <IconCalendarTime size={14} />
          {rescheduling ? 'Notifying Crew & Client...' : '1-Click Rain Delay Push'}
        </PushButton>
      </ActionBar>

      {statusBanner && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: statusBanner.isError ? '#fca5a5' : '#4ade80',
          }}
        >
          {statusBanner.text}
        </div>
      )}
    </Card>
  );
};

export default WeatherRadarScheduleCard;

