-- Preserve legacy rows while enforcing valid City -> Area references going forward.
UPDATE classified_available_areas area
LEFT JOIN classified_available_cities city ON city.id = area.city_id
SET area.city_id = NULL
WHERE area.city_id IS NOT NULL AND city.id IS NULL;

SET @cf_area_city_fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'FK_classified_available_areas_city'
);
SET @cf_area_city_fk_sql = IF(
  @cf_area_city_fk_exists = 0,
  'ALTER TABLE classified_available_areas ADD CONSTRAINT FK_classified_available_areas_city FOREIGN KEY (city_id) REFERENCES classified_available_cities(id) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE cf_area_city_fk_statement FROM @cf_area_city_fk_sql;
EXECUTE cf_area_city_fk_statement;
DEALLOCATE PREPARE cf_area_city_fk_statement;
