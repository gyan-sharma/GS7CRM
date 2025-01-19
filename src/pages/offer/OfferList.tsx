import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileDown, FileText, Pencil, Trash2, AlertTriangle, Eye, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import * as XLSX from 'xlsx';

type Offer = Database['public']['Tables']['offer_records']['Row'] & {
  opportunity_name?: string;
  customer_name?: string;
  presales_engineer_name?: string;
};

type Opportunity = Database['public']['Tables']['opportunity_records']['Row'] & {
  customer_name?: string;
  deal_owner_name?: string;
};

export function OfferList() {
  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showSearchModal, setShowSearchModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<Opportunity[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<keyof Offer>('offer_human_id');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<Offer | null>(null);

  const fetchOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_details')
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
        
        setOffers(sortedData);
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error('Failed to load offers data. Please try refreshing the page.');
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOffers();
  }, [sortColumn, sortDirection]);

  const searchOpportunities = React.useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('opportunity_records')
          .select(`
            *,
            customers:customer_id(company_name),
            users:deal_owner_id(name)
          `)
          .ilike('opportunity_name', `%${query}%`)
          .limit(10);

        if (error) throw error;

        const enrichedData = data?.map(opp => ({
          ...opp,
          customer_name: opp.customers?.company_name,
          deal_owner_name: opp.users?.name
        })) || [];

        setSearchResults(enrichedData);
      } catch (error) {
        console.error('Error searching opportunities:', error);
        toast.error('Failed to search opportunities');
      } finally {
        setSearching(false);
      }
    },
    []
  );

  // Debounce search
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (showSearchModal) {
        searchOpportunities(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchOpportunities, showSearchModal]);

  const handleSort = (column: keyof Offer) => {
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
        .from('offer_records')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('All offers deleted successfully');
      await fetchOffers();
    } catch (error) {
      console.error('Error deleting offers:', error);
      toast.error('Failed to delete offers');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportToExcel = () => {
    const exportData = offers.map(item => ({
      'Offer ID': item.offer_human_id,
      'Opportunity': item.opportunity_name,
      'Customer': item.customer_name,
      'PreSales Engineer': item.presales_engineer_name,
      'Status': item.status,
      'Due Date': new Date(item.offer_due_date).toLocaleDateString(),
      'Created At': new Date(item.created_at).toLocaleString(),
      'Updated At': new Date(item.updated_at).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Offers');
    XLSX.writeFile(wb, 'offers.xlsx');
  };

  const handleDeleteItem = async (id: string) => {
    setIsDeleting(true);

    try {
      if (!id) {
        throw new Error('Invalid offer ID');
      }

      const { error } = await supabase
        .from('offer_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Offer deleted successfully');
      await fetchOffers();
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error('Failed to delete offer');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const filteredOffers = offers.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredOffers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedOffers = filteredOffers.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'In Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-blue-100 text-blue-800';
      case 'Sent':
        return 'bg-indigo-100 text-indigo-800';
      case 'Won':
        return 'bg-green-100 text-green-800';
      case 'Lost':
        return 'bg-red-100 text-red-800';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Offers</h1>
        <div className="flex items-center gap-3">
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
          <Button
            className="flex items-center gap-2"
            onClick={() => setShowSearchModal(true)}
          >
            <Plus className="w-4 h-4" />
            Create Offer
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search offers..."
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
                  onClick={() => handleSort('offer_human_id')}
                >
                  <div className="flex items-center gap-2">
                    Offer ID
                    {sortColumn === 'offer_human_id' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('opportunity_name')}
                >
                  <div className="flex items-center gap-2">
                    Opportunity
                    {sortColumn === 'opportunity_name' && (
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
                  onClick={() => handleSort('presales_engineer_name')}
                >
                  <div className="flex items-center gap-2">
                    PreSales Engineer
                    {sortColumn === 'presales_engineer_name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortColumn === 'status' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('offer_due_date')}
                >
                  <div className="flex items-center gap-2">
                    Due Date
                    {sortColumn === 'offer_due_date' && (
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
              {paginatedOffers.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-indigo-100 rounded-lg">
                        <FileText className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {item.offer_human_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.opportunity_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.presales_engineer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.offer_due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/offers/${item.id}/details`}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        to={`/offers/${item.id}`}
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

        {paginatedOffers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No offers found. Try adjusting your search or add a new offer.
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {Math.min(startIndex + 1, filteredOffers.length)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(startIndex + rowsPerPage, filteredOffers.length)}
              </span>{' '}
              of <span className="font-medium">{filteredOffers.length}</span>{' '}
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

      {/* Search Modal */}
      <Modal
        isOpen={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
        title="Select Opportunity"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Search opportunities by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4">
            {searching ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map(opportunity => (
                  <Link
                    key={opportunity.id}
                    to={`/offers/new?opportunity=${opportunity.id}`}
                    className="block p-4 rounded-lg border border-gray-200 hover:border-indigo-500 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {opportunity.opportunity_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {opportunity.customer_name}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {opportunity.opportunity_human_id}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span>{opportunity.region}</span>
                      <span>•</span>
                      <span>{opportunity.deal_owner_name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : searchQuery ? (
              <p className="text-center text-gray-500 py-8">
                No opportunities found matching your search
              </p>
            ) : (
              <p className="text-center text-gray-500 py-8">
                Start typing to search opportunities
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete All Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Delete All Offers"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete all offers? This will permanently remove all offer information from the system.
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
        title="Confirm Delete Offer"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete this offer?
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