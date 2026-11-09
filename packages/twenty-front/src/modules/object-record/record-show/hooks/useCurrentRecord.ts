import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';

export interface InsuranceRecordData {
  id?: string;
  name?: string;
  customerName?: string;
  insuranceCarrier?: string;
  insuranceClaimNumber?: string;
  adjusterName?: string;
  adjusterPhone?: string;
  adjusterEmail?: string;
  dateOfLoss?: string;
  deductibleAmount?: number;
  rcvInitialAmount?: number;
  acvInitialAmount?: number;
  depreciationAmount?: number;
  supplementRequestedAmount?: number;
  supplementApprovedAmount?: number;
  totalClaimRcv?: number;
  insuranceClaimStage?: string;
  [key: string]: any;
}

/**
 * useCurrentRecord
 * Hook that returns the currently active record in Twenty CRM, enriched with insurance financials
 */
export const useCurrentRecord = (recordIdProp?: string): InsuranceRecordData | null => {
  const params = useParams<{ objectRecordId?: string }>();
  const activeRecordId = recordIdProp || params.objectRecordId || '';

  const storeRecord = useAtomFamilyStateValue(recordStoreFamilyState, activeRecordId) as InsuranceRecordData | null;
  const [remoteRecord, setRemoteRecord] = useState<InsuranceRecordData | null>(null);

  useEffect(() => {
    if (!activeRecordId) return;

    let isMounted = true;
    const serviceUrl =
      (window as any)?._env_?.REACT_APP_WORK_ORDER_SERVICE_URL ||
      process.env.REACT_APP_WORK_ORDER_SERVICE_URL ||
      'http://localhost:4000';

    fetch(`${serviceUrl}/api/insurance/${activeRecordId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.claim) {
          setRemoteRecord(data.claim);
        }
      })
      .catch(() => {
        // Fallback silently if offline or standalone
      });

    return () => {
      isMounted = false;
    };
  }, [activeRecordId]);

  if (!activeRecordId && !storeRecord && !remoteRecord) {
    return null;
  }

  // Merge store record with any remote-calculated claim data
  const merged: InsuranceRecordData = {
    ...(storeRecord || {}),
    ...(remoteRecord || {}),
  };

  return Object.keys(merged).length > 0 ? merged : null;
};

export default useCurrentRecord;
