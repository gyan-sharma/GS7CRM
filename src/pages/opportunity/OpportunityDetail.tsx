import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Pencil, Trash2, AlertTriangle, Globe, Mail, Phone, FileText, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';

type Opportunity = Database['public']['Tables']['opportunities']['Row'];
type OpportunityDocument = Database['public']['Tables']['opportunity_documents']['Row'];

export function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = React.useState<Opportunity & {
    customer_name?: string;
    deal_owner_name?: string;
  } | null>(null);
  const [documents, setDocuments] = React.useState<OpportunityDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    fetchOpportunity();
  }, [id]);

  const fetchOpportunity = async () => {
    try {
      const { data: opportunity, error: opportunityError } = await supabase
        .from('opportunity_records')
        .select('*')
        .eq('id', id)
        .single();

      if (opportunityError) throw opportunityError;

      // Fetch customer and deal owner names
      const [customerResponse, userResponse] = await Promise.all([
        supabase
          .from('customers')
          .select('company_name')
          .eq('id', opportunity.customer_id)
          .single(),
        supabase
          .from('users')
          .select('name')
          .eq('id', opportunity.deal_owner_id)
          .single()
      ]);

      // Fetch opportunity documents
      const { data: docs, error: docsError } = await supabase
        .from('opportunity_document_records')
        .select('*')
        .eq('opportunity_id', id);

      if (docsError) throw docsError;
      setDocuments(docs || []);

      setOpportunity({
        ...opportunity,
        customer_name: customerResponse.data?.company_name,
        deal_owner_name: userResponse.data?.name
      });
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      toast.error('Failed to load opportunity details');
      navigate('/opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!opportunity) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('opportunity_records')
        .delete()
        .eq('id', opportunity.id);

      if (error) throw error;

      toast.success('Opportunity deleted successfully');
      navigate('/opportunities');
    } catch (error) {
      console.error('Error deleting opportunity:', error);
      toast.error('Failed to delete opportunity');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('opportunity-documents')
        .download(filePath);

      if (error) throw error;

      // Create a download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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

  if (!opportunity) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Opportunity not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Opportunity Details</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="danger"
            className="flex items-center gap-2"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="w-4 h-4" />
            Delete Opportunity
          </Button>
          <Button
            onClick={() => navigate(`/opportunities/${id}`)}
            className="flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Opportunity
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Opportunity Name</dt>
            <dd className="mt-1 text-lg font-medium text-gray-900">
              {opportunity.opportunity_name}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Opportunity ID</dt>
            <dd className="mt-1 text-sm text-gray-900">{opportunity.opportunity_human_id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Customer</dt>
            <dd className="mt-1 text-sm text-gray-900">{opportunity.customer_name || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Deal Owner</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {opportunity.deal_owner_name ? (
                <div className="flex items-center gap-3">
                  <Avatar name={opportunity.deal_owner_name} size="sm" />
                  <span>{opportunity.deal_owner_name}</span>
                </div>
              ) : (
                'N/A'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Financial Information</dt>
            <dd className="mt-1 text-lg font-medium text-gray-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: opportunity.currency
              }).format(opportunity.budget)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Financial Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Budget</dt>
            <dd className="mt-1 text-lg font-medium text-gray-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: opportunity.currency
              }).format(opportunity.budget)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Currency</dt>
            <dd className="mt-1 text-sm text-gray-900">{opportunity.currency}</dd>
          </div>
        </dl>
      </div>

      {/* Region and Timeline */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Region and Timeline</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Region</dt>
            <dd className="mt-1">
              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                {opportunity.region}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Close Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(opportunity.close_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Creation Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(opportunity.opportunity_creation_date).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Classification */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Classification</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Stage</dt>
            <dd className="mt-1">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStageColor(opportunity.opportunity_stage)}`}>
                {opportunity.opportunity_stage}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Type</dt>
            <dd className="mt-1 text-sm text-gray-900">{opportunity.opportunity_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Lead Source</dt>
            <dd className="mt-1 text-sm text-gray-900">{opportunity.lead_source}</dd>
          </div>
        </dl>
      </div>

      {/* Description */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Description</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Use Case Summary</dt>
            <dd className="mt-2 text-sm text-gray-900 prose prose-sm max-w-none" 
                dangerouslySetInnerHTML={{ 
                  __html: opportunity.use_case_summary || 'No use case summary provided' 
                }}>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Description/Notes</dt>
            <dd className="mt-2 text-sm text-gray-900 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: opportunity.description || 'No description provided' 
                }}>
            </dd>
          </div>
        </dl>
      </div>

      {/* Documents */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Documents</h2>
        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(doc.file_path, doc.name)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center">
            No documents available
          </p>
        )}
      </div>

      {/* System Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(opportunity.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(opportunity.updated_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Delete Opportunity"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the opportunity{' '}
            <span className="font-medium">{opportunity.opportunity_name}</span>?
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
              onClick={handleDelete}
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