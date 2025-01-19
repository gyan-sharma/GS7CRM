import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileDown, Target, Pencil, Trash2, AlertTriangle, Eye, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { OPPORTUNITY_STAGES, OPPORTUNITY_TYPES, LEAD_SOURCES } from '../../constants/opportunities';
import * as XLSX from 'xlsx';

type Opportunity = Database['public']['Tables']['opportunities']['Row'];

export function OpportunityList() {
  const [opportunities, setOpportunities] = React.useState<Array<Opportunity & {
    customer_name?: string;
    deal_owner_name?: string;
  }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<keyof Opportunity>('opportunity_name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<Opportunity | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const fetchOpportunities = async () => {
    try {
      const { data: opportunities, error: opportunitiesError } = await supabase
        .from('opportunity_records')
        .select(`
          *,
          customers:customer_id(company_name),
          users:deal_owner_id(name)
        `);

      if (opportunitiesError) throw opportunitiesError;

      const enrichedOpportunities = opportunities?.map(opp => ({
        ...opp,
        customer_name: opp.customers?.company_name,
        deal_owner_name: opp.users?.name
      })) || [];

      const sortedData = [...enrichedOpportunities].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal === null) return sortDirection === 'asc' ? -1 : 1;
        
        return sortDirection === 'asc' 
          ? aVal > bVal ? 1 : -1
          : aVal < bVal ? 1 : -1;
      });
      
      setOpportunities(sortedData);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      toast.error('Failed to load opportunities data. Please try refreshing the page.');
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDummyData = async () => {
    setIsGenerating(true);
    
    try {
      // Get some random customers and users for reference
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .limit(3);

      const { data: users } = await supabase
        .from('users')
        .select('id')
        .limit(3);

      if (!customers?.length || !users?.length) {
        toast.error('Please create some customers and users first');
        return;
      }

      const dummyOpportunities = [
        {
          opportunity_name: 'Enterprise License Deal',
          customer_id: customers[0].id,
          deal_owner_id: users[0].id,
          opportunity_human_id: `OPP${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          budget: 150000,
          currency: 'USD',
          region: 'AMERICAS',
          close_date: new Date('2024-12-31').toISOString(),
          opportunity_creation_date: new Date().toISOString(),
          opportunity_stage: 'Qualification',
          opportunity_type: 'New Business',
          lead_source: 'Partner',
          use_case_summary: 'Enterprise-wide blockchain implementation',
          description: 'Large-scale blockchain implementation across multiple departments'
        },
        {
          opportunity_name: 'Platform Upgrade Project',
          customer_id: customers[1].id,
          deal_owner_id: users[1].id,
          opportunity_human_id: `OPP${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          budget: 75000,
          currency: 'EUR',
          region: 'EMEA',
          close_date: new Date('2024-09-30').toISOString(),
          opportunity_creation_date: new Date().toISOString(),
          opportunity_stage: 'Proposal',
          opportunity_type: 'Upsell',
          lead_source: 'Email Campaign',
          use_case_summary: 'Upgrade existing platform to latest version',
          description: 'Technical upgrade project including new features and security enhancements'
        },
        {
          opportunity_name: 'Support Contract Renewal',
          customer_id: customers[2].id,
          deal_owner_id: users[2].id,
          opportunity_human_id: `OPP${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          budget: 50000,
          currency: 'GBP',
          region: 'EMEA',
          close_date: new Date('2024-06-30').toISOString(),
          opportunity_creation_date: new Date().toISOString(),
          opportunity_stage: 'Negotiation',
          opportunity_type: 'Renewal',
          lead_source: 'Outbound Efforts',
          use_case_summary: 'Annual support contract renewal',
          description: 'Renewal of premium support package with additional services'
        }
      ];

      const { error } = await supabase
        .from('opportunity_records')
        .insert(dummyOpportunities);

      if (error) throw error;

      toast.success('Dummy opportunities generated successfully');
      await fetchOpportunities();
    } catch (error) {
      console.error('Error generating dummy opportunities:', error);
      toast.error('Failed to generate dummy opportunities');
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    fetchOpportunities();
  }, [sortColumn, sortDirection]);

  const handleSort = (column: keyof Opportunity) => {
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
        .from('opportunity_records')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('All opportunities deleted successfully');
      await fetchOpportunities();
    } catch (error) {
      console.error('Error deleting opportunities:', error);
      toast.error('Failed to delete opportunities');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportToExcel = () => {
    const exportData = opportunities.map(item => ({
      ...item,
      created_at: new Date(item.created_at).toLocaleString(),
      updated_at: new Date(item.updated_at).toLocaleString(),
      close_date: new Date(item.close_date).toLocaleDateString(),
      opportunity_creation_date: new Date(item.opportunity_creation_date).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Opportunities');
    XLSX.writeFile(wb, 'opportunities.xlsx');
  };

  const handleDeleteItem = async (id: string) => {
    setIsDeleting(true);

    try {
      if (!id) {
        throw new Error('Invalid opportunity ID');
      }

      const { error } = await supabase
        .from('opportunity_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Opportunity deleted successfully');
      await fetchOpportunities();
    } catch (error) {
      console.error('Error deleting opportunity:', error);
      toast.error('Failed to delete opportunity');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const filteredOpportunities = opportunities.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredOpportunities.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedOpportunities = filteredOpportunities.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Lead':
        return 'bg-gray-100 text-gray-800';
      case 'Qualification':
        return 'bg-blue-100 text-blue-800';
      case 'Proposal':
        return 'bg-yellow-100 text-yellow-800';
      case 'Negotiation':
        return 'bg-orange-100 text-orange-800';
      case 'Closed Won':
        return 'bg-green-100 text-green-800';
      case 'Closed Lost':
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Opportunities</h1>
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
          <Link to="/opportunities/new">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Opportunity
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search opportunities..."
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
                  onClick={() => handleSort('opportunity_name')}
                >
                  <div className="flex items-center gap-2">
                    Opportunity Name
                    {sortColumn === 'opportunity_name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Customer
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Deal Owner
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('opportunity_stage')}
                >
                  <div className="flex items-center gap-2">
                    Stage
                    {sortColumn === 'opportunity_stage' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('budget')}
                >
                  <div className="flex items-center gap-2">
                    Budget
                    {sortColumn === 'budget' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('close_date')}
                >
                  <div className="flex items-center gap-2">
                    Close Date
                    {sortColumn === 'close_date' && (
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
              {paginatedOpportunities.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-indigo-100 rounded-lg">
                        <Target className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900">
                          {item.opportunity_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {item.opportunity_human_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.customer_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.deal_owner_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                      getStageColor(item.opportunity_stage)
                    )}>
                      {item.opportunity_stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: item.currency
                    }).format(item.budget)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.close_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/opportunities/${item.id}/details`}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        to={`/opportunities/${item.id}`}
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

        {paginatedOpportunities.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No opportunities found. Try adjusting your search or add a new opportunity.
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {Math.min(startIndex + 1, filteredOpportunities.length)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(startIndex + rowsPerPage, filteredOpportunities.length)}
              </span>{' '}
              of <span className="font-medium">{filteredOpportunities.length}</span>{' '}
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
        title="Confirm Delete All Opportunities"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete all opportunities? This will permanently remove all opportunity information from the system.
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
        title="Confirm Delete Opportunity"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the opportunity{' '}
            <span className="font-medium">{itemToDelete?.opportunity_name}</span>?
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