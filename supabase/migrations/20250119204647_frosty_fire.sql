/*
  # Project Management Tables
  
  Creates tables and views for:
  1. Project team members
  2. Project tasks with hierarchy
  3. Payment milestones
*/

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_project_team_members_timestamp ON project_team_members;
DROP TRIGGER IF EXISTS update_project_tasks_timestamp ON project_tasks;
DROP TRIGGER IF EXISTS update_project_payment_milestones_timestamp ON project_payment_milestones;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS update_project_team_members_updated_at();
DROP FUNCTION IF EXISTS update_project_tasks_updated_at();
DROP FUNCTION IF EXISTS update_project_payment_milestones_updated_at();

-- Create project team members table
CREATE TABLE IF NOT EXISTS project_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  email text,
  phone text,
  allocation_percentage integer CHECK (allocation_percentage BETWEEN 0 AND 100),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project tasks table
CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES project_tasks(id),
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
  priority text NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
  assigned_to uuid REFERENCES project_team_members(id),
  start_date date,
  due_date date,
  completed_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment milestones table
CREATE TABLE IF NOT EXISTS project_payment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Pending', 'Invoiced', 'Paid')),
  payment_date date,
  invoice_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger functions
CREATE OR REPLACE FUNCTION update_project_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_project_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_project_payment_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_project_team_members_timestamp
  BEFORE UPDATE ON project_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_project_team_members_updated_at();

CREATE TRIGGER update_project_tasks_timestamp
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_project_tasks_updated_at();

CREATE TRIGGER update_project_payment_milestones_timestamp
  BEFORE UPDATE ON project_payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_project_payment_milestones_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_team_members_project_id
  ON project_team_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id
  ON project_tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id
  ON project_tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to
  ON project_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_project_payment_milestones_project_id
  ON project_payment_milestones(project_id);

-- Create view for project details
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
    ARRAY[t.id] as path,
    1 as level
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
  cust.company_name as customer_name,
  u_created.name as created_by_name,
  u_updated.name as updated_by_name,
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
  ) as team_members,
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
  ) as tasks,
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
      FROM project_payment_milestones pm
      WHERE pm.project_id = p.id
    ),
    '[]'::json
  ) as payment_milestones
FROM projects p
JOIN contracts c ON p.contract_id = c.id
JOIN offer_records o ON c.offer_id = o.id
JOIN opportunity_records opp ON o.opportunity_id = opp.id
JOIN customers cust ON opp.customer_id = cust.id
LEFT JOIN users u_created ON p.created_by = u_created.id
LEFT JOIN users u_updated ON p.updated_by = u_updated.id;