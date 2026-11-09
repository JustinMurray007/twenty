-- ==============================================================================
-- 03_COMPANYCAM_SCHEMA_AND_TRIGGERS.SQL
-- CompanyCam Visual Asset Layer Integration for Twenty CRM
-- ==============================================================================

-- 1. ADD COMPANYCAM COLUMNS TO OPPORTUNITY (SALES PIPELINE)
-- ------------------------------------------------------------------------------
ALTER TABLE "opportunity"
  ADD COLUMN IF NOT EXISTS "companycamProjectId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "companycamUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "companycamShareLink" TEXT,
  ADD COLUMN IF NOT EXISTS "companycamPhotoCount" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "companycamCoverPhotoUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_opp_companycam_project_id" 
  ON "opportunity"("companycamProjectId") 
  WHERE "companycamProjectId" IS NOT NULL;


-- 2. ADD COMPANYCAM COLUMNS TO JOB (PRODUCTION PIPELINE)
-- ------------------------------------------------------------------------------
ALTER TABLE "job"
  ADD COLUMN IF NOT EXISTS "companycamProjectId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "companycamUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "companycamShareLink" TEXT,
  ADD COLUMN IF NOT EXISTS "companycamPhotoCount" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "companycamCoverPhotoUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_job_companycam_project_id" 
  ON "job"("companycamProjectId") 
  WHERE "companycamProjectId" IS NOT NULL;


-- 3. OPTIONAL CACHED PHOTO STREAM TABLE
-- Keeps photo metadata (URLs, timestamps, tags, coordinates) for instant display
-- without bloating local storage (actual images stay hosted on CompanyCam's CDN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "companycam_photo" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  
  "companycamPhotoId" VARCHAR(100) UNIQUE NOT NULL,
  "companycamProjectId" VARCHAR(100) NOT NULL,
  "opportunityId" UUID REFERENCES "opportunity"("id") ON DELETE SET NULL,
  "jobId" UUID REFERENCES "job"("id") ON DELETE SET NULL,
  
  -- CompanyCam CDN URLs
  "thumbnailUrl" TEXT NOT NULL,
  "previewUrl" TEXT NOT NULL,
  "originalUrl" TEXT NOT NULL,
  
  -- Metadata & Field Verification
  "capturedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "creatorName" VARCHAR(150),
  "latitude" NUMERIC(10,7),
  "longitude" NUMERIC(10,7),
  "altitude" NUMERIC(8,2),
  "hasAnnotations" BOOLEAN DEFAULT false,
  
  -- Tags (e.g. ['Pre-Inspection', 'Hail Damage', 'Tear-Off', 'Decking', 'Ice & Water', 'Final'])
  "tags" JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS "idx_cc_photo_project" ON "companycam_photo"("companycamProjectId");
CREATE INDEX IF NOT EXISTS "idx_cc_photo_opp" ON "companycam_photo"("opportunityId");
CREATE INDEX IF NOT EXISTS "idx_cc_photo_job" ON "companycam_photo"("jobId");


-- 4. TRIGGER: PROPAGATE COMPANYCAM PROJECT FROM OPPORTUNITY TO PRODUCTION JOB
-- ------------------------------------------------------------------------------
-- When a production Job is created from a signed Opportunity, copy the CompanyCam
-- project ID and URLs so production crew immediately has all pre-existing photos.

CREATE OR REPLACE FUNCTION fn_sync_companycam_to_production_job()
RETURNS TRIGGER AS $$
DECLARE
  v_cc_id VARCHAR(100);
  v_cc_url TEXT;
  v_cc_share TEXT;
  v_cc_count INTEGER;
  v_cc_cover TEXT;
BEGIN
  -- Grab CompanyCam credentials from the parent opportunity
  SELECT 
    "companycamProjectId",
    "companycamUrl",
    "companycamShareLink",
    "companycamPhotoCount",
    "companycamCoverPhotoUrl"
  INTO 
    v_cc_id, v_cc_url, v_cc_share, v_cc_count, v_cc_cover
  FROM "opportunity"
  WHERE "id" = NEW."opportunityId";

  IF v_cc_id IS NOT NULL THEN
    NEW."companycamProjectId"      := v_cc_id;
    NEW."companycamUrl"            := v_cc_url;
    NEW."companycamShareLink"      := v_cc_share;
    NEW."companycamPhotoCount"     := COALESCE(v_cc_count, 0);
    NEW."companycamCoverPhotoUrl"  := v_cc_cover;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_companycam_to_production_job ON "job";

CREATE TRIGGER trg_sync_companycam_to_production_job
BEFORE INSERT ON "job"
FOR EACH ROW
EXECUTE FUNCTION fn_sync_companycam_to_production_job();

SELECT 'CompanyCam integration schema and synchronization triggers compiled successfully.' AS status;
