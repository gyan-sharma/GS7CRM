import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import { clsx } from 'clsx';

interface Project {
  id: string;
  project_human_id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  contract_id: string;
  contract_human_id: string;
  customer_name: string;
  total_contract_value: number;
  team_members: Array<{
    id: string;
    name: string;
    role: string;
    email: string;
    phone: string;
    allocation_percentage: number;
    start_date: string;
    end_date: string;
  }>;
  tasks: Array<{
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
  }>;
  payment_milestones: Array<{
    id: string;
    title: string;
    description: string;
    amount: number;
    due_date: string;
    status: string;
    payment_date: string | null;
    invoice_number: string | null;
  }>;
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Ensure we have safe access to arrays even when project is null
  const teamMembers = project?.team_members || [];
  const tasks = project?.tasks || [];
  const paymentMilestones = project?.payment_milestones || [];

  React.useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('project_details_view')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project details');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'On Hold':
        return 'bg-yellow-100 text-yellow-800';
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

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-gray-100 text-gray-800';
      case 'Invoiced':
        return 'bg-yellow-100 text-yellow-800';
      case 'Paid':
        return 'bg-green-100 text-green-800';
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

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Project Details</h1>
          <p className="text-sm text-gray-500 mt-1">
            {project.project_human_id} - {project.customer_name}
          </p>
        </div>
        <Button
          onClick={() => navigate(`/projects/${id}`)}
          className="flex items-center gap-2"
        >
          Edit Project
        </Button>
      </div>

      {/* Project Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
            <div className="mt-2">
              <span className={clsx(
                'px-2 py-1 text-xs font-medium rounded-full',
                getStatusColor(project.status)
              )}>
                {project.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Contract Value</div>
            <div className="text-xl font-semibold text-indigo-600">
              €{project.total_contract_value.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: project.description }} />

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-gray-500">Start Date</div>
            <div className="mt-1 text-sm font-medium text-gray-900">
              {new Date(project.start_date).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">End Date</div>
            <div className="mt-1 text-sm font-medium text-gray-900">
              {new Date(project.end_date).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900">Team Members</h2>
          <Button
            onClick={() => navigate(`/projects/${id}/team`)}
            className="flex items-center gap-2"
          >
            Manage Team
          </Button>
        </div>
        
        {teamMembers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map(member => (
              <div
                key={member.id}
                className="bg-gray-50 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} size="sm" />
                  <div>
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.role}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {member.allocation_percentage}% Allocation
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(member.start_date).toLocaleDateString()} - {new Date(member.end_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center">No team members assigned yet</p>
        )}
      </div>

      {/* Tasks */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900">Tasks</h2>
          <Button
            onClick={() => navigate(`/projects/${id}/tasks`)}
            className="flex items-center gap-2"
          >
            Manage Tasks
          </Button>
        </div>

        {tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.map(task => (
              <div
                key={task.id}
                className="bg-gray-50 rounded-lg p-4"
                style={{ marginLeft: `${(task.level - 1) * 2}rem` }}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-gray-500">{task.description}</div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full font-medium',
                        getStatusColor(task.status)
                      )}>
                        {task.status}
                      </span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full font-medium',
                        getPriorityColor(task.priority)
                      )}>
                        {task.priority} Priority
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>Due: {new Date(task.due_date).toLocaleDateString()}</div>
                    {task.completed_date && (
                      <div>Completed: {new Date(task.completed_date).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center">No tasks created yet</p>
        )}
      </div>

      {/* Payment Milestones */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900">Payment Milestones</h2>
          <Button
            onClick={() => navigate(`/projects/${id}/milestones`)}
            className="flex items-center gap-2"
          >
            Manage Milestones
          </Button>
        </div>

        {paymentMilestones.length > 0 ? (
          <div className="space-y-4">
            {paymentMilestones.map(milestone => (
              <div
                key={milestone.id}
                className="bg-gray-50 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">{milestone.title}</div>
                    {milestone.description && (
                      <div className="text-sm text-gray-500">{milestone.description}</div>
                    )}
                    <div className="text-sm font-medium text-indigo-600">
                      €{milestone.amount.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      getMilestoneStatusColor(milestone.status)
                    )}>
                      {milestone.status}
                    </span>
                    <div className="mt-1 text-xs text-gray-500">
                      Due: {new Date(milestone.due_date).toLocaleDateString()}
                    </div>
                    {milestone.payment_date && (
                      <div className="text-xs text-gray-500">
                        Paid: {new Date(milestone.payment_date).toLocaleDateString()}
                      </div>
                    )}
                    {milestone.invoice_number && (
                      <div className="text-xs text-gray-500">
                        Invoice: {milestone.invoice_number}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center">No payment milestones defined yet</p>
        )}
      </div>
    </div>
  );
}