import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RichTextEditor } from '../ui/RichTextEditor';
import { Combobox } from '../ui/Combobox';
import { FileUploadManager } from '../ui/FileUploadManager';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ReviewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: string;
  users: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export function ReviewRequestModal({
  isOpen,
  onClose,
  offerId,
  users
}: ReviewRequestModalProps) {
  const { user } = useAuth();
  const [requestDetails, setRequestDetails] = React.useState('');
  const [technicalReviewers, setTechnicalReviewers] = React.useState<string[]>([]);
  const [commercialReviewers, setCommercialReviewers] = React.useState<string[]>([]);
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
      toast.error('You must be logged in to submit a review request');
      return;
    }

    if (!offerId) {
      console.log('No offer ID provided');
      toast.error('Invalid offer ID');
      return;
    }

    if (!requestDetails.trim()) {
      console.log('No request details provided');
      toast.error('Please enter request details');
      return;
    }

    if (technicalReviewers.length === 0) {
      console.log('No technical reviewers selected');
      toast.error('Please select at least one technical reviewer');
      return;
    }

    if (commercialReviewers.length === 0) {
      console.log('No commercial reviewers selected');
      toast.error('Please select at least one commercial reviewer');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Creating review request for offer:', offerId);
      console.log('Request details:', {
        technicalReviewers,
        commercialReviewers,
        documents
      });

      // Create review request
      const { data: request, error: requestError } = await supabase
        .from('offer_review_requests')
        .insert({
          offer_id: offerId,
          request_details: requestDetails,
          requested_by: user.id
        })
        .select()
        .single();

      if (requestError) throw requestError;
      if (!request) throw new Error('Failed to create review request');
      console.log('Created review request:', request);

      // Create technical reviews
      if (technicalReviewers.length > 0) {
        console.log('Creating technical reviews');
        const { error: technicalError } = await supabase
          .from('offer_reviews')
          .insert(
            technicalReviewers.map(reviewerId => ({
              request_id: request.id,
              reviewer_id: reviewerId,
              review_type: 'technical',
              status: 'pending'
            }))
          );

        if (technicalError) throw technicalError;
      }

      // Create commercial reviews
      if (commercialReviewers.length > 0) {
        const { error: commercialError } = await supabase
          .from('offer_reviews')
          .insert(
            commercialReviewers.map(reviewerId => ({
              request_id: request.id,
              reviewer_id: reviewerId,
              review_type: 'commercial',
              status: 'pending'
            }))
          );

        if (commercialError) throw commercialError;
      }
      console.log('Created commercial reviews');

      // Save documents
      if (documents.length > 0) {
        console.log('Saving review documents');
        const { error: docsError } = await supabase
          .from('offer_review_documents')
          .insert(
            documents.map(doc => ({
              request_id: request.id,
              name: doc.name,
              file_path: doc.path,
              file_type: doc.type,
              file_size: doc.size,
              uploaded_by: user.id
            }))
          );

        if (docsError) throw docsError;
      }
      console.log('Saved review documents');

      // Update offer status
      const { error: offerError } = await supabase
        .from('offer_records')
        .update({
          status: 'In Review',
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId);

      if (offerError) throw offerError;
      console.log('Updated offer status to In Review');
      
      // Reset form
      setRequestDetails('');
      setTechnicalReviewers([]);
      setCommercialReviewers([]);
      setDocuments([]);

      toast.success('Review request submitted successfully');
      // Refresh the page to show the updated status
      window.location.reload();
      onClose();
    } catch (error) {
      console.error('Error submitting review request:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to submit review request');
      throw error;
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
      title="Submit Review Request"
    >
      <div className="space-y-6">
        <div>
          <RichTextEditor
            label="Request Details"
            value={requestDetails}
            onChange={setRequestDetails}
            placeholder="Enter review request details..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Technical Reviewers
          </label>
          <div className="space-y-2">
            {technicalReviewers.map(reviewerId => {
              const reviewer = users.find(u => u.id === reviewerId);
              return (
                <div
                  key={reviewerId}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900">{reviewer?.name}</span>
                    <span className="text-xs text-gray-500">{reviewer?.role}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTechnicalReviewers(prev =>
                      prev.filter(id => id !== reviewerId)
                    )}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <Combobox
              value=""
              onChange={value => {
                const reviewer = users.find(u => u.name === value);
                if (reviewer && !technicalReviewers.includes(reviewer.id)) {
                  setTechnicalReviewers(prev => [...prev, reviewer.id]);
                }
              }}
              options={users
                .filter(u => !technicalReviewers.includes(u.id))
                .map(u => u.name)}
              placeholder="Add technical reviewer..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commercial Reviewers
          </label>
          <div className="space-y-2">
            {commercialReviewers.map(reviewerId => {
              const reviewer = users.find(u => u.id === reviewerId);
              return (
                <div
                  key={reviewerId}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900">{reviewer?.name}</span>
                    <span className="text-xs text-gray-500">{reviewer?.role}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommercialReviewers(prev =>
                      prev.filter(id => id !== reviewerId)
                    )}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <Combobox
              value=""
              onChange={value => {
                const reviewer = users.find(u => u.name === value);
                if (reviewer && !commercialReviewers.includes(reviewer.id)) {
                  setCommercialReviewers(prev => [...prev, reviewer.id]);
                }
              }}
              options={users
                .filter(u => !commercialReviewers.includes(u.id))
                .map(u => u.name)}
              placeholder="Add commercial reviewer..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Supporting Documents
          </label>
          <FileUploadManager
            bucketName="drp-documents"
            folderPath={`reviews/${offerId}`}
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
            Submit Review Request
          </Button>
        </div>
      </div>
    </Modal>
  );
}