import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { Combobox } from '../../components/ui/Combobox';
import { Modal } from '../../components/ui/Modal';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';

interface Task {
  id: string;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string;
  start_date: string;
  due_date: string;
  completed_date: string | null;
  level: number;
  path: string[];
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
const TASK_PRIORITIES = ['Low', 'Medium', 'High'] as const;

export function TaskManagement() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [taskToDelete, setTaskToDelete] = React.useState<Task | null>(null);
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    status: TASK_STATUSES[0],
    priority: TASK_PRIORITIES[0],
    assigned_to: '',
    parent_task_id: '',
    start_date: '',
    due_date: '',
    completed_date: ''
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      fetchTasks(),
      fetchTeamMembers()
    ]);
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('project_team_members')
        .select('id, name, role')
        .eq('project_id', projectId);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Clean up the data before submission
    const cleanedData = {
      ...formData,
      parent_task_id: formData.parent_task_id || null, // Convert empty string to null
      assigned_to: formData.assigned_to || null, // Convert empty string to null
      completed_date: formData.status === 'Completed' ? new Date().toISOString() : null
    };

    try {
      const { error } = await supabase
        .from('project_tasks')
        .insert({
          project_id: projectId,
          ...cleanedData
        });

      if (error) throw error;

      toast.success('Task added successfully');
      setShowAddModal(false);
      setFormData({
        title: '',
        description: '',
        status: TASK_STATUSES[0],
        priority: TASK_PRIORITIES[0],
        assigned_to: '',
        parent_task_id: '',
        start_date: '',
        due_date: '',
        completed_date: ''
      });
      await fetchTasks();
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;

    try {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', taskToDelete.id);

      if (error) throw error;

      toast.success('Task deleted successfully');
      setTaskToDelete(null);
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low':
        return 'bg-green-100 text-green-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'High':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Task Management</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate(`/projects/${projectId}/details`)}
            variant="secondary"
          >
            Back to Project
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white shadow rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-sm text-gray-500">{task.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      getStatusColor(task.status)
                    )}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      value={task.status}
                      onChange={async (e) => {
                        try {
                          if (!user) {
                            toast.error('You must be logged in to update task status');
                            return;
                          }

                          const { error } = await supabase
                            .from('project_tasks')
                            .update({
                              status: e.target.value,
                              updated_by: user.id,
                              completed_date: e.target.value === 'Completed' ? new Date().toISOString() : null
                            })
                            .eq('id', task.id);

                          if (error) throw error;
                          toast.success('Task status updated successfully');
                          await fetchTasks();
                        } catch (error) {
                          console.error('Error updating task status:', error);
                          toast.error('Failed to update task status');
                        }
                      }}
                    >
                      {TASK_STATUSES.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      getPriorityColor(task.priority)
                    )}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {teamMembers.find(m => m.id === task.assigned_to)?.name || 'Unassigned'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setTaskToDelete(task)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No tasks created yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Task Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Task"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Title"
            type="text"
            required
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />

          <RichTextEditor
            label="Description"
            value={formData.description}
            onChange={value => setFormData(prev => ({ ...prev, description: value }))}
            placeholder="Enter task description..."
          />

          <div className="grid grid-cols-2 gap-4">
            <Combobox
              label="Status"
              value={formData.status}
              onChange={status => setFormData(prev => ({ ...prev, status }))}
              options={TASK_STATUSES}
              placeholder="Select status..."
            />

            <Combobox
              label="Priority"
              value={formData.priority}
              onChange={priority => setFormData(prev => ({ ...prev, priority }))}
              options={TASK_PRIORITIES}
              placeholder="Select priority..."
            />
          </div>

          <Combobox
            label="Assigned To"
            value={teamMembers.find(m => m.id === formData.assigned_to)?.name || ''}
            onChange={value => {
              const member = teamMembers.find(m => m.name === value);
              setFormData(prev => ({
                ...prev,
                assigned_to: member?.id || ''
              }));
            }}
            options={teamMembers.map(m => m.name)}
            placeholder="Select team member..."
          />

          <Combobox
            label="Parent Task"
            value={tasks.find(t => t.id === formData.parent_task_id)?.title || ''}
            onChange={value => {
              const task = tasks.find(t => t.title === value);
              setFormData(prev => ({
                ...prev,
                parent_task_id: task?.id || ''
              }));
            }}
            options={tasks.map(t => t.title)}
            placeholder="Select parent task..."
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Start Date"
              type="date"
              required
              value={formData.start_date}
              onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
            />

            <FormInput
              label="Due Date"
              type="date"
              required
              value={formData.due_date}
              onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Add Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="Confirm Delete Task"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the task{' '}
            <span className="font-medium">{taskToDelete?.title}</span>?
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setTaskToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}