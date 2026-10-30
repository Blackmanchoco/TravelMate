ALTER TYPE "AdminAuditAction" ADD VALUE 'PLACE_CREATED';
ALTER TYPE "AdminAuditAction" ADD VALUE 'PLACE_RESTORED';

ALTER TABLE "places"
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "displayTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "places_destinationId_normalized_name_key"
  ON "places" ("destinationId", lower(btrim(name)));
