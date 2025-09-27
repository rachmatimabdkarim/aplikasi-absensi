-- =============================================
-- SETUP DATABASE UNTUK APLIKASI ABSENSI PPNPN
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offices table
CREATE TABLE offices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    nik VARCHAR(16) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    unit_kerja TEXT,
    phone VARCHAR(15),
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attendance table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_location TEXT,
    check_out_location TEXT,
    check_in_latitude DECIMAL(10, 8),
    check_in_longitude DECIMAL(11, 8),
    check_out_latitude DECIMAL(10, 8),
    check_out_longitude DECIMAL(11, 8),
    work_hours DECIMAL(4, 2),
    status TEXT DEFAULT 'absent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Create policies for organizations
CREATE POLICY "Users can view own organization" 
ON organizations FOR SELECT USING (
    id IN (SELECT organization_id FROM employees WHERE user_id = auth.uid())
);

-- Create policies for offices
CREATE POLICY "Users can view own office data" 
ON offices FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM employees WHERE user_id = auth.uid())
);

-- Create policies for employees
CREATE POLICY "Users can view own employee data" 
ON employees FOR SELECT USING (
    user_id = auth.uid() OR 
    organization_id IN (SELECT organization_id FROM employees WHERE user_id = auth.uid())
);

-- Create policies for attendance
CREATE POLICY "Users can view own attendance" 
ON attendance FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own attendance" 
ON attendance FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own attendance" 
ON attendance FOR UPDATE USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- =============================================
-- SAMPLE DATA UNTUK TESTING
-- =============================================

-- Insert sample organization
INSERT INTO organizations (name) VALUES ('Kantor Guru dan Tenaga Kependidikan Provinsi Maluku Utara');

-- Insert sample office (Koordinat untuk Sofifi, Maluku Utara)
INSERT INTO offices (organization_id, name, address, latitude, longitude, radius_meters) 
VALUES (
    (SELECT id FROM organizations LIMIT 1),
    'Kantor GTK Provinsi Maluku Utara',
    'Jl. Raya Sofifi, Maluku Utara',
    1.2379,
    127.5669,
    500
);

-- Insert sample employees (akan diisi setelah user register)
-- Note: user_id akan terisi otomatis setelah user register melalui aplikasi

-- =============================================
-- FUNGSI UTILITY TAMBAHAN
-- =============================================

-- Function untuk menghitung total jam kerja bulanan
CREATE OR REPLACE FUNCTION calculate_monthly_hours(employee_uuid UUID, month_date DATE)
RETURNS DECIMAL AS $$
DECLARE
    total_hours DECIMAL;
BEGIN
    SELECT COALESCE(SUM(work_hours), 0)
    INTO total_hours
    FROM attendance
    WHERE employee_id = employee_uuid
    AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM month_date)
    AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM month_date);
    
    RETURN total_hours;
END;
$$ LANGUAGE plpgsql;

-- Function untuk mendapatkan status kehadiran hari ini
CREATE OR REPLACE FUNCTION get_today_status(employee_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    today_record RECORD;
BEGIN
    SELECT * INTO today_record
    FROM attendance
    WHERE employee_id = employee_uuid
    AND date = CURRENT_DATE;
    
    IF today_record IS NULL THEN
        RETURN 'absent';
    ELSIF today_record.check_in_time IS NOT NULL AND today_record.check_out_time IS NOT NULL THEN
        RETURN 'present';
    ELSIF today_record.check_in_time IS NOT NULL THEN
        -- Check if late
        IF EXTRACT(HOUR FROM today_record.check_in_time) > 8 THEN
            RETURN 'late';
        ELSE
            RETURN 'present';
        END IF;
    ELSE
        RETURN 'absent';
    END IF;
END;
$$ LANGUAGE plpgsql;