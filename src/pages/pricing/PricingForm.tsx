import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { Combobox } from '../../components/ui/Combobox';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { clsx } from 'clsx';

type LicensePricing = Database['public']['Tables']['license_pricing']['Row'];

const TYPES = ['Shared', 'Dedicated'] as const;
const SIZES = ['Small', 'Medium', 'Large'] as const;

export function PricingForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = React.useState<LicensePricing | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    pretty_name: '',
    type: TYPES[0],
    size: SIZES[0],
    hourly_price: ''
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
        .from('license_pricing')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
      setFormData({
        pretty_name: data.pretty_name,
        type: data.type,
        size: data.size,
        hourly_price: data.hourly_price.toString()
      });
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast.error('Failed to load pricing details');
      navigate('/pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const hourlyPrice = parseFloat(formData.hourly_price) || 0;
      const dataToSave = {
        ...formData,
        hourly_price: hourlyPrice
      };

      if (isNewItem) {
        const { error } = await supabase
          .from('license_pricing')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Pricing created successfully');
      } else {
        const { error } = await supabase
          .from('license_pricing')
          .update(formData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Pricing updated successfully');
      }

      navigate('/pricing');
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast.error(isNewItem ? 'Failed to create pricing' : 'Failed to update pricing');
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
          {isNewItem ? 'Create Pricing' : 'Edit Pricing'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Pricing Details</h2>
          
          <div className="space-y-4">
            <div>
              <FormInput
                label="Component Name"
                type="text"
                id="pretty_name"
                required
                value={formData.pretty_name}
                onChange={e =>
                  setFormData(prev => ({ ...prev, pretty_name: e.target.value }))
                }
              />
            </div>

            <div>
              <div className="relative mt-1">
                <Combobox
                label="Type"
                value={formData.type}
                onChange={type => setFormData(prev => ({ ...prev, type }))}
                options={TYPES}
                placeholder="Select type..."
                />
              </div>
            </div>

            <div>
              <div className="relative mt-1">
                <Combobox
                label="Size"
                value={formData.size}
                onChange={size => setFormData(prev => ({ ...prev, size }))}
                options={SIZES}
                placeholder="Select size..."
                />
              </div>
            </div>

            <div>
              <FormInput
                label="Hourly Price ($)"
                type="number"
                id="hourly_price"
                pattern="[0-9]*\.?[0-9]*"
                value={formData.hourly_price}
                onChange={e =>
                  setFormData(prev => ({ ...prev, hourly_price: e.target.value }))
                }
              />
              <p className="mt-1 text-sm text-gray-500">
                Monthly Price: ${((parseFloat(formData.hourly_price) || 0) * 730).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/pricing')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isNewItem ? 'Create Pricing' : 'Update Pricing'}
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