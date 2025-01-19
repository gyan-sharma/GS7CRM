import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { Combobox } from '../../components/ui/Combobox';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const PROJECT_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'] as const;

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
}

export function ProjectForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const contractId = searchParams.get('contract');
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    status: PROJECT_STATUSES[0]
  });

  const isNewProject = id === 'new';

  React.useEffect(() => {
    if (!isNewProject) {
      fetchProject();
    } else {
      setLoading(false);
    }
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
      setFormData({
        name: data.name,
        description: data.description || '',
        start_date: new Date(data.start_date).toISOString().split('T')[0],
        end_date: new Date(data.end_date).toISOString().split('T')[0],
        status: data.status
      });
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project details');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to update a project');
      return;
    }

    setSaving(true);
    try {
      if (isNewProject) {
        if (!contractId) {
          throw new Error('Contract ID is required');
        }

        const { error } = await supabase
          .from('projects')
          .insert({
            ...formData,
            contract_id: contractId,
            project_human_id: `PRJ${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            created_by: user.id,
            updated_by: user.id
          });

        if (error) throw error;
        toast.success('Project created successfully');
      } else {
        const { error } = await supabase
          .from('projects')
          .update({
            ...formData,
            updated_by: user.id
          })
          .eq('id', id);

        if (error) throw error;
        toast.success('Project updated successfully');
      }

      navigate('/projects');
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error(isNewProject ? 'Failed to create project' : 'Failed to update project');
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNewProject ? 'Create Project' : 'Edit Project'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Project Details</h2>
          <div className="space-y-6">
            <div>
              <FormInput
                label="Project Name"
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <RichTextEditor
                label="Description"
                value={formData.description}
                onChange={value => setFormData(prev => ({ ...prev, description: value }))}
                placeholder="Enter project description..."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <FormInput
                  label="Start Date"
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    start_date: e.target.value
                  }))}
                />
              </div>

              <div>
                <FormInput
                  label="End Date"
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    end_date: e.target.value
                  }))}
                />
              </div>

              <div>
                <Combobox
                  label="Status"
                  value={formData.status}
                  onChange={status => setFormData(prev => ({ ...prev, status }))}
                  options={PROJECT_STATUSES}
                  placeholder="Select status..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/projects')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isNewProject ? 'Create Project' : 'Update Project'}
          </Button>
        </div>
      </form>
    </div>
  );
}