import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { FileUploadManager } from '../../components/ui/FileUploadManager';
import { Combobox } from '../../components/ui/Combobox';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const CONTRACT_STATUSES = ['Draft', 'Active', 'Expired', 'Terminated'] as const;

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
  offer_human_id: string;
  customer_name: string;
  deal_owner_name: string;
}

export function ContractFormEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contract, setContract] = React.useState<Contract | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>>([]);
  const [formData, setFormData] = React.useState({
    contract_summary: '',
    payment_terms: '',
    contract_start_date: '',
    status: CONTRACT_STATUSES[0]
  });

  React.useEffect(() => {
    fetchContract();
  }, [id]);

  const fetchDocuments = async () => {
    try {
      const { data: docs, error: docsError } = await supabase
        .from('contract_documents')
        .select('*')
        .eq('contract_id', id);

      if (docsError) throw docsError;

      // Convert documents to file format for FileUploadManager
      setUploadedFiles(docs?.map(doc => ({
        name: doc.name,
        path: doc.file_path,
        type: doc.file_type,
        size: doc.file_size
      })) || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const fetchContract = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_details_view')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setContract(data);
      await fetchDocuments();
      setFormData({
        contract_summary: data.contract_summary,
        payment_terms: data.payment_terms,
        contract_start_date: new Date(data.contract_start_date).toISOString().split('T')[0],
        status: data.status as typeof CONTRACT_STATUSES[number]
      });
    } catch (error) {
      console.error('Error fetching contract:', error);
      toast.error('Failed to load contract details');
      navigate('/contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (fileData: {
    name: string;
    path: string;
    type: string;
    size: number;
  }) => {
    try {
      const { error } = await supabase
        .from('contract_documents')
        .insert({
          contract_id: id,
          name: fileData.name,
          file_path: fileData.path,
          file_type: fileData.type,
          file_size: fileData.size,
          uploaded_by: user?.id
        });

      if (error) throw error;

      // Update local state
      setUploadedFiles(prev => [...prev, fileData]);
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    }
  };

  const handleFileDelete = async (filePath: string) => {
    try {
      const { error } = await supabase
        .from('contract_documents')
        .delete()
        .eq('file_path', filePath);

      if (error) throw error;

      // Update local state
      setUploadedFiles(prev => prev.filter(file => file.path !== filePath));
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to update a contract');
      return;
    }

    if (!formData.contract_summary.trim()) {
      toast.error('Please enter a contract summary');
      return;
    }

    if (!formData.payment_terms.trim()) {
      toast.error('Please enter payment terms');
      return;
    }

    if (!formData.contract_start_date) {
      toast.error('Please select a contract start date');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .update({
          contract_summary: formData.contract_summary,
          payment_terms: formData.payment_terms,
          contract_start_date: formData.contract_start_date,
          status: formData.status,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Contract updated successfully');
      navigate(`/contracts/${id}/details`);
    } catch (error) {
      console.error('Error updating contract:', error);
      toast.error('Failed to update contract');
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

  if (!contract) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Contract not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Contract</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contract Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Contract Details</h2>
          <div className="space-y-6">
            <div>
              <RichTextEditor
                label="Contract Summary"
                value={formData.contract_summary}
                onChange={value => setFormData(prev => ({ ...prev, contract_summary: value }))}
                placeholder="Enter contract summary..."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <FormInput
                  label="Contract Start Date"
                  type="date"
                  value={formData.contract_start_date}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    contract_start_date: e.target.value
                  }))}
                  required
                />
              </div>

              <div>
                <Combobox
                  label="Status"
                  value={formData.status}
                  onChange={status => setFormData(prev => ({ ...prev, status }))}
                  options={CONTRACT_STATUSES}
                  placeholder="Select status..."
                />
              </div>

              <div className="sm:col-span-2">
                <FormInput
                  label="Payment Terms"
                  type="text"
                  value={formData.payment_terms}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    payment_terms: e.target.value
                  }))}
                  placeholder="e.g., Net 30, Monthly in advance"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Financial Overview</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
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

        {/* Related Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Related Information</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Contract ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.contract_human_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.customer_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Deal Owner</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.deal_owner_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Offer ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.offer_human_id}</dd>
            </div>
          </dl>
        </div>

        {/* Contract Documents */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Contract Documents</h2>
          <div className="space-y-4">
            <FileUploadManager
              bucketName="contract-documents"
              folderPath={`contracts/${id}`}
              onUploadComplete={handleFileUpload}
              onDeleteComplete={handleFileDelete}
              files={uploadedFiles}
              accept=".pdf,.doc,.docx"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/contracts/${id}/details`)}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            Update Contract
          </Button>
        </div>
      </form>
    </div>
  );
}