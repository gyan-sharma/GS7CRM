import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Pencil, Trash2, AlertTriangle, ExternalLink, Download, FileText } from 'lucide-react';
import { OfferReviewDetails } from '../../components/offer/OfferReviewDetails';
import { OfferReviewHistory } from '../../components/offer/OfferReviewHistory';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { PlatformLicenseDetails } from '../../components/offer/PlatformLicenseDetails';
import { ProjectServices } from '../../components/offer/ProjectServices';
import { OfferProgress } from '../../components/offer/OfferProgress';
import type { Database } from '../../types/supabase';

type Offer = Database['public']['Tables']['offer_records']['Row'];
type Document = Database['public']['Tables']['offer_document_records']['Row'];

export function OfferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [offer, setOffer] = React.useState<Offer & {
    opportunity_name?: string;
    customer_name?: string;
    deal_owner_name?: string; 
    presales_engineer_name?: string;
    partner_names?: string[];
    environments?: Array<{
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
    service_sets?: Array<{
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
  } | null>(null);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  React.useEffect(() => {
    fetchOffer();
  }, [id]);

  const fetchOffer = async () => {
    try {
      const { data: offerData, error: offerError } = await supabase
        .from('offer_details') 
        .select(`
          *,
          environments:offer_environments (
            *,
            components:offer_environment_components(*)
          ),
          service_sets:offer_service_sets (
            *,
            services:offer_service_components(*)
          )
        `)
        .eq('id', id)
        .single();

      if (offerError) throw offerError;

      // Fetch documents
      const { data: docsData, error: docsError } = await supabase
        .from('offer_document_records')
        .select('*')
        .eq('offer_id', id);

      if (docsError) throw docsError;

      setOffer(offerData);
      setDocuments(docsData || []);
    } catch (error) {
      console.error('Error fetching offer:', error);
      toast.error('Failed to load offer details');
      navigate('/offers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!offer) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('offer_records')
        .delete()
        .eq('id', offer.id);

      if (error) throw error;

      toast.success('Offer deleted successfully');
      navigate('/offers');
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error('Failed to delete offer');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!offer) return;
    setIsUpdatingStatus(true);

    try {
      const { error } = await supabase
        .from('offer_records')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', offer.id);

      if (error) throw error;

      // Update local state
      setOffer(prev => prev ? {
        ...prev,
        status: newStatus,
        updated_at: new Date().toISOString()
      } : null);

      toast.success(`Offer status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating offer status:', error);
      toast.error('Failed to update offer status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      console.log('Starting document download:', {
        documentInfo: document,
        bucket: 'drp-documents'
      });

      const { data, error } = await supabase.storage
        .from('drp-documents')
        .download(document.file_path);

      if (error) {
        console.error('Supabase storage error:', {
          error,
          errorMessage: error.message,
          errorDetails: error.details,
          statusCode: error.status,
          hint: error.hint
        });
        throw error;
      }

      console.log('Document download successful, creating blob URL');
      // Create a download link
      const url = window.URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.name);
      console.log('Download link created:', {
        url: 'blob URL - not shown for security',
        filename: document.name
      });

      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      console.log('Download initiated and cleanup completed');
    } catch (error) {
      console.error('Error downloading file:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Offer not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Offer Details</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage offer information</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="danger"
            className="flex items-center gap-2"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="w-4 h-4" />
            Delete Offer
          </Button>
          <Button
            onClick={() => navigate(`/offers/${id}`)}
            className="flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Offer
          </Button>
        </div>
      </div>

      {/* Offer Progress */}
      <div className="bg-white shadow rounded-lg p-6">
        <OfferProgress
          status={offer.status}
          dates={{
            draft: offer.created_at,
            review: offer.status === 'In Review' ? offer.updated_at : undefined,
            approved: offer.status === 'Approved' ? offer.updated_at : undefined,
            sent: offer.status === 'Sent' ? offer.updated_at : undefined,
            won: offer.status === 'Won' ? offer.updated_at : undefined,
            lost: offer.status === 'Lost' ? offer.updated_at : undefined,
            onHold: offer.status === 'Hold' ? offer.updated_at : undefined
          }}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Opportunity Details & Offer Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunity Details */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-900">Opportunity Details</h2>
          </div>
          <div className="p-4">
            <h3 className="text-xl font-medium text-gray-900 mb-4">{offer.opportunity_name}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-sm font-medium text-gray-500">Opportunity ID</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <Link
                    to={`/opportunities/${offer.opportunity_id}/details`}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900"
                  >
                    {offer.opportunity_human_id}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Customer</dt>
                <dd className="mt-1">
                  <Link
                    to={`/customers/${offer.customer_id}/details`}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900"
                  >
                    {offer.customer_name || 'N/A'}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Deal Owner</dt>
                <dd className="mt-1">
                  {offer.deal_owner_name ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={offer.deal_owner_name} size="sm" />
                      <span className="text-sm text-gray-900">{offer.deal_owner_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">N/A</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Region</dt>
                <dd className="mt-1">
                  {offer.region ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      {offer.region}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">N/A</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Offer Details */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-900">Offer Details</h2>
          </div>
          <div className="p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className="text-sm font-medium text-gray-500">Offer ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{offer.offer_human_id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className="px-2 py-0.5 inline-flex text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                    {offer.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Creation Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {offer.offer_creation_date ? new Date(offer.offer_creation_date).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Due Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {offer.offer_due_date ? new Date(offer.offer_due_date).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">PreSales Engineer</dt>
                <dd className="mt-1">
                  <div className="flex items-center gap-3">
                    <Avatar name={offer.presales_engineer_name || ''} size="sm" />
                    <span className="text-sm text-gray-900">{offer.presales_engineer_name || 'N/A'}</span>
                  </div>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm font-medium text-gray-500">Partners</dt>
                <dd className="mt-1">
                  {offer.partner_names && offer.partner_names.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {offer.partner_names.map((partner, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                        >
                          {partner}
                        </span>
                      ))}
                    </div>
                  ) : 'No partners assigned'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm font-medium text-gray-500">Offer Summary</dt>
                <dd className="mt-1 prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: offer.offer_summary || 'No summary available' }} />
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Review Status */}
      {offer.status === 'In Review' && (
        <OfferReviewDetails offerId={id} />
      )}

      {/* Review History */}
      {(offer.status === 'In Review' || offer.status === 'Approved') && (
        <OfferReviewHistory offerId={id} />
      )}

      {/* Platform License Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Platform License Details</h2>
        <div className="space-y-6">
          <PlatformLicenseDetails
            offerId={id}
            environments={offer.environments || []}
            readOnly={true}
          />
        </div>
      </div>

      {/* Project Services */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Project Services</h2>
        <div className="space-y-6">
          <ProjectServices
            offerId={id}
            serviceSets={offer.service_sets || []}
            readOnly={true}
          />
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Documents</h2>
        <div className="space-y-6">
          {/* Customer RFP Documents */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Customer RFP Documents</h3>
            {documents.filter(doc => doc.document_type === 'Customer RFP').length > 0 ? (
              <div className="space-y-2">
                {documents
                  .filter(doc => doc.document_type === 'Customer RFP')
                  .map((doc, index) => (
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
              <p className="text-sm text-gray-500">No Customer RFP documents available</p>
            )}
          </div>

          {/* Subcontractor Proposal Documents */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Subcontractor Proposal Documents</h3>
            {documents.filter(doc => doc.document_type === 'Subcontractor Proposal').length > 0 ? (
              <div className="space-y-2">
                {documents
                  .filter(doc => doc.document_type === 'Subcontractor Proposal')
                  .map((doc, index) => (
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
              <p className="text-sm text-gray-500">No Subcontractor Proposal documents available</p>
            )}
          </div>

          {/* SettleMint Proposal Documents */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">SettleMint Proposal Documents</h3>
            {documents.filter(doc => doc.document_type === 'SettleMint Proposal').length > 0 ? (
              <div className="space-y-2">
                {documents
                  .filter(doc => doc.document_type === 'SettleMint Proposal')
                  .map((doc, index) => (
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
              <p className="text-sm text-gray-500">No SettleMint Proposal documents available</p>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
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