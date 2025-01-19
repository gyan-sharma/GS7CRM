import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ExternalLink, Box } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clsx } from 'clsx';

interface Environment {
  id: string;
  name: string;
  type: string;
  offer_id: string;
  offer_human_id: string;
  opportunity_id: string;
  opportunity_name: string;
  opportunity_human_id: string;
  license_duration_months: number;
  deployment_type: string;
  platform_identifier: string | null;
  platform_link: string | null;
  contract_id: string;
  contract_human_id: string;
  contract_start_date: string;
  contract_end_date: string;
  customer_name: string;
  total_mrr: number;
  components: Array<{
    id: string;
    component_name: string;
    type: string;
    size: string;
    quantity: number;
    monthly_price: number;
  }>;
}

export function EnvironmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [environment, setEnvironment] = React.useState<Environment | null>(null);
  const [editingBPaaS, setEditingBPaaS] = React.useState(false);
  const [bpaasForm, setBPaaSForm] = React.useState({
    platform_identifier: '',
    platform_link: ''
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetchEnvironment();
  }, [id]);

  React.useEffect(() => {
    if (environment) {
      setBPaaSForm({
        platform_identifier: environment.platform_identifier || '',
        platform_link: environment.platform_link || ''
      });
    }
  }, [environment]);

  const fetchEnvironment = async () => {
    try {
      console.log('Fetching environment details for ID:', id);

      console.log('Querying Supabase environments_view');
      const { data, error } = await supabase
        .from('environments_view')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase query error:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          query: {
            table: 'environments_view',
            id: id
          }
        });
        throw error;
      }

      console.log('Environment data received:', {
        id: data?.id,
        name: data?.name,
        contractId: data?.contract_id,
        components: data?.components?.length
      });

      setEnvironment(data);
    } catch (error) {
      console.error('Error fetching environment:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to load environment details');
      navigate('/environments');
    } finally {
      console.log('Environment fetch completed');
      setLoading(false);
    }
  };

  const handleSaveBPaaS = async () => {
    if (!environment) return;
    setSaving(true);
    console.log('Saving BPaaS details:', bpaasForm);

    try {
      const { error } = await supabase
        .from('environment_bpaas_details')
        .upsert({
          environment_id: environment.id,
          platform_identifier: bpaasForm.platform_identifier,
          platform_link: bpaasForm.platform_link
        }, {
          onConflict: 'environment_id'
        });

      if (error) {
        console.error('Error saving BPaaS details:', error);
        throw error;
      }

      toast.success('BPaaS platform details saved successfully');
      await fetchEnvironment();
      setEditingBPaaS(false);
    } catch (error) {
      console.error('Error saving BPaaS details:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to save BPaaS platform details');
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

  if (!environment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Environment not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Environment Details</h1>
          <p className="text-sm text-gray-500 mt-1">View environment information</p>
        </div>
      </div>

      {/* Environment Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        {/* BPaaS Platform Details */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">BPaaS Platform Details</h3>
            {!editingBPaaS && (
              <button
                onClick={() => setEditingBPaaS(true)}
                className="text-sm text-indigo-600 hover:text-indigo-900"
              >
                Edit
              </button>
            )}
          </div>
          
          {editingBPaaS ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Platform Identifier
                </label>
                <input
                  type="text"
                  value={bpaasForm.platform_identifier}
                  onChange={e => setBPaaSForm(prev => ({
                    ...prev,
                    platform_identifier: e.target.value
                  }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Platform Link
                </label>
                <input
                  type="url"
                  value={bpaasForm.platform_link}
                  onChange={e => setBPaaSForm(prev => ({
                    ...prev,
                    platform_link: e.target.value
                  }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditingBPaaS(false);
                    setBPaaSForm({
                      platform_identifier: environment.platform_identifier || '',
                      platform_link: environment.platform_link || ''
                    });
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBPaaS}
                  disabled={saving}
                  className={clsx(
                    'px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700',
                    saving && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Platform Identifier:</span>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {environment.platform_identifier || 'Not set'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Platform Link:</span>
                <p className="mt-1">
                  {environment.platform_link ? (
                    <a
                      href={environment.platform_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900"
                    >
                      {environment.platform_link}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-sm text-gray-500">Not set</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {environment.name}
            </h2>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Opportunity</div>
            <Link
              to={`/opportunities/${environment.opportunity_id}/details`}
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900"
            >
              {environment.opportunity_name}
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Offer</div>
            <Link
              to={`/offers/${environment.offer_id}/details`}
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900"
            >
              {environment.offer_human_id}
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Contract</div>
            {environment.contract_id ? (
                  <Link
                    to={`/contracts/${environment.contract_id}/details`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900"
                  >
                    {environment.contract_human_id}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
            ) : (
              <span className="text-sm text-gray-500">No Contract</span>
            )}
          </div>
        </div>
      </div>

      {/* Contract Dates */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Start Date</div>
            <div className="text-sm font-medium text-gray-900">
              {environment.contract_start_date ? new Date(environment.contract_start_date).toLocaleDateString() : 'N/A'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-gray-500">End Date</div>
            <div className="text-sm font-medium text-gray-900">
              {environment.contract_end_date ? new Date(environment.contract_end_date).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Monthly Recurring Revenue</div>
            <div className="text-lg font-semibold text-indigo-600">
              €{environment.total_mrr.toLocaleString()}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Annual Recurring Revenue</div>
            <div className="text-lg font-semibold text-indigo-600">
              €{(environment.total_mrr * 12).toLocaleString()}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-gray-500">Total Contract Value</div>
            <div className="text-lg font-semibold text-indigo-600">
              €{(environment.total_mrr * environment.license_duration_months).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Components</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monthly Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {environment.components.map(comp => (
              <tr key={comp.id}>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{comp.component_name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{comp.type}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={clsx(
                    'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                    comp.size === 'Small' ? 'bg-green-100 text-green-800' :
                    comp.size === 'Medium' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  )}>
                    {comp.size}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-right">{comp.quantity}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                  €{comp.monthly_price.toLocaleString()}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                  €{(comp.monthly_price * comp.quantity).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}