import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { Combobox } from '../../components/ui/Combobox';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';

type Service = Database['public']['Tables']['services']['Row'];

const CATEGORIES = [
  'Core Services',
  'Supporting Services',
  'Ancillary Services',
  'Additional Costs'
] as const;

export function ServiceForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = React.useState<Service | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    category: CATEGORIES[0],
    manday_rate: '300'
  });

  const isNewItem = id === 'new';

  React.useEffect(() => {
    if (!isNewItem) {
      fetchItem();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
      setFormData({
        name: data.name,
        category: data.category as typeof CATEGORIES[number],
        manday_rate: data.manday_rate.toString()
      });
    } catch (error) {
      console.error('Error fetching service:', error);
      toast.error('Failed to load service details');
      navigate('/services');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const mandayRate = parseFloat(formData.manday_rate) || 300;
      const dataToSave = {
        ...formData,
        manday_rate: mandayRate
      };

      if (isNewItem) {
        const { error } = await supabase
          .from('services')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Service created successfully');
      } else {
        const { error } = await supabase
          .from('services')
          .update(dataToSave)
          .eq('id', id);

        if (error) throw error;
        toast.success('Service updated successfully');
      }

      navigate('/services');
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(isNewItem ? 'Failed to create service' : 'Failed to update service');
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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNewItem ? 'Create Service' : 'Edit Service'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Service Details</h2>
          
          <div className="space-y-4">
            <div>
              <FormInput
                label="Service Name"
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={e =>
                  setFormData(prev => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div>
              <div className="relative mt-1">
                <Combobox
                  label="Category"
                  value={formData.category}
                  onChange={category => setFormData(prev => ({ ...prev, category }))}
                  options={CATEGORIES}
                  placeholder="Select category..."
                />
              </div>
            </div>

            <div>
              <FormInput
                label="Manday Rate (€)"
                type="number"
                id="manday_rate"
                pattern="[0-9]*\.?[0-9]*"
                value={formData.manday_rate}
                onChange={e =>
                  setFormData(prev => ({ ...prev, manday_rate: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/services')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isNewItem ? 'Create Service' : 'Update Service'}
          </Button>
        </div>
      </form>

      {!isNewItem && item && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Additional Information
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(item.created_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(item.updated_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}