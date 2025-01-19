import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FileText, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { FileUploadManager } from '../../components/ui/FileUploadManager';
import { Combobox } from '../../components/ui/Combobox';
import { FileUpload } from '../../components/ui/FileUpload';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { CERTIFICATION_LEVELS, SERVICE_AREAS } from '../../constants/partners';
import { REGIONS } from '../../constants/customers';
import countries from '../../constants/countries.json';

type Partner = Database['public']['Tables']['partners']['Row'];
type PartnerServiceArea = Database['public']['Tables']['partner_service_areas']['Row'];
type PartnerDocument = Database['public']['Tables']['partner_documents']['Row'];

export function PartnerForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = React.useState<Partner | null>(null);
  const [documents, setDocuments] = React.useState<PartnerDocument[]>([]);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = React.useState<Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>>([]);
  const [fileUploadError, setFileUploadError] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    company_name: '',
    headquarter_country: countries[0],
    website: '',
    region: REGIONS[0],
    is_sales_partner: false,
    is_delivery_subcontractor: false,
    contact_person: '',
    email: '',
    phone: '',
    certification_level: CERTIFICATION_LEVELS[0],
    revenue_sharing_percentage: '',
    certifications: [] as string[],
    compliance_info: '',
    service_areas: [] as string[]
  });

  const handleFileSelect = (file: File) => {
    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      setFileUploadError('File size must be less than 20MB');
      return;
    }

    // Clear any previous errors
    setFileUploadError('');
    setPendingFiles(prev => [...prev, file]);
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (partnerId: string) => {
    const uploadedFiles = [];

    for (const file of pendingFiles) {
      try {
        const filePath = `partners/${partnerId}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('partner-documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Add document record
        const { error: dbError } = await supabase
          .from('partner_documents')
          .insert({
            partner_id: partnerId,
            name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size
          });

        if (dbError) throw dbError;

        uploadedFiles.push(file.name);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (uploadedFiles.length > 0) {
      toast.success(`Successfully uploaded ${uploadedFiles.length} file(s)`);
    }
  };

  const isNewItem = id === 'new';

  React.useEffect(() => {
    if (!isNewItem) {
      fetchItem();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchItem = async () => {
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

      // Convert documents to file format for FileUploadManager
      setUploadedFiles(docs.map(doc => ({
        name: doc.name,
        path: doc.file_path,
        type: doc.file_type,
        size: doc.file_size
      })));

      setItem(partner);
      setFormData({
        company_name: partner.company_name,
        headquarter_country: partner.headquarter_country,
        website: partner.website || '',
        region: partner.region,
        is_sales_partner: partner.is_sales_partner,
        is_delivery_subcontractor: partner.is_delivery_subcontractor,
        contact_person: partner.contact_person,
        email: partner.email,
        phone: partner.phone || '',
        certification_level: partner.certification_level || CERTIFICATION_LEVELS[0],
        revenue_sharing_percentage: partner.revenue_sharing_percentage?.toString() || '',
        certifications: partner.certifications || [],
        compliance_info: partner.compliance_info || '',
        service_areas: serviceAreas?.map(sa => sa.service_area) || []
      });
    } catch (error) {
      console.error('Error fetching partner:', error);
      toast.error('Failed to load partner details');
      navigate('/partners');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        company_human_id: isNewItem ? `PTR${Math.random().toString(36).substr(2, 6).toUpperCase()}` : item?.company_human_id,
        revenue_sharing_percentage: formData.revenue_sharing_percentage ? parseFloat(formData.revenue_sharing_percentage) : null
      };

      if (isNewItem) {
        const { data: partner, error: partnerError } = await supabase
          .from('partners')
          .insert([{
            company_name: dataToSave.company_name,
            headquarter_country: dataToSave.headquarter_country,
            website: dataToSave.website,
            region: dataToSave.region,
            is_sales_partner: dataToSave.is_sales_partner,
            is_delivery_subcontractor: dataToSave.is_delivery_subcontractor,
            contact_person: dataToSave.contact_person,
            email: dataToSave.email,
            phone: dataToSave.phone,
            certification_level: dataToSave.certification_level,
            revenue_sharing_percentage: dataToSave.revenue_sharing_percentage,
            certifications: dataToSave.certifications,
            compliance_info: dataToSave.compliance_info,
            company_human_id: dataToSave.company_human_id
          }])
          .select()
          .single();

        if (partnerError) throw partnerError;
        if (!partner) throw new Error('Failed to create partner');

        // Insert service areas
        if (formData.service_areas.length > 0) {
          const { error: serviceAreasError } = await supabase
            .from('partner_service_areas')
            .insert(
              formData.service_areas.map(area => ({
                partner_id: partner.id,
                service_area: area
              }))
            );

          if (serviceAreasError) throw serviceAreasError;
        }

        // Upload files if any
        if (pendingFiles.length > 0) {
          await uploadFiles(partner.id);
        }

        toast.success('Partner created successfully');
      } else {
        const { error: partnerError } = await supabase
          .from('partners')
          .update({
            company_name: dataToSave.company_name,
            headquarter_country: dataToSave.headquarter_country,
            website: dataToSave.website,
            region: dataToSave.region,
            is_sales_partner: dataToSave.is_sales_partner,
            is_delivery_subcontractor: dataToSave.is_delivery_subcontractor,
            contact_person: dataToSave.contact_person,
            email: dataToSave.email,
            phone: dataToSave.phone,
            certification_level: dataToSave.certification_level,
            revenue_sharing_percentage: dataToSave.revenue_sharing_percentage,
            certifications: dataToSave.certifications,
            compliance_info: dataToSave.compliance_info
          })
          .eq('id', id);

        if (partnerError) throw partnerError;

        // Delete existing service areas
        const { error: deleteError } = await supabase
          .from('partner_service_areas')
          .delete()
          .eq('partner_id', id);

        if (deleteError) throw deleteError;

        // Insert new service areas
        if (formData.service_areas.length > 0) {
          const { error: serviceAreasError } = await supabase
            .from('partner_service_areas')
            .insert(
              formData.service_areas.map(area => ({
                partner_id: id,
                service_area: area
              }))
            );

          if (serviceAreasError) throw serviceAreasError;
        }

        toast.success('Partner updated successfully');
      }

      navigate('/partners');
    } catch (error) {
      console.error('Error saving partner:', error);
      toast.error(isNewItem ? 'Failed to create partner' : 'Failed to update partner');
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
    if (!id) return;

    const { error } = await supabase
      .from('partner_documents')
      .insert({
        partner_id: id,
        name: fileData.name,
        file_path: fileData.path,
        file_type: fileData.type,
        file_size: fileData.size
      });

    if (error) throw error;

    // Update local state with the new document
    setDocuments(prev => [...prev, {
      id: '', // This will be updated when we fetch
      partner_id: id,
      name: fileData.name,
      file_path: fileData.path,
      file_type: fileData.type,
      file_size: fileData.size,
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
      .from('partner_documents')
      .select('*')
      .eq('partner_id', id);

    if (fetchError) throw fetchError;
    setDocuments(docs || []);
  };

  const handleFileDelete = async (filePath: string) => {
    if (!id) return;

    const { error } = await supabase
      .from('partner_documents')
      .delete()
      .eq('file_path', filePath);

    if (error) throw error;

    // Refresh documents list
    const { data: docs, error: fetchError } = await supabase
      .from('partner_documents')
      .select('*')
      .eq('partner_id', id);

    if (fetchError) throw fetchError;
    setDocuments(docs || []);
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
          {isNewItem ? 'Create Partner' : 'Edit Partner'}
        </h1>
        {isNewItem && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFormData({
                company_name: 'Tech Solutions International',
                headquarter_country: 'United States',
                website: 'https://techsolutions.example.com',
                region: 'AMERICAS',
                is_sales_partner: true,
                is_delivery_subcontractor: true,
                contact_person: 'John Smith',
                email: 'john.smith@techsolutions.example.com',
                phone: '+1 (555) 123-4567',
                certification_level: 'gold',
                revenue_sharing_percentage: '15',
                certifications: [
                  'ISO 9001:2015',
                  'AWS Certified Solutions Architect',
                  'Microsoft Gold Partner'
                ],
                compliance_info: 'GDPR Compliant\nSOC 2 Type II Certified\nHIPAA Compliant',
                service_areas: [
                  'Blockchain Development',
                  'Front-end Development',
                  'Back-end Development',
                  'DevOps'
                ]
              });
            }}
          >
            Fill Dummy Data
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Details */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Company Details</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput
                label="Company Name"
                type="text"
                id="company_name"
                required
                value={formData.company_name}
                onChange={e =>
                  setFormData(prev => ({ ...prev, company_name: e.target.value }))
                }
              />
            </div>

            <div>
              <Combobox
                label="Headquarter Country"
                value={formData.headquarter_country}
                onChange={headquarter_country => setFormData(prev => ({ ...prev, headquarter_country }))}
                options={countries}
                placeholder="Select country..."
              />
            </div>

            <div>
              <Combobox
                label="Region"
                value={formData.region}
                onChange={region => setFormData(prev => ({ ...prev, region }))}
                options={REGIONS}
                placeholder="Select region..."
              />
            </div>

            <div className="sm:col-span-2">
              <FormInput
                label="Website"
                type="url"
                id="website"
                value={formData.website}
                onChange={e =>
                  setFormData(prev => ({ ...prev, website: e.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Partner Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={formData.is_sales_partner}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        is_sales_partner: e.target.checked
                      }))
                    }
                  />
                  <span className="ml-2 text-sm text-gray-900">Sales Partner</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={formData.is_delivery_subcontractor}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        is_delivery_subcontractor: e.target.checked
                      }))
                    }
                  />
                  <span className="ml-2 text-sm text-gray-900">Delivery Subcontractor</span>
                </label>
              </div>
              {!formData.is_sales_partner && !formData.is_delivery_subcontractor && (
                <p className="mt-1 text-sm text-red-600">
                  Please select at least one partner type
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Contact Details</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput
                label="Contact Person"
                type="text"
                id="contact_person"
                required
                value={formData.contact_person}
                onChange={e =>
                  setFormData(prev => ({ ...prev, contact_person: e.target.value }))
                }
              />
            </div>

            <div className=" sm:col-span-2">
              <FormInput
                label="Email"
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={e =>
                  setFormData(prev => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <FormInput
                label="Phone"
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={e =>
                  setFormData(prev => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Sales Partner Details */}
        {formData.is_sales_partner && (
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Sales Partner Details</h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Combobox
                  label="Certification Level"
                  value={formData.certification_level}
                  onChange={certification_level => setFormData(prev => ({ ...prev, certification_level }))}
                  options={CERTIFICATION_LEVELS}
                  placeholder="Select certification level..."
                />
              </div>

              <div>
                <FormInput
                  label="Revenue Sharing Percentage"
                  type="number"
                  id="revenue_sharing_percentage"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.revenue_sharing_percentage}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, revenue_sharing_percentage: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Delivery Subcontractor Details */}
        {formData.is_delivery_subcontractor && (
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Delivery Subcontractor Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Areas
                </label>
                <div className="space-y-2">
                  {SERVICE_AREAS.map(area => (
                    <label key={area} className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={formData.service_areas.includes(area)}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              service_areas: [...prev.service_areas, area]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              service_areas: prev.service_areas.filter(a => a !== area)
                            }));
                          }
                        }}
                      />
                      <span className="ml-2 text-sm text-gray-900">{area}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certifications
                </label>
                <div className="mt-1">
                  <textarea
                    rows={3}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formData.certifications.join('\n')}
                    onChange={e => {
                      e.preventDefault();
                      setFormData(prev => ({
                        ...prev,
                        certifications: e.target.value.split('\n').filter(Boolean)
                      }));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const value = target.value;
                        const selectionStart = target.selectionStart;
                        const newValue = value.slice(0, selectionStart) + '\n' + value.slice(target.selectionEnd);
                        setFormData(prev => ({
                          ...prev,
                          certifications: newValue.split('\n').filter(Boolean)
                        }));
                        // Set cursor position after render
                        setTimeout(() => {
                          target.selectionStart = target.selectionEnd = selectionStart + 1;
                        }, 0);
                      }
                    }}
                    placeholder="Enter certifications (one per line)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compliance Information
                </label>
                <div className="mt-1">
                  <textarea
                    rows={3}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formData.compliance_info}
                    onChange={e => {
                      e.preventDefault();
                      setFormData(prev => ({
                        ...prev,
                        compliance_info: e.target.value
                      }));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const value = target.value;
                        const selectionStart = target.selectionStart;
                        const newValue = value.slice(0, selectionStart) + '\n' + value.slice(target.selectionEnd);
                        setFormData(prev => ({
                          ...prev,
                          compliance_info: newValue
                        }));
                        // Set cursor position after render
                        setTimeout(() => {
                          target.selectionStart = target.selectionEnd = selectionStart + 1;
                        }, 0);
                      }
                    }}
                    placeholder="Enter compliance information"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Partnership Documents</h2>
          <div className="space-y-4">
            {isNewItem && (
              <>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="mb-2"
                />
                {fileUploadError && (
                  <p className="text-sm text-red-600 mb-2">{fileUploadError}</p>
                )}
                {pendingFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {pendingFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <FileText className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!isNewItem && (
              <FileUploadManager
                bucketName="partner-documents"
                folderPath={`partners/${id}`}
                onUploadComplete={handleFileUpload}
                onDeleteComplete={handleFileDelete}
                files={uploadedFiles}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                maxSize={20 * 1024 * 1024} // 20MB
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/partners')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isNewItem ? 'Create Partner' : 'Update Partner'}
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
              <dt className="text-sm font-medium text-gray-500">Partner ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{item.company_human_id}</dd>
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