import React, { useState, useMemo, useCallback } from 'react';

export interface RoofingLineItem {
  id: string;
  name: string;
  category: 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'ACCESSORY' | 'PERMIT';
  unit: 'BUNDLE' | 'ROLL' | 'SQ' | 'LF' | 'EA' | 'BOX';
  quantity: number;
  unitCost: number;
  unitPrice: number;
}

export interface RoofingEstimatorGridProps {
  initialSquares?: number;
  initialPitch?: string;
  initialLayers?: number;
  initialWaste?: number;
  onSave?: (data: {
    squares: number;
    pitch: string;
    layers: number;
    waste: number;
    totalCost: number;
    totalPrice: number;
    grossMargin: number;
    items: RoofingLineItem[];
  }) => void;
}

const DEFAULT_PITCHES = ['3/12', '4/12', '5/12', '6/12', '7/12', '8/12', '9/12', '10/12', '12/12'];

export const RoofingEstimatorGrid: React.FC<RoofingEstimatorGridProps> = ({
  initialSquares = 32.0,
  initialPitch = '6/12',
  initialLayers = 1,
  initialWaste = 10,
  onSave,
}) => {
  const [squares, setSquares] = useState<number>(initialSquares);
  const [pitch, setPitch] = useState<string>(initialPitch);
  const [layers, setLayers] = useState<number>(initialLayers);
  const [waste, setWaste] = useState<number>(initialWaste);
  const [pipeBoots, setPipeBoots] = useState<number>(3);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Compute JobNimbus-compatible dynamic roofing line items
  const generateCalculatedItems = useCallback(
    (sq: number, w: number, l: number, boots: number): RoofingLineItem[] => {
      const effectiveSquares = sq * (1 + w / 100);
      const bundles = Math.ceil(effectiveSquares * 3);
      const feltRolls = Math.max(1, Math.ceil(effectiveSquares / 10));
      const iceWaterRolls = Math.max(1, Math.ceil(sq * 0.06));
      const starterRolls = Math.max(1, Math.ceil((sq * 1.6) / 120));
      const ridgeBundles = Math.max(1, Math.ceil(sq / 7));
      const dripEdgeSticks = Math.max(4, Math.ceil((sq * 1.8) / 10));
      const nailBoxes = Math.max(1, Math.ceil(effectiveSquares / 25));

      return [
        {
          id: 'shingles',
          name: 'GAF Timberline HDZ Architectural Shingles',
          category: 'MATERIAL',
          unit: 'BUNDLE',
          quantity: bundles,
          unitCost: 38.5,
          unitPrice: 55.0,
        },
        {
          id: 'starter',
          name: 'GAF Pro-Start Starter Strip Shingles',
          category: 'MATERIAL',
          unit: 'ROLL',
          quantity: starterRolls,
          unitCost: 48.0,
          unitPrice: 72.0,
        },
        {
          id: 'felt',
          name: 'FeltBuster Synthetic Roof Underlayment (10 SQ/roll)',
          category: 'MATERIAL',
          unit: 'ROLL',
          quantity: feltRolls,
          unitCost: 68.0,
          unitPrice: 110.0,
        },
        {
          id: 'ice-water',
          name: 'WeatherWatch Ice & Water Shield (Eaves & Valleys)',
          category: 'MATERIAL',
          unit: 'ROLL',
          quantity: iceWaterRolls,
          unitCost: 88.0,
          unitPrice: 145.0,
        },
        {
          id: 'ridge-cap',
          name: 'TimberTex Premium Hip & Ridge Cap Shingles',
          category: 'MATERIAL',
          unit: 'BUNDLE',
          quantity: ridgeBundles,
          unitCost: 58.0,
          unitPrice: 85.0,
        },
        {
          id: 'drip-edge',
          name: 'Aluminum Drip Edge White (1.5" x 10ft)',
          category: 'MATERIAL',
          unit: 'EA',
          quantity: dripEdgeSticks,
          unitCost: 8.5,
          unitPrice: 15.0,
        },
        {
          id: 'pipe-boots',
          name: 'Neoprene Plumbing Flashing Pipe Boots (1.5"-3")',
          category: 'ACCESSORY',
          unit: 'EA',
          quantity: boots,
          unitCost: 14.5,
          unitPrice: 32.0,
        },
        {
          id: 'coil-nails',
          name: '1-1/4" Electro-Galvanized Coil Roofing Nails',
          category: 'ACCESSORY',
          unit: 'BOX',
          quantity: nailBoxes,
          unitCost: 45.0,
          unitPrice: 75.0,
        },
        {
          id: 'labor-tear-install',
          name: `Tear-Off (${l} Layer${l > 1 ? 's' : ''}) & Complete Shingle Installation`,
          category: 'LABOR',
          unit: 'SQ',
          quantity: sq,
          unitCost: 95.0,
          unitPrice: 165.0,
        },
        {
          id: 'dumpster',
          name: '20-Yard Waste Roll-Off Container & Disposal Fees',
          category: 'EQUIPMENT',
          unit: 'EA',
          quantity: sq > 40 ? 2 : 1,
          unitCost: 475.0,
          unitPrice: 650.0,
        },
        {
          id: 'permit',
          name: 'Municipal Building Permit & Final City Inspection',
          category: 'PERMIT',
          unit: 'EA',
          quantity: 1,
          unitCost: 175.0,
          unitPrice: 250.0,
        },
      ];
    },
    []
  );

  const [items, setItems] = useState<RoofingLineItem[]>(() =>
    generateCalculatedItems(initialSquares, initialWaste, initialLayers, 3)
  );

  // Recalculate when base parameters update
  const handleRecalculate = () => {
    setItems(generateCalculatedItems(squares, waste, layers, pipeBoots));
    setSaveSuccess(false);
  };

  const handleUpdateItem = (index: number, field: keyof RoofingLineItem, value: number | string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setSaveSuccess(false);
  };

  // Rollups & Summary Metrics
  const summary = useMemo(() => {
    let materialCost = 0;
    let laborEquipCost = 0;
    let totalCost = 0;
    let totalPrice = 0;

    items.forEach((item) => {
      const itemCost = item.quantity * item.unitCost;
      const itemPrice = item.quantity * item.unitPrice;

      if (item.category === 'MATERIAL' || item.category === 'ACCESSORY') {
        materialCost += itemCost;
      } else {
        laborEquipCost += itemCost;
      }

      totalCost += itemCost;
      totalPrice += itemPrice;
    });

    const grossProfit = totalPrice - totalCost;
    const grossMargin = totalPrice > 0 ? (grossProfit / totalPrice) * 100 : 0;
    const pricePerSquare = squares > 0 ? totalPrice / squares : 0;
    const costPerSquare = squares > 0 ? totalCost / squares : 0;

    return {
      materialCost,
      laborEquipCost,
      totalCost,
      totalPrice,
      grossProfit,
      grossMargin,
      pricePerSquare,
      costPerSquare,
    };
  }, [items, squares]);

  const handleSave = () => {
    if (onSave) {
      onSave({
        squares,
        pitch,
        layers,
        waste,
        totalCost: summary.totalCost,
        totalPrice: summary.totalPrice,
        grossMargin: summary.grossMargin,
        items,
      });
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  return (
    <div
      style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        color: '#1e293b',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
            Roofing Estimate & Material Takeoff
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            JobNimbus-style automated takeoffs, material routing, and real-time gross margin calculation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRecalculate}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Auto-Calculate Takeoffs
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {saveSuccess ? 'Saved to Opportunity!' : 'Save & Sync Deal'}
          </button>
        </div>
      </div>

      {/* Scope Inputs Toolbar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          background: '#f8fafc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #edf2f7',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
            Roof Squares (SQ)
          </label>
          <input
            type="number"
            step="0.5"
            value={squares}
            onChange={(e) => setSquares(parseFloat(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
            Pitch
          </label>
          <select
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              fontSize: '14px',
              background: '#fff',
            }}
          >
            {DEFAULT_PITCHES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
            Waste Factor (%)
          </label>
          <input
            type="number"
            value={waste}
            onChange={(e) => setWaste(parseFloat(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
            Layers Tear-Off
          </label>
          <select
            value={layers}
            onChange={(e) => setLayers(parseInt(e.target.value, 10))}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              fontSize: '14px',
              background: '#fff',
            }}
          >
            <option value={1}>1 Layer</option>
            <option value={2}>2 Layers</option>
            <option value={3}>3 Layers</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
            Pipe Boots (EA)
          </label>
          <input
            type="number"
            value={pipeBoots}
            onChange={(e) => setPipeBoots(parseInt(e.target.value, 10) || 0)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Estimate (Retail)</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            ${summary.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            ${summary.pricePerSquare.toFixed(2)} / SQ
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Direct Cost</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            ${summary.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            ${summary.costPerSquare.toFixed(2)} / SQ
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Gross Profit ($)</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            ${summary.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Contractor Net Margin</div>
        </div>

        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Gross Margin (%)</div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: summary.grossMargin >= 35 ? '#10b981' : '#f59e0b',
              marginTop: '4px',
            }}
          >
            {summary.grossMargin.toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Target: &gt; 35.0%</div>
        </div>
      </div>

      {/* Editable Line Item Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700 }}>Item Description</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '100px' }}>Category</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '70px' }}>Unit</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '85px' }}>Qty</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '95px' }}>Unit Cost</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '95px' }}>Unit Price</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '100px' }}>Total Cost</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '100px' }}>Total Price</th>
              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, width: '75px' }}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const lineCost = item.quantity * item.unitCost;
              const linePrice = item.quantity * item.unitPrice;
              const lineMargin = linePrice > 0 ? ((linePrice - lineCost) / linePrice) * 100 : 0;

              return (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                  }}
                >
                  <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1e293b' }}>{item.name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background:
                          item.category === 'MATERIAL'
                            ? '#dbeafe'
                            : item.category === 'LABOR'
                            ? '#dcfce7'
                            : item.category === 'EQUIPMENT'
                            ? '#fee2e2'
                            : '#f3e8ff',
                        color:
                          item.category === 'MATERIAL'
                            ? '#1e40af'
                            : item.category === 'LABOR'
                            ? '#166534'
                            : item.category === 'EQUIPMENT'
                            ? '#991b1b'
                            : '#6b21a8',
                      }}
                    >
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.unit}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '70px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      step="0.5"
                      value={item.unitCost}
                      onChange={(e) => handleUpdateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '80px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      step="0.5"
                      value={item.unitPrice}
                      onChange={(e) => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '80px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', color: '#475569', fontWeight: 500 }}>
                    ${lineCost.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: 600 }}>
                    ${linePrice.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 12px', color: lineMargin >= 30 ? '#166534' : '#b45309', fontWeight: 600 }}>
                    {lineMargin.toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RoofingEstimatorGrid;
