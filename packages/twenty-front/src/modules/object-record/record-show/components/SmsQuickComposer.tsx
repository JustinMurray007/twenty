import React, { useState } from 'react';
import styled from '@emotion/styled';
import { IconSend, IconMessageDots, IconUser, IconHammer, IconCheck } from '@tabler/icons-react';
import { useCurrentRecord } from '@/object-record/record-show/hooks/useCurrentRecord';

const ComposerContainer = styled.div`
  background: ${({ theme }: any) => theme?.background?.secondary || '#1e293b'};
  border: 1px solid ${({ theme }: any) => theme?.border?.color?.medium || '#334155'};
  border-radius: ${({ theme }: any) => theme?.border?.radius?.md || '8px'};
  padding: 14px;
  margin-bottom: 16px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }: any) => theme?.font?.color?.primary || '#f8fafc'};
`;

const Switcher = styled.div`
  display: flex;
  background: ${({ theme }: any) => theme?.background?.tertiary || '#0f172a'};
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
`;

const TabButton = styled.button<{ active: boolean }>`
  border: none;
  background: ${({ active, theme }: any) => (active ? (theme?.background?.primary || '#334155') : 'transparent')};
  color: ${({ active, theme }: any) => (active ? (theme?.font?.color?.primary || '#f8fafc') : (theme?.font?.color?.tertiary || '#94a3b8'))};
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease-in-out;
`;

const TextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  background: ${({ theme }: any) => theme?.background?.primary || '#0f172a'};
  border: 1px solid ${({ theme }: any) => theme?.border?.color?.light || '#334155'};
  border-radius: 6px;
  padding: 8px 10px;
  color: ${({ theme }: any) => theme?.font?.color?.primary || '#f8fafc'};
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
  min-height: 64px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ActionRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px;
`;

const TemplateSelect = styled.select`
  background: ${({ theme }: any) => theme?.background?.primary || '#0f172a'};
  border: 1px solid ${({ theme }: any) => theme?.border?.color?.light || '#334155'};
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 11px;
  color: ${({ theme }: any) => theme?.font?.color?.secondary || '#cbd5e1'};
  cursor: pointer;
  max-width: 190px;
`;

const SendButton = styled.button<{ sending: boolean }>`
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: ${({ sending }) => (sending ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: #1d4ed8;
  }

  &:disabled {
    background: #64748b;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const StatusMessage = styled.div<{ success?: boolean }>`
  font-size: 11px;
  margin-top: 6px;
  color: ${({ success }) => (success ? '#22c55e' : '#ef4444')};
  display: flex;
  align-items: center;
  gap: 4px;
`;

export interface SmsQuickComposerProps {
  objectNameSingular?: string;
  recordId?: string;
}

export const SmsQuickComposer: React.FC<SmsQuickComposerProps> = ({
  objectNameSingular,
  recordId,
}) => {
  if (objectNameSingular && objectNameSingular !== 'opportunity') {
    return null;
  }

  const hookRecord: any = useCurrentRecord(recordId);
  const record = hookRecord;
  const oppId = record?.id || recordId;

  const [recipient, setRecipient] = useState<'homeowner' | 'crew'>('homeowner');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; success: boolean } | null>(null);

  const customerPhone = record?.customerPhone || record?.phone;
  const crewPhone = record?.crewLeaderPhone || record?.crewLeadPhone || record?.subcontractorPhone;
  const activePhone = recipient === 'homeowner' ? customerPhone : crewPhone;

  const handleTemplate = (val: string) => {
    if (!val) return;
    const clientName = record?.customerName?.split(' ')[0] || record?.name?.split(' ')[0] || 'there';
    const address = record?.addressStreet || record?.address || 'your home';

    const templates: Record<string, string> = {
      driveway: `Hi ${clientName}, please remember to move vehicles out of the driveway tonight so the material delivery truck can stage shingles tomorrow morning.`,
      crew_eta: `Hi ${clientName}, our roofing crew is scheduled to arrive at ${address} tomorrow between 7:00 AM - 7:30 AM.`,
      sub_tarp: `Reminder: Photograph driveway protection and ground tarps before beginning tear-off. Upload to CompanyCam.`,
      sub_magnet: `Please make sure a complete magnetic nail sweep of the grass, driveway, and walkways is completed prior to final sign-off.`,
    };

    if (templates[val]) {
      setText(templates[val]);
      setStatusMsg(null);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !activePhone || !oppId) return;

    setSending(true);
    setStatusMsg(null);
    try {
      const serviceUrl = process.env.REACT_APP_WORK_ORDER_SERVICE_URL || 'http://localhost:4000';
      const res = await fetch(`${serviceUrl}/api/sms/send-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: oppId,
          recipientType: recipient,
          messageBody: text.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setText('');
        setStatusMsg({
          text: `Text delivered to ${data.recipient || (recipient === 'homeowner' ? 'Client' : 'Crew')} (${data.phone})`,
          success: true,
        });
      } else {
        setStatusMsg({
          text: data.error || 'Failed to dispatch SMS.',
          success: false,
        });
      }
    } catch (e: any) {
      setStatusMsg({
        text: 'Network error connecting to SMS service.',
        success: false,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <ComposerContainer>
      <Header>
        <Title>
          <IconMessageDots size={16} color="#3b82f6" />
          SMS Quick Composer
        </Title>
        <Switcher>
          <TabButton
            type="button"
            active={recipient === 'homeowner'}
            onClick={() => {
              setRecipient('homeowner');
              setStatusMsg(null);
            }}
            title={customerPhone || 'No client phone configured'}
          >
            <IconUser size={12} />
            Client
          </TabButton>
          <TabButton
            type="button"
            active={recipient === 'crew'}
            onClick={() => {
              setRecipient('crew');
              setStatusMsg(null);
            }}
            title={crewPhone || 'No crew leader phone configured'}
          >
            <IconHammer size={12} />
            Crew
          </TabButton>
        </Switcher>
      </Header>

      <TextArea
        placeholder={
          activePhone
            ? `Type message to ${recipient === 'homeowner' ? 'Client' : 'Crew Leader'} (${activePhone})...`
            : `No ${recipient === 'homeowner' ? 'client' : 'crew'} phone configured on Opportunity`
        }
        value={text}
        disabled={!activePhone || sending}
        onChange={(e) => {
          setText(e.target.value);
          if (statusMsg) setStatusMsg(null);
        }}
      />

      <ActionRow>
        <TemplateSelect
          onChange={(e) => {
            handleTemplate(e.target.value);
            e.target.value = '';
          }}
          defaultValue=""
          disabled={!activePhone || sending}
        >
          <option value="" disabled>
            Insert Quick Template...
          </option>
          {recipient === 'homeowner' ? (
            <>
              <option value="driveway">Clear Driveway Alert</option>
              <option value="crew_eta">Crew ETA Arrival</option>
            </>
          ) : (
            <>
              <option value="sub_tarp">Tarp & Protect Decking</option>
              <option value="sub_magnet">Magnet Sweep Reminder</option>
            </>
          )}
        </TemplateSelect>

        <SendButton
          type="button"
          onClick={handleSend}
          sending={sending}
          disabled={!activePhone || !text.trim() || sending}
        >
          <IconSend size={13} />
          {sending ? 'Sending...' : 'Send Text'}
        </SendButton>
      </ActionRow>

      {statusMsg && (
        <StatusMessage success={statusMsg.success}>
          {statusMsg.success && <IconCheck size={12} />}
          {statusMsg.text}
        </StatusMessage>
      )}
    </ComposerContainer>
  );
};

export default SmsQuickComposer;
