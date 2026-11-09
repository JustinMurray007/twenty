-- ==============================================================================
-- 05_ADVANCED_AERIAL_TAKEOFF_TRIGGER.SQL
-- Advanced Aerial Measurements Takeoff Function & Dynamic Labor/Material Adders
-- (Squares, Pitch Multipliers, Valleys, Ridges, Perimeter, and Facet Complexity)
-- ==============================================================================

-- 1. Ensure all geometric & calculated fields exist on the Opportunity table
ALTER TABLE "opportunity"
ADD COLUMN IF NOT EXISTS "valleyLinearFeet" NUMERIC(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ridgeLinearFeet" NUMERIC(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "perimeterLinearFeet" NUMERIC(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "facetsCount" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "shingleBundlesNeeded" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "underlaymentRollsNeeded" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "iceAndWaterRollsNeeded" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ridgeCapBundlesNeeded" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dripEdgePiecesNeeded" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "starterBundlesNeeded" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "estimatedMaterialCost" NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "steepLaborMultiplierCost" NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "valleyLaborAdderCost" NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalCrewPayout" NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tierGoodPrice" NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS "tierBetterPrice" NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS "tierBestPrice" NUMERIC(10,2);

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
