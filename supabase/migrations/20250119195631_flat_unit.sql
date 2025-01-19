-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS track_task_status_changes ON project_tasks;
DROP TRIGGER IF EXISTS track_milestone_status_changes ON payment_milestones;
DROP FUNCTION IF EXISTS track_task_status_changes();
DROP FUNCTION IF EXISTS track_milestone_status_changes();

-- Create task status history table if it doesn't exist
CREATE TABLE IF NOT EXISTS task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Not Started', 'In Progress', 'Completed')),
  new_status text NOT NULL CHECK (new_status IN ('Not Started', 'In Progress', 'Completed')),
  changed_by uuid REFERENCES users(id),
  change_date timestamptz DEFAULT now(),
  comments text
);

-- Create milestone status history table if it doesn't exist
CREATE TABLE IF NOT EXISTS milestone_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid REFERENCES payment_milestones(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Pending', 'Invoiced', 'Paid')),
  new_status text NOT NULL CHECK (new_status IN ('Pending', 'Invoiced', 'Paid')),
  changed_by uuid REFERENCES users(id),
  change_date timestamptz DEFAULT now(),
  comments text
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id
  ON task_status_history(task_id);

CREATE INDEX IF NOT EXISTS idx_milestone_status_history_milestone_id
  ON milestone_status_history(milestone_id);

-- Create function to track task status changes
CREATE OR REPLACE FUNCTION track_task_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_status_history (
      task_id,
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

-- Create function to track milestone status changes
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

-- Create triggers
CREATE TRIGGER track_task_status_changes
  AFTER UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION track_task_status_changes();

CREATE TRIGGER track_milestone_status_changes
  AFTER UPDATE ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION track_milestone_status_changes();

-- Create views for status history
CREATE OR REPLACE VIEW task_status_history_view AS
SELECT 
  h.*,
  t.title as task_title,
  t.project_id,
  u.name as changed_by_name,
  u.role as changed_by_role
FROM task_status_history h
JOIN project_tasks t ON h.task_id = t.id
JOIN users u ON h.changed_by = u.id
ORDER BY h.change_date DESC;

CREATE OR REPLACE VIEW milestone_status_history_view AS
SELECT 
  h.*,
  m.title as milestone_title,
  m.project_id,
  u.name as changed_by_name,
  u.role as changed_by_role
FROM milestone_status_history h
JOIN payment_milestones m ON h.milestone_id = m.id
JOIN users u ON h.changed_by = u.id
ORDER BY h.change_date DESC;