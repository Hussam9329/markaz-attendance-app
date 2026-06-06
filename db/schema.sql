CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sequence for auto-generating employee codes HF_Employee_001, HF_Employee_002, ...
CREATE SEQUENCE IF NOT EXISTS employee_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_employee_code()
RETURNS text AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('employee_code_seq');
  RETURN 'HF_Employee_' || lpad(next_val::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE DEFAULT next_employee_code(),
  name text NOT NULL,
  employee_type text NOT NULL DEFAULT 'center' CHECK (employee_type IN ('center', 'crew')),
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

-- Migrations for existing databases
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code text UNIQUE DEFAULT next_employee_code();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_type text NOT NULL DEFAULT 'center' CHECK (employee_type IN ('center', 'crew'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (allowance >= 0);

-- Update existing employees that have no code to get one
UPDATE employees SET employee_code = next_employee_code() WHERE employee_code IS NULL;

-- Update existing employees that have no type
UPDATE employees SET employee_type = 'center' WHERE employee_type IS NULL OR employee_type = '';

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  local_date date NOT NULL,
  local_time time(0) NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent')),
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  deduction numeric(12, 2) NOT NULL DEFAULT 0 CHECK (deduction >= 0),
  source text NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, local_date)
);

-- Migration: add source column for existing databases
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'manual'));

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
CREATE INDEX IF NOT EXISTS employees_employee_type_idx ON employees(employee_type);

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
