import React from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Box, Eye, Layers, Filter, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';

interface Environment {
  id: string;
  name: string;
  type: string;
  license_duration_months: number;
  deployment_type: string;
  contract_id: string;
  contract_human_id: string;
  contract_status: string | null;
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

export function EnvironmentList() {
  const [environments, setEnvironments] = React.useState<Environment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<keyof Environment>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'with_contract' | 'no_contract'>('with_contract');

  const filteredEnvironments = React.useMemo(() => {
    return environments.filter(env => {
      // First apply status filter
      if (statusFilter === 'no_contract' && env.contract_id) {
        return false;
      }
      if (statusFilter === 'with_contract' && !env.contract_id) {
        return false;
      }
      
      // Then apply search filter
      return Object.values(env).some(value => 
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [environments, statusFilter, searchQuery]);

  const getContractStatusColor = (status: string | null) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Expired':
        return 'bg-yellow-100 text-yellow-800';
      case 'Terminated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSort = (column: keyof Environment) => {
    if (column === sortColumn) {
      console.log('Reversing sort direction for column:', column);
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      console.log('Setting new sort column:', column);
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  React.useEffect(() => {
    console.log('Fetching environments with sort:', { column: sortColumn, direction: sortDirection });
    fetchEnvironments();
  }, [sortColumn, sortDirection]);

  const fetchEnvironments = async () => {
    try {
      console.log('Starting environment fetch from Supabase');
      const { data, error } = await supabase
        .from('environments_view')
        .select('*');

      if (error) {
        console.error('Supabase query error:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      if (data) {
        console.log('Received environments data:', {
          count: data.length,
          firstItem: data[0],
          lastItem: data[data.length - 1]
        });

        const sortedData = [...data].sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          
          if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
          if (bVal === null) return sortDirection === 'asc' ? -1 : 1;
          
          return sortDirection === 'asc' 
            ? aVal > bVal ? 1 : -1
            : aVal < bVal ? 1 : -1;
        });
        
        setEnvironments(sortedData);
      }
    } catch (error) {
      console.error('Error fetching environments:', error);
      toast.error('Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    const exportData = environments.map(env => ({
      'Environment Name': env.name,
      'Type': env.type,
      'Deployment Type': env.deployment_type,
      'Duration (Months)': env.license_duration_months,
      'Customer': env.customer_name,
      'Contract ID': env.contract_human_id,
      'Monthly Revenue': env.total_mrr,
      'Components': env.components.map(c => 
        `${c.component_name} (${c.type} - ${c.size}) x${c.quantity}`
      ).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Environments');
    XLSX.writeFile(wb, 'environments.xlsx');
  };

  const totalPages = Math.ceil(filteredEnvironments.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedEnvironments = filteredEnvironments.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Environments</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="with_contract">With Contract</option>
              <option value="no_contract">No Contract</option>
              <option value="all">All Environments</option>
            </select>
          </div>
          <Button
            onClick={handleExportToExcel}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search environments..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={rowsPerPage}
              onChange={e => setRowsPerPage(Number(e.target.value))}
            >
              {[10, 15, 20, 50, 100].map(value => (
                <option key={value} value={value}>
                  {value} rows
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Environment Name
                    {sortColumn === 'name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('customer_name')}
                >
                  <div className="flex items-center gap-2">
                    Customer
                    {sortColumn === 'customer_name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('contract_human_id')}
                >
                  <div className="flex items-center gap-2">
                    Contract ID
                    {sortColumn === 'contract_human_id' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('license_duration_months')}
                >
                  <div className="flex items-center gap-2">
                    Duration
                    {sortColumn === 'license_duration_months' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    Type
                    {sortColumn === 'type' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('deployment_type')}
                >
                  <div className="flex items-center gap-2">
                    Deployment
                    {sortColumn === 'deployment_type' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('total_mrr')}
                >
                  <div className="flex items-center gap-2">
                    Monthly Revenue
                    {sortColumn === 'total_mrr' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedEnvironments.map(env => (
                <tr key={env.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-indigo-100 rounded-lg">
                        <Layers className="h-5 w-5 text-indigo-600" />
                      </div>
                      <span className="ml-4 text-sm font-medium text-gray-900">
                        {env.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{env.customer_name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {env.contract_human_id ? (
                      <Link
                        to={`/contracts/${env.contract_id}/details`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900"
                      >
                        {env.contract_human_id}
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500">No Contract</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {env.license_duration_months} months
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {env.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                      {env.deployment_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-sm font-medium text-gray-900">€{env.total_mrr.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">per month</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/environments/${env.id}/details`}
                      className="text-gray-600 hover:text-gray-900"
                      onClick={() => {
                        console.log('Navigating to environment details:', {
                          id: env.id,
                          name: env.name,
                          customer: env.customer_name,
                          contractId: env.contract_id
                        });
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedEnvironments.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No environments found. Try adjusting your search.
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {Math.min(startIndex + 1, filteredEnvironments.length)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(startIndex + rowsPerPage, filteredEnvironments.length)}
              </span>{' '}
              of <span className="font-medium">{filteredEnvironments.length}</span>{' '}
              results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}