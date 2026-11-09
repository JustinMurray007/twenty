import React, { useState } from 'react';

export interface ShingleColorItem {
  name: string;
  hex: string;
  texture: string;
}

export interface ShingleCatalog {
  [brand: string]: ShingleColorItem[];
}

export const COLOR_CATALOG: ShingleCatalog = {
  GAF: [
    { name: 'Charcoal', hex: '#26282a', texture: 'linear-gradient(135deg, #1c1d1f, #333639)' },
    { name: 'Pewter Gray', hex: '#484b4f', texture: 'linear-gradient(135deg, #3d4044, #5a5e63)' },
    { name: 'Barkwood', hex: '#42372d', texture: 'linear-gradient(135deg, #382c23, #544437)' },
    { name: 'Shakewood', hex: '#635b4f', texture: 'linear-gradient(135deg, #4f483d, #756c5e)' },
    { name: 'Weathered Wood', hex: '#3b3834', texture: 'linear-gradient(135deg, #2e2b27, #4f4b46)' },
    { name: 'Oyster Gray', hex: '#595d5c', texture: 'linear-gradient(135deg, #4c504f, #6e7372)' },
  ],
  OC: [
    { name: 'Onyx Black', hex: '#1e2022', texture: 'linear-gradient(135deg, #141517, #2a2d30)' },
    { name: 'Estate Gray', hex: '#404347', texture: 'linear-gradient(135deg, #35383c, #52565c)' },
    { name: 'Driftwood', hex: '#453f3a', texture: 'linear-gradient(135deg, #36312d, #57504a)' },
    { name: 'Brownwood', hex: '#3e3128', texture: 'linear-gradient(135deg, #2e241d, #524136)' },
    { name: 'Teak', hex: '#4f443b', texture: 'linear-gradient(135deg, #3d342c, #63564b)' },
    { name: 'Chateau Green', hex: '#2f3d35', texture: 'linear-gradient(135deg, #232e28, #3e5247)' },
  ],
};

export interface ShingleColorPickerProps {
  initialBrand?: 'GAF' | 'OC';
  initialColorName?: string;
  onColorChange?: (selection: {
    manufacturer: 'GAF' | 'Owens Corning';
    colorName: string;
    colorHex: string;
    brandLine: string;
  }) => void;
  readOnly?: boolean;
}

export const ShingleColorPicker: React.FC<ShingleColorPickerProps> = ({
  initialBrand = 'GAF',
  initialColorName,
  onColorChange,
  readOnly = false,
}) => {
  const [activeBrand, setActiveBrand] = useState<'GAF' | 'OC'>(initialBrand);
  const [selectedColor, setSelectedColor] = useState<ShingleColorItem>(() => {
    const list = COLOR_CATALOG[initialBrand];
    if (initialColorName) {
      const match = list.find((c) => c.name.toLowerCase() === initialColorName.toLowerCase());
      if (match) return match;
    }
    return list[0];
  });

  const handleBrandSwitch = (brand: 'GAF' | 'OC') => {
    if (readOnly) return;
    setActiveBrand(brand);
    const newColor = COLOR_CATALOG[brand][0];
    setSelectedColor(newColor);
    if (onColorChange) {
      onColorChange({
        manufacturer: brand === 'GAF' ? 'GAF' : 'Owens Corning',
        colorName: newColor.name,
        colorHex: newColor.hex,
        brandLine: brand === 'GAF' ? 'GAF Timberline HDZ' : 'Owens Corning TruDefinition Duration',
      });
    }
  };

  const handleColorSelect = (color: ShingleColorItem) => {
    if (readOnly) return;
    setSelectedColor(color);
    if (onColorChange) {
      onColorChange({
        manufacturer: activeBrand === 'GAF' ? 'GAF' : 'Owens Corning',
        colorName: color.name,
        colorHex: color.hex,
        brandLine: activeBrand === 'GAF' ? 'GAF Timberline HDZ' : 'Owens Corning TruDefinition Duration',
      });
    }
  };

  const brandLabel = activeBrand === 'GAF' ? 'GAF Timberline HDZ' : 'Owens Corning Duration';

  return (
    <div
      style={{
        background: '#1e293b',
        border: '1.5px solid #334155',
        borderRadius: '12px',
        padding: '22px',
        marginBottom: '28px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
            Select Shingle Color & Manufacturer
          </h3>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Choose manufacturer palette to lock in material SKU specs
          </span>
        </div>

        {/* Brand Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleBrandSwitch('GAF')}
            style={{
              background: activeBrand === 'GAF' ? '#2563eb' : '#0f172a',
              borderColor: activeBrand === 'GAF' ? '#3b82f6' : '#334155',
              color: activeBrand === 'GAF' ? '#ffffff' : '#94a3b8',
              borderWidth: '1px',
              borderStyle: 'solid',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: readOnly ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            GAF HDZ
          </button>
          <button
            type="button"
            onClick={() => handleBrandSwitch('OC')}
            style={{
              background: activeBrand === 'OC' ? '#2563eb' : '#0f172a',
              borderColor: activeBrand === 'OC' ? '#3b82f6' : '#334155',
              color: activeBrand === 'OC' ? '#ffffff' : '#94a3b8',
              borderWidth: '1px',
              borderStyle: 'solid',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: readOnly ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Owens Corning
          </button>
        </div>
      </div>

      {/* Swatch Cards Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '12px',
        }}
      >
        {COLOR_CATALOG[activeBrand].map((item) => {
          const isSelected = item.name === selectedColor.name;
          return (
            <div
              key={item.name}
              onClick={() => handleColorSelect(item)}
              style={{
                background: '#0f172a',
                border: isSelected ? '2px solid #38bdf8' : '2px solid #334155',
                boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.35)' : 'none',
                borderRadius: '8px',
                padding: '8px',
                textAlign: 'center',
                cursor: readOnly ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  height: '48px',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: item.texture,
                }}
              />
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isSelected ? '#38bdf8' : '#f1f5f9',
                }}
              >
                {item.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Finish Label */}
      <div
        style={{
          marginTop: '14px',
          fontSize: '13px',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>Selected Finish:</span>
        <strong style={{ color: '#38bdf8' }}>
          {brandLabel} - {selectedColor.name}
        </strong>
      </div>
    </div>
  );
};

export default ShingleColorPicker;
