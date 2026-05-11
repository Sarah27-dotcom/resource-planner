-- PostgreSQL Assignments Database Schema
-- For Vercel Postgres / Supabase

-- Tabel assignments (PostgreSQL syntax)
CREATE TABLE IF NOT EXISTS assignments (
  uuid VARCHAR(36) PRIMARY KEY,
  employee_uuid VARCHAR(36) NOT NULL,
  project_uuid VARCHAR(36),
  task_uuid VARCHAR(36),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours_per_day DECIMAL(4,2) DEFAULT 8.00,
  allocation_percentage DECIMAL(5,2),
  is_time_off BOOLEAN DEFAULT FALSE,
  is_adjustment BOOLEAN DEFAULT FALSE,
  time_off_type_uuid VARCHAR(36),
  category VARCHAR(100),
  is_billable BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'confirmed',
  note TEXT,
  total_hours DECIMAL(10, 2) DEFAULT NULL,
  created_by_uuid VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON assignments(employee_uuid);
CREATE INDEX IF NOT EXISTS idx_assignments_project ON assignments(project_uuid);
CREATE INDEX IF NOT EXISTS idx_assignments_dates ON assignments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_employee_dates ON assignments(employee_uuid, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_assignments_adjustment ON assignments(is_adjustment);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Tabel actual (untuk actual assignments jika diperlukan)
CREATE TABLE IF NOT EXISTS actual (
  uuid VARCHAR(36) PRIMARY KEY,
  employee_uuid VARCHAR(36) NOT NULL,
  project_uuid VARCHAR(36),
  task_uuid VARCHAR(36),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours_per_day DECIMAL(4,2) DEFAULT 8.00,
  total_hours DECIMAL(8,2),
  allocation_percentage DECIMAL(5,2),
  is_time_off BOOLEAN DEFAULT FALSE,
  time_off_type_uuid VARCHAR(36),
  category VARCHAR(100),
  is_billable BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'confirmed',
  note TEXT,
  created_by_uuid VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for actual table
CREATE INDEX IF NOT EXISTS idx_actual_employee ON actual(employee_uuid);
CREATE INDEX IF NOT EXISTS idx_actual_project ON actual(project_uuid);
CREATE INDEX IF NOT EXISTS idx_actual_dates ON actual(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_actual_status ON actual(status);
CREATE INDEX IF NOT EXISTS idx_actual_employee_dates ON actual(employee_uuid, start_date, end_date);

-- Trigger for actual table updated_at
DROP TRIGGER IF EXISTS update_actual_updated_at ON actual;
CREATE TRIGGER update_actual_updated_at
  BEFORE UPDATE ON actual
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
