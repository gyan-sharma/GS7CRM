import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileDown, FileUp, DollarSign, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FileUpload } from '../../components/ui/FileUpload';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { parseExcelFile, validatePricing, importPricing } from '../../lib/license_pricing_excel';
import type { Database } from '../../types/supabase';
import * as XLSX from 'xlsx';

type LicensePricing = Database['public']['Tables']['license_pricing']['Row'];

export function PricingList() {
  const [pricing, setPricing] = React.useState<LicensePricing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<keyof LicensePricing>('pretty_name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showProgressModal, setShowProgressModal] = React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<LicensePricing | null>(null);
  const [importErrors, setImportErrors] = React.useState<string[]>([]);
  const [importStatus, setImportStatus] = React.useState<Array<{ pretty_name: string; status: 'pending' | 'success' | 'error'; message?: string }>>([]);
  const [isImporting, setIsImporting] = React.useState(false);

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase
        .from('license_pricing')
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
        
        setPricing(sortedData);
      } else {
        setPricing([]);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast.error('Failed to load pricing data. Please try refreshing the page.');
      setPricing([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPricing();
  }, [sortColumn, sortDirection]);

  const handleSort = (column: keyof LicensePricing) => {
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
    setShowProgressModal(true);
    setProgress(0);

    try {
      const { error } = await supabase
        .from('license_pricing')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('All pricing data deleted successfully');
      await fetchPricing();
    } catch (error) {
      console.error('Error deleting pricing:', error);
      toast.error('Failed to delete pricing data');
    } finally {
      setIsDeleting(false);
      setShowProgressModal(false);
      setProgress(0);
    }
  };

  const handleExportToExcel = () => {
    const exportData = pricing.map(item => ({
      ...item,
      created_at: new Date(item.created_at).toLocaleString(),
      updated_at: new Date(item.updated_at).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pricing');
    XLSX.writeFile(wb, 'license-pricing.xlsx');
  };

  const handleImportFile = async (file: File) => {
    try {
      setImportErrors([]);
      setImportStatus([]);

      // Parse Excel file
      const items = await parseExcelFile(file);

      // Validate items
      const validationErrors = validatePricing(items);
      if (validationErrors.length > 0) {
        setImportErrors(validationErrors);
        return;
      }

      // Initialize status for all items
      setImportStatus(items.map(item => ({
        pretty_name: item.pretty_name,
        status: 'pending'
      })));

      // Start import
      setIsImporting(true);

      const results = await importPricing(items, (progress) => {
        setProgress(progress);
      });

      if (results.successful > 0) {
        toast.success(`Successfully imported ${results.successful} items`);
      }

      if (results.failed > 0) {
        setImportErrors(results.errors);
      }

      await fetchPricing();
      setShowImportModal(false);
    } catch (error) {
      console.error('Import error:', error);
      toast.error((error as Error).message);
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setIsDeleting(true);
    setShowProgressModal(true);
    setProgress(0);

    try {
      if (!id) {
        throw new Error('Invalid pricing ID');
      }

      const { error } = await supabase
        .from('license_pricing')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setProgress(100);

      toast.success('Item deleted successfully');
      await fetchPricing();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    } finally {
      setIsDeleting(false);
      setShowProgressModal(false);
      setProgress(0);
      setItemToDelete(null);
    }
  };

  const filteredPricing = pricing.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredPricing.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedPricing = filteredPricing.slice(
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
        <h1 className="text-2xl font-semibold text-gray-900">License Pricing</h1>
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
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => setShowImportModal(true)}
          >
            <FileUp className="w-4 h-4" />
            Bulk Import
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
          <Link to="/pricing/new">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Pricing
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search pricing..."
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
                  onClick={() => handleSort('pretty_name')}
                >
                  <div className="flex items-center gap-2">
                    Component Name
                    {sortColumn === 'pretty_name' && (
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
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center gap-2">
                    Size
                    {sortColumn === 'size' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('hourly_price')}
                >
                  <div className="flex items-center gap-2">
                    Hourly Price
                    {sortColumn === 'hourly_price' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('monthly_price')}
                >
                  <div className="flex items-center gap-2">
                    Monthly Price
                    {sortColumn === 'monthly_price' && (
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
              {paginatedPricing.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {item.pretty_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="uppercase">{item.type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="uppercase">{item.size}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${item.hourly_price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${item.monthly_price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/pricing/${item.id}`}
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

        {paginatedPricing.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No pricing data found. Try adjusting your search or add new pricing.
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {Math.min(startIndex + 1, filteredPricing.length)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(startIndex + rowsPerPage, filteredPricing.length)}
              </span>{' '}
              of <span className="font-medium">{filteredPricing.length}</span>{' '}
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
        title="Confirm Delete All Pricing"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete all pricing data? This will permanently remove all pricing information from the system.
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
        title="Confirm Delete Pricing"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the pricing for{' '}
            <span className="font-medium">{itemToDelete?.pretty_name}</span>?
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

      {/* Progress Modal */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => {}}
        title={itemToDelete ? `Deleting ${itemToDelete.pretty_name}` : "Deleting All Pricing"}
        className="sm:max-w-md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {itemToDelete
              ? "Deleting pricing item. Please wait..."
              : "Deleting all pricing data. Please wait..."}
          </p>
          <ProgressBar progress={progress} />
          <p className="text-sm text-gray-500 text-center">
            {Math.round(progress)}% Complete
          </p>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          if (!isImporting) {
            setShowImportModal(false);
            setImportStatus([]);
            setImportErrors([]);
            setProgress(0);
          }
        }}
        title="Import Pricing"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Upload an Excel file with the following columns: PRETTY_NAME, TYPE, SIZE, PRICE.
            The hourly price will be automatically converted to monthly price (x730).
          </p>

          {!isImporting && <FileUpload
            onFileSelect={handleImportFile}
            accept=".xlsx,.xls"
            className="mt-4"
          />}

          {isImporting && importStatus.length > 0 && (
            <div className="mt-4 space-y-4">
              <ProgressBar progress={progress} />
              <p className="text-sm text-gray-500 text-center">
                Importing pricing data... {Math.round(progress)}% Complete
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {importStatus.map((status, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-md bg-gray-50"
                  >
                    <span className="text-sm text-gray-700">{status.pretty_name}</span>
                    <div className="flex items-center gap-2">
                      {status.status === 'pending' && (
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      {status.status === 'success' && (
                        <span className="text-green-600">✓</span>
                      )}
                      {status.status === 'error' && (
                        <span className="text-red-600" title={status.message}>✗</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {importErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-md">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Import Errors:
              </h4>
              <ul className="text-sm text-red-700 list-disc list-inside">
                {importErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}