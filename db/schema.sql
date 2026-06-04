CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE,
  name text NOT NULL,
  department text DEFAULT '',
  job_title text DEFAULT '',
  phone text DEFAULT '',
  hire_date date,
  bank_account text DEFAULT '',
  monthly_salary numeric(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
  allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (allowance >= 0),
  qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code text UNIQUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (allowance >= 0);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  local_date date NOT NULL,
  local_time time(0) NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late')),
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  deduction numeric(12, 2) NOT NULL DEFAULT 0 CHECK (deduction >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, local_date)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('center_name', 'مركز أستاذ حسن فلاح'),
  ('timezone', 'Asia/Baghdad'),
  ('currency', 'IQD'),
  ('late_after_time', '09:00:00'),
  ('late_deduction_per_minute', '0'),
  ('workdays_per_month', '26')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS attendance_records_local_date_idx ON attendance_records(local_date);
CREATE INDEX IF NOT EXISTS attendance_records_employee_date_idx ON attendance_records(employee_id, local_date);
CREATE INDEX IF NOT EXISTS employees_active_idx ON employees(active);
CREATE INDEX IF NOT EXISTS employees_department_idx ON employees(department);
CREATE INDEX IF NOT EXISTS employees_employee_code_idx ON employees(employee_code);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_set_updated_at ON employees;
CREATE TRIGGER employees_set_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON app_settings;
CREATE TRIGGER app_settings_set_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
