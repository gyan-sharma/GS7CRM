/*
  # Add hold status to offer_records

  1. Changes
    - Modify status check constraint in offer_records table to include 'hold' status
*/

-- Drop existing check constraint
ALTER TABLE offer_records DROP CONSTRAINT IF EXISTS offer_records_status_check;

-- Add new check constraint with 'hold' status
ALTER TABLE offer_records
  ADD CONSTRAINT offer_records_status_check
  CHECK (status IN (
    'Draft',
    'In Review',
    'Approved',
    'Sent',
    'Won',
    'Lost',
    'Cancelled',
    'Hold'
  ));