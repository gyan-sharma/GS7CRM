import React from 'react'; 
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormInput } from '../ui/FormInput';
import { RichTextEditor } from '../ui/RichTextEditor';
import { FileUploadManager } from '../ui/FileUploadManager';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: string;
  totalMRR: number;
  totalServicesRevenue: number; 
}

export function ContractFormModal({
  isOpen,
  onClose,
  offerId,
  totalMRR,
  totalServicesRevenue,
}: ContractFormModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = React.useState({
    contract_summary: '',
    payment_terms: '',
    contract_start_date: new Date().toISOString().split('T')[0]
  });
  const [documents, setDocuments] = React.useState<Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!user) {
      console.log('No user found in context');
      toast.error('You must be logged in to create a contract');
      return;
    }

    if (!formData.contract_summary.trim()) {
      console.log('Missing contract summary');
      toast.error('Please enter a contract summary');
      return;
    }

    if (!formData.payment_terms.trim()) {
      console.log('Missing payment terms');
      toast.error('Please enter payment terms');
      return;
    }

    if (!formData.contract_start_date) {
      console.log('Missing contract start date');
      toast.error('Please select a contract start date');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Creating contract with data:', {
        offerId,
        totalMRR,
        totalServicesRevenue,
        formData
      });

      const totalContractValue = totalMRR * 12 + totalServicesRevenue;

      const { data: contract, error } = await supabase
        .from('contracts')
        .insert({
          offer_id: offerId,
          contract_human_id: `CNT${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          contract_summary: formData.contract_summary,
          total_contract_value: totalContractValue,
          total_mrr: totalMRR,
          total_services_revenue: totalServicesRevenue,
          payment_terms: formData.payment_terms,
          contract_start_date: formData.contract_start_date,
          status: 'Draft',
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating contract:', error);
        throw error;
      }

      if (!contract) {
        console.error('No contract data returned from insert');
        throw new Error('Failed to create contract - no data returned');
      }

      // Save documents if any
      if (documents.length > 0) {
        const { error: docsError } = await supabase
          .from('contract_documents')
          .insert(
            documents.map(doc => ({
              contract_id: contract.id,
              name: doc.name,
              file_path: doc.path,
              file_type: doc.type,
              file_size: doc.size,
              uploaded_by: user.id
            }))
          );

        if (docsError) throw docsError;
      }
      console.log('Contract created successfully:', contract);

      toast.success('Contract created successfully');
      navigate(`/contracts/${contract.id}/details`);
      onClose();
    } catch (error) {
      console.error('Error creating contract:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to create contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (fileData: {
    name: string;
    path: string;
    type: string;
    size: number;
  }) => {
    setDocuments(prev => [...prev, fileData]);
  };

  const handleFileDelete = async (filePath: string) => {
    setDocuments(prev => prev.filter(doc => doc.path !== filePath));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Contract"
    >
      <div className="space-y-6">
        <div>
          <RichTextEditor
            label="Contract Summary"
            value={formData.contract_summary}
            onChange={value => setFormData(prev => ({ ...prev, contract_summary: value }))}
            placeholder="Enter contract summary..."
          />
        </div>

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

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-500">Total MRR:</span>
            <span className="text-gray-900">€{totalMRR.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-500">Total Services Revenue:</span>
            <span className="text-gray-900">€{totalServicesRevenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200">
            <span className="text-gray-900">Total Contract Value:</span>
            <span className="text-indigo-600">€{(totalMRR * 12 + totalServicesRevenue).toLocaleString()}</span>
          </div>
        </div>

        {/* Contract Documents */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Contract Documents
          </label>
          <FileUploadManager
            bucketName="contract-documents"
            folderPath={`contracts/temp`}
            onUploadComplete={handleFileUpload}
            onDeleteComplete={handleFileDelete}
            files={documents}
            accept=".pdf,.doc,.docx"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
          >
            Create Contract
          </Button>
        </div>
      </div>
    </Modal>
  );
}