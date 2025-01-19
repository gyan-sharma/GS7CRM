import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RichTextEditor } from '../ui/RichTextEditor';
import { FileUploadManager } from '../ui/FileUploadManager';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface ResendReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string;
  onResendComplete: () => Promise<void>;
}

export function ResendReviewModal({
  isOpen,
  onClose,
  reviewId,
  onResendComplete
}: ResendReviewModalProps) {
  const { user } = useAuth();
  const [message, setMessage] = React.useState('');
  const [documents, setDocuments] = React.useState<Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to resend a review');
      return;
    }

    if (!message.trim()) {
      toast.error('Please provide a message');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the offer ID for this review
      const { data: reviewData, error: reviewError } = await supabase
        .from('offer_reviews')
        .select('request_id')
        .eq('id', reviewId)
        .single();

      if (reviewError) throw reviewError;

      const { data: requestData, error: requestError } = await supabase
        .from('offer_review_requests')
        .select('offer_id')
        .eq('id', reviewData.request_id)
        .single();

      if (requestError) throw requestError;

      // Get the current review to add to history
      const { data: currentReview, error: reviewFetchError } = await supabase
        .from('offer_reviews')
        .select('*')
        .eq('id', reviewId)
        .single();

      if (reviewFetchError) throw reviewFetchError;

      // Update the offer status to "In Review"
      const { error: offerError } = await supabase
        .from('offer_records')
        .update({
          status: 'In Review',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestData.offer_id);

      if (offerError) throw offerError;

      // Update review status
      const { error: updateError } = await supabase
        .from('offer_reviews')
        .update({
          status: 'pending',
          comments: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (updateError) throw updateError;

      // Add history entry
      const { error: historyError } = await supabase
        .from('offer_review_history')
        .insert({
          review_id: reviewId,
          previous_status: currentReview?.status || 'needs_improvement',
          new_status: 'pending',
          comments: message,
          changed_by: user.id
        });

      if (historyError) throw historyError;

      // Save new documents if any
      if (documents.length > 0) {
        const { error: docsError } = await supabase
          .from('offer_review_documents')
          .insert(
            documents.map(doc => ({
              request_id: reviewData.request_id,
              name: doc.name,
              file_path: doc.path,
              file_type: doc.type,
              file_size: doc.size,
              uploaded_by: user.id
            }))
          );

        if (docsError) throw docsError;
      }

      toast.success('Review request resent successfully');
      await onResendComplete();
      onClose();
    } catch (error) {
      console.error('Error resending review:', error);
      toast.error('Failed to resend review');
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
      title="Resend Review Request"
    >
      <div className="space-y-6">
        <div>
          <RichTextEditor
            label="Message"
            value={message}
            onChange={setMessage}
            placeholder="Enter your message explaining the changes made..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Additional Documents
          </label>
          <FileUploadManager
            bucketName="drp-documents"
            folderPath={`reviews/${reviewId}`}
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
            Resend Review Request
          </Button>
        </div>
      </div>
    </Modal>
  );
}