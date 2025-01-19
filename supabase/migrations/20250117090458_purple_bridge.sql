/*
  # Partners Module Schema

  1. New Tables
    - `partners`
      - Company details
      - Contact information
      - Partner type and certification
    - `partner_service_areas`
      - Service areas for delivery subcontractors
  
  2. Changes
    - Added partner-specific fields and constraints
    - Added service areas relationship
*/

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Company Details
  company_name text NOT NULL,
  headquarter_country text NOT NULL,
  website text,
  region text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  is_sales_partner boolean DEFAULT false,
  is_delivery_subcontractor boolean DEFAULT false,
  company_human_id text UNIQUE NOT NULL,
  -- Contact Details
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text,
  -- Sales Partner Fields
  certification_level text CHECK (certification_level IN ('platinum', 'gold', 'silver', 'bronze')),
  revenue_sharing_percentage numeric CHECK (revenue_sharing_percentage >= 0 AND revenue_sharing_percentage <= 100),
  -- Delivery Subcontractor Fields
  certifications text[],
  compliance_info text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Constraints
  CONSTRAINT partner_type_check CHECK (is_sales_partner = true OR is_delivery_subcontractor = true)
);

-- Create partner service areas table
CREATE TABLE IF NOT EXISTS partner_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  service_area text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, service_area)
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();