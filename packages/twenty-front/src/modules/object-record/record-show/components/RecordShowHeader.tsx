import React from 'react';
import { RecordShowPageHeader } from '~/pages/object-record/RecordShowPageHeader';
import { OpenProposalActionButton } from '@/object-record/record-show/components/OpenProposalActionButton';
import { CopyPortalLinkActionButton } from '@/object-record/record-show/components/CopyPortalLinkActionButton';
import { RoofInspectionActionButton } from '@/object-record/record-show/components/RoofInspectionActionButton';
import { InsuranceClaimWidget } from '@/object-record/record-show/components/InsuranceClaimWidget';
import { JobCostingFinancialCard } from '@/object-record/record-show/components/JobCostingFinancialCard';
import { CertificateOfCompletionActionButton } from '@/object-record/record-show/components/CertificateOfCompletionActionButton';
import { DeductibleComplianceModalButton } from '@/object-record/record-show/components/DeductibleComplianceModalButton';
import { SendDeductibleLinkButton } from '@/object-record/record-show/components/SendDeductibleLinkButton';
import { RecordCarrierCheckModalButton } from '@/object-record/record-show/components/RecordCarrierCheckModalButton';
import { PrintWorkOrderActionButton } from '@/object-record/record-show/components/PrintWorkOrderActionButton';
import { GenerateMaterialOrderActionButton } from '@/object-record/record-show/components/GenerateMaterialOrderActionButton';
import { GenerateClaimOfLienActionButton } from '@/object-record/record-show/components/GenerateClaimOfLienActionButton';
import { GenerateReleaseOfLienActionButton } from '@/object-record/record-show/components/GenerateReleaseOfLienActionButton';
import { SubmitToSimplifileActionButton } from '@/object-record/record-show/components/SubmitToSimplifileActionButton';
import {
  ExportAbcSupplyButton,
  TransmitAbcOrderButton,
} from '@/object-record/record-show/components/ExportAbcSupplyButton';
import { SmsQuickComposer } from '@/object-record/record-show/components/SmsQuickComposer';

/**
 * RecordShowHeader: Canonical record header export supporting roofing work order actions
 */
export const RecordShowHeader = (props: React.ComponentProps<typeof RecordShowPageHeader>) => {
  return (
    <RecordShowPageHeader {...props}>
      <SmsQuickComposer
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <RoofInspectionActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <InsuranceClaimWidget
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <JobCostingFinancialCard
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <SendDeductibleLinkButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <DeductibleComplianceModalButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <CertificateOfCompletionActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <RecordCarrierCheckModalButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <CopyPortalLinkActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <OpenProposalActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <PrintWorkOrderActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <GenerateMaterialOrderActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <ExportAbcSupplyButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <TransmitAbcOrderButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <GenerateClaimOfLienActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <GenerateReleaseOfLienActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      <SubmitToSimplifileActionButton
        objectNameSingular={props.objectNameSingular}
        recordId={props.objectRecordId}
      />
      {props.children}
    </RecordShowPageHeader>
  );
};

export default RecordShowHeader;
