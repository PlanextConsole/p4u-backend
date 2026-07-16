-- Preserve legacy rows while enforcing valid City -> Area references going forward.
UPDATE classified_available_areas area
SET city_id = NULL
WHERE city_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM classified_available_cities city WHERE city.id = area.city_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_classified_available_areas_city'
  ) THEN
    ALTER TABLE classified_available_areas
      ADD CONSTRAINT fk_classified_available_areas_city
      FOREIGN KEY (city_id)
      REFERENCES classified_available_cities(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END
$$;
