import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileDown, Building2, Pencil, Trash2, AlertTriangle, Eye, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { INDUSTRIES, REGIONS, EMPLOYEE_RANGES } from '../../constants/customers';
import countries from '../../constants/countries.json';
import * as XLSX from 'xlsx';

type Customer = Database['public']['Tables']['customers']['Row'];

export function CustomerList() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<keyof Customer>('company_name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<Customer | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*');

      if (error) throw error;
      
      if (data) {
        const sortedData = [...data].sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          
          if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
          if (bVal === null) return sortDirection === 'asc' ? -1 : 1;
          
          return sortDirection === 'asc' 
            ? aVal > bVal ? 1 : -1
            : aVal < bVal ? 1 : -1;
        });
        
        setCustomers(sortedData);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers data. Please try refreshing the page.');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDummyData = async () => {
    setIsGenerating(true);
    
    try {
      const dummyCustomers = [
        {
          company_name: 'Tech Innovators Ltd',
          industry: 'IT & Technology',
          country: 'United States',
          region: 'AMERICAS',
          website: 'https://techinnovators.com',
          number_of_employees: '501-1000',
          company_human_id: `CUS${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          hubspot_id: 'HS123456',
          contact_person: 'John Smith',
          email: 'john.smith@techinnovators.com',
          phone: '+1 (555) 123-4567'
        },
        {
          company_name: 'Global Finance Corp',
          industry: 'Banking',
          country: 'United Kingdom',
          region: 'EMEA',
          website: 'https://globalfinance.com',
          number_of_employees: '5001-10000',
          company_human_id: `CUS${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          hubspot_id: 'HS789012',
          contact_person: 'Emma Wilson',
          email: 'emma.wilson@globalfinance.com',
          phone: '+44 20 7123 4567'
        },
        {
          company_name: 'Asia Manufacturing Co',
          industry: 'Manufacturing',
          country: 'Singapore',
          region: 'JAPAC',
          website: 'https://asiamfg.com',
          number_of_employees: '1001-5000',
          company_human_id: `CUS${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          hubspot_id: 'HS345678',
          contact_person: 'David Chen',
          email: 'david.chen@asiamfg.com',
          phone: '+65 6789 0123'
        },
        {
          company_name: 'Green Energy Solutions',
          industry: 'Energy',
          country: 'Germany',
          region: 'EMEA',
          website: 'https://greenenergy.de',
          number_of_employees: '201-500',
          company_human_id: `CUS${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          hubspot_id: 'HS901234',
          contact_person: 'Anna Schmidt',
          email: 'anna.schmidt@greenenergy.de',
          phone: '+49 30 1234 5678'
        },
        {
          company_name: 'Healthcare Plus',
          industry: 'Healthcare',
          country: 'Australia',
          region: 'JAPAC',
          website: 'https://healthcareplus.com.au',
          number_of_employees: '51-200',
          company_human_id: `CUS${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          hubspot_id: 'HS567890',
          contact_person: 'Sarah Johnson',
          email: 'sarah.johnson@healthcareplus.com.au',
          phone: '+61 2 9876 5432'
        }
      ];

      const { error } = await supabase
        .from('customers')
        .insert(dummyCustomers);

      if (error) throw error;

      toast.success('Dummy customers generated successfully');
      await fetchCustomers();
    } catch (error) {
      console.error('Error generating dummy customers:', error);
      toast.error('Failed to generate dummy customers');
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    fetchCustomers();
  }, [sortColumn, sortDirection]);

  const handleSort = (column: keyof Customer) => {
    if (column === sortColumn) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleDeleteAll = async () => {
    setShowDeleteModal(false);
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('All customers deleted successfully');
      await fetchCustomers();
    } catch (error) {
      console.error('Error deleting customers:', error);
      toast.error('Failed to delete customers');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportToExcel = () => {
    const exportData = customers.map(item => ({
      ...item,
      created_at: new Date(item.created_at).toLocaleString(),
      updated_at: new Date(item.updated_at).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'customers.xlsx');
  };

  const handleDeleteItem = async (id: string) => {
    setIsDeleting(true);

    try {
      if (!id) {
        throw new Error('Invalid customer ID');
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Customer deleted successfully');
      await fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const filteredCustomers = customers.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedCustomers = filteredCustomers.slice(
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
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateDummyData}
            variant="secondary"
            className="flex items-center gap-2"
            isLoading={isGenerating}
          >
            <Users className="w-4 h-4" />
            Generate Dummy Data
          </Button>
          <Button
            onClick={handleExportToExcel}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export to Excel
          </Button>
          <Button
            variant="danger"
            className="flex items-center gap-2"
            onClick={() => setShowDeleteModal(true)}
            isLoading={isDeleting}
          >
            <Trash2 className="w-4 h-4" />
            Delete All
          </Button>
          <Link to="/customers/new">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search customers..."
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
                  onClick={() => handleSort('company_name')}
                >
                  <div className="flex items-center gap-2">
                    Company Name
                    {sortColumn === 'company_name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('industry')}
                >
                  <div className="flex items-center gap-2">
                    Industry
                    {sortColumn === 'industry' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('region')}
                >
                  <div className="flex items-center gap-2">
                    Region
                    {sortColumn === 'region' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('contact_person')}
                >
                  <div className="flex items-center gap-2">
                    Contact Person
                    {sortColumn === 'contact_person' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-2">
                    Email
                    {sortColumn === 'email' && (
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
              {paginatedCustomers.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-indigo-100 rounded-lg">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900">
                          {item.company_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {item.company_human_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.industry}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      {item.region}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.contact_person}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/customers/${item.id}/details`}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        to={`/customers/${item.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedCustomers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No customers found. Try adjusting your search or add a new customer.
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {Math.min(startIndex + 1, filteredCustomers.length)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(startIndex + rowsPerPage, filteredCustomers.length)}
              </span>{' '}
              of <span className="font-medium">{filteredCustomers.length}</span>{' '}
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

      {/* Delete All Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Delete All Customers"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete all customers? This will permanently remove all customer information from the system.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAll}
              isLoading={isDeleting}
            >
              Delete All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Single Item Modal */}
      <Modal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="Confirm Delete Customer"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the customer{' '}
            <span className="font-medium">{itemToDelete?.company_name}</span>?
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setItemToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (itemToDelete) {
                  handleDeleteItem(itemToDelete.id);
                }
              }}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}