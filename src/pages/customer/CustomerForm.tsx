import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { Combobox } from '../../components/ui/Combobox';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { INDUSTRIES, REGIONS, EMPLOYEE_RANGES } from '../../constants/customers';
import countries from '../../constants/countries.json';

type Customer = Database['public']['Tables']['customers']['Row'];

export function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = React.useState<Customer | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    company_name: '',
    industry: INDUSTRIES[0],
    country: countries[0],
    region: REGIONS[0],
    website: '',
    number_of_employees: EMPLOYEE_RANGES[0],
    hubspot_id: '',
    contact_person: '',
    email: '',
    phone: ''
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
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
      setFormData({
        company_name: data.company_name,
        industry: data.industry,
        country: data.country,
        region: data.region,
        website: data.website || '',
        number_of_employees: data.number_of_employees,
        hubspot_id: data.hubspot_id || '',
        contact_person: data.contact_person,
        email: data.email,
        phone: data.phone || ''
      });
    } catch (error) {
      console.error('Error fetching customer:', error);
      toast.error('Failed to load customer details');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        company_human_id: isNewItem ? `CUS${Math.random().toString(36).substr(2, 6).toUpperCase()}` : item?.company_human_id
      };

      if (isNewItem) {
        const { error } = await supabase
          .from('customers')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Customer created successfully');
      } else {
        const { error } = await supabase
          .from('customers')
          .update(dataToSave)
          .eq('id', id);

        if (error) throw error;
        toast.success('Customer updated successfully');
      }

      navigate('/customers');
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(isNewItem ? 'Failed to create customer' : 'Failed to update customer');
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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNewItem ? 'Create Customer' : 'Edit Customer'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Details */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Company Details</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput
                label="Company Name"
                type="text"
                id="company_name"
                required
                value={formData.company_name}
                onChange={e =>
                  setFormData(prev => ({ ...prev, company_name: e.target.value }))
                }
              />
            </div>

            <div>
              <Combobox
                label="Industry"
                value={formData.industry}
                onChange={industry => setFormData(prev => ({ ...prev, industry }))}
                options={INDUSTRIES}
                placeholder="Select industry..."
              />
            </div>

            <div>
              <Combobox
                label="Country"
                value={formData.country}
                onChange={country => setFormData(prev => ({ ...prev, country }))}
                options={countries}
                placeholder="Select country..."
              />
            </div>

            <div>
              <Combobox
                label="Region"
                value={formData.region}
                onChange={region => setFormData(prev => ({ ...prev, region }))}
                options={REGIONS}
                placeholder="Select region..."
              />
            </div>

            <div>
              <Combobox
                label="Number of Employees"
                value={formData.number_of_employees}
                onChange={number_of_employees => setFormData(prev => ({ ...prev, number_of_employees }))}
                options={EMPLOYEE_RANGES}
                placeholder="Select employee range..."
              />
            </div>

            <div className="sm:col-span-2">
              <FormInput
                label="Website"
                type="url"
                id="website"
                value={formData.website}
                onChange={e =>
                  setFormData(prev => ({ ...prev, website: e.target.value }))
                }
              />
            </div>

            <div>
              <FormInput
                label="HubSpot ID"
                type="text"
                id="hubspot_id"
                value={formData.hubspot_id}
                onChange={e =>
                  setFormData(prev => ({ ...prev, hubspot_id: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Contact Details</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput
                label="Contact Person"
                type="text"
                id="contact_person"
                required
                value={formData.contact_person}
                onChange={e =>
                  setFormData(prev => ({ ...prev, contact_person: e.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <FormInput
                label="Email"
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={e =>
                  setFormData(prev => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <FormInput
                label="Phone"
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={e =>
                  setFormData(prev => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/customers')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isNewItem ? 'Create Customer' : 'Update Customer'}
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
              <dt className="text-sm font-medium text-gray-500">Customer ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{item.company_human_id}</dd>
            </div>
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