/*
  # Create Offers Module Schema

  1. New Tables
    - `offers`
      - Basic offer information
      - Links to opportunities
      - Tracks offer details and status
    
    - `offer_partners`
      - Junction table for offers and partners
      - Allows multiple partners per offer
    
    - `offer_documents`
      - Stores different types of documents
      - Categorized by document type (RFP, Subcontractor, SettleMint)

  2. Storage
    - Creates 'offer-documents' bucket for file storage
    
  3. Security
    - Enables appropriate storage policies
*/

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunity_records(id) ON DELETE CASCADE,
  offer_human_id text UNIQUE NOT NULL,
  offer_summary text,
  presales_engineer_id uuid REFERENCES users(id),
  offer_creation_date date NOT NULL DEFAULT CURRENT_DATE,
  offer_due_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer partners junction table
CREATE TABLE IF NOT EXISTS offer_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(offer_id, partner_id)
);

-- Create offer documents table
CREATE TABLE IF NOT EXISTS offer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  document_category text NOT NULL CHECK (
    document_category IN (
      'RFP Documents',
      'Subcontractor Proposal',
      'SettleMint Proposal'
    )
  ),
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create storage bucket for offer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-documents', 'offer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Allow authenticated to upload offer files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'offer-documents');

CREATE POLICY "Allow authenticated to read offer files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'offer-documents');

CREATE POLICY "Allow authenticated to delete offer files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'offer-documents');

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_offer_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_offers_timestamp
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_offers_updated_at();

CREATE TRIGGER update_offer_documents_timestamp
  BEFORE UPDATE ON offer_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_documents_updated_at();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_offers_opportunity_id
  ON offers(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_offer_partners_offer_id
  ON offer_partners(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_partners_partner_id
  ON offer_partners(partner_id);

CREATE INDEX IF NOT EXISTS idx_offer_documents_offer_id
  ON offer_documents(offer_id);