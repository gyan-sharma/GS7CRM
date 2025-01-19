/*
  # Status History Tables
  
  Creates tables and triggers for tracking status changes in tasks and milestones.
  Split into smaller, focused changes to avoid timeout issues.
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS track_task_status_changes ON project_tasks;
DROP TRIGGER IF EXISTS track_milestone_status_changes ON payment_milestones;

-- Drop existing functions
DROP FUNCTION IF EXISTS track_task_status_changes();
DROP FUNCTION IF EXISTS track_milestone_status_changes();

-- Create task status history table
CREATE TABLE IF NOT EXISTS task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Not Started', 'In Progress', 'Completed')),
  new_status text NOT NULL CHECK (new_status IN ('Not Started', 'In Progress', 'Completed')),
  changed_by uuid REFERENCES users(id),
  change_date timestamptz DEFAULT now(),
  comments text
);

-- Create milestone status history table
CREATE TABLE IF NOT EXISTS milestone_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid REFERENCES payment_milestones(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Pending', 'Invoiced', 'Paid')),
  new_status text NOT NULL CHECK (new_status IN ('Pending', 'Invoiced', 'Paid')),
  changed_by uuid REFERENCES users(id),
  change_date timestamptz DEFAULT now(),
  comments text
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id
  ON task_status_history(task_id);

CREATE INDEX IF NOT EXISTS idx_milestone_status_history_milestone_id
  ON milestone_status_history(milestone_id);