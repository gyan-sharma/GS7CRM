import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileDown, Building2, Pencil, Trash2, AlertTriangle, Eye, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import * as XLSX from 'xlsx';

type Partner = Database['public']['Tables']['partners']['Row'];

export function PartnerList() {
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<keyof Partner>('company_name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<Partner | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*');

      if (error) throw error;
      
      if (data) {
        // Fetch service areas for each partner
        const partnersWithServiceAreas = await Promise.all(
          data.map(async partner => {
            const { data: serviceAreas } = await supabase
              .from('partner_service_areas')
              .select('service_area')
              .eq('partner_id', partner.id);
            
            return {
              ...partner,
              service_areas: serviceAreas?.map(sa => sa.service_area) || []
            };
          })
        );

        const sortedData = [...data].sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          
          if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
          if (bVal === null) return sortDirection === 'asc' ? -1 : 1;
          
          return sortDirection === 'asc' 
            ? aVal > bVal ? 1 : -1
            : aVal < bVal ? 1 : -1;
        });
        
        setPartners(sortedData);
      } else {
        setPartners([]);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast.error('Failed to load partners data. Please try refreshing the page.');
      setPartners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDummyData = async () => {
    setIsGenerating(true);
    
    try {
      // Create dummy partners
      const dummyPartners = [
        {
          company_name: 'TechForge Solutions',
          headquarter_country: 'United States',
          website: 'https://techforge.example.com',
          region: 'AMERICAS',
          is_sales_partner: true,
          is_delivery_subcontractor: true,
          company_human_id: `PTR${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          contact_person: 'Michael Chen',
          email: 'michael.chen@techforge.example.com',
          phone: '+1 (555) 123-4567',
          certification_level: 'platinum',
          revenue_sharing_percentage: 20,
          certifications: [
            'ISO 27001',
            'AWS Advanced Partner',
            'Microsoft Gold Partner',
            'CMMI Level 5'
          ],
          compliance_info: 'SOC 2 Type II Certified\nGDPR Compliant\nHIPAA Compliant'
        },
        {
          company_name: 'Digital Ventures GmbH',
          headquarter_country: 'Germany',
          website: 'https://digitalventures.example.de',
          region: 'EMEA',
          is_sales_partner: true,
          is_delivery_subcontractor: false,
          company_human_id: `PTR${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          contact_person: 'Anna Schmidt',
          email: 'anna.schmidt@digitalventures.example.de',
          phone: '+49 30 1234 5678',
          certification_level: 'gold',
          revenue_sharing_percentage: 15,
          certifications: [],
          compliance_info: ''
        },
        {
          company_name: 'Blockchain Masters Ltd',
          headquarter_country: 'Singapore',
          website: 'https://blockmasters.example.sg',
          region: 'JAPAC',
          is_sales_partner: false,
          is_delivery_subcontractor: true,
          company_human_id: `PTR${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          contact_person: 'David Wong',
          email: 'david.wong@blockmasters.example.sg',
          phone: '+65 6789 0123',
          certification_level: null,
          revenue_sharing_percentage: null,
          certifications: [
            'Certified Blockchain Developer',
            'Ethereum Enterprise Alliance Member',
            'Hyperledger Certified'
          ],
          compliance_info: 'ISO 27001 Certified\nMAS Compliant'
        }
      ];

      // Insert partners
      for (const partner of dummyPartners) {
        const { data: newPartner, error: partnerError } = await supabase
          .from('partners')
          .insert([partner])
          .select()
          .single();

        if (partnerError) throw partnerError;

        // Insert service areas for each partner
        if (partner.is_delivery_subcontractor && newPartner) {
          const serviceAreas = partner === dummyPartners[0] 
            ? ['Blockchain Development', 'Front-end Development', 'Back-end Development', 'DevOps']
            : ['Blockchain Development', 'Smart Contract Development'];

          const { error: serviceAreasError } = await supabase
            .from('partner_service_areas')
            .insert(
              serviceAreas.map(area => ({
                partner_id: newPartner.id,
                service_area: area
              }))
            );

          if (serviceAreasError) throw serviceAreasError;
        }
      }

      toast.success('Dummy partners generated successfully');
      await fetchPartners();
    } catch (error) {
      console.error('Error generating dummy partners:', error);
      toast.error('Failed to generate dummy partners');
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    fetchPartners();
  }, [sortColumn, sortDirection]);

  const handleSort = (column: keyof Partner) => {
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
        .from('partners')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('All partners deleted successfully');
      await fetchPartners();
    } catch (error) {
      console.error('Error deleting partners:', error);
      toast.error('Failed to delete partners');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportToExcel = () => {
    const exportData = partners.map(item => ({
      ...item,
      created_at: new Date(item.created_at).toLocaleString(),
      updated_at: new Date(item.updated_at).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Partners');
    XLSX.writeFile(wb, 'partners.xlsx');
  };

  const handleDeleteItem = async (id: string) => {
    setIsDeleting(true);

    try {
      if (!id) {
        throw new Error('Invalid partner ID');
      }

      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Partner deleted successfully');
      await fetchPartners();
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast.error('Failed to delete partner');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const filteredPartners = partners.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredPartners.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedPartners = filteredPartners.slice(
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
        <h1 className="text-2xl font-semibold text-gray-900">Partners</h1>
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
          <Link to="/partners/new">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Partner
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search partners..."
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
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Partner Type
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
              {paginatedPartners.map(item => (
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      {item.region}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {item.is_sales_partner && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Sales
                        </span>
                      )}
                      {item.is_delivery_subcontractor && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          Delivery
                        </span>
                      )}
                    </div>
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
                        to={`/partners/${item.id}/details`}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        to={`/partners/${item.id}`}
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

        {paginatedPartners.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No partners found. Try adjusting your search or add a new partner.
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {Math.min(startIndex + 1, filteredPartners.length)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(startIndex + rowsPerPage, filteredPartners.length)}
              </span>{' '}
              of <span className="font-medium">{filteredPartners.length}</span>{' '}
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
        title="Confirm Delete All Partners"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete all partners? This will permanently remove all partner information from the system.
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
        title="Confirm Delete Partner"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the partner{' '}
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