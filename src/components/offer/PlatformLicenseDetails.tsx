import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { FormInput } from '../ui/FormInput';
import { Combobox } from '../ui/Combobox';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

type LicensePricing = Database['public']['Tables']['license_pricing']['Row'];
type OfferEnvironment = Database['public']['Tables']['offer_environments']['Row'];
type OfferEnvironmentComponent = Database['public']['Tables']['offer_environment_components']['Row'];

const ENVIRONMENT_TYPES = ['Production', 'Development', 'Testing', 'Demo', 'Other'] as const;
const DEPLOYMENT_TYPES = ['Saas', 'Self-Managed'] as const;

interface PlatformLicenseDetailsProps {
  offerId: string;
  readOnly?: boolean;
  disabled?: boolean;
  onEnvironmentsChange?: (environments: Array<{
    name: string;
    type: string;
    license_duration_months: number;
    deployment_type: string;
    components: Array<{
      component_name: string;
      type: string;
      size: string;
      quantity: number;
      monthly_price: number;
    }>;
  }>) => void;
}

export function PlatformLicenseDetails({
  offerId,
  readOnly = false,
  disabled = false,
  onEnvironmentsChange
}: PlatformLicenseDetailsProps) {
  const [environments, setEnvironments] = React.useState<Array<OfferEnvironment & {
    components: Array<OfferEnvironmentComponent & {
      total_price: number;
    }>;
  }>>([]);
  const [pricing, setPricing] = React.useState<LicensePricing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Component selector state
  const [selectedComponent, setSelectedComponent] = React.useState<{
    name: string;
    type: string;
    size: string;
    quantity: string;
  }>({
    name: '',
    type: '',
    size: '',
    quantity: '1'
  }, []);

  // Get unique values from pricing data
  const componentNames = React.useMemo(() => 
    Array.from(new Set(pricing.map(p => p.pretty_name))),
    [pricing]
  );

  const componentTypes = React.useMemo(() => 
    Array.from(new Set(pricing.map(p => p.type))),
    [pricing]
  );

  const componentSizes = React.useMemo(() => 
    Array.from(new Set(pricing.map(p => p.size))),
    [pricing]
  );

  React.useEffect(() => {
    fetchData();
  }, [offerId]);
  
  const fetchData = async () => {
    try {
      // Skip fetching if no offerId (new offer)
      if (!offerId) {
        setEnvironments([]);
        const { data: pricingData, error: pricingError } = await supabase
          .from('license_pricing')
          .select('*')
          .order('pretty_name', { ascending: true });

        if (pricingError) throw pricingError;
        setPricing(pricingData || []);
        return;
      }

      const [environmentsResponse, pricingResponse] = await Promise.all([
        supabase
          .from('offer_environments')
          .select(`
            *,
            components:offer_environment_components(*)
          `)
          .eq('offer_id', offerId)
          .order('created_at', { ascending: true }),
        supabase
          .from('license_pricing')
          .select('*')
          .order('pretty_name', { ascending: true })
      ]);

      if (environmentsResponse.error) throw environmentsResponse.error;
      if (pricingResponse.error) throw pricingResponse.error;

      // Calculate total price for each component
      const enrichedEnvironments = environmentsResponse.data.map(env => ({
        ...env,
        components: (env.components || []).map(comp => ({
          ...comp,
          total_price: comp.monthly_price * comp.quantity
        }))
      }));

      setEnvironments(enrichedEnvironments);
      setPricing(pricingResponse.data || []);

      // Notify parent of environment changes if callback provided
      if (onEnvironmentsChange) {
        onEnvironmentsChange(enrichedEnvironments.map(env => ({
          name: env.name,
          type: env.type,
          license_duration_months: env.license_duration_months,
          deployment_type: env.deployment_type,
          components: env.components.map(comp => ({
            component_name: comp.component_name,
            type: comp.type,
            size: comp.size,
            quantity: comp.quantity,
            monthly_price: comp.monthly_price
          }))
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEnvironment = async () => {
    try {
      setSaving(true);
      
      // For new offers, just update local state
      if (!offerId) {
        const newEnvironment = {
          id: `temp-${Date.now()}`,
          offer_id: '',
          environment_human_id: `ENV${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: 'New Environment',
          type: ENVIRONMENT_TYPES[0],
          license_duration_months: 12,
          deployment_type: DEPLOYMENT_TYPES[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          components: []
        };

        setEnvironments(prev => [...prev, newEnvironment]);

        // Notify parent of environment changes
        if (onEnvironmentsChange) {
          onEnvironmentsChange([...environments, {
            name: newEnvironment.name,
            type: newEnvironment.type,
            license_duration_months: newEnvironment.license_duration_months,
            deployment_type: newEnvironment.deployment_type,
            components: []
          }]);
        }
        return;
      }

      const { data, error } = await supabase
        .from('offer_environments')
        .insert({
          offer_id: offerId,
          environment_human_id: `ENV${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: 'New Environment',
          type: ENVIRONMENT_TYPES[0],
          license_duration_months: 12,
          deployment_type: DEPLOYMENT_TYPES[0]
        })
        .select()
        .single();

      if (error) throw error;
      
      setEnvironments(prev => [...prev, { ...data, components: [] }]);
    } catch (error) {
      console.error('Error adding environment:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateEnvironment = async (
    environmentId: string,
    updates: Partial<OfferEnvironment>
  ) => {
    try {
      // Update local state first for immediate feedback
      setEnvironments(prev =>
        prev.map(env =>
          env.id === environmentId
            ? { ...env, ...updates }
            : env
        )
      );

      // For new offers, just update local state
      if (!offerId || environmentId.startsWith('temp-')) {
        // Notify parent of environment changes
        if (onEnvironmentsChange) {
          onEnvironmentsChange(environments.map(env => ({
            name: env.name,
            type: env.type,
            license_duration_months: env.license_duration_months,
            deployment_type: env.deployment_type,
            components: env.components.map(comp => ({
              component_name: comp.component_name,
              type: comp.type,
              size: comp.size,
              quantity: comp.quantity,
              monthly_price: comp.monthly_price
            }))
          })));
        }
        return;
      }

      const { error } = await supabase
        .from('offer_environments')
        .update(updates)
        .eq('id', environmentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating environment:', error);
      // Revert local state on error
      await fetchData();
      toast.error('Failed to update environment');
    }
  };

  const deleteEnvironment = async (environmentId: string) => {
    try {
      // For new offers, just update local state
      if (!offerId || environmentId.startsWith('temp-')) {
        setEnvironments(prev =>
          prev.filter(env => env.id !== environmentId)
        );

        // Notify parent of environment changes
        if (onEnvironmentsChange) {
          onEnvironmentsChange(environments.filter(env => env.id !== environmentId).map(env => ({
            name: env.name,
            type: env.type,
            license_duration_months: env.license_duration_months,
            deployment_type: env.deployment_type,
            components: env.components.map(comp => ({
              component_name: comp.component_name,
              type: comp.type,
              size: comp.size,
              quantity: comp.quantity,
              monthly_price: comp.monthly_price
            }))
          })));
        }
        return;
      }

      const { error } = await supabase
        .from('offer_environments')
        .delete()
        .eq('id', environmentId);

      if (error) throw error;

      setEnvironments(prev =>
        prev.filter(env => env.id !== environmentId)
      );
    } catch (error) {
      console.error('Error deleting environment:', error);
    }
  };

  const addComponent = async (environmentId: string) => {
    try {
      // Skip API call for new offers
      if (!offerId) {
        const priceData = pricing.find(p =>
          p.pretty_name === selectedComponent.name &&
          p.type === selectedComponent.type &&
          p.size === selectedComponent.size
        );

        if (!priceData) {
          toast.error('Invalid component configuration');
          return;
        }

        const quantity = parseInt(selectedComponent.quantity);
        if (isNaN(quantity) || quantity < 1) {
          toast.error('Invalid quantity');
          return;
        }

        const newComponent = {
          id: `temp-${Date.now()}`,
          environment_id: environmentId,
          component_name: selectedComponent.name,
          type: selectedComponent.type,
          size: selectedComponent.size,
          quantity: quantity,
          monthly_price: priceData.monthly_price,
          total_price: priceData.monthly_price * quantity,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setEnvironments(prev =>
          prev.map(env => {
            if (env.id === environmentId) {
              return {
                ...env,
                components: [...env.components, newComponent]
              };
            }
            return env;
          })
        );

        // Reset component selector
        setSelectedComponent({
          name: '',
          type: '',
          size: '',
          quantity: '1'
        });

        // Notify parent of environment changes
        if (onEnvironmentsChange) {
          const updatedEnvironments = environments.map(env => ({
            name: env.name,
            type: env.type,
            license_duration_months: env.license_duration_months,
            deployment_type: env.deployment_type,
            components: env.id === environmentId 
              ? [...env.components, {
                  component_name: selectedComponent.name,
                  type: selectedComponent.type,
                  size: selectedComponent.size,
                  quantity,
                  monthly_price: priceData.monthly_price
                }]
              : env.components.map(comp => ({
              component_name: comp.component_name,
              type: comp.type,
              size: comp.size,
              quantity: comp.quantity,
              monthly_price: comp.monthly_price
            }))
          }));
          onEnvironmentsChange(updatedEnvironments);
        }

        return;
      }

      // Find pricing for selected component
      const priceData = pricing.find(p =>
        p.pretty_name === selectedComponent.name &&
        p.type === selectedComponent.type &&
        p.size === selectedComponent.size
      );

      if (!priceData) {
        throw new Error('Invalid component configuration');
      }

      const quantity = parseInt(selectedComponent.quantity);
      if (isNaN(quantity) || quantity < 1) {
        throw new Error('Invalid quantity');
      }

      const { data, error } = await supabase
        .from('offer_environment_components')
        .insert({
          environment_id: environmentId,
          component_name: selectedComponent.name,
          type: selectedComponent.type,
          size: selectedComponent.size,
          quantity: quantity,
          monthly_price: priceData.monthly_price
        })
        .select()
        .single();

      if (error) throw error;

      setEnvironments(prev =>
        prev.map(env =>
          env.id === environmentId
            ? {
                ...env,
                components: [
                  ...env.components,
                  {
                    ...data,
                    total_price: data.monthly_price * data.quantity
                  }
                ]
              }
            : env
        )
      );

      // Reset component selector
      setSelectedComponent({
        name: '',
        type: '',
        size: '',
        quantity: '1'
      });
    } catch (error) {
      console.error('Error adding component:', error);
    }
  };

  const deleteComponent = async (environmentId: string, componentId: string) => {
    try {
      setEnvironments(prev =>
        prev.map(env =>
          env.id === environmentId
            ? {
                ...env,
                components: env.components.filter(comp => comp.id !== componentId)
              }
            : env
        )
      );

      // Notify parent of environment changes
      if (onEnvironmentsChange) {
        const updatedEnvironments = environments.map(env => ({
          name: env.name,
          type: env.type,
          license_duration_months: env.license_duration_months,
          deployment_type: env.deployment_type,
          components: env.id === environmentId
            ? env.components.filter(comp => comp.id !== componentId).map(comp => ({
            component_name: comp.component_name,
            type: comp.type,
            size: comp.size,
            quantity: comp.quantity,
            monthly_price: comp.monthly_price
          }))
            : env.components.map(comp => ({
                component_name: comp.component_name,
                type: comp.type,
                size: comp.size,
                quantity: comp.quantity,
                monthly_price: comp.monthly_price
              }))
        }));
        onEnvironmentsChange(updatedEnvironments);
      }
    } catch (error) {
      console.error('Error deleting component:', error);
    }
  };

  const calculateTotalMRR = (environment: typeof environments[0]) => {
    return environment.components.reduce((sum, comp) => sum + comp.total_price, 0);
  };

  const calculateTotalRevenue = (environment: typeof environments[0]) => {
    return calculateTotalMRR(environment) * environment.license_duration_months;
  };

  const calculateOverallMRR = () => {
    return environments.reduce((sum, env) => sum + calculateTotalMRR(env), 0);
  };

  const calculateOverallRevenue = () => {
    return environments.reduce((sum, env) => sum + calculateTotalRevenue(env), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!readOnly && <h2 className="text-lg font-medium text-gray-900">Platform License Details</h2>}
        {!readOnly && !disabled && (
          <Button
            type="button"
            onClick={addEnvironment}
            className="flex items-center gap-2"
            isLoading={saving}
          >
            <Plus className="w-4 h-4" />
            Add Environment
          </Button>
        )}
      </div>

      {environments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">No environments added yet.</p>
          {!readOnly && !disabled && (
            <Button
              variant="secondary"
              type="button"
              className="mt-4"
              onClick={addEnvironment}
              isLoading={saving}
            >
              Add Your First Environment
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {environments.map(environment => (
            <div
              key={environment.id}
              className="bg-white shadow rounded-lg overflow-hidden"
            >
              {/* Environment Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Environment: {environment.environment_human_id}
                    </h3>
                  </div>
                  {!readOnly && !disabled && (
                    <Button
                       type="button" 
                      variant="danger"
                      size="sm"
                      onClick={() => deleteEnvironment(environment.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Environment Details */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    {readOnly ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Environment Name</dt>
                        <dd className="mt-1 text-sm text-gray-900">{environment.name}</dd>
                      </div>
                    ) : (
                      <FormInput
                        label="Environment Name"
                        type="text"
                        id={`env-name-${environment.id}`}
                        value={environment.name}
                        onChange={e =>
                          updateEnvironment(environment.id, { name: e.target.value })
                        }
                        disabled={disabled}
                        className="bg-white"
                      />
                    )}
                  </div>
                  <div>
                    {readOnly ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Environment Type</dt>
                        <dd className="mt-1">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {environment.type}
                          </span>
                        </dd>
                      </div>
                    ) : (
                      <Combobox
                        label="Environment Type"
                        value={environment.type}
                        onChange={value =>
                          updateEnvironment(environment.id, { type: value })
                        }
                        options={ENVIRONMENT_TYPES}
                        disabled={disabled}
                      />
                    )}
                  </div>
                  <div>
                    {readOnly ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">License Duration</dt>
                        <dd className="mt-1 text-sm text-gray-900">{environment.license_duration_months} months</dd>
                      </div>
                    ) : (
                      <FormInput
                        label="License Duration (Months)"
                        type="number"
                        min="1"
                        value={environment.license_duration_months}
                        onChange={e =>
                          updateEnvironment(environment.id, {
                            license_duration_months: parseInt(e.target.value)
                          })
                        }
                        disabled={disabled}
                      />
                    )}
                  </div>
                  <div>
                    {readOnly ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Deployment Type</dt>
                        <dd className="mt-1">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            {environment.deployment_type}
                          </span>
                        </dd>
                      </div>
                    ) : (
                      <Combobox
                        label="Deployment Type"
                        value={environment.deployment_type}
                        onChange={value =>
                          updateEnvironment(environment.id, { deployment_type: value })
                        }
                        options={DEPLOYMENT_TYPES}
                        disabled={disabled}
                      />
                    )}
                  </div>
                </div>

                {/* Component Selection */}
                {!readOnly && !disabled && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Add Component
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
                      <div className="sm:col-span-2">
                        <Combobox
                          label="Component"
                          value={selectedComponent.name}
                          onChange={value =>
                            setSelectedComponent(prev => ({ ...prev, name: value }))
                          }
                          options={componentNames}
                          placeholder="Select component..."
                        />
                      </div>
                      <div>
                        <Combobox
                          label="Type"
                          value={selectedComponent.type}
                          onChange={value =>
                            setSelectedComponent(prev => ({ ...prev, type: value }))
                          }
                          options={componentTypes}
                          placeholder="Select type..."
                        />
                      </div>
                      <div>
                        <Combobox
                          label="Size"
                          value={selectedComponent.size}
                          onChange={value =>
                            setSelectedComponent(prev => ({ ...prev, size: value }))
                          }
                          options={componentSizes}
                          placeholder="Select size..."
                        />
                      </div>
                      <div>
                        <FormInput
                          label="Quantity"
                          type="number"
                          min="1"
                          value={selectedComponent.quantity}
                          onChange={e =>
                            setSelectedComponent(prev => ({
                              ...prev,
                              quantity: e.target.value
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        onClick={() => addComponent(environment.id)}
                        disabled={
                          !selectedComponent.name ||
                          !selectedComponent.type ||
                          !selectedComponent.size ||
                          !selectedComponent.quantity
                        }
                      >
                        Add Component
                      </Button>
                    </div>
                  </div>
                )}

                {/* Components Table */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-4">
                    Components
                  </h4>
                  <div>
                    <table className="w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Size
                          </th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Monthly Price
                          </th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Price
                          </th>
                          {!readOnly && !disabled && (
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {environment.components.map(component => (
                          <tr key={component.id}>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">
                              {component.component_name}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500">
                              {component.type}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500">
                              <span className={clsx(
                                'px-2.5 py-1 text-xs font-medium rounded-full',
                                component.size === 'Small' ? 'bg-green-100 text-green-800' :
                                component.size === 'Medium' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              )}>
                                {component.size}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500">
                              {component.quantity}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500 text-right">
                              €{component.monthly_price.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              €{component.total_price.toLocaleString()}
                            </td>
                            {!readOnly && !disabled && (
                              <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() =>
                                    deleteComponent(environment.id, component.id)
                                  }
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {environment.components.length === 0 && (
                          <tr>
                            <td
                              colSpan={readOnly || disabled ? 6 : 7}
                              className="px-6 py-4 text-sm text-gray-500 text-center"
                            >
                              No components added yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-green-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-sm font-medium text-gray-700">
                            Total Revenue ({environment.license_duration_months} months)
                          </td>
                          <td colSpan={readOnly ? 3 : 4} className="px-3 py-1.5 text-right">
                            <span className="text-sm font-medium text-gray-700 mr-8">
                              Monthly: €{Math.ceil(calculateTotalMRR(environment)).toLocaleString()}
                            </span>
                            <span className="text-sm font-medium text-indigo-600">
                              Total: €{Math.ceil(calculateTotalRevenue(environment)).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}