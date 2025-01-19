import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { Combobox } from '../../components/ui/Combobox';
import { FileUploadManager } from '../../components/ui/FileUploadManager';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PlatformLicenseDetails } from '../../components/offer/PlatformLicenseDetails';
import { ProjectServices } from '../../components/offer/ProjectServices';
import type { Database } from '../../types/supabase';

type Opportunity = Database['public']['Tables']['opportunity_records']['Row'] & {
  customer_name?: string;
  deal_owner_name?: string;
};

type Partner = Database['public']['Tables']['partners']['Row'];
type User = Database['public']['Tables']['users']['Row'];

interface OfferFormEditProps {
  id: string;
}

export function OfferFormEdit({ id }: OfferFormEditProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [opportunity, setOpportunity] = React.useState<Opportunity | null>(null);
  const [offer, setOffer] = React.useState<Database['public']['Tables']['offer_records']['Row'] | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [selectedPartners, setSelectedPartners] = React.useState<string[]>([]);
  const [environments, setEnvironments] = React.useState<Array<{
    name: string;
    type: string;
    license_duration_months: number;
    deployment_type: string;
    components: Array<{
      component_name: string;
      type: string;
      size: string;
      quantity: number;
      monthly_price: number;
    }>;
  }>>([]);
  const [serviceSets, setServiceSets] = React.useState<Array<{
    name: string;
    subcontractor_id: string | null;
    duration_months: number;
    services: Array<{
      service_name: string;
      manday_rate: number;
      number_of_mandays: number;
      profit_percentage: number;
    }>;
  }>>([]);
  const [uploadedDocuments, setUploadedDocuments] = React.useState<{
    'Customer RFP': Array<{ name: string; path: string; type: string; size: number; }>;
    'Subcontractor Proposal': Array<{ name: string; path: string; type: string; size: number; }>;
    'SettleMint Proposal': Array<{ name: string; path: string; type: string; size: number; }>;
  }>({
    'Customer RFP': [],
    'Subcontractor Proposal': [],
    'SettleMint Proposal': []
  });

  const [formData, setFormData] = React.useState({
    offer_summary: '',
    presales_engineer_id: '',
    offer_creation_date: new Date().toISOString().split('T')[0],
    offer_due_date: ''
  });

  React.useEffect(() => {
    const init = async () => {
      try {
        const [users, partners] = await Promise.all([
          fetchUsers(),
          fetchPartners()
        ]);

        // Fetch existing offer and its opportunity
        const { data: offerData, error: offerError } = await supabase
          .from('offer_details')
          .select('*')
          .eq('id', id)
          .single();

        if (offerError) throw offerError;
        setOffer(offerData);

        // Fetch opportunity details
        await fetchOpportunity(offerData.opportunity_id);

        // Set form data
        setFormData({
          offer_summary: offerData.offer_summary || '',
          presales_engineer_id: offerData.presales_engineer_id || '',
          offer_creation_date: new Date(offerData.offer_creation_date).toISOString().split('T')[0],
          offer_due_date: new Date(offerData.offer_due_date).toISOString().split('T')[0]
        });

        // Set selected partners
        if (offerData.partner_ids) {
          setSelectedPartners(offerData.partner_ids);
        }

        // Fetch documents
        const { data: docs, error: docsError } = await supabase
          .from('offer_document_records')
          .select('*')
          .eq('offer_id', id);

        if (docsError) throw docsError;

        // Group documents by type
        const groupedDocs = {
          'Customer RFP': [],
          'Subcontractor Proposal': [],
          'SettleMint Proposal': []
        };

        docs?.forEach(doc => {
          groupedDocs[doc.document_type].push({
            name: doc.name,
            path: doc.file_path,
            type: doc.file_type,
            size: doc.file_size
          });
        });

        setUploadedDocuments(groupedDocs);
      } catch (error) {
        console.error('Error initializing:', error);
        toast.error('Failed to load data');
        navigate('/offers');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  const fetchOpportunity = async (oppId: string) => {
    try {
      const { data, error } = await supabase
        .from('opportunity_records')
        .select(`
          *,
          customers:customer_id(company_name),
          users:deal_owner_id(name)
        `)
        .eq('id', oppId)
        .single();

      if (error) throw error;

      setOpportunity({
        ...data,
        customer_name: data.customers?.company_name,
        deal_owner_name: data.users?.name
      });
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      toast.error('Failed to load opportunity details');
      navigate('/offers');
      throw error;
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('company_name');

      if (error) throw error;
      setPartners(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast.error('Failed to load partners');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity || !offer) return;
    if (!user) {
      toast.error('You must be logged in to update an offer');
      return;
    }
    if (!formData.presales_engineer_id) {
      toast.error('Please select a PreSales Engineer');
      return;
    }
    if (!formData.offer_due_date) {
      toast.error('Please select an Offer Due Date');
      return;
    }

    setSaving(true);
    try {
      // Update offer
      const { error: offerError } = await supabase
        .from('offer_records')
        .update({
          presales_engineer_id: formData.presales_engineer_id,
          offer_summary: formData.offer_summary,
          offer_creation_date: formData.offer_creation_date,
          offer_due_date: formData.offer_due_date,
          updated_by: user?.id
        })
        .eq('id', id);

      if (offerError) throw offerError;

      // Delete existing partners
      const { error: deletePartnersError } = await supabase
        .from('offer_partner_records')
        .delete()
        .eq('offer_id', id);

      if (deletePartnersError) throw deletePartnersError;

      // Add new partners
      if (selectedPartners.length > 0) {
        const { error: partnersError } = await supabase
          .from('offer_partner_records')
          .insert(
            selectedPartners.map(partnerId => ({
              offer_id: id,
              partner_id: partnerId
            }))
          );

        if (partnersError) throw partnersError;
      }

      // Handle documents
      const { data: existingDocs, error: existingDocsError } = await supabase
        .from('offer_document_records')
        .select('file_path')
        .eq('offer_id', id);

      if (existingDocsError) throw existingDocsError;

      // Get current file paths from state
      const currentFilePaths = new Set(
        Object.values(uploadedDocuments).flat().map(file => file.path)
      );

      // Find files that were removed
      const filesToDelete = existingDocs
        ?.filter(doc => !currentFilePaths.has(doc.file_path))
        .map(doc => doc.file_path) || [];

      // Delete removed files from storage
      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('offer-documents')
          .remove(filesToDelete);

        if (storageError) throw storageError;
      }

      // Delete existing document records
      const { error: deleteDocsError } = await supabase
        .from('offer_document_records')
        .delete()
        .eq('offer_id', id);

      if (deleteDocsError) throw deleteDocsError;

      // Insert new document records
      const allDocuments = [
        ...uploadedDocuments['Customer RFP'].map(doc => ({
          ...doc,
          document_type: 'Customer RFP' as const
        })),
        ...uploadedDocuments['Subcontractor Proposal'].map(doc => ({
          ...doc,
          document_type: 'Subcontractor Proposal' as const
        })),
        ...uploadedDocuments['SettleMint Proposal'].map(doc => ({
          ...doc,
          document_type: 'SettleMint Proposal' as const
        }))
      ];

      if (allDocuments.length > 0) {
        const { error: docsError } = await supabase
          .from('offer_document_records')
          .insert(
            allDocuments.map(doc => ({
              offer_id: id,
              name: doc.name,
              file_path: doc.path,
              file_type: doc.type,
              file_size: doc.size,
              document_type: doc.document_type,
              document_status: 'Draft',
              uploaded_by: user.id
            }))
          );

        if (docsError) throw docsError;
      }

      toast.success('Offer updated successfully');
      navigate(`/offers/${id}/details`);
    } catch (error) {
      console.error('Error updating offer:', error);
      toast.error('Failed to update offer');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (
    fileData: { name: string; path: string; type: string; size: number; },
    documentType: 'Customer RFP' | 'Subcontractor Proposal' | 'SettleMint Proposal'
  ) => {
    // Update local state to show the file immediately
    setUploadedDocuments(prev => ({
      ...prev,
      [documentType]: [...prev[documentType], fileData]
    }));
  };

  const handleFileDelete = async (
    filePath: string,
    documentType: 'Customer RFP' | 'Subcontractor Proposal' | 'SettleMint Proposal'
  ) => {
    // Update UI state
    const updatedDocuments = {
      ...uploadedDocuments,
      [documentType]: uploadedDocuments[documentType].filter(file => file.path !== filePath)
    };
    setUploadedDocuments(updatedDocuments);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!opportunity || !offer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Offer not found</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => navigate('/offers')}
        >
          Back to Offers
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Offer</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Opportunity Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Opportunity Details</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Opportunity Name
                  </label>
                  <p className="mt-1 text-lg font-medium text-gray-900">
                    {opportunity.opportunity_name}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {opportunity.opportunity_human_id}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Customer
              </label>
              <p className="mt-1 text-sm text-gray-900">{opportunity.customer_name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Region
              </label>
              <p className="mt-1 text-sm text-gray-900">{opportunity.region}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Deal Owner
              </label>
              <p className="mt-1 text-sm text-gray-900">{opportunity.deal_owner_name}</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Opportunity Summary
              </label>
              <div className="mt-1 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: opportunity.use_case_summary || 'No summary available' }} />
            </div>
          </div>
        </div>

        {/* Offer Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Offer Details</h2>
          <div className="space-y-6">
            <div>
              <RichTextEditor
                label="Offer Summary"
                value={formData.offer_summary}
                onChange={value => setFormData(prev => ({ ...prev, offer_summary: value }))}
                placeholder="Enter offer summary..."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Combobox
                  label="PreSales Engineer"
                  value={users.find(u => u.id === formData.presales_engineer_id)?.name || ''}
                  onChange={value => { 
                    const user = users.find(u => u.name === value && u.role === 'Presales Engineer');
                    setFormData(prev => ({
                      ...prev,
                      presales_engineer_id: user?.id || ''
                    }));
                  }}
                  options={users.filter(u => u.role === 'Presales Engineer').map(u => u.name)}
                  placeholder="Select presales engineer..."
                  renderOption={(option) => {
                    const user = users.find(u => u.name === option);
                    return (
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        {user && <span className="text-xs text-gray-500">{user.role}</span>}
                      </div>
                    );
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Partners
                </label>
                <div className="space-y-2">
                  {selectedPartners.map(partnerId => {
                    const partner = partners.find(p => p.id === partnerId);
                    return (
                      <div
                        key={partnerId}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                      >
                        <span className="text-sm text-gray-900">
                          {partner?.company_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPartners(prev =>
                            prev.filter(id => id !== partnerId)
                          )}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  <Combobox
                    value=""
                    onChange={value => {
                      const partner = partners.find(p => p.company_name === value);
                      if (partner && !selectedPartners.includes(partner.id)) {
                        setSelectedPartners(prev => [...prev, partner.id]);
                      }
                    }}
                    options={partners
                      .filter(p => !selectedPartners.includes(p.id))
                      .map(p => p.company_name)}
                    placeholder="Add partner..."
                  />
                </div>
              </div>

              <div>
                <FormInput
                  label="Offer Creation Date"
                  type="date"
                  value={formData.offer_creation_date}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    offer_creation_date: e.target.value
                  }))}
                  disabled
                />
              </div>

              <div>
                <FormInput
                  label="Offer Due Date"
                  type="date"
                  value={formData.offer_due_date}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    offer_due_date: e.target.value
                  }))}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Platform License Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <PlatformLicenseDetails
            offerId={id}
            onEnvironmentsChange={setEnvironments}
          />
        </div>

        {/* Project Services */}
        <div className="bg-white shadow rounded-lg p-6">
          <ProjectServices
            offerId={id}
            onServiceSetsChange={setServiceSets}
          />
        </div>

        {/* Documents */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Documents</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Customer RFP Documents
              </h3>
              <FileUploadManager
                bucketName="offer-documents"
                folderPath={`offers/customer-rfp`}
                onUploadComplete={async (fileData) => handleFileUpload(fileData, 'Customer RFP')}
                onDeleteComplete={async (filePath) => handleFileDelete(filePath, 'Customer RFP')}
                files={uploadedDocuments['Customer RFP']}
                accept=".pdf,.doc,.docx"
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Subcontractor Proposal Documents
              </h3>
              <FileUploadManager
                bucketName="offer-documents"
                folderPath={`offers/subcontractor-proposal`}
                onUploadComplete={async (fileData) => handleFileUpload(fileData, 'Subcontractor Proposal')}
                onDeleteComplete={async (filePath) => handleFileDelete(filePath, 'Subcontractor Proposal')}
                files={uploadedDocuments['Subcontractor Proposal']}
                accept=".pdf,.doc,.docx"
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                SettleMint Proposal Documents
              </h3>
              <FileUploadManager
                bucketName="offer-documents"
                folderPath={`offers/settlemint-proposal`}
                onUploadComplete={async (fileData) => handleFileUpload(fileData, 'SettleMint Proposal')}
                onDeleteComplete={async (filePath) => handleFileDelete(filePath, 'SettleMint Proposal')}
                files={uploadedDocuments['SettleMint Proposal']}
                accept=".pdf,.doc,.docx"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/offers')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            Update Offer
          </Button>
        </div>
      </form>
    </div>
  );
}