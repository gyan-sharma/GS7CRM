import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { Avatar } from '../../components/ui/Avatar';
import { Combobox } from '../../components/ui/Combobox';
import { FileUploadManager } from '../../components/ui/FileUploadManager';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { supabase, checkSupabaseConnection } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_TYPES,
  LEAD_SOURCES,
  CURRENCIES,
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES
} from '../../constants/opportunities';
import { REGIONS } from '../../constants/customers';
import clsx from 'clsx';
import { FileText, X } from 'lucide-react';

type Opportunity = Database['public']['Tables']['opportunities']['Row'];
type OpportunityDocument = Database['public']['Tables']['opportunity_documents']['Row'];

export function OpportunityForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = React.useState<Opportunity | null>(null);
  const [documents, setDocuments] = React.useState<OpportunityDocument[]>([]);
  const [uploadedFiles, setUploadedFiles] = React.useState<Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [customers, setCustomers] = React.useState<Array<{
    id: string;
    company_name: string;
  }>>([]);
  const [users, setUsers] = React.useState<Array<{
    id: string;
    name: string;
  }>>([]);
  const [formData, setFormData] = React.useState({
    opportunity_name: '',
    customer_id: '',
    deal_owner_id: '',
    budget: '',
    currency: CURRENCIES[0],
    region: REGIONS[0],
    close_date: '',
    opportunity_creation_date: new Date().toISOString().split('T')[0],
    opportunity_stage: OPPORTUNITY_STAGES[0],
    opportunity_type: OPPORTUNITY_TYPES[0],
    lead_source: LEAD_SOURCES[0],
    use_case_summary: '',
    description: ''
  });

  const isNewItem = id === 'new';

  React.useEffect(() => {
    Promise.all([
      fetchCustomers(),
      fetchUsers(),
      !isNewItem && fetchItem()
    ].filter(Boolean));
  }, [id]);

  const fetchCustomers = async () => {
    try {
      // Check Supabase connection first
      const isConnected = await checkSupabaseConnection().catch(() => false);
      if (!isConnected) {
        throw new Error('Please connect to Supabase first by clicking the "Connect to Supabase" button in the top right.');
      }

      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name');

      if (error) {
        console.error('Error fetching customers:', error);
        throw new Error('Failed to load customers. Please try again.');
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load customers');
      // Set empty customers array to prevent undefined errors
      setCustomers([]);
    }
  };

  const fetchUsers = async () => {
    try {
      // Check Supabase connection first
      const isConnected = await checkSupabaseConnection().catch(() => false);
      if (!isConnected) {
        throw new Error('Please connect to Supabase first by clicking the "Connect to Supabase" button in the top right.');
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching users:', error);
        throw new Error('Failed to load users. Please try again.');
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load users');
      // Set empty users array to prevent undefined errors
      setUsers([]);
    } finally {
      if (isNewItem) {
        setLoading(false);
      }
    }
  };

  const fetchItem = async () => {
    try {
      const { data: opportunity, error: opportunityError } = await supabase
        .from('opportunity_records')
        .select('*')
        .eq('id', id)
        .single();

      if (opportunityError) throw opportunityError;

      // Fetch opportunity documents
      const { data: docs, error: docsError } = await supabase
        .from('opportunity_document_records')
        .select('*')
        .eq('opportunity_id', id);

      if (docsError) throw docsError;
      setDocuments(docs || []);

      // Convert documents to file format for FileUploadManager
      setUploadedFiles(docs.map(doc => ({
        name: doc.name,
        path: doc.file_path,
        type: doc.file_type,
        size: doc.file_size
      })));

      setItem(opportunity);
      setFormData({
        opportunity_name: opportunity.opportunity_name,
        customer_id: opportunity.customer_id || '',
        deal_owner_id: opportunity.deal_owner_id || '',
        budget: opportunity.budget.toString(),
        currency: opportunity.currency,
        region: opportunity.region,
        close_date: new Date(opportunity.close_date).toISOString().split('T')[0],
        opportunity_creation_date: new Date(opportunity.opportunity_creation_date).toISOString().split('T')[0],
        opportunity_stage: opportunity.opportunity_stage,
        opportunity_type: opportunity.opportunity_type,
        lead_source: opportunity.lead_source,
        use_case_summary: opportunity.use_case_summary || '',
        description: opportunity.description || ''
      });
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      toast.error('Failed to load opportunity details');
      navigate('/opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let newOpportunityId: string | null = null;

    try {
      const dataToSave = {
        ...formData,
        opportunity_human_id: isNewItem ? `OPP${Math.random().toString(36).substr(2, 6).toUpperCase()}` : item?.opportunity_human_id,
        budget: parseFloat(formData.budget) || 0
      };

      if (isNewItem) {
        const { data: opportunity, error: opportunityError } = await supabase
        .from('opportunity_records')
          .insert([dataToSave])
          .select()
          .single();

        if (opportunityError) throw opportunityError;
        if (!opportunity) throw new Error('Failed to create opportunity');

        newOpportunityId = opportunity.id;

        // Handle any pending file uploads for new opportunity
        if (uploadedFiles.length > 0) {
          for (const file of uploadedFiles) {
            // Move file from temp folder to actual opportunity folder
            const newPath = file.path.replace('temp', opportunity.id);
            const { error: moveError } = await supabase.storage
              .from('opportunity_document_storage')
              .move(file.path, newPath);

            if (moveError) {
              console.error('Error moving file:', moveError);
              continue;
            }

            // Create document record
            await supabase
              .from('opportunity_document_records')
              .insert({
                opportunity_id: opportunity.id,
                name: file.name,
                file_path: newPath,
                file_type: file.type,
                file_size: file.size,
                document_type: DOCUMENT_TYPES[0],
                document_status: DOCUMENT_STATUSES[0]
              });
          }
        }

        toast.success('Opportunity created successfully');
      } else {
        const { error: opportunityError } = await supabase
        .from('opportunity_records')
          .update(dataToSave)
          .eq('id', id);

        if (opportunityError) throw opportunityError;

        toast.success('Opportunity updated successfully');
      }

      navigate('/opportunities');
    } catch (error) {
      console.error('Error saving opportunity:', error);
      toast.error(isNewItem ? 'Failed to create opportunity' : 'Failed to update opportunity');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (fileData: {
    name: string;
    path: string;
    type: string;
    size: number;
  }) => {
    // For new opportunities, just update the UI state
    if (isNewItem) {
      setUploadedFiles(prev => [...prev, fileData]);
      return;
    }

    const { error } = await supabase
      .from('opportunity_document_records')
      .insert({
        opportunity_id: id,
        name: fileData.name,
        file_path: fileData.path,
        file_type: fileData.type,
        file_size: fileData.size,
        document_type: DOCUMENT_TYPES[0],
        document_status: DOCUMENT_STATUSES[0]
      });

    if (error) throw error;

    // Update local state with the new document
    setDocuments(prev => [...prev, {
      id: '', // This will be updated when we fetch
      opportunity_id: id,
      name: fileData.name,
      file_path: fileData.path,
      file_type: fileData.type,
      file_size: fileData.size,
      document_type: DOCUMENT_TYPES[0],
      document_status: DOCUMENT_STATUSES[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);

    // Update uploaded files list for FileUploadManager
    setUploadedFiles(prev => [...prev, {
      name: fileData.name,
      path: fileData.path,
      type: fileData.type,
      size: fileData.size
    }]);

    // Refresh documents list
    const { data: docs, error: fetchError } = await supabase
      .from('opportunity_document_records')
      .select('*')
      .eq('opportunity_id', id);

    if (fetchError) throw fetchError;
    setDocuments(docs || []);
  };

  const handleFileDelete = async (filePath: string) => {
    // For new opportunities, just update the UI state
    if (isNewItem) {
      setUploadedFiles(prev => prev.filter(file => file.path !== filePath));
      return;
    }

    try {
    const { error } = await supabase
      .from('opportunity_document_records')
      .delete()
      .eq('file_path', filePath);

      if (error) throw error;

      // Update local state
      setDocuments(prev => prev.filter(doc => doc.file_path !== filePath));
      setUploadedFiles(prev => prev.filter(file => file.path !== filePath));

      toast.success('File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNewItem ? 'Create Opportunity' : 'Edit Opportunity'}
        </h1>
        {isNewItem && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFormData({
                opportunity_name: 'Enterprise License Deal',
                customer_id: customers[0]?.id || '',
                deal_owner_id: users[0]?.id || '',
                budget: '150000',
                currency: 'USD',
                region: 'AMERICAS',
                close_date: '2024-12-31',
                opportunity_creation_date: new Date().toISOString().split('T')[0],
                opportunity_stage: 'Qualification',
                opportunity_type: 'New Business',
                lead_source: 'Partner',
                use_case_summary: 'Enterprise-wide blockchain implementation',
                description: 'Large-scale blockchain implementation across multiple departments'
              });
            }}
          >
            Fill Dummy Data
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput
                label="Opportunity Name"
                type="text"
                id="opportunity_name"
                required
                value={formData.opportunity_name}
                onChange={e =>
                  setFormData(prev => ({ ...prev, opportunity_name: e.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <Combobox
                label="Customer"
                value={customers.find(c => c.id === formData.customer_id)?.company_name || ''}
                onChange={value => {
                  const customer = customers.find(c => c.company_name === value);
                  setFormData(prev => ({ ...prev, customer_id: customer?.id || '' }));
                }}
                options={customers.map(c => c.company_name)}
                placeholder="Select customer..."
              />
            </div>

            <div className="sm:col-span-2">
              <Combobox
                label="Deal Owner"
                value={users.find(u => u.id === formData.deal_owner_id)?.name || ''}
                onChange={value => {
                  const user = users.find(u => u.name === value);
                  setFormData(prev => ({ ...prev, deal_owner_id: user?.id || '' }));
                }}
                options={users.map(u => u.name)}
                placeholder="Select deal owner..."
                renderOption={(option) => {
                  return (
                    <div className="flex items-center gap-3 px-2">
                      <Avatar name={option} size="sm" />
                      <span>{option}</span>
                    </div>
                  );
                }}
                renderValue={(value) => {
                  if (value) {
                    return (
                      <div className="flex items-center gap-3 pl-1">
                        <Avatar name={value} size="sm" />
                        <span>{value}</span>
                      </div>
                    );
                  }
                  return <span className="text-gray-500">Select deal owner...</span>;
                }}
              />
            </div>
          </div>
        </div>

        {/* Financial Information */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Financial Information</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <FormInput
                label="Budget"
                type="number"
                id="budget"
                min="0"
                step="0.01"
                required
                value={formData.budget}
                onChange={e =>
                  setFormData(prev => ({ ...prev, budget: e.target.value }))
                }
              />
            </div>

            <div>
              <Combobox
                label="Currency"
                value={formData.currency}
                onChange={currency => setFormData(prev => ({ ...prev, currency }))}
                options={CURRENCIES}
                placeholder="Select currency..."
              />
            </div>
          </div>
        </div>

        {/* Region and Timeline */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Region and Timeline</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Combobox
                label="Region"
                value={formData.region}
                onChange={region => setFormData(prev => ({ ...prev, region }))}
                options={REGIONS}
                placeholder="Select region..."
              />
            </div>

            <div>
              <FormInput
                label="Close Date"
                type="date"
                id="close_date"
                required
                value={formData.close_date}
                onChange={e =>
                  setFormData(prev => ({ ...prev, close_date: e.target.value }))
                }
              />
            </div>

            <div>
              <FormInput
                label="Creation Date"
                type="date"
                id="opportunity_creation_date"
                required
                value={formData.opportunity_creation_date}
                onChange={e =>
                  setFormData(prev => ({ ...prev, opportunity_creation_date: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Classification</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Combobox
                label="Stage"
                value={formData.opportunity_stage}
                onChange={opportunity_stage => setFormData(prev => ({ ...prev, opportunity_stage }))}
                options={OPPORTUNITY_STAGES}
                placeholder="Select stage..."
              />
            </div>

            <div>
              <Combobox
                label="Type"
                value={formData.opportunity_type}
                onChange={opportunity_type => setFormData(prev => ({ ...prev, opportunity_type }))}
                options={OPPORTUNITY_TYPES}
                placeholder="Select type..."
              />
            </div>

            <div>
              <Combobox
                label="Lead Source"
                value={formData.lead_source}
                onChange={lead_source => setFormData(prev => ({ ...prev, lead_source }))}
                options={LEAD_SOURCES}
                placeholder="Select lead source..."
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Description</h2>
          
          <div className="space-y-4">
            <div>
              <RichTextEditor
                label="Use Case Summary"
                value={formData.use_case_summary}
                onChange={value =>
                  setFormData(prev => ({ ...prev, use_case_summary: value }))
                }
                placeholder="Enter use case summary..."
              />
            </div>

            <div>
              <RichTextEditor
                label="Description/Notes"
                value={formData.description}
                onChange={value =>
                  setFormData(prev => ({ ...prev, description: value }))
                }
                placeholder="Enter description and notes..."
              />
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Documents</h2>
          <div className="space-y-4">
            <FileUploadManager
              bucketName="opportunity_document_storage"
              folderPath={`opportunities/${id || 'temp'}`}
              onUploadComplete={handleFileUpload}
              onDeleteComplete={handleFileDelete}
              files={uploadedFiles}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              maxSize={20 * 1024 * 1024} // 20MB
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/opportunities')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isNewItem ? 'Create Opportunity' : 'Update Opportunity'}
          </Button>
        </div>
      </form>

      {!isNewItem && item && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Additional Information
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Opportunity ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{item.opportunity_human_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(item.created_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(item.updated_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}