import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Pencil, Trash2, AlertTriangle, Globe, Mail, Phone, FileText, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';

type Partner = Database['public']['Tables']['partners']['Row'];
type PartnerDocument = Database['public']['Tables']['partner_documents']['Row'];

export function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [partner, setPartner] = React.useState<Partner | null>(null);
  const [serviceAreas, setServiceAreas] = React.useState<string[]>([]);
  const [documents, setDocuments] = React.useState<PartnerDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    fetchPartner();
  }, [id]);

  const fetchPartner = async () => {
    try {
      const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();

      if (partnerError) throw partnerError;

      const { data: serviceAreas, error: serviceAreasError } = await supabase
        .from('partner_service_areas')
        .select('service_area')
        .eq('partner_id', id);

      if (serviceAreasError) throw serviceAreasError;

      // Fetch partner documents
      const { data: docs, error: docsError } = await supabase
        .from('partner_documents')
        .select('*')
        .eq('partner_id', id);

      if (docsError) throw docsError;
      setDocuments(docs || []);

      setPartner(partner);
      setServiceAreas(serviceAreas?.map(sa => sa.service_area) || []);
    } catch (error) {
      console.error('Error fetching partner:', error);
      toast.error('Failed to load partner details');
      navigate('/partners');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!partner) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', partner.id);

      if (error) throw error;

      toast.success('Partner deleted successfully');
      navigate('/partners');
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast.error('Failed to delete partner');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('partner-documents')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Partner not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Partner Details</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="danger"
            className="flex items-center gap-2"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="w-4 h-4" />
            Delete Partner
          </Button>
          <Button
            onClick={() => navigate(`/partners/${id}`)}
            className="flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Partner
          </Button>
        </div>
      </div>

      {/* Company Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Company Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Company Name</dt>
            <dd className="mt-1 text-lg font-medium text-gray-900">
              {partner.company_name}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Partner ID</dt>
            <dd className="mt-1 text-sm text-gray-900">{partner.company_human_id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Headquarter Country</dt>
            <dd className="mt-1 text-sm text-gray-900">{partner.headquarter_country}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Region</dt>
            <dd className="mt-1">
              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                {partner.region}
              </span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Website</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {partner.website ? (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-900"
                >
                  <Globe className="w-4 h-4" />
                  {partner.website}
                </a>
              ) : (
                'N/A'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Partner Type</dt>
            <dd className="mt-1">
              <div className="flex flex-wrap gap-2">
                {partner.is_sales_partner && (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Sales Partner
                  </span>
                )}
                {partner.is_delivery_subcontractor && (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    Delivery Subcontractor
                  </span>
                )}
              </div>
            </dd>
          </div>
        </dl>
      </div>

      {/* Contact Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
            <dd className="mt-1 text-lg font-medium text-gray-900">
              {partner.contact_person}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <a
                href={`mailto:${partner.email}`}
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-900"
              >
                <Mail className="w-4 h-4" />
                {partner.email}
              </a>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {partner.phone ? (
                <a
                  href={`tel:${partner.phone}`}
                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-900"
                >
                  <Phone className="w-4 h-4" />
                  {partner.phone}
                </a>
              ) : (
                'N/A'
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Sales Partner Details */}
      {partner.is_sales_partner && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Partner Details</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Certification Level</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <span className="capitalize">{partner.certification_level || 'N/A'}</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Revenue Sharing Percentage</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {partner.revenue_sharing_percentage ? `${partner.revenue_sharing_percentage}%` : 'N/A'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Delivery Subcontractor Details */}
      {partner.is_delivery_subcontractor && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Delivery Subcontractor Details</h2>
          <dl className="grid grid-cols-1 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Service Areas</dt>
              <dd className="mt-2">
                <div className="flex flex-wrap gap-2">
                  {serviceAreas.map(area => (
                    <span
                      key={area}
                      className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Certifications</dt>
              <dd className="mt-2">
                {partner.certifications && partner.certifications.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {partner.certifications.map((cert, index) => (
                      <li key={index} className="text-sm text-gray-900">
                        {cert}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No certifications listed</p>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Compliance Information</dt>
              <dd className="mt-2">
                {partner.compliance_info && partner.compliance_info.trim() ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {partner.compliance_info.split('\n').map((info, index) => (
                      <li key={index} className="text-sm text-gray-900">
                        {info}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No compliance information provided</p>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* System Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(partner.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(partner.updated_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Partnership Documents */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Partnership Documents</h2>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Delete Partner"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the partner{' '}
            <span className="font-medium">{partner.company_name}</span>?
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