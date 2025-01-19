import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Pencil, ExternalLink, FileText, Download, Box } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { supabase } from '../../lib/supabase';
import { clsx } from 'clsx';

interface Contract {
  id: string;
  contract_human_id: string;
  contract_summary: string;
  total_contract_value: number;
  total_mrr: number;
  total_services_revenue: number;
  payment_terms: string;
  contract_start_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  // Related data
  documents: Array<{
    id: string;
    name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    created_at: string;
  }>;
  offer_human_id: string;
  offer_summary: string;
  opportunity_name: string;
  opportunity_human_id: string;
  customer_name: string;
  deal_owner_name: string;
  presales_engineer_name: string;
  environments: Array<{
    id: string;
    name: string;
    type: string;
    license_duration_months: number;
    deployment_type: string;
    components: Array<{
      id: string;
      component_name: string;
      type: string;
      size: string;
      quantity: number;
      monthly_price: number;
    }>;
  }>;
  service_sets: Array<{
    id: string;
    name: string;
    duration_months: number;
    subcontractor_id: string | null;
    services: Array<{
      id: string;
      service_name: string;
      manday_rate: number;
      number_of_mandays: number;
      profit_percentage: number;
    }>;
  }>;
}

export function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = React.useState<Contract | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchContract();
  }, [id]);

  const fetchContract = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_details_view')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setContract(data);
    } catch (error) {
      console.error('Error fetching contract:', error);
      toast.error('Failed to load contract details');
      navigate('/contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (document: Contract['documents'][0]) => {
    try {
      const { data, error } = await supabase.storage
        .from('contract-documents')
        .download(document.file_path);

      if (error) throw error;

      // Create a download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Expired':
        return 'bg-yellow-100 text-yellow-800';
      case 'Terminated':
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

  if (!contract) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Contract not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contract Details</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage contract information</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate(`/projects/new?contract=${id}`)}
            className="flex items-center gap-2"
          >
            <Box className="w-4 h-4" />
            Create Project
          </Button>
          <Button
            onClick={() => navigate(`/contracts/${id}`)}
            className="flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Contract
          </Button>
        </div>
      </div>

      {/* Contract Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-indigo-100 rounded-lg">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {contract.contract_human_id}
              </h2>
              <p className="text-sm text-gray-500">
                Created on {new Date(contract.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <span className={clsx(
            'px-3 py-1 text-sm font-medium rounded-full',
            getStatusColor(contract.status)
          )}>
            {contract.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Contract Value</h3>
            <div className="mt-2 bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Monthly Recurring Revenue:</span>
                <span className="font-medium">€{contract.total_mrr.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Services Revenue:</span>
                <span className="font-medium">€{contract.total_services_revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200">
                <span>Total Contract Value:</span>
                <span className="text-indigo-600">€{contract.total_contract_value.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Contract Terms</h3>
            <div className="mt-2 space-y-3">
              <div>
                <span className="text-sm text-gray-600">Start Date:</span>
                <p className="mt-1 text-sm font-medium">
                  {new Date(contract.contract_start_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Payment Terms:</span>
                <p className="mt-1 text-sm font-medium">{contract.payment_terms}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Contract Summary</h3>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: contract.contract_summary }} />
        </div>
      </div>

      {/* Related Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Related Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-4">Customer & Deal Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Customer</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{contract.customer_name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Deal Owner</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Avatar name={contract.deal_owner_name} size="sm" />
                  <span className="text-sm font-medium text-gray-900">{contract.deal_owner_name}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">PreSales Engineer</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Avatar name={contract.presales_engineer_name || ''} size="sm" />
                  <span className="text-sm font-medium text-gray-900">
                    {contract.presales_engineer_name || 'N/A'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-4">Related Records</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Opportunity</dt>
                <dd className="mt-1">
                  <Link
                    to={`/opportunities/${contract.opportunity_human_id}/details`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900"
                  >
                    {contract.opportunity_name}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Offer</dt>
                <dd className="mt-1">
                  <Link
                    to={`/offers/${contract.offer_human_id}/details`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900"
                  >
                    View Offer Details
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Platform License Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Platform License Details</h2>
        {contract.environments.map((env, index) => (
          <div key={env.id} className={clsx('space-y-4', index > 0 && 'mt-8')}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-900">{env.name}</h3>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {env.type}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {env.deployment_type}
                </span>
              </div>
            </div>

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
                {env.components.map(comp => (
                  <tr key={comp.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{comp.component_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{comp.type}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{comp.size}</td>
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
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-sm font-medium text-gray-900">
                    Environment Total (Monthly)
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-indigo-600">
                    €{env.components.reduce((sum, comp) => sum + (comp.monthly_price * comp.quantity), 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>

      {/* Project Services */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Project Services</h2>
        {contract.service_sets.map((set, index) => (
          <div key={set.id} className={clsx('space-y-4', index > 0 && 'mt-8')}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-900">{set.name}</h3>
              <span className="text-sm text-gray-500">
                Duration: {set.duration_months} months
              </span>
            </div>

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Manday Rate</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mandays</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Profit %</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {set.services.map(service => (
                  <tr key={service.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{service.service_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      €{service.manday_rate.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {service.number_of_mandays}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                      {service.profit_percentage}%
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      €{(service.manday_rate * service.number_of_mandays * (1 + service.profit_percentage / 100)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-900">
                    Service Set Total
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-indigo-600">
                    €{set.services.reduce((sum, service) => 
                      sum + (service.manday_rate * service.number_of_mandays * (1 + service.profit_percentage / 100)), 
                      0
                    ).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>

      {/* Contract Documents */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Contract Documents</h2>
        {contract.documents && contract.documents.length > 0 ? (
          <div className="space-y-2">
            {contract.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadDocument(doc)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center">No documents available</p>
        )}
      </div>

      {/* System Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(contract.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(contract.updated_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}