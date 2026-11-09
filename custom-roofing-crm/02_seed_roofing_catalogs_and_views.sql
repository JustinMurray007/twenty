-- ==============================================================================
-- 02_SEED_ROOFING_CATALOGS_AND_VIEWS.SQL
-- Standard Roofing Material Pricebook & Takeoff Generation Stored Procedures
-- ==============================================================================

-- 1. MATERIAL PRICEBOOK CATALOG (Standard Contractor Cost & Retail Pricing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "roofing_material_catalog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" VARCHAR(50) NOT NULL, -- SHINGLES, UNDERLAYMENT, FLASHING, ACCESSORIES, LABOR, EQUIPMENT
  "itemCode" VARCHAR(50) UNIQUE NOT NULL,
  "itemName" VARCHAR(255) NOT NULL,
  "unit" VARCHAR(20) NOT NULL, -- SQ, BUNDLE, ROLL, LF, EA, BOX
  "coveragePerUnit" NUMERIC(8,2) NOT NULL DEFAULT 1.0, -- e.g. 1 bundle = 0.333 SQ (3 bundles per SQ)
  "defaultUnitCost" NUMERIC(10,2) NOT NULL,
  "defaultUnitPrice" NUMERIC(10,2) NOT NULL,
  "supplier" VARCHAR(100) DEFAULT 'ABC Supply / Beacon'
);

INSERT INTO "roofing_material_catalog" ("category", "itemCode", "itemName", "unit", "coveragePerUnit", "defaultUnitCost", "defaultUnitPrice")
VALUES
  ('SHINGLES', 'SHG-ARCH-TIMBERLINE', 'GAF Timberline HDZ Architectural Shingles (Bundle)', 'BUNDLE', 0.333, 38.50, 55.00),
  ('SHINGLES', 'SHG-STARTER-PRO-START', 'GAF Pro-Start Starter Strip Shingles (120 LF Roll)', 'ROLL', 120.0, 48.00, 72.00),
  ('SHINGLES', 'SHG-RIDGE-TIMBERTEX', 'GAF TimberTex Premium Ridge Cap (Bundle, 20 LF)', 'BUNDLE', 20.0, 58.00, 85.00),
  ('UNDERLAYMENT', 'UND-SYN-FELTBUSTER', 'GAF FeltBuster Synthetic Roofing Felt (10 SQ Roll)', 'ROLL', 10.0, 68.00, 110.00),
  ('UNDERLAYMENT', 'UND-ICE-WEATHERWATCH', 'GAF WeatherWatch Mineral Surfaced Ice & Water (2 SQ Roll)', 'ROLL', 2.0, 88.00, 145.00),
  ('FLASHING', 'FLS-DRIP-EDGE-T-STYLE', 'Aluminum Drip Edge T-Style 1.5in x 10ft White (Stick)', 'EA', 10.0, 8.50, 15.00),
  ('ACCESSORIES', 'ACC-PIPE-BOOT-NEOPRENE', 'Oatey Master Flash Flexible Neoprene Pipe Boot 1.5"-3"', 'EA', 1.0, 14.50, 32.00),
  ('ACCESSORIES', 'ACC-NAILS-COIL-1-1-4', '1-1/4" Electro-Galvanized Coil Roofing Nails (7,200/Box)', 'BOX', 25.0, 45.00, 75.00),
  ('LABOR', 'LAB-TEAROFF-INSTALL-1L', 'Tear-off 1 Layer & Install Shingles (Per SQ)', 'SQ', 1.0, 95.00, 165.00),
  ('EQUIPMENT', 'EQP-DUMPSTER-20YD', '20-Yard Roll-off Dumpster (4-ton allowance)', 'EA', 1.0, 475.00, 650.00),
  ('PERMIT', 'PER-MUNICIPAL-ROOF', 'City Building Permit & Municipal Inspection Fee', 'EA', 1.0, 175.00, 250.00)
ON CONFLICT ("itemCode") DO UPDATE 
SET "defaultUnitCost" = EXCLUDED."defaultUnitCost",
    "defaultUnitPrice" = EXCLUDED."defaultUnitPrice";


-- 2. STORED PROCEDURE: GENERATE ACCURATE LINE ITEMS FROM ROOF SQUARES
-- ------------------------------------------------------------------------------
-- Given an opportunity_id, this procedure wipes old draft line items and automatically
-- populates exact quantities and JobNimbus-style roofing material takeoff line items.

CREATE OR REPLACE FUNCTION sp_generate_roofing_estimate_line_items(
  p_opportunity_id UUID
)
RETURNS TABLE (
  items_created INTEGER,
  total_material_cost NUMERIC(12,2),
  total_estimate_price NUMERIC(12,2),
  gross_margin_percent NUMERIC(5,2)
) AS $$
DECLARE
  v_squares NUMERIC(8,2);
  v_waste NUMERIC(5,2);
  v_effective_squares NUMERIC(8,2);
  v_bundles INTEGER;
  v_felt_rolls INTEGER;
  v_ice_water_rolls INTEGER;
  v_ridge_bundles INTEGER;
  v_starter_rolls INTEGER;
  v_drip_edge_sticks INTEGER;
  v_nail_boxes INTEGER;
  v_layers INTEGER;
BEGIN
  -- Grab opportunity parameters
  SELECT 
    COALESCE("roofSquares", 0.0),
    COALESCE("wasteFactorPercent", 10.0),
    COALESCE("layers", 1)
  INTO v_squares, v_waste, v_layers
  FROM "opportunity"
  WHERE "id" = p_opportunity_id;

  IF v_squares <= 0 THEN
    RAISE EXCEPTION 'Opportunity must have roofSquares > 0 to generate takeoff line items.';
  END IF;

  -- Remove existing generated line items for this opportunity
  DELETE FROM "deal_line_item" WHERE "opportunityId" = p_opportunity_id;

  -- Math Takeoffs
  v_effective_squares := v_squares * (1.0 + (v_waste / 100.0));
  v_bundles           := CEIL(v_effective_squares * 3.0);
  v_felt_rolls        := GREATEST(1, CEIL(v_effective_squares / 10.0));
  v_ice_water_rolls   := GREATEST(1, CEIL(v_squares * 0.06));
  v_starter_rolls     := GREATEST(1, CEIL((v_squares * 1.6) / 120.0));
  v_ridge_bundles     := GREATEST(1, CEIL(v_squares / 7.0));
  v_drip_edge_sticks  := GREATEST(4, CEIL((v_squares * 1.8) / 10.0));
  v_nail_boxes        := GREATEST(1, CEIL(v_effective_squares / 25.0));

  -- 1. Main Shingles
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'GAF Timberline HDZ Shingles', 'MATERIAL', 'BUNDLE', v_bundles, 38.50, 55.00);

  -- 2. Starter Strip
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'Pro-Start Starter Strip Shingles', 'MATERIAL', 'ROLL', v_starter_rolls, 48.00, 72.00);

  -- 3. Synthetic Felt
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'FeltBuster Synthetic Underlayment', 'MATERIAL', 'ROLL', v_felt_rolls, 68.00, 110.00);

  -- 4. Ice & Water Shield
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'WeatherWatch Ice & Water Shield (Eaves & Valleys)', 'MATERIAL', 'ROLL', v_ice_water_rolls, 88.00, 145.00);

  -- 5. Hip & Ridge Cap
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'TimberTex Ridge Cap Shingles', 'MATERIAL', 'BUNDLE', v_ridge_bundles, 58.00, 85.00);

  -- 6. Drip Edge
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'Aluminum Drip Edge White (10ft sticks)', 'MATERIAL', 'EA', v_drip_edge_sticks, 8.50, 15.00);

  -- 7. Pipe Boots
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'Neoprene Plumbing Vent Pipe Flashings', 'ACCESSORIES', 'EA', 3, 14.50, 32.00);

  -- 8. Coil Nails
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, '1-1/4" Coil Roofing Nails', 'ACCESSORIES', 'BOX', v_nail_boxes, 45.00, 75.00);

  -- 9. Tear-Off & Installation Labor
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'Labor: Tear-Off (' || v_layers || ' Layer) & Full Installation', 'LABOR', 'SQ', v_squares, 95.00, 165.00);

  -- 10. Dumpster & Disposal
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, '20-Yard Roll-Off Waste Container & Disposal', 'EQUIPMENT', 'EA', 1, 475.00, 650.00);

  -- 11. Permit
  INSERT INTO "deal_line_item" ("opportunityId", "itemName", "category", "unit", "quantity", "unitCost", "unitPrice")
  VALUES (p_opportunity_id, 'Building Permit & Municipal Inspection Fee', 'PERMIT', 'EA', 1, 175.00, 250.00);

  -- Return Summary Rollup
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS items_created,
    SUM("totalCost") AS total_material_cost,
    SUM("totalPrice") AS total_estimate_price,
    ROUND(((SUM("totalPrice") - SUM("totalCost")) / NULLIF(SUM("totalPrice"), 0)) * 100.0, 2) AS gross_margin_percent
  FROM "deal_line_item"
  WHERE "opportunityId" = p_opportunity_id;

END;
$$ LANGUAGE plpgsql;


-- 3. REPORTING VIEW: ROOFING OPPORTUNITY ESTIMATING & PRODUCTION ROLLUP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW "view_roofing_opportunity_summary" AS
SELECT 
  o."id" AS "opportunityId",
  o."name" AS "opportunityName",
  o."stage" AS "salesStage",
  o."roofSquares",
  o."pitch",
  o."layers",
  o."materialType",
  o."totalBundles",
  o."syntheticFeltRolls",
  o."iceWaterShieldRolls",
  o."ridgeCapBundles",
  COALESCE(c."claimNumber", 'N/A') AS "insuranceClaimNumber",
  COALESCE(c."insuranceCarrier", 'Retail / Cash') AS "carrier",
  j."id" AS "productionJobId",
  j."stage" AS "productionStage",
  j."jobNumber",
  j."assignedSubcontractor",
  j."scheduledStartDate",
  COALESCE(SUM(dli."totalCost"), 0.00) AS "totalCalculatedCost",
  COALESCE(SUM(dli."totalPrice"), 0.00) AS "totalEstimatedPrice",
  COALESCE(SUM(dli."grossProfit"), 0.00) AS "estimatedGrossProfit",
  CASE 
    WHEN SUM(dli."totalPrice") > 0 
    THEN ROUND(((SUM(dli."totalPrice") - SUM(dli."totalCost")) / SUM(dli."totalPrice")) * 100.0, 2)
    ELSE 0.00
  END AS "estimatedGrossMarginPercent"
FROM "opportunity" o
LEFT JOIN "claim_info" c ON c."opportunityId" = o."id"
LEFT JOIN "job" j ON j."opportunityId" = o."id"
LEFT JOIN "deal_line_item" dli ON dli."opportunityId" = o."id"
GROUP BY o."id", o."name", o."stage", o."roofSquares", o."pitch", o."layers", o."materialType",
         o."totalBundles", o."syntheticFeltRolls", o."iceWaterShieldRolls", o."ridgeCapBundles",
         c."claimNumber", c."insuranceCarrier", j."id", j."stage", j."jobNumber", j."assignedSubcontractor", j."scheduledStartDate";
