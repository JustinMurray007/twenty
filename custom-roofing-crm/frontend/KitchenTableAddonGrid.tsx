import React, { useState, useMemo, useCallback } from 'react';

export interface UpsellItem {
  id: string;
  name: string;
  category: 'GUTTERS' | 'SKYLIGHTS' | 'VENTILATION' | 'PROTECTION';
  categoryLabel: string;
  price: number;
  description: string;
  specs: string;
  badge?: string;
  badgeColor?: string;
  recommended?: boolean;
}

export const ROOFING_UPGRADE_CATALOG: UpsellItem[] = [
  // 1. Gutters & Drainage
  {
    id: 'gutters-seamless-6',
    name: 'Seamless Aluminum 6" K-Style Gutters & 3x4" Downspouts',
    category: 'GUTTERS',
    categoryLabel: 'Gutters & Drainage',
    price: 1850,
    description: 'Complete roof perimeter replacement with heavy-gauge seamless aluminum, factory-mitered leakproof corners, and heavy-duty hidden screw hangers spaced every 24".',
    specs: '0.032" Heavy-Gauge Aluminum • 20-Yr Manufacturer Finish Warranty',
    badge: 'High ROI',
    badgeColor: '#0284c7',
    recommended: true,
  },
  {
    id: 'gutters-guards-mesh',
    name: 'Stainless Steel Micro-Mesh Gutter Protection',
    category: 'GUTTERS',
    categoryLabel: 'Gutters & Drainage',
    price: 1250,
    description: 'Surgical-grade stainless micro-mesh that locks out pine needles, shingle grit, leaves, and nesting pests while accepting heaviest rainfall without overflow.',
    specs: 'Anodized Aluminum Frame • Lifetime Clog-Free Guarantee',
    badge: 'No-Clog Guarantee',
    badgeColor: '#10b981',
  },

  // 2. Skylights & Natural Daylighting
  {
    id: 'skylight-velux-deck',
    name: 'Velux Deck-Mounted Leak-Proof Skylight Replacement (Pair)',
    category: 'SKYLIGHTS',
    categoryLabel: 'Skylights & Daylighting',
    price: 2400,
    description: 'Dual insulated LoĒ3-366 argon-gas glass with pre-engineered flashing kits and 3 layers of water protection. Replaces cloudy or leaking contractor-grade units.',
    specs: 'Clean, Quiet & Safe Laminated Glass • 10-Yr No Leak Warranty',
    badge: '10-Yr No Leak',
    badgeColor: '#f59e0b',
  },
  {
    id: 'skylight-solar-venting',
    name: 'Velux Solar-Powered "Fresh Air" Skylight + Solar Blinds',
    category: 'SKYLIGHTS',
    categoryLabel: 'Skylights & Daylighting',
    price: 3250,
    description: 'Solar-powered remote opening with acoustic rain sensor that closes automatically at the first drop of rain. Includes solar blackout shades and qualifies for Federal Tax Credits.',
    specs: '30% Federal Solar Tax Credit Eligible • Built-in Rain Sensor',
    badge: '30% Tax Credit',
    badgeColor: '#8b5cf6',
  },
  {
    id: 'skylight-sun-tunnel',
    name: 'Velux 14" Rigid Sun Tunnel with Solar NightLight',
    category: 'SKYLIGHTS',
    categoryLabel: 'Skylights & Daylighting',
    price: 1150,
    description: 'Channels brilliant natural sunlight into dim hallways, bathrooms, or laundry rooms without structural truss modifications.',
    specs: '99.9% Reflective Tunnel • Integrated Night Solar LED Light',
    badge: 'Popular Upgrade',
    badgeColor: '#3b82f6',
  },

  // 3. Attic Ventilation & Thermal Efficiency
  {
    id: 'vent-continuous-ridge',
    name: 'Continuous Shingle-Over Ridge Ventilation Upgrade',
    category: 'VENTILATION',
    categoryLabel: 'Attic Ventilation',
    price: 650,
    description: 'High-efficiency external baffle system that creates continuous vacuum draft along the ridge line, venting trapped moisture and attic heat.',
    specs: 'NFA 18 sq in/LF • Meets IRC 1:300 Attic Ventilation Code',
    badge: 'Energy Star',
    badgeColor: '#10b981',
    recommended: true,
  },
  {
    id: 'vent-solar-attic-fan',
    name: 'Solar-Powered Attic Master Exhaust Fan (30W Monocrystalline)',
    category: 'VENTILATION',
    categoryLabel: 'Attic Ventilation',
    price: 1450,
    description: 'Pulls over 1,200 CFM of stagnant heat from attic spaces without drawing grid electricity. Drastically lowers summer cooling bills and shingle surface temps.',
    specs: 'Whisper-Quiet Brushless Motor • 30% Federal Tax Credit Eligible',
    badge: 'Power Saver',
    badgeColor: '#059669',
  },
  {
    id: 'vent-soffit-baffles',
    name: 'Smart Airflow Soffit Rafter Intake Baffles (Whole Attic)',
    category: 'VENTILATION',
    categoryLabel: 'Attic Ventilation',
    price: 450,
    description: 'Prevents insulation from blocking eave airflow channels, ensuring unobstructed continuous intake ventilation and preventing winter ice damming.',
    specs: 'Rigid High-Impact Polystyrene • Anti-Ice Dam Protection',
    badge: 'Airflow Guard',
    badgeColor: '#64748b',
  },

  // 4. Severe Weather & Deck Armor
  {
    id: 'armor-full-ice-water',
    name: '100% Full-Deck Self-Adhering Ice & Water Shield Armor',
    category: 'PROTECTION',
    categoryLabel: 'Roof Armor & Defense',
    price: 1650,
    description: 'Upgrades entire deck from standard synthetic underlayment to premium SBS elastomeric self-adhering membrane that seals watertight around every nail fastener.',
    specs: 'High-Temp SBS Polymer • 130 MPH Wind-Driven Rain Barrier',
    badge: 'Max Protection',
    badgeColor: '#dc2626',
  },
  {
    id: 'armor-drip-edge-apron',
    name: 'Heavy-Duty Drip Edge & Gutter Apron Flashing System',
    category: 'PROTECTION',
    categoryLabel: 'Roof Armor & Defense',
    price: 480,
    description: 'Extended architectural drip apron that directs water cleanly into gutters, preventing water capillary wicking into fascia boards and rafter tails.',
    specs: 'T-Style Extended Flange • Baked Enamel Corrosion Proof',
    badge: 'Rot Prevention',
    badgeColor: '#d97706',
    recommended: true,
  },
  {
    id: 'armor-chimney-cricket',
    name: 'Chimney Saddle Cricket & Lead Counterflashing Renewal',
    category: 'PROTECTION',
    categoryLabel: 'Roof Armor & Defense',
    price: 850,
    description: 'Custom framed divergence cricket behind wide chimneys with stepped code-compliant lead counterflashing diamond-cut into mortar joints.',
    specs: 'Heavy 4# Code Sheet Lead • Prevents Chimney Pooling',
    badge: 'Critical Flashing',
    badgeColor: '#7c3aed',
  },
];

export interface KitchenTableAddonGridProps {
  opportunityId?: string;
  basePrice?: number;
  initialTier?: 'Good' | 'Better' | 'Best';
  initialSelectedIds?: string[];
  onTotalChange?: (data: {
    basePrice: number;
    addonsTotal: number;
    grandTotal: number;
    monthlyPayment: number;
    depositRequired: number;
    selectedAddons: UpsellItem[];
  }) => void;
  onSave?: (data: {
    selectedAddonIds: string[];
    selectedAddons: UpsellItem[];
    addonsTotal: number;
    grandTotal: number;
  }) => void;
  readOnly?: boolean;
  serviceUrl?: string;
}

export const KitchenTableAddonGrid: React.FC<KitchenTableAddonGridProps> = ({
  opportunityId,
  basePrice = 17078,
  initialTier = 'Better',
  initialSelectedIds = ['vent-continuous-ridge'],
  onTotalChange,
  onSave,
  readOnly = false,
  serviceUrl = 'http://localhost:4000',
}) => {
  const [tier, setTier] = useState<'Good' | 'Better' | 'Best'>(initialTier);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Amortized monthly payment calculation (120 months @ 9.99% APR)
  const calculateMonthly = useCallback((total: number): number => {
    const monthlyRate = 0.0999 / 12;
    const months = 120;
    const payment =
      (total * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
      (Math.pow(1 + monthlyRate, months) - 1);
    return Math.round(payment);
  }, []);

  // Compute live rollups
  const metrics = useMemo(() => {
    const selectedItems = ROOFING_UPGRADE_CATALOG.filter((item) => selectedIds.has(item.id));
    const addonsTotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
    const grandTotal = basePrice + addonsTotal;
    const monthlyPayment = calculateMonthly(grandTotal);
    // CA BPC § 7159 deposit: 10% or $1,000 maximum
    const depositRequired = Math.min(Math.round(grandTotal * 0.1), 1000);

    return {
      selectedItems,
      addonsTotal,
      grandTotal,
      monthlyPayment,
      depositRequired,
    };
  }, [selectedIds, basePrice, calculateMonthly]);

  // Notify parent component on state change
  React.useEffect(() => {
    if (onTotalChange) {
      onTotalChange({
        basePrice,
        addonsTotal: metrics.addonsTotal,
        grandTotal: metrics.grandTotal,
        monthlyPayment: metrics.monthlyPayment,
        depositRequired: metrics.depositRequired,
        selectedAddons: metrics.selectedItems,
      });
    }
  }, [metrics, basePrice, onTotalChange]);

  const handleToggle = (id: string) => {
    if (readOnly) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSaveMessage(null);
  };

  const handleSelectPreset = (preset: 'recommended' | 'all' | 'clear') => {
    if (readOnly) return;
    if (preset === 'recommended') {
      const recIds = ROOFING_UPGRADE_CATALOG.filter((i) => i.recommended).map((i) => i.id);
      setSelectedIds(new Set(recIds));
    } else if (preset === 'all') {
      setSelectedIds(new Set(ROOFING_UPGRADE_CATALOG.map((i) => i.id)));
    } else {
      setSelectedIds(new Set());
    }
    setSaveMessage(null);
  };

  const handleSaveToOpportunity = async () => {
    if (!opportunityId) {
      if (onSave) {
        onSave({
          selectedAddonIds: Array.from(selectedIds),
          selectedAddons: metrics.selectedItems,
          addonsTotal: metrics.addonsTotal,
          grandTotal: metrics.grandTotal,
        });
      }
      setSaveMessage('✓ Add-ons updated successfully.');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${serviceUrl}/api/opportunities/${opportunityId}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAddonIds: Array.from(selectedIds),
          tier,
          grandTotal: metrics.grandTotal,
        }),
      });

      if (res.ok) {
        setSaveMessage('✓ Synced with Twenty CRM & Opportunity record!');
        if (onSave) {
          onSave({
            selectedAddonIds: Array.from(selectedIds),
            selectedAddons: metrics.selectedItems,
            addonsTotal: metrics.addonsTotal,
            grandTotal: metrics.grandTotal,
          });
        }
      } else {
        setSaveMessage('⚠️ Failed to save add-ons to CRM.');
      }
    } catch (err: any) {
      setSaveMessage('⚠️ Network error saving to backend.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  const filteredCatalog = useMemo(() => {
    if (activeCategory === 'ALL') return ROOFING_UPGRADE_CATALOG;
    return ROOFING_UPGRADE_CATALOG.filter((i) => i.category === activeCategory);
  }, [activeCategory]);

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#0f172a',
        color: '#f8fafc',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #334155',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Header & Kitchen-Table Title */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid #334155',
          paddingBottom: '18px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Kitchen-Table Presentation
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Real-Time Upgrade Calculator & Upsell Engine
            </span>
          </div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
            Interactive Proposal Add-On Grid
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Select homeowner upgrades below. Contract totals, monthly financing, and deposit requirements update in real time.
          </p>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => handleSelectPreset('recommended')}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ⚡ Recommended
          </button>
          <button
            type="button"
            onClick={() => handleSelectPreset('all')}
            style={{
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🏆 Select All
          </button>
          <button
            type="button"
            onClick={() => handleSelectPreset('clear')}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Category Navigation Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {[
          { id: 'ALL', label: 'All Upgrades', icon: '✨' },
          { id: 'GUTTERS', label: 'Gutters & Drainage', icon: '🌧️' },
          { id: 'SKYLIGHTS', label: 'Skylights', icon: '☀️' },
          { id: 'VENTILATION', label: 'Attic Ventilation', icon: '💨' },
          { id: 'PROTECTION', label: 'Roof Armor & Defense', icon: '🛡️' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveCategory(tab.id)}
            style={{
              background: activeCategory === tab.id ? '#3b82f6' : '#1e293b',
              color: activeCategory === tab.id ? '#ffffff' : '#94a3b8',
              border: '1px solid',
              borderColor: activeCategory === tab.id ? '#60a5fa' : '#334155',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s ease',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Grid of Add-On Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {filteredCatalog.map((item) => {
          const isSelected = selectedIds.has(item.id);

          return (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              style={{
                background: isSelected ? 'rgba(59, 130, 246, 0.12)' : '#1e293b',
                border: `2px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                borderRadius: '12px',
                padding: '18px',
                cursor: 'pointer',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.25)' : 'none',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '10px',
                  }}
                >
                  <span
                    style={{
                      background: item.badgeColor ? `${item.badgeColor}22` : '#334155',
                      color: item.badgeColor || '#38bdf8',
                      border: `1px solid ${item.badgeColor || '#38bdf8'}55`,
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.badge || item.categoryLabel}
                  </span>

                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Controlled via parent card click
                    style={{
                      width: '20px',
                      height: '20px',
                      accentColor: '#3b82f6',
                      cursor: 'pointer',
                    }}
                  />
                </div>

                <h4
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: isSelected ? '#ffffff' : '#f1f5f9',
                    lineHeight: 1.3,
                  }}
                >
                  {item.name}
                </h4>

                <p
                  style={{
                    margin: '0 0 10px 0',
                    fontSize: '12px',
                    color: '#94a3b8',
                    lineHeight: 1.45,
                  }}
                >
                  {item.description}
                </p>
              </div>

              <div style={{ borderTop: '1px solid #334155', paddingTop: '10px', marginTop: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{item.specs}</span>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: isSelected ? '#38bdf8' : '#e2e8f0',
                    }}
                  >
                    +${item.price.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-Time Financial Summary & Live Financing Bar */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          border: '2px solid #3b82f6',
          borderRadius: '14px',
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Base Roof Package ({tier})
          </span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0' }}>
            ${basePrice.toLocaleString()}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Selected Add-Ons ({metrics.selectedItems.length})
          </span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8' }}>
            +${metrics.addonsTotal.toLocaleString()}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Contract Value
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>
            ${metrics.grandTotal.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid #22c55e',
            borderRadius: '10px',
            padding: '10px 14px',
            textAlign: 'right',
          }}
        >
          <span style={{ fontSize: '11px', color: '#86efac', fontWeight: 700, textTransform: 'uppercase' }}>
            Estimated Financing
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e' }}>
            ${metrics.monthlyPayment} <span style={{ fontSize: '14px', fontWeight: 500 }}>/ mo</span>
          </div>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>120 mo @ 9.99% APR • No Prepayment Penalty</span>
        </div>
      </div>

      {/* Actions & Synchronization */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          <span>Required Initial Deposit (CA BPC § 7159): </span>
          <strong style={{ color: '#ffffff' }}>${metrics.depositRequired.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saveMessage && (
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>{saveMessage}</span>
          )}
          <button
            type="button"
            disabled={isSaving || readOnly}
            onClick={handleSaveToOpportunity}
            style={{
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: readOnly ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            {isSaving ? 'Saving to CRM...' : 'Save Upgrades to Opportunity'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const InteractiveUpsellGrid = KitchenTableAddonGrid;
export default KitchenTableAddonGrid;
