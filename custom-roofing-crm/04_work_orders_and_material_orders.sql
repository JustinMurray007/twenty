-- ==============================================================================
-- 04_WORK_ORDERS_AND_MATERIAL_ORDERS.SQL
-- Automated Estimator Trigger, Subcontractor Work Orders & Material Orders
-- ==============================================================================

-- ==============================================================================
-- STEP 1: AUTOMATED ROOFING ESTIMATOR (POSTGRESQL TRIGGER)
-- Computes shingle bundles, synthetic rolls & material costs from roofSquares
-- ==============================================================================

-- 1. Ensure required roofing columns exist on the Opportunity table
ALTER TABLE "opportunity" 
  ADD COLUMN IF NOT EXISTS "roofSquares" NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pitch" VARCHAR(32) DEFAULT '4/12',
  ADD COLUMN IF NOT EXISTS "wasteFactorPercent" NUMERIC(4,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS "shingleBundlesNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "underlaymentRollsNeeded" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estimatedMaterialCost" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "materialOrderStatus" VARCHAR(50) DEFAULT 'Draft',
  ADD COLUMN IF NOT EXISTS "purchaseOrderNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "supplierTrackingUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "abcTrackingUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierStockStatus" VARCHAR(50) DEFAULT 'In Stock',
  ADD COLUMN IF NOT EXISTS "branchQuantityAvailable" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "materialDropScheduledTime" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "materialActualDeliveredAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "drivewayClearanceReminderSentAt" TIMESTAMP WITH TIME ZONE,
  -- Automated 24-Hour Review Generation Campaign & Sentiment Gating
  ADD COLUMN IF NOT EXISTS "reviewRequestSentAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "reviewRatingScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "reviewFeedbackText" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewStatus" VARCHAR(50) DEFAULT 'Pending',
  -- Homeowner Live Job Tracking Portal (JobNimbus Job Share)
  ADD COLUMN IF NOT EXISTS "portalAccessToken" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "homeownerPortalUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "portalLinkSentAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "projectManagerName" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "projectManagerPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "permitStatus" VARCHAR(50) DEFAULT 'Not Required',
  -- Mobile Roof Inspection Checklist & Customer Health Report
  ADD COLUMN IF NOT EXISTS "roofAgeYears" INTEGER,
  ADD COLUMN IF NOT EXISTS "existingLayers" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "inspectShingleCondition" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "inspectDeckingCondition" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "inspectFlashingCondition" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "inspectPipeBootsCondition" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "inspectVentilationCondition" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "inspectionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "inspectionCompletedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "inspectionReportUrl" TEXT,
  -- Insurance Restoration Roofing (JobNimbus Scope & Depreciation Tracker)
  ADD COLUMN IF NOT EXISTS "insuranceCarrier" VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "insuranceClaimNumber" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "adjusterName" VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "adjusterPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "adjusterEmail" VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "dateOfLoss" DATE,
  ADD COLUMN IF NOT EXISTS "deductibleAmount" NUMERIC(10,2) DEFAULT 1000.00,
  ADD COLUMN IF NOT EXISTS "rcvInitialAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "acvInitialAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "depreciationAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "supplementRequestedAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "supplementApprovedAmount" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "totalClaimRcv" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "insuranceClaimStage" VARCHAR(100) DEFAULT 'Claim Filed - Awaiting Inspection',
  ADD COLUMN IF NOT EXISTS "deliveryTruckDriverPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "crewLeadPhone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "leadSource" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "trackingNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "sourceCampaign" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "gclid" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "callRecordingUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "companycamProjectId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "companycamUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "addressStreet" TEXT,
  ADD COLUMN IF NOT EXISTS "addressCity" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "addressState" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "addressPostcode" VARCHAR(20),
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
  -- Subcontractor Labor Payout Voucher Tracking
  ADD COLUMN IF NOT EXISTS "laborRatePerSquare" NUMERIC(10,2) DEFAULT 75.00,
  ADD COLUMN IF NOT EXISTS "tearOffRatePerSquare" NUMERIC(10,2) DEFAULT 35.00,
  ADD COLUMN IF NOT EXISTS "steepPitchFeePerSquare" NUMERIC(10,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS "totalCrewPayout" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "laborVoucherStatus" VARCHAR(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS "laborVoucherGeneratedAt" TIMESTAMP WITH TIME ZONE,
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
  ADD COLUMN IF NOT EXISTS "totalCrewPayout" NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "selectedAddons" TEXT,
  -- Interactive Shingle Brand & Colorway Selection
  ADD COLUMN IF NOT EXISTS "shingleManufacturer" VARCHAR(50) DEFAULT 'GAF',
  ADD COLUMN IF NOT EXISTS "shingleColorName" VARCHAR(100) DEFAULT 'Charcoal',
  ADD COLUMN IF NOT EXISTS "shingleColorHex" VARCHAR(20) DEFAULT '#26282a',
  -- Real-Time Job Profit Tracker Columns
  ADD COLUMN IF NOT EXISTS "actualMaterialCost" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "actualLaborCost" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grossProfitDollars" NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grossMarginPercent" NUMERIC(5,2) DEFAULT 0;

-- 2. Enhanced Trigger Function with Pitch & LF Multipliers
CREATE OR REPLACE FUNCTION calculate_advanced_roofing_takeoff()
RETURNS TRIGGER AS $$
DECLARE
    gross_squares NUMERIC;
    waste_multiplier NUMERIC;
    pitch_rise INTEGER := 4;
    pitch_parts TEXT[];
    
    -- Material piece parameters
    lf_per_ice_roll NUMERIC := 65.0;        -- 3 ft x 66 ft roll (~65 net LF)
    lf_per_cap_bundle NUMERIC := 31.0;      -- 31 LF coverage per bundle
    lf_per_drip_edge NUMERIC := 9.0;        -- 10-ft stick with lap loss
    lf_per_starter_bundle NUMERIC := 105.0; -- Standard universal starter bundle
    
    -- Material unit price constants
    cost_per_shingle_bd NUMERIC := 38.50;
    cost_per_felt_roll NUMERIC := 95.00;
    cost_per_ice_roll NUMERIC := 85.00;
    cost_per_cap_bd NUMERIC := 58.00;
    cost_per_drip_piece NUMERIC := 12.50;
    cost_per_starter_bd NUMERIC := 45.00;

    -- Labor baseline rates (per SQ or per LF)
    base_install_rate_per_sq NUMERIC := 75.00;
    base_tearoff_rate_per_sq NUMERIC := 35.00;
    steep_mod_rate_per_sq NUMERIC := 0.00;
    valley_labor_rate_per_lf NUMERIC := 3.50;
BEGIN
    IF NEW."roofSquares" IS NOT NULL AND NEW."roofSquares" > 0 THEN

        -- Parse pitch string (e.g., '7/12' -> 7; default to 4 if unparseable)
        IF NEW."pitch" IS NOT NULL AND NEW."pitch" ~ '^[0-9]+/[0-9]+$' THEN
            pitch_parts := regexp_split_to_array(NEW."pitch", '/');
            pitch_rise := pitch_parts[1]::INTEGER;
        ELSE
            pitch_rise := 4;
        END IF;

        -- Determine waste factor: add 2% waste if roof has >12 facets (high cut loss)
        waste_multiplier := 1.0 + (COALESCE(NEW."wasteFactorPercent", 10.0) / 100.0);
        IF COALESCE(NEW."facetsCount", 1) > 12 THEN
            waste_multiplier := waste_multiplier + 0.02;
        END IF;

        gross_squares := NEW."roofSquares" * waste_multiplier;

        -- 1. MATERIAL TAKEOFF CALCULATIONS
        -- Field shingles (3 bundles per square)
        NEW."shingleBundlesNeeded" := CEIL(gross_squares * 3.0);
        
        -- Synthetic underlayment (10 squares net coverage per roll)
        NEW."underlaymentRollsNeeded" := CEIL(gross_squares / 10.0);

        -- Hip & Ridge Cap Bundles (from ridge LF)
        IF COALESCE(NEW."ridgeLinearFeet", 0) > 0 THEN
            NEW."ridgeCapBundlesNeeded" := CEIL(NEW."ridgeLinearFeet" / lf_per_cap_bundle);
        ELSE
            NEW."ridgeCapBundlesNeeded" := CEIL(NEW."roofSquares" * 0.3); -- Fallback rule of thumb
        END IF;

        -- Ice & Water Shield (Valleys LF + 3ft perimeter along eaves)
        IF COALESCE(NEW."valleyLinearFeet", 0) > 0 THEN
            NEW."iceAndWaterRollsNeeded" := CEIL(NEW."valleyLinearFeet" / lf_per_ice_roll);
        ELSE
            NEW."iceAndWaterRollsNeeded" := 1;
        END IF;

        -- Drip Edge Sticks (Perimeter LF / 9 LF net coverage)
        IF COALESCE(NEW."perimeterLinearFeet", 0) > 0 THEN
            NEW."dripEdgePiecesNeeded" := CEIL(NEW."perimeterLinearFeet" / lf_per_drip_edge);
            NEW."starterBundlesNeeded" := CEIL(NEW."perimeterLinearFeet" / lf_per_starter_bundle);
        ELSE
            NEW."dripEdgePiecesNeeded" := CEIL(NEW."roofSquares" * 1.5);
            NEW."starterBundlesNeeded" := CEIL(NEW."roofSquares" * 0.4);
        END IF;

        -- Roll up total estimated material cost
        NEW."estimatedMaterialCost" := 
            (NEW."shingleBundlesNeeded" * cost_per_shingle_bd) +
            (NEW."underlaymentRollsNeeded" * cost_per_felt_roll) +
            (NEW."iceAndWaterRollsNeeded" * cost_per_ice_roll) +
            (NEW."ridgeCapBundlesNeeded" * cost_per_cap_bd) +
            (NEW."dripEdgePiecesNeeded" * cost_per_drip_piece) +
            (NEW."starterBundlesNeeded" * cost_per_starter_bd);

        -- 2. LABOR MULTIPLIER & ADDER CALCULATIONS
        -- Pitch tiered adder: 7/12-9/12 is steep (+15/sq); 10/12+ is extreme steep (+25/sq)
        IF pitch_rise >= 10 THEN
            steep_mod_rate_per_sq := 25.00;
        ELSIF pitch_rise >= 7 THEN
            steep_mod_rate_per_sq := 15.00;
        ELSE
            steep_mod_rate_per_sq := 0.00;
        END IF;

        NEW."steepLaborMultiplierCost" := NEW."roofSquares" * steep_mod_rate_per_sq;

        -- Valley labor cutting & flashing adder ($3.50 per LF)
        NEW."valleyLaborAdderCost" := COALESCE(NEW."valleyLinearFeet", 0) * valley_labor_rate_per_lf;

        -- Total labor payout baseline
        NEW."totalCrewPayout" := 
            (NEW."roofSquares" * base_install_rate_per_sq) +
            (NEW."roofSquares" * base_tearoff_rate_per_sq * COALESCE(NEW."layers", 1)) +
            NEW."steepLaborMultiplierCost" +
            NEW."valleyLaborAdderCost";

        -- 3. AUTO-POPULATE PROPOSAL TIERS (Good / Better / Best)
        -- Good Tier = (Estimated Materials + Total Labor) * 1.65 (35% Gross Margin)
        -- Better Tier = Good Tier * 1.18
        -- Best Tier = Good Tier * 1.40
        NEW."tierGoodPrice" := ROUND((NEW."estimatedMaterialCost" + NEW."totalCrewPayout") * 1.65);
        NEW."tierBetterPrice" := ROUND(NEW."tierGoodPrice" * 1.18);
        NEW."tierBestPrice" := ROUND(NEW."tierGoodPrice" * 1.40);

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-attach the trigger to Opportunity
DROP TRIGGER IF EXISTS trg_calculate_advanced_roofing_takeoff ON "opportunity";
DROP TRIGGER IF EXISTS trg_calculate_roofing_estimate ON "opportunity";

CREATE TRIGGER trg_calculate_advanced_roofing_takeoff
BEFORE INSERT OR UPDATE OF 
    "roofSquares", "pitch", "wasteFactorPercent", "facetsCount",
    "valleyLinearFeet", "ridgeLinearFeet", "perimeterLinearFeet", "layers"
ON "opportunity"
FOR EACH ROW
EXECUTE FUNCTION calculate_advanced_roofing_takeoff();

-- 4. Stored Trigger Function to Compute Real-Time Margins (JobNimbus Profit Tracker)
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

-- Attach Profitability Trigger to Opportunity updates
DROP TRIGGER IF EXISTS trg_calculate_job_profitability ON "opportunity";
CREATE TRIGGER trg_calculate_job_profitability
BEFORE INSERT OR UPDATE OF "amount", "actualMaterialCost", "actualLaborCost", "totalCrewPayout", "estimatedMaterialCost", "selectedTier", "tierGoodPrice", "tierBetterPrice", "tierBestPrice"
ON "opportunity"
FOR EACH ROW
EXECUTE FUNCTION calculate_job_profitability();

-- 5. Add Insurance Claim Restoration Fields to Opportunity
ALTER TABLE "opportunity"
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

-- Stored Trigger Function to Compute Insurance Claim Financials (RCV, ACV, Depreciation, Supplements)
CREATE OR REPLACE FUNCTION calculate_insurance_claim_financials()
RETURNS TRIGGER AS $$
DECLARE
    initial_rcv NUMERIC := COALESCE(NEW."rcvInitialAmount", 0);
    initial_acv NUMERIC := COALESCE(NEW."acvInitialAmount", 0);
    supp_requested NUMERIC := COALESCE(NEW."supplementRequestedAmount", 0);
    supp_approved NUMERIC := COALESCE(NEW."supplementApprovedAmount", 0);
    deductible NUMERIC := COALESCE(NEW."deductibleAmount", 1000);
BEGIN
    -- 1. Total Final RCV = Original RCV + Approved Supplements
    NEW."totalClaimRcv" := initial_rcv + supp_approved;

    -- 2. Recoverable Depreciation = RCV - ACV
    IF initial_rcv > 0 AND initial_acv > 0 THEN
        NEW."depreciationAmount" := GREATEST(initial_rcv - initial_acv, 0);
    END IF;

    -- 3. Update primary Opportunity amount to match total approved contract value
    IF NEW."totalClaimRcv" > 0 THEN
        NEW."amount" := NEW."totalClaimRcv";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to Opportunity table
DROP TRIGGER IF EXISTS trg_calculate_insurance_claim_financials ON "opportunity";

CREATE TRIGGER trg_calculate_insurance_claim_financials
BEFORE INSERT OR UPDATE OF 
    "rcvInitialAmount", "acvInitialAmount", "deductibleAmount", 
    "supplementRequestedAmount", "supplementApprovedAmount"
ON "opportunity"
FOR EACH ROW
EXECUTE FUNCTION calculate_insurance_claim_financials();



-- ==============================================================================
-- STEP 2: CONFIGURE WORK ORDERS FOR SUBCONTRACTOR DISPATCH
-- Stripped-down production dispatch hiding all sales prices & margins
-- ==============================================================================

-- Enhance work_order table with standard dispatch fields
ALTER TABLE "work_order"
  ADD COLUMN IF NOT EXISTS "scheduledStartDate" DATE,
  ADD COLUMN IF NOT EXISTS "tearOffDumpsterCompany" VARCHAR(150) DEFAULT 'Waste Management / Local Roll-Off',
  ADD COLUMN IF NOT EXISTS "deliveryStagedLocation" VARCHAR(50) DEFAULT 'DRIVEWAY', -- DRIVEWAY, GROUND, ROOFTOP
  ADD COLUMN IF NOT EXISTS "specialCrewInstructions" TEXT DEFAULT 'Protect landscaping and A/C unit with plywood. Magnetic sweep driveway & yard after tear-off and final cleanup.',
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, DISPATCHED, IN_PROGRESS, COMPLETED
  ADD COLUMN IF NOT EXISTS "subcontractorPersonId" UUID REFERENCES "person"("id") ON DELETE SET NULL;

-- 2. Build the Safe Crew View (Hides customer pricing, profits, and margins)
CREATE OR REPLACE VIEW "view_crew_work_order_dispatch" AS
SELECT 
  wo."id" AS "workOrderId",
  wo."workOrderNumber",
  wo."status",
  wo."scheduledStartDate",
  j."jobNumber",
  j."propertyAddress" AS "jobAddress",
  j."homeownerName",
  j."homeownerPhone",
  COALESCE(j."roofSquares", o."roofSquares", 0.00) AS "roofSquares",
  COALESCE(o."pitch", '4/12') AS "pitch",
  COALESCE(o."layers", 1) AS "layers",
  COALESCE(j."materialType", o."materialType", 'ARCHITECTURAL_SHINGLE') AS "materialType",
  COALESCE(o."shingleBundlesNeeded", CEIL(COALESCE(j."roofSquares", 0) * 3.3)) AS "shingleBundlesNeeded",
  COALESCE(o."underlaymentRollsNeeded", CEIL(COALESCE(j."roofSquares", 0) * 0.11)) AS "underlaymentRollsNeeded",
  wo."deliveryStagedLocation",
  wo."tearOffDumpsterCompany",
  wo."specialCrewInstructions",
  COALESCE(j."companycamUrl", o."companycamUrl") AS "companycamUrl",
  p."name"->>'firstName' || ' ' || COALESCE(p."name"->>'lastName', '') AS "assignedCrewLead",
  wo."createdAt" AS "dispatchedAt"
FROM "work_order" wo
JOIN "job" j ON j."id" = wo."jobId"
LEFT JOIN "opportunity" o ON o."id" = j."opportunityId"
LEFT JOIN "person" p ON p."id" = wo."subcontractorPersonId";


-- ==============================================================================
-- STEP 3: IMPLEMENT MATERIAL DELIVERY CHECKLISTS & MATERIAL ORDER OBJECT
-- Tracks supplier POs, delivery status, and CompanyCam pre-tear-off drop verification
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "material_order" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,

  -- Many-to-One relation to Job
  "jobId" UUID NOT NULL REFERENCES "job"("id") ON DELETE CASCADE,
  
  -- Supplier Information
  "supplier" VARCHAR(100) NOT NULL DEFAULT 'ABC Supply', -- ABC Supply, Beacon Building Products, SRS Distribution
  "poNumber" VARCHAR(100) NOT NULL,
  
  -- Order Status Lifecycle
  "orderStatus" VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, DELIVERED, CANCELLED
  "dropDate" DATE,
  "stagedLocation" VARCHAR(50) DEFAULT 'ROOFTOP', -- ROOFTOP, DRIVEWAY, GROUND
  
  -- Verification Gate
  "deliveryVerifiedViaCompanyCam" BOOLEAN DEFAULT false,
  "verifiedByWorkspaceMember" VARCHAR(150),
  "verifiedAt" TIMESTAMP WITH TIME ZONE,
  
  "deliveryNotes" TEXT DEFAULT 'Supplier confirmed roof-load delivery. Verify bundle counts against delivery ticket.'
);

CREATE INDEX IF NOT EXISTS "idx_material_order_job_id" ON "material_order"("jobId");
CREATE INDEX IF NOT EXISTS "idx_material_order_status" ON "material_order"("orderStatus");


-- ==============================================================================
-- STEP 4: VERIFICATION & UNIT TEST SCRIPT
-- ==============================================================================

-- Test function to confirm that 28 squares with 10% waste evaluates to 93 bundles
DO $$
DECLARE
  v_test_opp_id UUID := gen_random_uuid();
  v_bundles INT;
  v_rolls INT;
  v_cost NUMERIC;
BEGIN
  -- 1. Create a dummy test opportunity
  INSERT INTO "opportunity" (
    "id",
    "name",
    "stage",
    "roofSquares",
    "wasteFactorPercent"
  ) VALUES (
    v_test_opp_id,
    'QA Test - 28 Squares Verification',
    'NEW_LEAD',
    28.00,
    10.00
  );

  -- 2. Inspect computed values
  SELECT 
    "shingleBundlesNeeded",
    "underlaymentRollsNeeded",
    "estimatedMaterialCost"
  INTO v_bundles, v_rolls, v_cost
  FROM "opportunity"
  WHERE "id" = v_test_opp_id;

  -- 3. Assertions (28 * 1.10 = 30.8; 30.8 * 3 = 92.4 -> CEIL is 93 bundles)
  IF v_bundles = 93 AND v_rolls = 4 THEN
    RAISE NOTICE '✓ VERIFICATION PASSED: 28 Squares @ 10%% waste = % bundles (expected 93), % underlayment rolls (expected 4), $% estimated cost',
      v_bundles, v_rolls, v_cost;
  ELSE
    RAISE EXCEPTION '✗ VERIFICATION FAILED: Expected 93 bundles, got %', v_bundles;
  END IF;

  -- 4. Clean up test record
  DELETE FROM "opportunity" WHERE "id" = v_test_opp_id;
END;
$$;

SELECT 'Automated Roofing Estimator, Work Order Crew Dispatch & Material Order Checklists compiled successfully.' AS status;
