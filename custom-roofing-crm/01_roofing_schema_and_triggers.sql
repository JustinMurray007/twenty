-- ==============================================================================
-- ROOFING CRM DATABASE SCHEMA & AUTOMATED TRIGGERS FOR TWENTY CRM
-- Bridges Twenty CRM to JobNimbus Core Roofing Workflows
-- ==============================================================================

-- 1. ADD ROOFING CUSTOM FIELDS & GENERATED TAKEOFF COLUMNS TO OPPORTUNITY
-- ------------------------------------------------------------------------------
ALTER TABLE "opportunity"
  ADD COLUMN IF NOT EXISTS "roofSquares" NUMERIC(8,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "pitch" VARCHAR(20) DEFAULT '6/12',
  ADD COLUMN IF NOT EXISTS "layers" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "deckingType" VARCHAR(50) DEFAULT 'OSB_7_16',
  ADD COLUMN IF NOT EXISTS "materialType" VARCHAR(50) DEFAULT 'ARCHITECTURAL_SHINGLE',
  ADD COLUMN IF NOT EXISTS "wasteFactorPercent" NUMERIC(5,2) DEFAULT 10.00,
  -- Stored Generated Takeoff Formulas (JobNimbus Automated Calculations)
  ADD COLUMN IF NOT EXISTS "totalBundles" NUMERIC(10,2) GENERATED ALWAYS AS (
    CEIL("roofSquares" * 3.0 * (1.0 + ("wasteFactorPercent" / 100.0)))
  ) STORED,
  ADD COLUMN IF NOT EXISTS "syntheticFeltRolls" INTEGER GENERATED ALWAYS AS (
    CEIL(("roofSquares" * (1.0 + ("wasteFactorPercent" / 100.0))) / 10.0)
  ) STORED,
  ADD COLUMN IF NOT EXISTS "iceWaterShieldRolls" INTEGER GENERATED ALWAYS AS (
    -- Average 2 rolls per standard roof for eaves & valleys
    GREATEST(1, CEIL("roofSquares" * 0.05))
  ) STORED,
  ADD COLUMN IF NOT EXISTS "ridgeCapBundles" INTEGER GENERATED ALWAYS AS (
    -- Approx 35 LF per bundle, ~1 bundle per 7 squares average
    GREATEST(1, CEIL("roofSquares" / 7.0))
  ) STORED,
  -- Good / Better / Best Interactive Proposal Tiers & E-Signature
  ADD COLUMN IF NOT EXISTS "tierGoodPrice" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "tierBetterPrice" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "tierBestPrice" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "selectedTier" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "contractSignedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "customerSignatureData" TEXT,
  -- Stripe Initial Deposit Tracking (California BPC § 7159: Max 10% or $1,000)
  ADD COLUMN IF NOT EXISTS "depositStatus" VARCHAR(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS "depositAmountPaid" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" VARCHAR(100),
  -- QuickBooks Online (QBO) Direct Accounting Sync & Final Invoice Billing
  ADD COLUMN IF NOT EXISTS "qboCustomerId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "qboInvoiceId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "qboInvoiceNumber" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "qboInvoiceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "qboPaymentId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "qboDepositPaymentId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "qboBankDepositId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "qboSyncStatus" VARCHAR(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS "finalInvoiceSentAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "finalBalanceDue" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "qboLiveBalance" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "lastReconciledAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "reconciliationVariance" NUMERIC(10,2),
  -- Subcontractor Labor Payout Voucher Tracking
  ADD COLUMN IF NOT EXISTS "laborRatePerSquare" NUMERIC(10,2) DEFAULT 75.00,
  ADD COLUMN IF NOT EXISTS "tearOffRatePerSquare" NUMERIC(10,2) DEFAULT 35.00,
  ADD COLUMN IF NOT EXISTS "steepPitchFeePerSquare" NUMERIC(10,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS "totalCrewPayout" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "laborVoucherStatus" VARCHAR(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS "laborVoucherGeneratedAt" TIMESTAMP WITH TIME ZONE,
  -- Job Costing & Sales Rep Commission Split Fields
  ADD COLUMN IF NOT EXISTS "actualMaterialCost" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "actualLaborCost" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "dumpsterCost" NUMERIC(10,2) DEFAULT 550.00,
  ADD COLUMN IF NOT EXISTS "permitCost" NUMERIC(10,2) DEFAULT 350.00,
  ADD COLUMN IF NOT EXISTS "otherJobCosts" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "totalJobCost" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "companyOverheadPercent" NUMERIC(5,4) DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS "salesRepCommissionPlan" VARCHAR(100) DEFAULT '50/50 Split (Net Margin)',
  ADD COLUMN IF NOT EXISTS "salesRepCommissionRate" NUMERIC(5,4) DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS "grossProfit" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "grossMarginPercent" NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "commissionableGrossProfit" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "salesRepCommissionAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "commissionStatus" VARCHAR(100) DEFAULT 'Pending Build',
  -- Two-Way Threaded SMS & Communication Hub Fields
  ADD COLUMN IF NOT EXISTS "customerPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "customerName" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "assignedRepPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "addressStreet" VARCHAR(255),
  -- Subcontractor Crew SMS Automation & Job Tracking
  ADD COLUMN IF NOT EXISTS "crewStatus" VARCHAR(50) DEFAULT 'Scheduled',
  ADD COLUMN IF NOT EXISTS "crewLeaderPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "crewLeadPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "crewName" VARCHAR(255),
  -- Text-to-Pay & Billing Stage (JobNimbus A/R & Billing Board)
  ADD COLUMN IF NOT EXISTS "textToPaySentAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "paymentLinkUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "billingStage" VARCHAR(50) DEFAULT 'Deposit Pending',
  ADD COLUMN IF NOT EXISTS "finalPaymentReceivedAt" TIMESTAMP WITH TIME ZONE,
  -- Automated Dunning & A/R Payment Reminders
  ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastReminderSentAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "lateFeeAssessed" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "noticeOfIntentIssuedAt" TIMESTAMP WITH TIME ZONE,
  -- Lob Certified Mail & USPS Proof of Delivery (CA Civil Code § 8416)
  ADD COLUMN IF NOT EXISTS "lobLetterId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "certifiedMailDeliveredAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "uspsDeliveryStatus" VARCHAR(50),
  -- California Mechanic's Lien & County Recording (CA Civil Code §§ 8416–8448)
  ADD COLUMN IF NOT EXISTS "assessorParcelNumber" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "uspsCertifiedTrackingNumber" VARCHAR(100),
  -- Recorded Lien Metadata & Release of Lien (CA Civil Code § 8490)
  ADD COLUMN IF NOT EXISTS "countyDocumentNumber" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "countyBookPage" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "lienRecordedDate" DATE,
  ADD COLUMN IF NOT EXISTS "lienReleasePdfUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "lienReleaseGeneratedAt" TIMESTAMP WITH TIME ZONE,
  -- Simplifile San Diego County E-Recording (FIPS 06073)
  ADD COLUMN IF NOT EXISTS "simplifilePackageId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "recordingFeePaid" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "countyRecordedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "stampedRecordingPdfUrl" TEXT,
  -- ABC Supply Dispatch, Live Telematics Tracking & Proof of Delivery
  ADD COLUMN IF NOT EXISTS "materialOrderStatus" VARCHAR(50) DEFAULT 'Draft',
  ADD COLUMN IF NOT EXISTS "purchaseOrderNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "abcTrackingUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "materialDropScheduledTime" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "materialActualDeliveredAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "deliveryTruckDriverPhone" VARCHAR(50),
  -- Aerial Roof Measurement Takeoff (Roofr / EagleView Webhook Ingest)
  ADD COLUMN IF NOT EXISTS "valleyLinearFeet" NUMERIC(8,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "ridgeLinearFeet" NUMERIC(8,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "perimeterLinearFeet" NUMERIC(8,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "facetsCount" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "shingleBundlesNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "underlaymentRollsNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "iceAndWaterRollsNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ridgeCapBundlesNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dripEdgePiecesNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "starterBundlesNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estimatedMaterialCost" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "steepLaborMultiplierCost" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "valleyLaborAdderCost" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "selectedAddons" TEXT,
  ADD COLUMN IF NOT EXISTS "totalAddonsPrice" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "selectedAddonsJson" JSONB,
  -- Interactive Shingle Brand & Colorway Selection
  ADD COLUMN IF NOT EXISTS "shingleManufacturer" VARCHAR(50) DEFAULT 'GAF',
  ADD COLUMN IF NOT EXISTS "shingleColorName" VARCHAR(100) DEFAULT 'Charcoal',
  ADD COLUMN IF NOT EXISTS "shingleColorHex" VARCHAR(20) DEFAULT '#26282a',
  -- Real-Time Job Profit Tracker Columns
  ADD COLUMN IF NOT EXISTS "actualMaterialCost" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "actualLaborCost" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grossProfitDollars" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grossMarginPercent" NUMERIC(5,2) DEFAULT 0,
  -- Insurance Scope & Restoration Metrics
  ADD COLUMN IF NOT EXISTS "insuranceCarrier" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "insuranceClaimNumber" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "adjusterName" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "adjusterPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "adjusterEmail" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "dateOfLoss" DATE,
  ADD COLUMN IF NOT EXISTS "deductibleAmount" NUMERIC(10,2) DEFAULT 1000.00,
  ADD COLUMN IF NOT EXISTS "rcvInitialAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "acvInitialAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "depreciationAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "supplementRequestedAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "supplementApprovedAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "totalClaimRcv" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "insuranceClaimStage" VARCHAR(100) DEFAULT 'Claim Filed - Awaiting Inspection',
  ADD COLUMN IF NOT EXISTS "cocGeneratedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "cocDocumentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "depreciationStatus" VARCHAR(50) DEFAULT 'Held by Insurer',
  ADD COLUMN IF NOT EXISTS "carrierCheckNumber" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "carrierCheckAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "carrierCheckReceivedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "depreciationFollowUpSentAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "depreciationAgingDays" INTEGER DEFAULT 0,
  -- Deductible Compliance Lock & Proof of Collection (Anti-Fraud Statutes: CA Ins Code § 550, TX HB 2102, FL § 817.234)
  ADD COLUMN IF NOT EXISTS "deductiblePaymentStatus" VARCHAR(50) DEFAULT 'Unpaid',
  ADD COLUMN IF NOT EXISTS "deductibleAmountCollected" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "deductiblePaymentMethod" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "deductiblePaymentRef" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "deductibleProofUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "deductibleCollectedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "deductibleVerifiedBy" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "deductiblePaymentLinkUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "deductibleLinkSentAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "deductibleReceiptUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "qboJournalEntryId" TEXT,
  ADD COLUMN IF NOT EXISTS "qboPaymentId" TEXT;

-- Ensure Opportunity stages support the Roofing Sales Pipeline
-- Stages: NEW_LEAD -> INSPECTION_SCHEDULED -> INSPECTION_COMPLETE -> ESTIMATE_SENT -> INSURANCE_CLAIM_PENDING -> CONTRACT_SIGNED
COMMENT ON COLUMN "opportunity"."stage" IS 'Roofing Sales Pipeline: NEW_LEAD, INSPECTION_SCHEDULED, INSPECTION_COMPLETE, ESTIMATE_SENT, INSURANCE_CLAIM_PENDING, CONTRACT_SIGNED, CLOSED_LOST';


-- 2. CREATE JOBS OBJECT (PRODUCTION PIPELINE)
-- ------------------------------------------------------------------------------
-- Production Stages: MATERIAL_ORDERED -> CREW_SCHEDULED -> TEAR_OFF_IN_PROGRESS -> FINAL_INSPECTION -> BILLED_PAID
CREATE TABLE IF NOT EXISTS "job" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  
  -- 1-to-1 strict relationship with Opportunity
  "opportunityId" UUID UNIQUE NOT NULL REFERENCES "opportunity"("id") ON DELETE CASCADE,
  
  -- Production Pipeline Stage
  "stage" VARCHAR(50) NOT NULL DEFAULT 'MATERIAL_ORDERED',
  
  -- Job & Homeowner Details
  "jobNumber" VARCHAR(50) UNIQUE,
  "title" VARCHAR(255) NOT NULL,
  "homeownerName" VARCHAR(255),
  "homeownerPhone" VARCHAR(50),
  "homeownerEmail" VARCHAR(255),
  "propertyAddress" TEXT,
  "city" VARCHAR(100),
  "state" VARCHAR(50),
  "postalCode" VARCHAR(20),
  
  -- Scope & Specs
  "roofSquares" NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  "materialType" VARCHAR(50),
  "shingleColor" VARCHAR(100),
  "scopeOfWork" TEXT,
  
  -- Crew & Subcontractor Assignment
  "assignedSubcontractor" VARCHAR(255),
  "crewLeadName" VARCHAR(255),
  "crewLeadPhone" VARCHAR(50),
  
  -- Production Schedule Dates
  "materialDeliveryDate" DATE,
  "dumpsterDropDate" DATE,
  "scheduledStartDate" DATE,
  "actualStartDate" DATE,
  "completionDate" DATE,
  "finalInspectionDate" DATE,
  
  -- Financial & Billing
  "contractAmount" NUMERIC(12,2) DEFAULT 0.00,
  "totalJobCost" NUMERIC(12,2) DEFAULT 0.00,
  "actualMarginPercent" NUMERIC(5,2),
  "paymentStatus" VARCHAR(50) DEFAULT 'DEPOSIT_COLLECTED'
);

CREATE INDEX IF NOT EXISTS "idx_job_stage" ON "job"("stage");
CREATE INDEX IF NOT EXISTS "idx_job_opportunity_id" ON "job"("opportunityId");


-- 3. CREATE CLAIM INFO OBJECT (INSURANCE RESTORATION TRACKING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "claim_info" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  
  "opportunityId" UUID NOT NULL REFERENCES "opportunity"("id") ON DELETE CASCADE,
  "insuranceCarrier" VARCHAR(150) NOT NULL,
  "claimNumber" VARCHAR(100) NOT NULL,
  "policyNumber" VARCHAR(100),
  "dateOfLoss" DATE,
  "damageType" VARCHAR(50) DEFAULT 'HAIL_AND_WIND', -- HAIL, WIND, HURRICANE, FALLEN_TREE
  
  -- Adjuster Contact Info
  "adjusterName" VARCHAR(150),
  "adjusterPhone" VARCHAR(50),
  "adjusterEmail" VARCHAR(255),
  "adjusterMeetingDate" TIMESTAMP WITH TIME ZONE,
  
  -- Financials (ACV, RCV, Deductible, Depreciation)
  "deductibleAmount" NUMERIC(10,2) DEFAULT 1000.00,
  "acvAmount" NUMERIC(12,2) DEFAULT 0.00, -- Actual Cash Value
  "rcvAmount" NUMERIC(12,2) DEFAULT 0.00, -- Replacement Cost Value
  "depreciationAmount" NUMERIC(12,2) GENERATED ALWAYS AS (
    GREATEST(0.00, "rcvAmount" - "acvAmount")
  ) STORED,
  "netClaimAmount" NUMERIC(12,2) GENERATED ALWAYS AS (
    GREATEST(0.00, "rcvAmount" - "deductibleAmount")
  ) STORED,
  "supplementStatus" VARCHAR(50) DEFAULT 'NONE', -- NONE, PREPARED, SUBMITTED, APPROVED
  "supplementAmount" NUMERIC(10,2) DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS "idx_claim_info_opportunity" ON "claim_info"("opportunityId");
CREATE INDEX IF NOT EXISTS "idx_claim_number" ON "claim_info"("claimNumber");


-- 4. CREATE DEAL LINE ITEMS OBJECT (TAKEOFFS & MATERIAL/LABOR ROLLUPS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "deal_line_item" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  
  "opportunityId" UUID NOT NULL REFERENCES "opportunity"("id") ON DELETE CASCADE,
  "itemName" VARCHAR(255) NOT NULL,
  "category" VARCHAR(50) NOT NULL DEFAULT 'MATERIAL', -- MATERIAL, LABOR, EQUIPMENT, PERMIT, SUBCONTRACTOR
  "unit" VARCHAR(20) NOT NULL DEFAULT 'SQ', -- SQ (Squares), LF (Linear Feet), EA (Each), ROLL, BUNDLE, BOX
  "quantity" NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  "unitCost" NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  "unitPrice" NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  
  -- Stored calculations for accurate rollup
  "totalCost" NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND("quantity" * "unitCost", 2)
  ) STORED,
  "totalPrice" NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND("quantity" * "unitPrice", 2)
  ) STORED,
  "grossProfit" NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(("quantity" * "unitPrice") - ("quantity" * "unitCost"), 2)
  ) STORED,
  "marginPercent" NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN ("quantity" * "unitPrice") > 0 
      THEN ROUND(((("quantity" * "unitPrice") - ("quantity" * "unitCost")) / ("quantity" * "unitPrice")) * 100.0, 2)
      ELSE 0.00 
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS "idx_deal_line_item_opp" ON "deal_line_item"("opportunityId");


-- 5. CREATE WORK ORDERS OBJECT (PRODUCTION ROUTING & LOGISTICS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "work_order" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  
  "jobId" UUID NOT NULL REFERENCES "job"("id") ON DELETE CASCADE,
  "workOrderNumber" VARCHAR(50) UNIQUE,
  "subcontractorCrewLead" VARCHAR(255) NOT NULL,
  "crewContactPhone" VARCHAR(50),
  "permitNumber" VARCHAR(100),
  "permitIssuedDate" DATE,
  
  -- Dumpster / Waste Routing
  "dumpsterVendor" VARCHAR(150),
  "dumpsterSizeYards" INTEGER DEFAULT 20,
  "dumpsterScheduledDate" DATE,
  "dumpsterDropLocation" VARCHAR(150) DEFAULT 'Right side of driveway',
  
  -- Material Delivery Routing
  "supplierName" VARCHAR(150) DEFAULT 'ABC Supply / Beacon Building Products',
  "deliveryDate" DATE,
  "roofLoadType" VARCHAR(50) DEFAULT 'ROOFTOP_LOAD', -- ROOFTOP_LOAD, GROUND_DROP
  
  -- Execution Logistics
  "dumpSlipTonnage" NUMERIC(6,2),
  "crewLaborPayout" NUMERIC(10,2),
  "specialInstructions" TEXT DEFAULT 'Protect landscaping and A/C unit with plywood. Run magnetic sweep after tear-off and final cleanup.'
);

CREATE INDEX IF NOT EXISTS "idx_work_order_job_id" ON "work_order"("jobId");


-- 6. NATIVE POSTGRES TRIGGER: CONTRACT SIGNED -> AUTOMATIC JOB CREATION
-- ------------------------------------------------------------------------------
-- When Opportunity stage transitions to 'CONTRACT_SIGNED', automatically provision
-- a production Job with homeowner address, specifications, and default work order.

CREATE OR REPLACE FUNCTION fn_opportunity_contract_signed_create_job()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_job_number VARCHAR(50);
  v_customer_name VARCHAR(255);
  v_customer_phone VARCHAR(50);
  v_customer_email VARCHAR(255);
  v_address TEXT;
BEGIN
  -- Check if stage was just set to CONTRACT_SIGNED
  IF (NEW."stage" IN ('CONTRACT_SIGNED', 'Contract Signed')) 
     AND (OLD."stage" IS NULL OR OLD."stage" NOT IN ('CONTRACT_SIGNED', 'Contract Signed')) THEN
    
    -- Guard against duplicate job creation if job already exists
    IF EXISTS (SELECT 1 FROM "job" WHERE "opportunityId" = NEW."id") THEN
      RETURN NEW;
    END IF;

    -- Fetch homeowner contact details from Person table if pointOfContactId exists
    IF NEW."pointOfContactId" IS NOT NULL THEN
      SELECT 
        COALESCE(TRIM(CONCAT("name"->>'firstName', ' ', "name"->>'lastName')), NEW."name"),
        "phones"->0->>'number',
        "emails"->0->>'email'
      INTO v_customer_name, v_customer_phone, v_customer_email
      FROM "person"
      WHERE "id" = NEW."pointOfContactId";
    ELSE
      v_customer_name := NEW."name";
    END IF;

    -- Generate human-friendly Job Number (e.g. JOB-2026-XXXX)
    v_job_number := 'JOB-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

    -- Insert new production job
    INSERT INTO "job" (
      "opportunityId",
      "jobNumber",
      "title",
      "stage",
      "homeownerName",
      "homeownerPhone",
      "homeownerEmail",
      "roofSquares",
      "materialType",
      "contractAmount",
      "scopeOfWork"
    ) VALUES (
      NEW."id",
      v_job_number,
      'Roof Replacement - ' || COALESCE(v_customer_name, NEW."name"),
      'MATERIAL_ORDERED',
      v_customer_name,
      v_customer_phone,
      v_customer_email,
      COALESCE(NEW."roofSquares", 0.00),
      COALESCE(NEW."materialType", 'ARCHITECTURAL_SHINGLE'),
      COALESCE((NEW."amount"->>'amountMicros')::NUMERIC / 1000000.0, 0.00),
      'Full roof tear-off and replacement. Pitch: ' || COALESCE(NEW."pitch", '6/12') || 
      ', Layers: ' || COALESCE(NEW."layers"::TEXT, '1') || 
      ', Decking: ' || COALESCE(NEW."deckingType", 'OSB_7_16') || '.'
    )
    RETURNING "id" INTO v_job_id;

    -- Automatically seed initial work order template for production team
    INSERT INTO "work_order" (
      "jobId",
      "workOrderNumber",
      "subcontractorCrewLead",
      "specialInstructions"
    ) VALUES (
      v_job_id,
      'WO-' || v_job_number,
      'Unassigned Production Crew',
      'Initial production work order generated on Contract Signed. Verify material delivery and permit issuance.'
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to opportunity table
DROP TRIGGER IF EXISTS trg_opportunity_contract_signed_create_job ON "opportunity";

CREATE TRIGGER trg_opportunity_contract_signed_create_job
AFTER INSERT OR UPDATE OF "stage" ON "opportunity"
FOR EACH ROW
EXECUTE FUNCTION fn_opportunity_contract_signed_create_job();

-- ==============================================================================
-- 6. REAL-TIME JOB PROFIT TRACKER (JOBNIMBUS MARGIN ENGINE)
-- ==============================================================================

-- Stored Trigger Function to Compute Real-Time Margins
CREATE OR REPLACE FUNCTION calculate_job_profitability()
RETURNS TRIGGER AS $$
DECLARE
    revenue NUMERIC := 0;
    total_costs NUMERIC := 0;
BEGIN
    -- Extract numeric revenue whether amount is JSONB, numeric, or fallback to selected tier
    BEGIN
        IF NEW."amount" IS NOT NULL THEN
            IF pg_typeof(NEW."amount")::text = 'jsonb' OR pg_typeof(NEW."amount")::text = 'json' THEN
                IF NEW."amount" ? 'amountMicros' THEN
                    revenue := (NEW."amount"->>'amountMicros')::NUMERIC / 1000000.0;
                ELSE
                    revenue := (NEW."amount"#>>'{}')::NUMERIC;
                END IF;
            ELSE
                revenue := NEW."amount"::NUMERIC;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        revenue := 0;
    END;

    -- Fallback to selected tier price if revenue is 0
    IF revenue = 0 THEN
        IF NEW."selectedTier" = 'Best' AND NEW."tierBestPrice" IS NOT NULL THEN
            revenue := NEW."tierBestPrice";
        ELSIF NEW."selectedTier" = 'Better' AND NEW."tierBetterPrice" IS NOT NULL THEN
            revenue := NEW."tierBetterPrice";
        ELSIF NEW."selectedTier" = 'Good' AND NEW."tierGoodPrice" IS NOT NULL THEN
            revenue := NEW."tierGoodPrice";
        END IF;
    END IF;

    -- Pull labor cost from auto-calculated voucher if actualLaborCost not manually overridden
    IF NEW."actualLaborCost" IS NULL OR NEW."actualLaborCost" = 0 THEN
        NEW."actualLaborCost" := COALESCE(NEW."totalCrewPayout", 0);
    END IF;

    -- Pull material cost from estimate if actualMaterialCost not manually overridden
    IF NEW."actualMaterialCost" IS NULL OR NEW."actualMaterialCost" = 0 THEN
        NEW."actualMaterialCost" := COALESCE(NEW."estimatedMaterialCost", 0);
    END IF;

    total_costs := COALESCE(NEW."actualMaterialCost", 0) + COALESCE(NEW."actualLaborCost", 0);
    NEW."grossProfitDollars" := revenue - total_costs;

    IF revenue > 0 THEN
        NEW."grossMarginPercent" := ROUND(((NEW."grossProfitDollars" / revenue) * 100.0), 2);
    ELSE
        NEW."grossMarginPercent" := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach Trigger to Opportunity record updates
DROP TRIGGER IF EXISTS trg_calculate_job_profitability ON "opportunity";
CREATE TRIGGER trg_calculate_job_profitability
BEFORE INSERT OR UPDATE OF "amount", "actualMaterialCost", "actualLaborCost", "totalCrewPayout", "estimatedMaterialCost", "selectedTier", "tierGoodPrice", "tierBetterPrice", "tierBestPrice"
ON "opportunity"
FOR EACH ROW
EXECUTE FUNCTION calculate_job_profitability();

-- ==============================================================================
-- 7. QBO ACCOUNTS PAYABLE (A/P) BILLS & 1099 SUBCONTRACTOR COMPLIANCE COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "qboVendorBillIds" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "lastQboBillId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "subcontractorVendorId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "subcontractorW9Status" VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS "subcontractorTinLast4" VARCHAR(10),
    ADD COLUMN IF NOT EXISTS "subcontractorCoiExpirationDate" DATE,
    ADD COLUMN IF NOT EXISTS "subcontractorComplianceStatus" VARCHAR(100) DEFAULT 'Pending Verification',
    ADD COLUMN IF NOT EXISTS "laborVoucherStatus" VARCHAR(50) DEFAULT 'Draft';

-- ==============================================================================
-- 8. WEATHER RADAR, RAIN DELAY GUARD & CREW RESCHEDULING COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "scheduledStartDate" DATE,
    ADD COLUMN IF NOT EXISTS "originalScheduledStartDate" DATE,
    ADD COLUMN IF NOT EXISTS "weatherRainProbability" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "weatherWindGustMph" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "weatherForecastSummary" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "weatherRiskStatus" VARCHAR(100) DEFAULT 'Clear - Safe for Tear-Off',
    ADD COLUMN IF NOT EXISTS "weatherDelayCount" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastWeatherRescheduledAt" TIMESTAMPTZ;

-- ==============================================================================
-- 9. POST-TEAR-OFF ROTTED DECKING (OSB/PLYWOOD) & FASCIA CHANGE ORDER COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "rottedDeckingSheets" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "rottedFasciaLinearFeet" NUMERIC(8,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "includedFreeDeckingSheets" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "deckingRatePerSheet" NUMERIC(10,2) DEFAULT 85.00,
    ADD COLUMN IF NOT EXISTS "fasciaRatePerLf" NUMERIC(10,2) DEFAULT 14.00,
    ADD COLUMN IF NOT EXISTS "changeOrderAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "changeOrderLaborAdder" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "changeOrderMaterialAdder" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "changeOrderStatus" VARCHAR(50) DEFAULT 'None',
    ADD COLUMN IF NOT EXISTS "changeOrderToken" VARCHAR(128),
    ADD COLUMN IF NOT EXISTS "changeOrderApprovalUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "changeOrderPhotoUrls" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "changeOrderRequestedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "changeOrderApprovedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "changeOrderSignedBy" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "changeOrderQboSynced" BOOLEAN DEFAULT false;

-- ==============================================================================
-- 10. MANUFACTURER WARRANTY AUTO-REGISTRATION & CERTIFICATE PACKET COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "warrantyManufacturer" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "warrantyProgramName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "warrantyTermYears" INTEGER DEFAULT 50,
    ADD COLUMN IF NOT EXISTS "warrantyWorkmanshipYears" INTEGER DEFAULT 25,
    ADD COLUMN IF NOT EXISTS "warrantyWindRatingMph" INTEGER DEFAULT 130,
    ADD COLUMN IF NOT EXISTS "warrantyRegistrationNumber" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "warrantyShingleLotNumber" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "warrantyStatus" VARCHAR(50) DEFAULT 'Pending Final Payment',
    ADD COLUMN IF NOT EXISTS "warrantyRegisteredAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "warrantyCertificateUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "warrantyPacketSentAt" TIMESTAMPTZ;

-- ==============================================================================
-- 11. MUNICIPAL ROOF PERMIT & MID-ROOF / FINAL CITY INSPECTION TRACKER COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "permitJurisdiction" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "permitNumber" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "permitStatus" VARCHAR(60) DEFAULT 'Not Applied',
    ADD COLUMN IF NOT EXISTS "permitFeeAmount" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "permitQboBillId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "permitIssuedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "midRoofInspectionScheduledAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "midRoofInspectionStatus" VARCHAR(60) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS "midRoofPassedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "finalInspectionScheduledAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "finalInspectionStatus" VARCHAR(60) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS "finalInspectionPassedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "inspectorName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "inspectionNotes" TEXT,
    ADD COLUMN IF NOT EXISTS "permitCardPdfUrl" TEXT;

-- ==============================================================================
-- 12. MORTGAGE COMPANY / LOSS DRAFT ENDORSEMENT TRACKER COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "mortgageCompanyName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "mortgageLoanNumber" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "lossDraftDepartmentPhone" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "lossDraftCheckNumber" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "lossDraftCheckAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "lossDraftHoldbackAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "lossDraftTrackingNumber" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "lossDraftStatus" VARCHAR(80) DEFAULT 'Not Required',
    ADD COLUMN IF NOT EXISTS "lossDraftPacketGeneratedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "lossDraftPacketUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "lossDraftInspectionScheduledAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "lossDraftInspectionPct" INTEGER DEFAULT 100,
    ADD COLUMN IF NOT EXISTS "lossDraftEndorsedReceivedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "lossDraftNotes" TEXT;

-- ==============================================================================
-- 13. DUMPSTER / ROLL-OFF CONTAINER DISPATCH & OVERWEIGHT TONNAGE COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "dumpsterHaulerName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "dumpsterHaulerPhone" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "dumpsterContainerSizeYd" INTEGER DEFAULT 20,
    ADD COLUMN IF NOT EXISTS "dumpsterEstimatedTons" NUMERIC(8,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "dumpsterIncludedTons" NUMERIC(8,2) DEFAULT 3.00,
    ADD COLUMN IF NOT EXISTS "dumpsterActualTons" NUMERIC(8,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "dumpsterBaseHaulFee" NUMERIC(10,2) DEFAULT 450.00,
    ADD COLUMN IF NOT EXISTS "dumpsterOverageRatePerTon" NUMERIC(10,2) DEFAULT 95.00,
    ADD COLUMN IF NOT EXISTS "dumpsterOverageFeeAmount" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "dumpsterTotalCost" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "dumpsterTicketNumber" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "dumpsterQboBillId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "dumpsterStatus" VARCHAR(60) DEFAULT 'Not Scheduled',
    ADD COLUMN IF NOT EXISTS "dumpsterDispatchedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "dumpsterPickedUpAt" TIMESTAMPTZ;

-- ==============================================================================
-- 14. STORM SWATH CANVASSING & CLOVERLEAF NEIGHBORHOOD TRACKER
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "canvassPinStatus" VARCHAR(60),
    ADD COLUMN IF NOT EXISTS "canvassStormDate" DATE,
    ADD COLUMN IF NOT EXISTS "canvassHailSizeInches" NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS "canvassWindSpeedMph" INTEGER,
    ADD COLUMN IF NOT EXISTS "canvassRepName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "canvassParentOpportunityId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "canvassCloverleafCount" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "canvassNeighborsNotifiedAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "canvassing_pin" (
    "id" VARCHAR(100) PRIMARY KEY,
    "parentOpportunityId" VARCHAR(100),
    "convertedOpportunityId" VARCHAR(100),
    "addressStreet" VARCHAR(255) NOT NULL,
    "addressCity" VARCHAR(100),
    "addressState" VARCHAR(50),
    "addressPostcode" VARCHAR(20),
    "homeownerName" VARCHAR(150),
    "homeownerPhone" VARCHAR(50),
    "pinStatus" VARCHAR(60) DEFAULT 'Not Home',
    "repName" VARCHAR(150),
    "stormDate" DATE,
    "hailSizeInches" NUMERIC(5,2),
    "windSpeedMph" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 15. POST-COMPLETION GOOGLE REVIEW GATE & $250 REFERRAL BOUNTY COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "reviewRequestStatus" VARCHAR(60) DEFAULT 'Not Sent',
    ADD COLUMN IF NOT EXISTS "reviewSentimentScore" INTEGER,
    ADD COLUMN IF NOT EXISTS "reviewComment" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewGoogleRedirected" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "reviewRequestedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "reviewSubmittedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "referralCode" VARCHAR(60),
    ADD COLUMN IF NOT EXISTS "referredByOpportunityId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "referralCount" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "referralBountyEarned" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "referralBountyPaid" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "referralLastQboBillId" VARCHAR(100);

-- ==============================================================================
-- 16. FINAL QC WALKTHROUGH, MAGNETIC NAIL SWEEP & PUNCH-LIST GATE COLUMNS
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "qcMagneticSweepVerified" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "qcGutterCleanoutVerified" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "qcPipeBootFlashingVerified" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "qcAtticPenetrationChecked" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "qcDrivewayDebrisCleared" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "qcPunchListNotes" TEXT,
    ADD COLUMN IF NOT EXISTS "qcSuperintendentName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "qcWalkthroughStatus" VARCHAR(60) DEFAULT 'Pending Inspection',
    ADD COLUMN IF NOT EXISTS "qcHomeownerSignedBy" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "qcHomeownerSignedAt" TIMESTAMPTZ;

-- ==============================================================================
-- 17. HOA ARCHITECTURAL REVIEW COMMITTEE (ARC) SUBMITTAL & APPROVAL GATE
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "hoaRequired" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "hoaManagementCompany" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "hoaCommunityName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "hoaArcContactEmail" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "hoaArcStatus" VARCHAR(60) DEFAULT 'No HOA / Exempt',
    ADD COLUMN IF NOT EXISTS "hoaShingleSampleBoardSubmitted" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "hoaCcrColorApproved" VARCHAR(120),
    ADD COLUMN IF NOT EXISTS "hoaArcSubmittedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "hoaArcApprovedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "hoaApprovalLetterUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "hoaPacketUrl" TEXT;

-- ==============================================================================
-- 18. SOLAR PANEL DETACH & RESET (D&R) COORDINATION & SUB-TRADE TRACKER
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "hasRooftopSolar" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "solarPanelCount" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "solarInverterType" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "solarProviderName" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "solarDnRPerPanelRate" NUMERIC(10,2) DEFAULT 225.00,
    ADD COLUMN IF NOT EXISTS "solarStandoffKitFee" NUMERIC(10,2) DEFAULT 450.00,
    ADD COLUMN IF NOT EXISTS "solarDnRTotalQuote" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "solarDetachScheduledAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "solarDetachCompletedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "solarResetScheduledAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "solarSystemRecommissionedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "solarPtoVerified" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "solarQboBillId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "solarDnRStatus" VARCHAR(80) DEFAULT 'No Solar Array';

-- ==============================================================================
-- 19. POINT-OF-SALE HOMEOWNER ROOF FINANCING & DEALER-FEE CALCULATOR
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "financingLender" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "financingPlanCode" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "financingPrincipalAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "financingAprPct" NUMERIC(6,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "financingTermMonths" INTEGER DEFAULT 120,
    ADD COLUMN IF NOT EXISTS "financingMonthlyPayment" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "financingDealerFeePct" NUMERIC(6,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "financingDealerFeeAmount" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "financingNetFundedAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "financingApplicationStatus" VARCHAR(60) DEFAULT 'Not Applied',
    ADD COLUMN IF NOT EXISTS "financingStipsCleared" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "financingFundedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "financingQboPaymentId" VARCHAR(100);

-- ==============================================================================
-- 20. XACTIMATE CODE-UPGRADE & 10%/10% OVERHEAD & PROFIT (O&P) SUPPLEMENT BUILDER
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "supplementStatus" VARCHAR(60) DEFAULT 'Draft',
    ADD COLUMN IF NOT EXISTS "supplementCodeItemsJson" JSONB,
    ADD COLUMN IF NOT EXISTS "supplementTradesCount" INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "supplementOpApplied" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "supplementCodeSubtotal" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "supplementOpAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "supplementRequestedAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "supplementApprovedAmount" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "supplementInitialRcv" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "supplementRevisedRcv" NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "supplementRebuttalPacketUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "supplementSubmittedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "supplementApprovedAt" TIMESTAMPTZ;

-- ==============================================================================
-- 21. POST-INSTALL LEAK SERVICE TICKET DISPATCHER & ANNUAL TUNE-UP MEMBERSHIP
-- ==============================================================================
ALTER TABLE "opportunity"
    ADD COLUMN IF NOT EXISTS "maintenancePlanEnrolled" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "maintenanceAnnualFee" NUMERIC(10,2) DEFAULT 299.00,
    ADD COLUMN IF NOT EXISTS "maintenanceEnrolledAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "maintenanceNextTuneUpDate" DATE,
    ADD COLUMN IF NOT EXISTS "serviceTicketId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "serviceTicketStatus" VARCHAR(60) DEFAULT 'None',
    ADD COLUMN IF NOT EXISTS "serviceTicketCategory" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "serviceTicketPriority" VARCHAR(40) DEFAULT 'Standard',
    ADD COLUMN IF NOT EXISTS "serviceTicketAssignedTech" VARCHAR(150),
    ADD COLUMN IF NOT EXISTS "serviceTicketWarrantyCovered" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "serviceTicketCrewBackchargeAmount" NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "serviceTicketSlaDeadline" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "serviceTicketResolvedAt" TIMESTAMPTZ;

-- Trigger notification confirmation
SELECT 'Roofing schema, production routing, and real-time profitability triggers successfully compiled.' AS status;

