-- Add first-class quart and pint units, completing the gallon follow-up
-- (20260803160705). Receipt lines with "QT"/"PT" previously passed through
-- unrecognized and required manual conversion.
-- 1 qt = 32 fl_oz, 1 pt = 16 fl_oz (volume base unit since 20260501153000).
insert into public.unit_definitions (unit, unit_category, base_unit, to_base_factor)
values
  ('qt', 'volume', 'fl_oz', 32),
  ('pt', 'volume', 'fl_oz', 16);
