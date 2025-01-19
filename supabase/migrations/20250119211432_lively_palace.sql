/*
  # Add updated_by field to payment milestones

  1. Changes
    - Add updated_by field to payment_milestones table
    - Update track_milestone_status_changes function to handle updated_by field
*/

-- Add updated_by field to payment_milestones table
ALTER TABLE payment_milestones 
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);

-- Update the track_milestone_status_changes function to handle updated_by
CREATE OR REPLACE FUNCTION track_milestone_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO milestone_status_history (
      milestone_id,
      previous_status,
      new_status,
      changed_by,
      comments
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