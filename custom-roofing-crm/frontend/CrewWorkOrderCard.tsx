import React from 'react';

export interface CrewWorkOrderProps {
  workOrderNumber?: string;
  jobNumber?: string;
  status?: 'DRAFT' | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED';
  scheduledStartDate?: string;
  jobAddress?: string;
  homeownerName?: string;
  homeownerPhone?: string;
  roofSquares?: number;
  pitch?: string;
  layers?: number;
  materialType?: string;
  shingleBundlesNeeded?: number;
  underlaymentRollsNeeded?: number;
  deliveryStagedLocation?: 'DRIVEWAY' | 'GROUND' | 'ROOFTOP';
  tearOffDumpsterCompany?: string;
  specialCrewInstructions?: string;
  companycamUrl?: string;
  assignedCrewLead?: string;
  supplierName?: string;
  poNumber?: string;
  materialDelivered?: boolean;
}

export const CrewWorkOrderCard: React.FC<CrewWorkOrderProps> = ({
  workOrderNumber = 'WO-202610-8491',
  jobNumber = 'JOB-202610-4821',
  status = 'DISPATCHED',
  scheduledStartDate = 'Tomorrow at 7:00 AM',
  jobAddress = '1234 Oak St, San Diego, CA 92109',
  homeownerName = 'John Doe',
  homeownerPhone = '(619) 555-0192',
  roofSquares = 28.0,
  pitch = '6/12',
  layers = 1,
  materialType = 'GAF Timberline HDZ (Charcoal)',
  shingleBundlesNeeded = 93,
  underlaymentRollsNeeded = 4,
  deliveryStagedLocation = 'ROOFTOP',
  tearOffDumpsterCompany = 'Waste Management (20-Yard Drop)',
  specialCrewInstructions = 'Protect driveway pavers and HVAC condenser with 3/4" plywood. Run continuous magnetic nail sweep after tear-off and final cleanup before leaving jobsite.',
  companycamUrl = 'https://app.companycam.com/projects/sample_project',
  assignedCrewLead = 'Carlos Mendoza (Alpha Crew)',
  supplierName = 'ABC Supply Co.',
  poNumber = 'PO-98231',
  materialDelivered = true,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleOpenCompanyCam = () => {
    window.open(companycamUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#ffffff',
        border: '2px solid #0f172a',
        borderRadius: '10px',
        padding: '24px',
        maxWidth: '850px',
        margin: '0 auto',
        color: '#0f172a',
        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, textTransform: 'uppercase' }}>
              Crew Production Work Order
            </h1>
            <span
              style={{
                background: status === 'DISPATCHED' ? '#dbeafe' : '#dcfce7',
                color: status === 'DISPATCHED' ? '#1e40af' : '#166534',
                fontSize: '11px',
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {status}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
            Work Order: <strong>{workOrderNumber}</strong> • Associated Job: <strong>{jobNumber}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🖨️ Print Dispatch Slip
          </button>
          <button
            type="button"
            onClick={handleOpenCompanyCam}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📷 CompanyCam Photos
          </button>
        </div>
      </div>

      {/* Grid: Jobsite & Schedule Details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Jobsite Address
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {jobAddress}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Homeowner: {homeownerName} • {homeownerPhone}
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Schedule &amp; Subcontractor Lead
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {scheduledStartDate}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Assigned Crew: <strong>{assignedCrewLead}</strong>
          </div>
        </div>
      </div>

      {/* Scope of Work & Material Checklist (NO DOLLAR AMOUNTS) */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
          Roofing Technical Specs &amp; Material Checklist
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>SURFACE SQUARES</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{roofSquares} SQ</div>
          </div>
          <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>PITCH SLOPE</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{pitch}</div>
          </div>
          <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>TEAR-OFF LAYERS</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{layers} Layer{layers > 1 ? 's' : ''}</div>
          </div>
          <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>BUNDLES VERIFIED</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>{shingleBundlesNeeded} Bundles</div>
          </div>
          <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>SYNTHETIC ROLLS</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>{underlaymentRollsNeeded} Rolls</div>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: '#334155' }}>
          <strong>Specified Material:</strong> {materialType}
        </div>
      </div>

      {/* Staging, Delivery & Dumpster Logistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
            Material Drop &amp; Verification
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {supplierName} • {poNumber}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: materialDelivered ? '#10b981' : '#f59e0b',
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: materialDelivered ? '#15803d' : '#b45309' }}>
              {materialDelivered ? 'Delivered & Verified via CompanyCam' : 'Pending Supplier Drop'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Staged Location: <strong>{deliveryStagedLocation}</strong>
          </div>
        </div>

        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
            Dumpster Logistics
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {tearOffDumpsterCompany}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Position: Right side of driveway. <strong>Place 2x4 blocking under steel rollers.</strong>
          </div>
        </div>
      </div>

      {/* Special Crew Instructions */}
      <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#b45309' }}>
          ⚠️ Critical Safety &amp; Quality Directives
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#92400e', lineHeight: 1.5 }}>
          {specialCrewInstructions}
        </p>
      </div>

      {/* Sign-Off / Acceptance Block */}
      <div
        style={{
          borderTop: '1px dashed #cbd5e1',
          paddingTop: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          fontSize: '12px',
        }}
      >
        <div>
          <div style={{ borderBottom: '1px solid #0f172a', paddingBottom: '24px' }} />
          <div style={{ marginTop: '4px', color: '#64748b' }}>Crew Lead Signature &amp; Date</div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #0f172a', paddingBottom: '24px' }} />
          <div style={{ marginTop: '4px', color: '#64748b' }}>Project Manager Verification &amp; Date</div>
        </div>
      </div>
    </div>
  );
};

export default CrewWorkOrderCard;
