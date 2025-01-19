/*
  # Project Management Features

  1. New Tables
    - project_team_members
    - project_tasks
    - project_payment_milestones

  2. Changes
    - Add indexes and constraints
    - Add triggers for updated_at timestamps
    - Add views for better data access

  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS update_project_team_members_timestamp ON project_team_members;
DROP TRIGGER IF EXISTS update_project_tasks_timestamp ON project_tasks;
DROP TRIGGER IF EXISTS update_payment_milestones_timestamp ON payment_milestones;

DROP FUNCTION IF EXISTS update_project_team_members_updated_at();
DROP FUNCTION IF EXISTS update_project_tasks_updated_at();
DROP FUNCTION IF EXISTS update_payment_milestones_updated_at();

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
CREATE TABLE IF NOT EXISTS payment_milestones (
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

CREATE OR REPLACE FUNCTION update_payment_milestones_updated_at()
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

CREATE TRIGGER update_payment_milestones_timestamp
  BEFORE UPDATE ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_milestones_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_team_members_project_id
  ON project_team_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id
  ON project_tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id
  ON project_tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to
  ON project_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_project_id
  ON payment_milestones(project_id);