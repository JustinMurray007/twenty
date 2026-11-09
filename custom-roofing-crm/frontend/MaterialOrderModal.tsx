import React, { useState } from 'react';
import { styled } from '@linaria/react';
import { IconX, IconPackageExport, IconLoader2 } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

const StyledModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const StyledModalCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: ${themeCssVariables.font.color.primary};
  }

  button {
    background: transparent;
    border: none;
    cursor: pointer;
    color: ${themeCssVariables.font.color.tertiary};
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.15s ease;

    &:hover {
      color: ${themeCssVariables.font.color.primary};
      background: ${themeCssVariables.background.tertiary};
    }
  }
`;

const StyledModalBody = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StyledFormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: ${themeCssVariables.font.color.secondary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  select,
  input,
  textarea {
    width: 100%;
    padding: 8px 12px;
    background: ${themeCssVariables.background.secondary};
    border: 1px solid ${themeCssVariables.border.color.medium};
    border-radius: ${themeCssVariables.border.radius.sm};
    color: ${themeCssVariables.font.color.primary};
    font-size: 13px;
    box-sizing: border-box;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: ${themeCssVariables.color.blue};
    }
  }

  textarea {
    resize: vertical;
    min-height: 60px;
  }
`;

const StyledModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid ${themeCssVariables.border.color.light};
  background: ${themeCssVariables.background.secondary};
`;

const StyledButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;

  &[data-variant='primary'] {
    background: ${themeCssVariables.color.blue};
    color: #ffffff;
    border: 1px solid ${themeCssVariables.color.blue};
    &:hover {
      filter: brightness(1.1);
    }
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &[data-variant='secondary'] {
    background: transparent;
    color: ${themeCssVariables.font.color.secondary};
    border: 1px solid ${themeCssVariables.border.color.medium};
    &:hover {
      background: ${themeCssVariables.background.tertiary};
      color: ${themeCssVariables.font.color.primary};
    }
  }

  svg {
    stroke-width: 1.75;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

export interface MaterialOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string;
  onSuccess: () => void;
}

const SUPPLIERS = [
  { name: 'ABC Supply Co.', email: 'orders.abcsupply@supplier.com' },
  { name: 'Beacon Building Products', email: 'orders.beacon@supplier.com' },
  { name: 'SRS Distribution', email: 'orders.srs@supplier.com' },
];

export const MaterialOrderModal: React.FC<MaterialOrderModalProps> = ({
  isOpen,
  onClose,
  recordId,
  onSuccess,
}) => {
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Rooftop Drop');
  const [stagingNotes, setStagingNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const serviceUrl =
        (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
        process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
        'http://localhost:4000';

      const chosenSupplier = SUPPLIERS[selectedSupplierIndex];

      const res = await fetch(
        `${serviceUrl}/material-orders/${recordId}/dispatch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierName: chosenSupplier.name,
            supplierEmail: chosenSupplier.email,
            deliveryDate: deliveryDate || 'Earliest Available',
            deliveryMethod,
            stagingNotes,
          }),
        }
      );

      if (!res.ok) throw new Error('Dispatch failed');

      onSuccess();
      onClose();
    } catch (err) {
      alert('Failed to send PO to supplier. Check server console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledModalBackdrop onClick={onClose}>
      <StyledModalCard onClick={(e) => e.stopPropagation()}>
        <StyledModalHeader>
          <h3>Dispatch Material Purchase Order</h3>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <IconX size={18} />
          </button>
        </StyledModalHeader>

        <form onSubmit={handleSubmit}>
          <StyledModalBody>
            <StyledFormGroup>
              <label>Select Roofing Supplier</label>
              <select
                value={selectedSupplierIndex}
                onChange={(e) => setSelectedSupplierIndex(Number(e.target.value))}
              >
                {SUPPLIERS.map((s, idx) => (
                  <option key={s.name} value={idx}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </StyledFormGroup>

            <StyledFormGroup>
              <label>Requested Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </StyledFormGroup>

            <StyledFormGroup>
              <label>Drop Method</label>
              <select
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
              >
                <option value="Rooftop Drop">Rooftop Drop (Boom Truck)</option>
                <option value="Ground Drop - Driveway">Ground Drop (Driveway)</option>
                <option value="Ground Drop - Yard">Ground Drop (Backyard / Side)</option>
              </select>
            </StyledFormGroup>

            <StyledFormGroup>
              <label>Staging & Access Notes</label>
              <textarea
                placeholder="e.g. Back in on driveway right side; avoid overhead telephone wire; call 30 mins prior."
                value={stagingNotes}
                onChange={(e) => setStagingNotes(e.target.value)}
              />
            </StyledFormGroup>
          </StyledModalBody>

          <StyledModalFooter>
            <StyledButton
              type="button"
              data-variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </StyledButton>
            <StyledButton
              type="submit"
              data-variant="primary"
              disabled={loading}
            >
              {loading ? (
                <IconLoader2 size={16} className="spin" />
              ) : (
                <IconPackageExport size={16} />
              )}
              <span>{loading ? 'Sending Order...' : 'Send Purchase Order'}</span>
            </StyledButton>
          </StyledModalFooter>
        </form>
      </StyledModalCard>
    </StyledModalBackdrop>
  );
};
