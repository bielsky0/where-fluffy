-- Backfill photoUrls from the legacy single photoUrl column so existing pet reports don't
-- start with an empty gallery.
UPDATE "Pet" SET "photoUrls" = ARRAY["photoUrl"] WHERE "photoUrl" IS NOT NULL AND "photoUrl" <> '';
