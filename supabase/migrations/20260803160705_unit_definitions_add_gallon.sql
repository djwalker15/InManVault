-- Add a first-class gallon unit. Receipts previously aliased "gal" to L
-- label-only (no rescale), silently under-counting by 3.785x.
-- 1 gal = 128 fl_oz (volume base unit since 20260501153000).
insert into public.unit_definitions (unit, unit_category, base_unit, to_base_factor)
values ('gal', 'volume', 'fl_oz', 128);
