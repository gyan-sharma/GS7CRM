import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { FormInput } from '../ui/FormInput';
import { Combobox } from '../ui/Combobox';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

type ServiceSet = Database['public']['Tables']['offer_service_sets']['Row'];
type ServiceComponent = Database['public']['Tables']['offer_service_components']['Row'];
type Service = Database['public']['Tables']['services']['Row'];
type Partner = Database['public']['Tables']['partners']['Row'];

interface ProjectServicesProps {
  offerId: string;
  readOnly?: boolean;
  disabled?: boolean;
  onServiceSetsChange?: (serviceSets: Array<{
    name: string;
    subcontractor_id: string | null;
    duration_months: number;
    services: Array<{
      service_name: string;
      manday_rate: number;
      number_of_mandays: number;
      profit_percentage: number;
    }>;
  }>) => void;
}

export function ProjectServices({
  offerId,
  readOnly = false,
  disabled = false,
  onServiceSetsChange
}: ProjectServicesProps) {
  const [serviceSets, setServiceSets] = React.useState<Array<ServiceSet & {
    services: Array<ServiceComponent & {
      total_cost: number;
    }>;
  }>>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Service selector state
  const [selectedService, setSelectedService] = React.useState<{
    name: string;
    manday_rate: string;
    number_of_mandays: string;
    profit_percentage: string;
  }>({
    name: '',
    manday_rate: '',
    number_of_mandays: '1',
    profit_percentage: '20'
  });

  React.useEffect(() => {
    fetchData();
  }, [offerId]);
  
  const fetchData = async () => {
    try {
      // Skip fetching if no offerId (new offer)
      if (!offerId) {
        setServiceSets([]);
        const [servicesData, partnersData] = await Promise.all([
          supabase
            .from('services')
            .select('*')
            .order('name', { ascending: true }),
          supabase
            .from('partners')
            .select('*')
            .eq('is_delivery_subcontractor', true)
            .order('company_name', { ascending: true })
        ]);

        if (servicesData.error) throw servicesData.error;
        if (partnersData.error) throw partnersData.error;
        
        setServices(servicesData.data || []);
        setPartners(partnersData.data || []);
        return;
      }

      const [serviceSetsResponse, servicesResponse, partnersResponse] = await Promise.all([
        supabase
          .from('offer_service_sets')
          .select(`
            *,
            services:offer_service_components(*)
          `)
          .eq('offer_id', offerId)
          .order('created_at', { ascending: true }),
        supabase
          .from('services')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('partners')
          .select('*')
          .eq('is_delivery_subcontractor', true)
          .order('company_name', { ascending: true })
      ]);

      if (serviceSetsResponse.error) throw serviceSetsResponse.error;
      if (servicesResponse.error) throw servicesResponse.error;
      if (partnersResponse.error) throw partnersResponse.error;

      // Calculate total cost for each service
      const enrichedServiceSets = serviceSetsResponse.data.map(set => ({
        ...set,
        services: (set.services || []).map(service => ({
          ...service,
          total_cost: service.manday_rate * service.number_of_mandays * (1 + service.profit_percentage / 100)
        }))
      }));

      setServiceSets(enrichedServiceSets);
      setServices(servicesResponse.data || []);
      setPartners(partnersResponse.data || []);

      // Notify parent of service set changes if callback provided
      if (onServiceSetsChange) {
        onServiceSetsChange(enrichedServiceSets.map(set => ({
          name: set.name,
          subcontractor_id: set.subcontractor_id,
          duration_months: set.duration_months,
          services: set.services.map(service => ({
            service_name: service.service_name,
            manday_rate: service.manday_rate,
            number_of_mandays: service.number_of_mandays,
            profit_percentage: service.profit_percentage
          }))
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addServiceSet = async () => {
    try {
      setSaving(true);
      
      // For new offers, just update local state
      if (!offerId) {
        const newServiceSet = {
          id: `temp-${Date.now()}`,
          offer_id: '',
          service_set_human_id: `SVC${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: 'New Service Set',
          duration_months: 12,
          subcontractor_id: null,
          services_summary: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          services: []
        };

        setServiceSets(prev => [...prev, newServiceSet]);

        // Notify parent of service set changes
        if (onServiceSetsChange) {
          onServiceSetsChange([...serviceSets, {
            name: newServiceSet.name,
            subcontractor_id: newServiceSet.subcontractor_id,
            duration_months: newServiceSet.duration_months,
            services: []
          }]);
        }
        return;
      }

      const { data, error } = await supabase
        .from('offer_service_sets')
        .insert({
          offer_id: offerId,
          service_set_human_id: `SVC${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: 'New Service Set',
          duration_months: 12,
          subcontractor_id: null,
          services_summary: ''
        })
        .select()
        .single();

      if (error) throw error;
      
      setServiceSets(prev => [...prev, { ...data, services: [] }]);
    } catch (error) {
      console.error('Error adding service set:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateServiceSet = async (
    serviceSetId: string,
    updates: Partial<ServiceSet>
  ) => {
    try {
      // Update local state first for immediate feedback
      setServiceSets(prev =>
        prev.map(set =>
          set.id === serviceSetId
            ? { ...set, ...updates }
            : set
        )
      );

      // For new offers, just update local state
      if (!offerId || serviceSetId.startsWith('temp-')) {
        // Notify parent of service set changes
        if (onServiceSetsChange) {
          onServiceSetsChange(serviceSets.map(set => ({
            name: set.name,
            subcontractor_id: set.subcontractor_id,
            duration_months: set.duration_months,
            services: set.services.map(service => ({
              service_name: service.service_name,
              manday_rate: service.manday_rate,
              number_of_mandays: service.number_of_mandays,
              profit_percentage: service.profit_percentage
            }))
          })));
        }
        return;
      }

      const { error } = await supabase
        .from('offer_service_sets')
        .update(updates)
        .eq('id', serviceSetId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating service set:', error);
      // Revert local state on error
      await fetchData();
      toast.error('Failed to update service set');
    }
  };

  const deleteServiceSet = async (serviceSetId: string) => {
    try {
      // For new offers, just update local state
      if (!offerId || serviceSetId.startsWith('temp-')) {
        setServiceSets(prev =>
          prev.filter(set => set.id !== serviceSetId)
        );

        // Notify parent of service set changes
        if (onServiceSetsChange) {
          onServiceSetsChange(serviceSets.filter(set => set.id !== serviceSetId).map(set => ({
            name: set.name,
            subcontractor_id: set.subcontractor_id,
            duration_months: set.duration_months,
            services: set.services.map(service => ({
              service_name: service.service_name,
              manday_rate: service.manday_rate,
              number_of_mandays: service.number_of_mandays,
              profit_percentage: service.profit_percentage
            }))
          })));
        }
        return;
      }

      const { error } = await supabase
        .from('offer_service_sets')
        .delete()
        .eq('id', serviceSetId);

      if (error) throw error;

      setServiceSets(prev =>
        prev.filter(set => set.id !== serviceSetId)
      );
    } catch (error) {
      console.error('Error deleting service set:', error);
    }
  };

  const addService = async (serviceSetId: string) => {
    try {
      // Skip API call for new offers
      if (!offerId) {
        const serviceData = services.find(s => s.name === selectedService.name);
        if (!serviceData) {
          toast.error('Invalid service configuration');
          return;
        }

        const mandayRate = parseFloat(selectedService.manday_rate) || serviceData.manday_rate;
        const numberOfMandays = parseInt(selectedService.number_of_mandays);
        const profitPercentage = parseFloat(selectedService.profit_percentage);

        if (isNaN(numberOfMandays) || numberOfMandays < 1) {
          toast.error('Invalid number of mandays');
          return;
        }

        if (isNaN(profitPercentage) || profitPercentage < 0) {
          toast.error('Invalid profit percentage');
          return;
        }

        const newService = {
          id: `temp-${Date.now()}`,
          service_set_id: serviceSetId,
          service_name: selectedService.name,
          manday_rate: mandayRate,
          number_of_mandays: numberOfMandays,
          profit_percentage: profitPercentage,
          total_cost: mandayRate * numberOfMandays * (1 + profitPercentage / 100),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setServiceSets(prev =>
          prev.map(set => {
            if (set.id === serviceSetId) {
              return {
                ...set,
                services: [...set.services, newService]
              };
            }
            return set;
          })
        );

        // Reset service selector
        setSelectedService({
          name: '',
          manday_rate: '',
          number_of_mandays: '1',
          profit_percentage: '20'
        });

        // Notify parent of service set changes
        if (onServiceSetsChange) {
          const updatedServiceSets = serviceSets.map(set => ({
            name: set.name,
            subcontractor_id: set.subcontractor_id,
            duration_months: set.duration_months,
            services: set.id === serviceSetId 
              ? [...set.services, {
                  service_name: selectedService.name,
                  manday_rate: mandayRate,
                  number_of_mandays: numberOfMandays,
                  profit_percentage: profitPercentage
                }]
              : set.services.map(service => ({
                  service_name: service.service_name,
                  manday_rate: service.manday_rate,
                  number_of_mandays: service.number_of_mandays,
                  profit_percentage: service.profit_percentage
                }))
          }));
          onServiceSetsChange(updatedServiceSets);
        }

        return;
      }

      // Find service data
      const serviceData = services.find(s => s.name === selectedService.name);
      if (!serviceData) {
        throw new Error('Invalid service configuration');
      }

      const mandayRate = parseFloat(selectedService.manday_rate) || serviceData.manday_rate;
      const numberOfMandays = parseInt(selectedService.number_of_mandays);
      const profitPercentage = parseFloat(selectedService.profit_percentage);

      if (isNaN(numberOfMandays) || numberOfMandays < 1) {
        throw new Error('Invalid number of mandays');
      }

      if (isNaN(profitPercentage) || profitPercentage < 0) {
        throw new Error('Invalid profit percentage');
      }

      const { data, error } = await supabase
        .from('offer_service_components')
        .insert({
          service_set_id: serviceSetId,
          service_name: selectedService.name,
          manday_rate: mandayRate,
          number_of_mandays: numberOfMandays,
          profit_percentage: profitPercentage
        })
        .select()
        .single();

      if (error) throw error;

      setServiceSets(prev =>
        prev.map(set =>
          set.id === serviceSetId
            ? {
                ...set,
                services: [
                  ...set.services,
                  {
                    ...data,
                    total_cost: data.manday_rate * data.number_of_mandays * (1 + data.profit_percentage / 100)
                  }
                ]
              }
            : set
        )
      );

      // Reset service selector
      setSelectedService({
        name: '',
        manday_rate: '',
        number_of_mandays: '1',
        profit_percentage: '20'
      });
    } catch (error) {
      console.error('Error adding service:', error);
    }
  };

  const deleteService = async (serviceSetId: string, serviceId: string) => {
    try {
      setServiceSets(prev =>
        prev.map(set =>
          set.id === serviceSetId
            ? {
                ...set,
                services: set.services.filter(service => service.id !== serviceId)
              }
            : set
        )
      );

      // Notify parent of service set changes
      if (onServiceSetsChange) {
        const updatedServiceSets = serviceSets.map(set => ({
          name: set.name,
          subcontractor_id: set.subcontractor_id,
          duration_months: set.duration_months,
          services: set.id === serviceSetId
            ? set.services.filter(service => service.id !== serviceId).map(service => ({
                service_name: service.service_name,
                manday_rate: service.manday_rate,
                number_of_mandays: service.number_of_mandays,
                profit_percentage: service.profit_percentage
              }))
            : set.services.map(service => ({
                service_name: service.service_name,
                manday_rate: service.manday_rate,
                number_of_mandays: service.number_of_mandays,
                profit_percentage: service.profit_percentage
              }))
        }));
        onServiceSetsChange(updatedServiceSets);
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const calculateTotalCost = (serviceSet: typeof serviceSets[0]) => {
    return serviceSet.services.reduce((sum, service) => sum + service.total_cost, 0);
  };
  
  const calculateOverallCost = () => {
    return serviceSets.reduce((sum, set) => sum + calculateTotalCost(set), 0);
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
        {!readOnly && <h2 className="text-lg font-medium text-gray-900">Project Services</h2>}
        {!readOnly && !disabled && (
          <Button
            type="button"
            onClick={addServiceSet}
            className="flex items-center gap-2"
            isLoading={saving}
          >
            <Plus className="w-4 h-4" />
            Add Service Set
          </Button>
        )}
      </div>

      {serviceSets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">No service sets added yet.</p>
          {!readOnly && !disabled && (
            <Button
              variant="secondary"
              type="button"
              className="mt-4"
              onClick={addServiceSet}
              isLoading={saving}
            >
              Add Your First Service Set
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {serviceSets.map(serviceSet => (
            <div
              key={serviceSet.id}
              className="bg-white shadow rounded-lg overflow-hidden"
            >
              {/* Service Set Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Service Set:</span>
                      <span className="text-sm font-medium text-gray-900">{serviceSet.service_set_human_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Name:</span>
                      {readOnly ? (
                        <span className="text-sm text-gray-900">{serviceSet.name}</span>
                      ) : (
                        <input
                          type="text"
                          value={serviceSet.name}
                          onChange={e => updateServiceSet(serviceSet.id, { name: e.target.value })}
                          disabled={disabled}
                          className="text-sm text-gray-900 bg-transparent border-none p-0 focus:ring-0"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Duration:</span>
                      {readOnly ? (
                        <span className="text-sm text-gray-900">{serviceSet.duration_months} months</span>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          value={serviceSet.duration_months}
                          onChange={e => updateServiceSet(serviceSet.id, { duration_months: parseInt(e.target.value) })}
                          disabled={disabled}
                          className="text-sm text-gray-900 bg-transparent border-none p-0 w-16 focus:ring-0"
                        />
                      )}
                    </div>
                  </div>
                  {!readOnly && !disabled && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => deleteServiceSet(serviceSet.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Service Set Details */}
              <div className="p-4 space-y-4">

                {/* Service Selection */}
                {!readOnly && !disabled && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Add Service
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                      <div>
                        <Combobox
                          label="Service"
                          value={selectedService.name}
                          onChange={value => {
                            const service = services.find(s => s.name === value);
                            setSelectedService(prev => ({
                              ...prev,
                              name: value,
                              manday_rate: service ? service.manday_rate.toString() : prev.manday_rate
                            }));
                          }}
                          options={services.map(s => s.name)}
                          placeholder="Select service..."
                        />
                      </div>
                      <div>
                        <FormInput
                          label="Manday Rate"
                          type="number"
                          min="0"
                          step="0.01"
                          value={selectedService.manday_rate}
                          onChange={e =>
                            setSelectedService(prev => ({
                              ...prev,
                              manday_rate: e.target.value
                            }))
                          }
                        />
                      </div>
                      <div>
                        <FormInput
                          label="Number of Mandays"
                          type="number"
                          min="1"
                          value={selectedService.number_of_mandays}
                          onChange={e =>
                            setSelectedService(prev => ({
                              ...prev,
                              number_of_mandays: e.target.value
                            }))
                          }
                        />
                      </div>
                      <div>
                        <FormInput
                          label="Profit Percentage"
                          type="number"
                          min="0"
                          step="0.01"
                          value={selectedService.profit_percentage}
                          onChange={e =>
                            setSelectedService(prev => ({
                              ...prev,
                              profit_percentage: e.target.value
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        onClick={() => addService(serviceSet.id)}
                        disabled={
                          !selectedService.name ||
                          !selectedService.number_of_mandays ||
                          !selectedService.profit_percentage
                        }
                      >
                        Add Service
                      </Button>
                    </div>
                  </div>
                )}

                {/* Services Table */}
                <div>
                  <div>
                    <table className="w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Service Name
                          </th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Manday Rate
                          </th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Number of Mandays
                          </th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Profit %
                          </th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Cost
                          </th>
                          {!readOnly && !disabled && (
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {serviceSet.services.map(service => (
                          <tr key={service.id}>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">
                              {service.service_name}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500 text-right">
                              €{service.manday_rate.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500 text-right">
                              {service.number_of_mandays}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-500 text-right">
                              {service.profit_percentage}%
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              €{service.total_cost.toLocaleString()}
                            </td>
                            {!readOnly && !disabled && (
                              <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() =>
                                    deleteService(serviceSet.id, service.id)
                                  }
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {serviceSet.services.length === 0 && (
                          <tr>
                            <td
                              colSpan={readOnly || disabled ? 5 : 6}
                              className="px-6 py-4 text-sm text-gray-500 text-center"
                            >
                              No services added yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-green-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-sm font-medium text-gray-700">
                            Total Cost
                          </td>
                          <td colSpan={readOnly ? 2 : 3} className="px-3 py-1.5 text-right">
                            <span className="text-sm font-medium text-indigo-600">
                              €{Math.ceil(calculateTotalCost(serviceSet)).toLocaleString()}
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