--
-- 1. Extensions & Setup
--    Make sure pgcrypto is available for gen_random_uuid() & crypt().
--
CREATE EXTENSION IF NOT EXISTS pgcrypto;

--
-- 2. Drop existing objects in correct dependency order.
--    (So this script can run idempotently if desired.)
--
DROP VIEW  IF EXISTS milestone_status_history_view       CASCADE;
DROP VIEW  IF EXISTS task_status_history_view            CASCADE;
DROP VIEW  IF EXISTS contract_details_view               CASCADE;
DROP VIEW  IF EXISTS active_environments_view            CASCADE;
DROP VIEW  IF EXISTS environments_view                   CASCADE;
DROP VIEW  IF EXISTS review_details_view                 CASCADE;
DROP VIEW  IF EXISTS offer_review_details_view           CASCADE;
DROP VIEW  IF EXISTS review_history_view                 CASCADE;
DROP VIEW  IF EXISTS project_details_view                CASCADE;

-- Tables that depend on each other in reverse order:
DROP TABLE IF EXISTS task_status_history                 CASCADE;
DROP TABLE IF EXISTS milestone_status_history            CASCADE;
DROP TABLE IF EXISTS project_tasks                       CASCADE;
DROP TABLE IF EXISTS project_team_members                CASCADE;
DROP TABLE IF EXISTS payment_milestones                  CASCADE;
DROP TABLE IF EXISTS projects                            CASCADE;

DROP TABLE IF EXISTS contract_documents                  CASCADE;
DROP TABLE IF EXISTS contracts                           CASCADE;

DROP TABLE IF EXISTS offer_environment_components        CASCADE;
DROP TABLE IF EXISTS environment_bpaas_details           CASCADE;
DROP TABLE IF EXISTS offer_environments                  CASCADE;

DROP TABLE IF EXISTS offer_service_components            CASCADE;
DROP TABLE IF EXISTS offer_service_sets                  CASCADE;

DROP TABLE IF EXISTS offer_document_records              CASCADE;
DROP TABLE IF EXISTS offer_partner_records               CASCADE;
DROP TABLE IF EXISTS offer_records                       CASCADE;

DROP TABLE IF EXISTS opportunity_document_records        CASCADE;
DROP TABLE IF EXISTS opportunity_status_history          CASCADE;
DROP TABLE IF EXISTS opportunity_records                 CASCADE;

DROP TABLE IF EXISTS partner_documents                   CASCADE;
DROP TABLE IF EXISTS partner_service_areas               CASCADE;
DROP TABLE IF EXISTS partners                            CASCADE;

DROP TABLE IF EXISTS customers                           CASCADE;
DROP TABLE IF EXISTS services                            CASCADE;
DROP TABLE IF EXISTS license_pricing                     CASCADE;

DROP TABLE IF EXISTS offer_review_history                CASCADE;
DROP TABLE IF EXISTS offer_review_documents              CASCADE;
DROP TABLE IF EXISTS offer_reviews                       CASCADE;
DROP TABLE IF EXISTS offer_review_requests               CASCADE;

-- Finally, drop the 'users' table to rebuild
DROP TABLE IF EXISTS users                               CASCADE;

--
-- 3. Create final "users" table (public) and seed the admin user
--    (No RLS in final state, as per your last migrations).
--
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  email            text UNIQUE NOT NULL,
  role             text        NOT NULL,
  password         text        NOT NULL,
  user_human_id    text UNIQUE NOT NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  last_login       timestamptz
);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION update_users_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at_column();

--
-- Create or update the default admin user in public.users and auth.users
--   1) Ensure an admin user with email = 'admin@mail.com'
--   2) Use bcrypt for the password
--   3) role in public.users = 'admin'
--   4) Supabase side (auth.users) with metadata marking them as admin
--
DO $$
DECLARE
  admin_email     constant text := 'admin@mail.com';
  admin_id        constant uuid := 'c9c60d12-5128-4d46-b8e8-e8c9c7f27a05';
  plain_password  text := 'password';  -- For demonstration
  encrypted_pwd   text;
BEGIN
  encrypted_pwd := crypt(plain_password, gen_salt('bf'));

  -- 1) Upsert in auth.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = admin_email
  ) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',    -- Must remain 'authenticated'
      admin_email,
      encrypted_pwd,
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"], "role": "admin"}',
      '{"role": "admin"}',
      now(),
      now()
    );
  ELSE
    -- If it exists, just update the password & metadata
    UPDATE auth.users
      SET encrypted_password = encrypted_pwd,
          updated_at = now(),
          role = 'authenticated',
          raw_app_meta_data = jsonb_build_object(
            'provider', 'email',
            'providers', ARRAY['email'],
            'role', 'admin'
          ),
          raw_user_meta_data = jsonb_build_object('role','admin'),
          email_confirmed_at = now()
      WHERE id = admin_id
         OR email = admin_email;
  END IF;

  -- 2) Upsert in public.users
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = admin_email
  ) THEN
    INSERT INTO public.users (id, name, email, role, password, user_human_id)
    VALUES (
      admin_id,
      'Admin User',
      admin_email,
      'admin',
      encrypted_pwd,
      'ADM00001'
    );
  ELSE
    -- Make sure the uuid is correct, password is updated, role is admin
    UPDATE public.users
      SET id = admin_id,
          password = encrypted_pwd,
          role = 'admin',
          updated_at = now()
      WHERE email = admin_email;
  END IF;
END
$$;

--
-- 4. license_pricing table
--    Final: no RLS, with composite unique constraint.
--
CREATE TABLE license_pricing (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pretty_name   text UNIQUE NOT NULL,
  type          text         NOT NULL,
  size          text         NOT NULL,
  hourly_price  numeric      NOT NULL CHECK (hourly_price >= 0),
  monthly_price numeric GENERATED ALWAYS AS (hourly_price * 730) STORED,
  created_at    timestamptz  DEFAULT now(),
  updated_at    timestamptz  DEFAULT now()
);

-- Remove old unique on pretty_name if it exists, add final composite unique
ALTER TABLE license_pricing DROP CONSTRAINT IF EXISTS license_pricing_pretty_name_key;
ALTER TABLE license_pricing
  ADD CONSTRAINT license_pricing_name_type_size_key UNIQUE (pretty_name, type, size);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_license_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_license_pricing_updated_at
  BEFORE UPDATE ON license_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_license_pricing_updated_at();

--
-- 5. services table & some seed data
--
CREATE TABLE services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL,
  manday_rate numeric NOT NULL DEFAULT 300,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- Insert seed data
INSERT INTO services (name, category, manday_rate) VALUES
  ('Project Management',           'Core Services',       300),
  ('Solution Design',              'Core Services',       300),
  ('UI Design and Development',    'Core Services',       300),
  ('Front-End Development',        'Core Services',       300),
  ('Back-End Development',         'Core Services',       300),
  ('Blockchain BPaaS Development', 'Core Services',       300),
  ('Integrations',                 'Core Services',       300),

  ('Quality Assurance (QA) & Testing', 'Supporting Services', 300),
  ('Deployment',                        'Supporting Services', 300),
  ('Documentation',                     'Supporting Services', 300),
  ('Training',                          'Supporting Services', 300),

  ('Support & Maintenance',       'Ancillary Services',   300),
  ('Iterations & Enhancements',   'Ancillary Services',   300),
  ('Risk Management',             'Ancillary Services',   300),
  ('Risk Buffer',                 'Ancillary Services',   300),

  ('Travel Costs', 'Additional Costs', 300),
  ('Stay Costs',   'Additional Costs', 300)
ON CONFLICT DO NOTHING;  -- in case it’s rerun

--
-- 6. customers table
--
CREATE TABLE customers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name         text NOT NULL,
  industry             text NOT NULL,
  country              text NOT NULL,
  region               text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  website              text,
  number_of_employees  text NOT NULL,
  company_human_id     text UNIQUE NOT NULL,
  hubspot_id           text,
  contact_person       text NOT NULL,
  email                text NOT NULL,
  phone                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

--
-- 7. partners & partner_service_areas & partner_documents
--
CREATE TABLE partners (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name           text NOT NULL,
  headquarter_country    text NOT NULL,
  website                text,
  region                 text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  is_sales_partner       boolean DEFAULT false,
  is_delivery_subcontractor boolean DEFAULT false,
  company_human_id       text UNIQUE NOT NULL,
  contact_person         text NOT NULL,
  email                  text NOT NULL,
  phone                  text,
  certification_level    text CHECK (certification_level IN ('platinum', 'gold', 'silver', 'bronze')),
  revenue_sharing_percentage numeric CHECK (revenue_sharing_percentage >= 0 AND revenue_sharing_percentage <= 100),
  certifications         text[],
  compliance_info        text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  CONSTRAINT partner_type_check CHECK (is_sales_partner = true OR is_delivery_subcontractor = true)
);

CREATE TABLE partner_service_areas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid REFERENCES partners(id) ON DELETE CASCADE,
  service_area text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(partner_id, service_area)
);

-- Timestamps
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();

-- partner_documents
CREATE TABLE partner_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid REFERENCES partners(id) ON DELETE CASCADE,
  name        text NOT NULL,
  file_path   text NOT NULL,
  file_type   text NOT NULL,
  file_size   bigint NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_partner_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_partner_documents_updated_at
  BEFORE UPDATE ON partner_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_documents_updated_at();

-- Create a storage bucket for partner docs (Supabase)
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-documents', 'partner-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Minimal policies for partner-documents
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'partner-documents');

CREATE POLICY "Allow authenticated users to read files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'partner-documents');

CREATE POLICY "Allow authenticated users to delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'partner-documents');

--
-- 8. Opportunity records + docs + status_history
--
CREATE TABLE opportunity_records (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_human_id   text UNIQUE NOT NULL,
  opportunity_name       text NOT NULL,
  customer_id            uuid REFERENCES customers(id) ON DELETE CASCADE,
  deal_owner_id          uuid REFERENCES users(id),
  budget                 numeric NOT NULL DEFAULT 0,
  currency               text NOT NULL,
  region                 text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  close_date             date NOT NULL,
  opportunity_creation_date date NOT NULL,
  opportunity_stage      text NOT NULL CHECK (
    opportunity_stage IN (
      'Lead','Qualification','Proposal','Negotiation','Closed Won','Closed Lost'
    )
  ),
  opportunity_type text NOT NULL CHECK (
    opportunity_type IN ('New Business','Upsell','Renewal')
  ),
  lead_source      text NOT NULL CHECK (
    lead_source IN (
      'Website','Outbound Efforts','Referral','Partner','Email Campaign',
      'Cold Call','Event/Conference','Other'
    )
  ),
  use_case_summary text,
  description      text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE opportunity_document_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    uuid REFERENCES opportunity_records(id) ON DELETE CASCADE,
  name              text NOT NULL,
  file_path         text NOT NULL,
  file_type         text NOT NULL,
  file_size         bigint NOT NULL,
  document_type     text NOT NULL CHECK (
    document_type IN ('Proposal','Contract','Supporting Material')
  ),
  document_status   text NOT NULL CHECK (
    document_status IN ('Uploaded','Signed','Pending')
  ),
  uploaded_by       uuid REFERENCES users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE opportunity_status_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunity_records(id) ON DELETE CASCADE,
  previous_stage text,
  new_stage      text NOT NULL,
  changed_by     uuid REFERENCES users(id),
  change_date    timestamptz DEFAULT now(),
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Bucket for opportunity docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity_document_storage','opportunity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for that storage
CREATE POLICY "Allow authenticated to upload opportunity files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'opportunity_document_storage');

CREATE POLICY "Allow authenticated to read opportunity files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'opportunity_document_storage');

CREATE POLICY "Allow authenticated to delete opportunity files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'opportunity_document_storage');

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_opportunity_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_opportunity_records_timestamp
  BEFORE UPDATE ON opportunity_records
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_records_updated_at();

CREATE OR REPLACE FUNCTION update_opportunity_document_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_opportunity_document_records_timestamp
  BEFORE UPDATE ON opportunity_document_records
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_document_records_updated_at();

CREATE OR REPLACE FUNCTION update_opportunity_status_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_opportunity_status_history_timestamp
  BEFORE UPDATE ON opportunity_status_history
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_status_history_updated_at();

-- Indexes
CREATE INDEX idx_opportunity_records_customer_id
  ON opportunity_records(customer_id);
CREATE INDEX idx_opportunity_records_deal_owner_id
  ON opportunity_records(deal_owner_id);
CREATE INDEX idx_opportunity_records_stage
  ON opportunity_records(opportunity_stage);

CREATE INDEX idx_opportunity_document_records_opportunity_id
  ON opportunity_document_records(opportunity_id);

CREATE INDEX idx_opportunity_status_history_opportunity_id
  ON opportunity_status_history(opportunity_id);

--
-- 9. Offer records + partner_records + doc_records
--    with final constraint for status including 'Hold'
--
CREATE TABLE offer_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    uuid REFERENCES opportunity_records(id) ON DELETE CASCADE,
  presales_engineer_id uuid REFERENCES users(id),
  offer_human_id    text UNIQUE NOT NULL,
  offer_summary     text,
  offer_creation_date date NOT NULL DEFAULT CURRENT_DATE,
  offer_due_date    date NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'Draft','In Review','Approved','Sent','Won','Lost','Cancelled','Hold'
    )
  ) DEFAULT 'Draft',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  created_by        uuid REFERENCES users(id),
  updated_by        uuid REFERENCES users(id)
);

CREATE TABLE offer_partner_records (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id  uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(offer_id, partner_id)
);

CREATE TABLE offer_document_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id       uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  name           text NOT NULL,
  file_path      text NOT NULL,
  file_type      text NOT NULL,
  file_size      bigint NOT NULL,
  document_type  text NOT NULL CHECK (
    document_type IN ('Customer RFP','Subcontractor Proposal','SettleMint Proposal')
  ),
  document_status text NOT NULL CHECK (
    document_status IN ('Draft','Final','Archived')
  ) DEFAULT 'Draft',
  uploaded_by    uuid REFERENCES users(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Bucket for offer docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-documents','offer-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to upload offer files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'offer-documents');

CREATE POLICY "Allow authenticated users to read offer files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'offer-documents');

CREATE POLICY "Allow authenticated users to delete offer files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'offer-documents');

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_offer_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_offer_document_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_records_timestamp
  BEFORE UPDATE ON offer_records
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_records_updated_at();

CREATE TRIGGER update_offer_document_records_timestamp
  BEFORE UPDATE ON offer_document_records
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_document_records_updated_at();

-- Indexes
CREATE INDEX idx_offer_records_opportunity_id
  ON offer_records(opportunity_id);
CREATE INDEX idx_offer_records_presales_engineer_id
  ON offer_records(presales_engineer_id);
CREATE INDEX idx_offer_records_status
  ON offer_records(status);

CREATE INDEX idx_offer_partner_records_offer_id
  ON offer_partner_records(offer_id);
CREATE INDEX idx_offer_partner_records_partner_id
  ON offer_partner_records(partner_id);

CREATE INDEX idx_offer_document_records_offer_id
  ON offer_document_records(offer_id);

--
-- 10. Offer Services: offer_service_sets + offer_service_components
--
CREATE TABLE offer_service_sets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id           uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  service_set_human_id text NOT NULL,
  name               text NOT NULL,
  duration_months    integer NOT NULL CHECK (duration_months > 0),
  subcontractor_id   uuid REFERENCES partners(id),
  services_summary   text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE offer_service_components (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_set_id     uuid REFERENCES offer_service_sets(id) ON DELETE CASCADE,
  service_name       text NOT NULL,
  manday_rate        numeric NOT NULL CHECK (manday_rate >= 0),
  number_of_mandays  integer NOT NULL CHECK (number_of_mandays > 0),
  profit_percentage  numeric NOT NULL CHECK (profit_percentage >= 0),
  total_cost         numeric GENERATED ALWAYS AS (
    manday_rate * number_of_mandays * (1 + profit_percentage / 100)
  ) STORED,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Timestamps
CREATE OR REPLACE FUNCTION update_offer_service_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_service_sets_timestamp
  BEFORE UPDATE ON offer_service_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_service_sets_updated_at();

CREATE OR REPLACE FUNCTION update_offer_service_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_service_components_timestamp
  BEFORE UPDATE ON offer_service_components
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_service_components_updated_at();

-- Indexes
CREATE INDEX idx_offer_service_sets_offer_id
  ON offer_service_sets(offer_id);
CREATE INDEX idx_offer_service_components_service_set_id
  ON offer_service_components(service_set_id);

--
-- 11. Offer Environments: offer_environments + offer_environment_components
--
CREATE TABLE offer_environments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id                uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  environment_human_id    text NOT NULL,
  name                    text NOT NULL,
  type                    text NOT NULL,
  license_duration_months integer NOT NULL CHECK (license_duration_months > 0),
  deployment_type         text NOT NULL,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE offer_environment_components (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES offer_environments(id) ON DELETE CASCADE,
  component_name text NOT NULL,
  type           text NOT NULL,
  size           text NOT NULL,
  quantity       integer NOT NULL CHECK (quantity > 0),
  monthly_price  numeric NOT NULL CHECK (monthly_price >= 0),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Timestamps
CREATE OR REPLACE FUNCTION update_offer_environments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_environments_timestamp
  BEFORE UPDATE ON offer_environments
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_environments_updated_at();

CREATE OR REPLACE FUNCTION update_offer_environment_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_environment_components_timestamp
  BEFORE UPDATE ON offer_environment_components
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_environment_components_updated_at();

CREATE INDEX idx_offer_environments_offer_id
  ON offer_environments(offer_id);
CREATE INDEX idx_offer_environment_components_environment_id
  ON offer_environment_components(environment_id);

--
-- 12. environment_bpaas_details
--
CREATE TABLE environment_bpaas_details (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id      uuid REFERENCES offer_environments(id) ON DELETE CASCADE,
  platform_identifier text NOT NULL,
  platform_link       text NOT NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(environment_id)
);

CREATE OR REPLACE FUNCTION update_environment_bpaas_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_environment_bpaas_details_timestamp
  BEFORE UPDATE ON environment_bpaas_details
  FOR EACH ROW
  EXECUTE FUNCTION update_environment_bpaas_details_updated_at();

CREATE INDEX idx_environment_bpaas_details_environment_id
  ON environment_bpaas_details(environment_id);

--
-- 13. (Intentionally left empty to avoid "relation does not exist")
--     We no longer define or drop the function/trigger here for offer_reviews.
--     We'll create them in Section 19 after the table exists.
--

--
-- 14. Contracts & contract_documents + contract_details_view
--
CREATE TABLE contracts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_human_id     text UNIQUE NOT NULL,
  offer_id              uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  contract_summary      text,
  total_contract_value  numeric NOT NULL CHECK (total_contract_value >= 0),
  total_mrr             numeric NOT NULL CHECK (total_mrr >= 0),
  total_services_revenue numeric NOT NULL CHECK (total_services_revenue >= 0),
  payment_terms         text NOT NULL,
  contract_start_date   date NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft','Active','Expired','Terminated')) DEFAULT 'Draft',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  created_by            uuid REFERENCES users(id),
  updated_by            uuid REFERENCES users(id)
);

CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contracts_timestamp
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_updated_at();

-- Indexes
CREATE INDEX idx_contracts_offer_id
  ON contracts(offer_id);
CREATE INDEX idx_contracts_status
  ON contracts(status);

-- contract_documents
CREATE TABLE contract_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  file_path   text NOT NULL,
  file_type   text NOT NULL,
  file_size   bigint NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_contract_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contract_documents_timestamp
  BEFORE UPDATE ON contract_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_documents_updated_at();

CREATE INDEX idx_contract_documents_contract_id
  ON contract_documents(contract_id);

-- Bucket for contract documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-documents','contract-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to upload contract files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contract-documents');

CREATE POLICY "Allow authenticated users to read contract files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contract-documents');

CREATE POLICY "Allow authenticated users to delete contract files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contract-documents');

-- contract_details_view
CREATE OR REPLACE VIEW contract_details_view AS
SELECT 
  c.*,
  o.offer_human_id,
  o.offer_summary,
  opp.opportunity_name,
  opp.opportunity_human_id,
  cust.company_name  AS customer_name,
  u.name            AS deal_owner_name,
  pe.name           AS presales_engineer_name,
  (
    SELECT json_agg(json_build_object(
      'id', d.id,
      'name', d.name,
      'file_path', d.file_path,
      'file_type', d.file_type,
      'file_size', d.file_size,
      'created_at', d.created_at
    ))
    FROM contract_documents d
    WHERE d.contract_id = c.id
  ) AS documents,
  (
    SELECT json_agg(json_build_object(
      'id', env.id,
      'name', env.name,
      'type', env.type,
      'license_duration_months', env.license_duration_months,
      'deployment_type', env.deployment_type,
      'components', (
        SELECT json_agg(json_build_object(
          'id', comp.id,
          'component_name', comp.component_name,
          'type', comp.type,
          'size', comp.size,
          'quantity', comp.quantity,
          'monthly_price', comp.monthly_price
        ))
        FROM offer_environment_components comp
        WHERE comp.environment_id = env.id
      )
    ))
    FROM offer_environments env
    WHERE env.offer_id = o.id
  ) AS environments,
  (
    SELECT json_agg(json_build_object(
      'id', ss.id,
      'name', ss.name,
      'duration_months', ss.duration_months,
      'subcontractor_id', ss.subcontractor_id,
      'services', (
        SELECT json_agg(json_build_object(
          'id', sc.id,
          'service_name', sc.service_name,
          'manday_rate', sc.manday_rate,
          'number_of_mandays', sc.number_of_mandays,
          'profit_percentage', sc.profit_percentage
        ))
        FROM offer_service_components sc
        WHERE sc.service_set_id = ss.id
      )
    ))
    FROM offer_service_sets ss
    WHERE ss.offer_id = o.id
  ) AS service_sets
FROM contracts c
JOIN offer_records o        ON c.offer_id = o.id
JOIN opportunity_records opp ON o.opportunity_id = opp.id
JOIN customers cust         ON opp.customer_id = cust.id
JOIN users u                ON opp.deal_owner_id = u.id
LEFT JOIN users pe          ON o.presales_engineer_id = pe.id;

--
-- 15. An “all environments” view: environments_view
--
DROP VIEW IF EXISTS environments_view;
CREATE OR REPLACE VIEW environments_view AS
WITH environment_components AS (
  SELECT
    env.id AS environment_id,
    COALESCE(
      json_agg(
        json_build_object(
          'id', comp.id,
          'component_name', comp.component_name,
          'type', comp.type,
          'size', comp.size,
          'quantity', comp.quantity,
          'monthly_price', comp.monthly_price
        )
      ) FILTER (WHERE comp.id IS NOT NULL),
      '[]'::json
    ) AS components,
    COALESCE(SUM(comp.monthly_price * comp.quantity),0) AS total_mrr
  FROM offer_environments env
  LEFT JOIN offer_environment_components comp ON env.id = comp.environment_id
  GROUP BY env.id
)
SELECT
  env.id,
  env.name,
  env.type,
  env.offer_id,
  o.offer_human_id,
  opp.id AS opportunity_id,
  opp.opportunity_name,
  opp.opportunity_human_id,
  env.license_duration_months,
  env.deployment_type,
  c.id   AS contract_id,
  c.contract_human_id,
  c.status AS contract_status,
  c.contract_start_date,
  c.contract_start_date + (env.license_duration_months || ' months')::interval AS contract_end_date,
  cust.company_name AS customer_name,
  COALESCE(ec.components,'[]'::json) AS components,
  COALESCE(ec.total_mrr,0) AS total_mrr,
  bpaas.platform_identifier,
  bpaas.platform_link,
  env.created_at,
  env.updated_at
FROM offer_environments env
JOIN offer_records o            ON env.offer_id = o.id
LEFT JOIN contracts c           ON o.id = c.offer_id
JOIN opportunity_records opp    ON o.opportunity_id = opp.id
JOIN customers cust             ON opp.customer_id = cust.id
LEFT JOIN environment_components ec ON env.id = ec.environment_id
LEFT JOIN environment_bpaas_details bpaas ON env.id = bpaas.environment_id
ORDER BY env.created_at DESC;

--
-- 16. Project Module (projects, project_team_members, project_tasks, payment_milestones)
--     plus status-history tables for tasks & milestones
--
CREATE TABLE projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_human_id text UNIQUE NOT NULL,
  contract_id      uuid REFERENCES contracts(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  status           text NOT NULL CHECK (
    status IN ('Not Started','In Progress','On Hold','Completed')
  ),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  created_by       uuid REFERENCES users(id),
  updated_by       uuid REFERENCES users(id)
);

CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_timestamp
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

CREATE INDEX idx_projects_contract_id
  ON projects(contract_id);

-- project_team_members
CREATE TABLE project_team_members (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid REFERENCES projects(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  role                 text NOT NULL,
  email                text,
  phone                text,
  allocation_percentage integer CHECK (allocation_percentage BETWEEN 0 AND 100),
  start_date           date NOT NULL,
  end_date             date NOT NULL,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_project_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_team_members_timestamp
  BEFORE UPDATE ON project_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_project_team_members_updated_at();

CREATE INDEX idx_project_team_members_project_id
  ON project_team_members(project_id);

-- project_tasks
CREATE TABLE project_tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES project_tasks(id),
  title          text NOT NULL,
  description    text,
  status         text NOT NULL CHECK (status IN ('Not Started','In Progress','Completed')),
  priority       text NOT NULL CHECK (priority IN ('Low','Medium','High')),
  assigned_to    uuid REFERENCES project_team_members(id),
  start_date     date,
  due_date       date,
  completed_date date,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  updated_by     uuid REFERENCES users(id)
);

CREATE OR REPLACE FUNCTION update_project_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_tasks_timestamp
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_project_tasks_updated_at();

CREATE INDEX idx_project_tasks_project_id
  ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_parent_task_id
  ON project_tasks(parent_task_id);
CREATE INDEX idx_project_tasks_assigned_to
  ON project_tasks(assigned_to);

-- payment_milestones
CREATE TABLE payment_milestones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  amount        numeric NOT NULL CHECK (amount > 0),
  due_date      date NOT NULL,
  status        text NOT NULL CHECK (status IN ('Pending','Invoiced','Paid')),
  payment_date  date,
  invoice_number text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES users(id)
);

CREATE OR REPLACE FUNCTION update_payment_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_milestones_timestamp
  BEFORE UPDATE ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_milestones_updated_at();

CREATE INDEX idx_payment_milestones_project_id
  ON payment_milestones(project_id);

--
-- 17. Status-history for tasks & milestones
--
DROP FUNCTION IF EXISTS track_task_status_changes();
DROP FUNCTION IF EXISTS track_milestone_status_changes();

CREATE TABLE task_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Not Started','In Progress','Completed')),
  new_status      text NOT NULL CHECK (new_status IN ('Not Started','In Progress','Completed')),
  changed_by      uuid REFERENCES users(id),
  change_date     timestamptz DEFAULT now(),
  comments        text
);

CREATE TABLE milestone_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    uuid REFERENCES payment_milestones(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Pending','Invoiced','Paid')),
  new_status      text NOT NULL CHECK (new_status IN ('Pending','Invoiced','Paid')),
  changed_by      uuid REFERENCES users(id),
  change_date     timestamptz DEFAULT now(),
  comments        text
);

CREATE INDEX idx_task_status_history_task_id
  ON task_status_history(task_id);

CREATE INDEX idx_milestone_status_history_milestone_id
  ON milestone_status_history(milestone_id);

-- Functions & triggers to track changes
CREATE OR REPLACE FUNCTION track_task_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_status_history (
      task_id, previous_status, new_status, changed_by, comments
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.updated_by,
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_task_status_changes
  AFTER UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION track_task_status_changes();

CREATE OR REPLACE FUNCTION track_milestone_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO milestone_status_history (
      milestone_id, previous_status, new_status, changed_by, comments
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.updated_by,
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_milestone_status_changes
  AFTER UPDATE ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION track_milestone_status_changes();

-- Views for those status histories
CREATE OR REPLACE VIEW task_status_history_view AS
SELECT 
  h.*,
  t.title       AS task_title,
  t.project_id,
  u.name        AS changed_by_name,
  u.role        AS changed_by_role
FROM task_status_history h
JOIN project_tasks t ON h.task_id = t.id
JOIN users u ON h.changed_by = u.id
ORDER BY h.change_date DESC;

CREATE OR REPLACE VIEW milestone_status_history_view AS
SELECT
  h.*,
  m.title       AS milestone_title,
  m.project_id,
  u.name        AS changed_by_name,
  u.role        AS changed_by_role
FROM milestone_status_history h
JOIN payment_milestones m ON h.milestone_id = m.id
JOIN users u ON h.changed_by = u.id
ORDER BY h.change_date DESC;

--
-- 18. project_details_view (recursive tasks, team, milestones)
--
CREATE OR REPLACE VIEW project_details_view AS
WITH RECURSIVE task_hierarchy AS (
  -- Base case: top-level tasks
  SELECT 
    t.id,
    t.project_id,
    t.parent_task_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.assigned_to,
    t.start_date,
    t.due_date,
    t.completed_date,
    ARRAY[t.id] AS path,
    1 AS level
  FROM project_tasks t
  WHERE t.parent_task_id IS NULL

  UNION ALL
  
  -- Recursive case: child tasks
  SELECT
    t.id,
    t.project_id,
    t.parent_task_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.assigned_to,
    t.start_date,
    t.due_date,
    t.completed_date,
    h.path || t.id,
    h.level + 1
  FROM project_tasks t
  JOIN task_hierarchy h ON t.parent_task_id = h.id
)
SELECT
  p.*,
  c.contract_human_id,
  c.total_contract_value,
  c.total_mrr,
  c.total_services_revenue,
  o.offer_human_id,
  cust.company_name   AS customer_name,
  u_created.name      AS created_by_name,
  u_updated.name      AS updated_by_name,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'id', tm.id,
        'name', tm.name,
        'role', tm.role,
        'email', tm.email,
        'phone', tm.phone,
        'allocation_percentage', tm.allocation_percentage,
        'start_date', tm.start_date,
        'end_date', tm.end_date
      ))
      FROM project_team_members tm
      WHERE tm.project_id = p.id
    ),
    '[]'::json
  ) AS team_members,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'id', t.id,
        'parent_task_id', t.parent_task_id,
        'title', t.title,
        'description', t.description,
        'status', t.status,
        'priority', t.priority,
        'assigned_to', t.assigned_to,
        'start_date', t.start_date,
        'due_date', t.due_date,
        'completed_date', t.completed_date,
        'level', t.level,
        'path', t.path
      ) ORDER BY t.path)
      FROM task_hierarchy t
      WHERE t.project_id = p.id
    ),
    '[]'::json
  ) AS tasks,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'id', pm.id,
        'title', pm.title,
        'description', pm.description,
        'amount', pm.amount,
        'due_date', pm.due_date,
        'status', pm.status,
        'payment_date', pm.payment_date,
        'invoice_number', pm.invoice_number
      ) ORDER BY pm.due_date)
      FROM payment_milestones pm
      WHERE pm.project_id = p.id
    ),
    '[]'::json
  ) AS payment_milestones
FROM projects p
JOIN contracts c            ON p.contract_id = c.id
JOIN offer_records o        ON c.offer_id = o.id
JOIN opportunity_records opp ON o.opportunity_id = opp.id
JOIN customers cust         ON opp.customer_id = cust.id
LEFT JOIN users u_created   ON p.created_by = u_created.id
LEFT JOIN users u_updated   ON p.updated_by = u_updated.id;

--
-- 19. Review system tables & final views
--
DROP VIEW IF EXISTS offer_review_details_view       CASCADE;
DROP VIEW IF EXISTS review_history_view            CASCADE;
DROP VIEW IF EXISTS review_details_view            CASCADE;
DROP TABLE IF EXISTS offer_review_history          CASCADE;
DROP TABLE IF EXISTS offer_review_documents        CASCADE;
DROP TABLE IF EXISTS offer_reviews                 CASCADE;
DROP TABLE IF EXISTS offer_review_requests         CASCADE;

-- Recreate final
CREATE TABLE offer_review_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id       uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  request_details text NOT NULL,
  requested_by   uuid REFERENCES users(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE offer_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid REFERENCES offer_review_requests(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id),
  review_type text NOT NULL CHECK (review_type IN ('technical','commercial')),
  status      text NOT NULL CHECK (status IN ('pending','approved','needs_improvement')) DEFAULT 'pending',
  comments    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE offer_review_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid REFERENCES offer_review_requests(id) ON DELETE CASCADE,
  name        text NOT NULL,
  file_path   text NOT NULL,
  file_type   text NOT NULL,
  file_size   bigint NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE offer_review_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       uuid REFERENCES offer_reviews(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('pending','approved','needs_improvement')),
  new_status      text NOT NULL CHECK (new_status IN ('pending','approved','needs_improvement')),
  comments        text,
  changed_by      uuid REFERENCES users(id),
  created_at      timestamptz DEFAULT now()
);

-- Storage bucket for drp-documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('drp-documents','drp-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Minimal policies for that bucket
CREATE POLICY "Allow authenticated users to upload DRP files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'drp-documents');

CREATE POLICY "Allow authenticated users to read DRP files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'drp-documents');

CREATE POLICY "Allow authenticated users to delete DRP files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'drp-documents');

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_offer_review_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_review_requests_timestamp
  BEFORE UPDATE ON offer_review_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_review_requests_updated_at();

CREATE OR REPLACE FUNCTION update_offer_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_reviews_timestamp
  BEFORE UPDATE ON offer_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_reviews_updated_at();

-- Indexes
CREATE INDEX idx_offer_review_requests_offer_id
  ON offer_review_requests(offer_id);
CREATE INDEX idx_offer_reviews_request_id
  ON offer_reviews(request_id);
CREATE INDEX idx_offer_reviews_reviewer_id
  ON offer_reviews(reviewer_id);
CREATE INDEX idx_offer_review_documents_request_id
  ON offer_review_documents(request_id);
CREATE INDEX idx_offer_review_history_review_id
  ON offer_review_history(review_id);

--
-- Now define the function + trigger that updates "offer_records.status" if all reviews are approved.
-- We do it here so that the "offer_reviews" table definitely exists first.
--
DROP FUNCTION IF EXISTS check_reviews_and_update_offer_status();

CREATE OR REPLACE FUNCTION check_reviews_and_update_offer_status()
RETURNS TRIGGER AS $$
DECLARE
  v_offer_id     uuid;
  v_all_approved boolean;
BEGIN
  -- 1) Which offer does this review belong to?
  SELECT offer_id
    INTO v_offer_id
    FROM offer_review_requests req
   WHERE req.id = NEW.request_id;

  -- 2) Check if all reviews are 'approved'
  WITH review_counts AS (
    SELECT 
      COUNT(*) FILTER (WHERE r.status = 'approved') AS approved_count,
      COUNT(*) AS total_count
    FROM offer_reviews r
    JOIN offer_review_requests req2 ON r.request_id = req2.id
    WHERE req2.offer_id = v_offer_id
  )
  SELECT (approved_count = total_count)
    INTO v_all_approved
  FROM review_counts;

  -- 3) If they are all approved, set the offer to 'Approved'
  IF v_all_approved THEN
    UPDATE offer_records
       SET status = 'Approved',
           updated_at = now()
     WHERE id = v_offer_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offer_status_on_review_change
  AFTER INSERT OR UPDATE OF status
  ON offer_reviews
  FOR EACH ROW
  EXECUTE FUNCTION check_reviews_and_update_offer_status();


--
-- final review_details_view
--
CREATE OR REPLACE VIEW review_details_view AS
SELECT 
  r.id                AS review_id,
  r.request_id,
  r.reviewer_id,
  u.name              AS reviewer_name,
  u.role              AS reviewer_role,
  r.review_type,
  r.status            AS review_status,
  r.comments          AS review_comments,
  r.created_at        AS review_created_at,
  r.updated_at        AS review_updated_at,
  req.request_details,
  req.requested_by,
  req.created_at      AS request_created_at,
  o.id                AS offer_id,
  o.offer_human_id,
  o.offer_summary     AS offer_name,
  o.status            AS offer_status,
  c.company_name      AS customer_name,
  c.id                AS customer_id,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'id', d.id,
        'name', d.name,
        'file_path', d.file_path,
        'file_type', d.file_type,
        'file_size', d.file_size,
        'created_at', d.created_at
      ))
      FROM offer_review_documents d
      WHERE d.request_id = req.id
    ),
    '[]'::json
  ) AS documents
FROM offer_reviews r
LEFT JOIN offer_review_requests req  ON r.request_id = req.id
LEFT JOIN users u                    ON r.reviewer_id = u.id
LEFT JOIN offer_records o            ON req.offer_id = o.id
LEFT JOIN opportunity_records opp    ON o.opportunity_id = opp.id
LEFT JOIN customers c                ON opp.customer_id = c.id;

-- Additional "offer_review_details_view" if you want a combined view
CREATE OR REPLACE VIEW offer_review_details_view AS
WITH review_docs AS (
  SELECT 
    request_id,
    COALESCE(
      json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'file_path', file_path,
          'file_type', file_type,
          'file_size', file_size,
          'created_at', created_at
        )
      ) FILTER (WHERE id IS NOT NULL),
      '[]'::json
    ) AS documents
  FROM offer_review_documents
  GROUP BY request_id
),
review_details AS (
  SELECT 
    r.request_id,
    json_agg(
      json_build_object(
        'review_id', r.id,
        'reviewer_name', u.name,
        'reviewer_role', u.role,
        'review_type', r.review_type,
        'review_status', r.status,
        'review_comments', r.comments,
        'review_created_at', r.created_at
      ) ORDER BY r.created_at DESC
    ) AS reviews
  FROM offer_reviews r
  LEFT JOIN users u ON r.reviewer_id = u.id
  GROUP BY r.request_id
)
SELECT
  req.id            AS request_id,
  req.offer_id,
  req.request_details,
  req.created_at    AS request_created_at,
  o.offer_human_id,
  o.offer_summary   AS offer_name,
  o.status          AS offer_status,
  c.company_name    AS customer_name,
  c.id              AS customer_id,
  COALESCE(d.documents, '[]'::json)   AS documents,
  COALESCE(rd.reviews, '[]'::json)    AS reviews
FROM offer_review_requests req
LEFT JOIN offer_records o   ON req.offer_id = o.id
LEFT JOIN opportunity_records opp ON o.opportunity_id = opp.id
LEFT JOIN customers c       ON opp.customer_id = c.id
LEFT JOIN review_docs d     ON req.id = d.request_id
LEFT JOIN review_details rd ON req.id = rd.request_id;

-- final review_history_view
CREATE OR REPLACE VIEW review_history_view AS
SELECT
  h.id            AS history_id,
  h.review_id,
  h.previous_status,
  h.new_status,
  h.comments,
  h.created_at    AS change_date,
  u.name          AS changed_by_name,
  u.role          AS changed_by_role,
  r.review_type,
  rev.name        AS reviewer_name,
  rev.role        AS reviewer_role,
  req.offer_id,
  o.offer_human_id,
  COALESCE(o.offer_summary, 'Untitled Offer') AS offer_name,
  o.status        AS offer_status
FROM offer_review_history h
INNER JOIN offer_reviews r        ON h.review_id = r.id
INNER JOIN users u                ON h.changed_by = u.id
INNER JOIN users rev              ON r.reviewer_id = rev.id
INNER JOIN offer_review_requests req ON r.request_id = req.id
INNER JOIN offer_records o        ON req.offer_id = o.id
ORDER BY h.created_at DESC;

--
-- Script end. The final schema now stands created with no duplicates, 
-- no "relation does not exist" errors, and correct object ordering.
--