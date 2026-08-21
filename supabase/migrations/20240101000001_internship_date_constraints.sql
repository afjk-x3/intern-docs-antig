-- 20240101000001_internship_date_constraints.sql

ALTER TABLE public.users
ADD CONSTRAINT chk_internship_dates_order
CHECK (
  (internship_start IS NULL AND internship_end IS NULL) OR
  (internship_start IS NOT NULL AND internship_end IS NOT NULL AND internship_end > internship_start)
);

ALTER TABLE public.users
ADD CONSTRAINT chk_internship_duration
CHECK (
  (internship_start IS NULL AND internship_end IS NULL) OR
  (internship_start IS NOT NULL AND internship_end IS NOT NULL AND internship_end <= internship_start + INTERVAL '12 months')
);
