import React from 'react';
import { CheckCircle, XCircle, Clock, FileText, Download } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ResendReviewComments } from './ResendReviewComments';
import { ReviewHistorySection } from './ReviewHistorySection';
import { ReviewDocumentsSection } from './ReviewDocumentsSection';
import { RichTextEditor } from '../ui/RichTextEditor';
import { supabase } from '../../lib/supabase';
import { clsx } from 'clsx';

interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  type: 'technical' | 'commercial';
  status: 'pending' | 'approved' | 'needs_improvement';
  comments: string;
  timestamp: string;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface OfferReviewSectionProps {
  requestDetails: string;
  documents: Document[];
  reviews: Review[];
  onDownloadDocument: (document: Document) => Promise<void>;
  onSubmitReview: (reviewId: string, status: 'approved' | 'needs_improvement', comments: string) => Promise<void>;
  onResendReview: (reviewId: string) => Promise<void>;
  currentUserId: string;
  isAdmin: boolean;
}

export function OfferReviewSection({
  requestDetails,
  documents,
  reviews,
  onDownloadDocument,
  onSubmitReview,
  onResendReview,
  currentUserId,
  isAdmin
}: OfferReviewSectionProps) {
  const [reviewComments, setReviewComments] = React.useState<Record<string, string>>({});
  const [submittingReview, setSubmittingReview] = React.useState<string | null>(null);
  const [resendingReview, setResendingReview] = React.useState<string | null>(null);

  const technicalReviews = reviews.filter(r => r.type === 'technical');
  const commercialReviews = reviews.filter(r => r.type === 'commercial');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const [reviewHistory, setReviewHistory] = React.useState<Array<{
    history_id: string;
    review_id: string;
    previous_status: string;
    new_status: string;
    comments: string;
    change_date: string;
    changed_by_name: string;
    changed_by_role: string;
    review_type: 'technical' | 'commercial';
    reviewer_name: string;
    reviewer_role: string;
  }>>([]);

  React.useEffect(() => {
    fetchReviewHistory();
  }, [reviews]);

  const fetchReviewHistory = async () => {
    try {
      const reviewIds = reviews.map(r => r.id);
      const { data, error } = await supabase
        .from('review_history_view')
        .select('*')
        .in('review_id', reviewIds)
        .order('change_date', { ascending: false });

      if (error) throw error;
      setReviewHistory(data || []);
    } catch (error) {
      console.error('Error fetching review history:', error);
      toast.error('Failed to load review history');
    }
  };

  const handleSubmitReview = async (reviewId: string, status: 'approved' | 'needs_improvement') => {
    const comments = reviewComments[reviewId];
    if (!comments?.trim()) {
      alert('Please provide review comments');
      return;
    }

    setSubmittingReview(reviewId);
    try {
      await onSubmitReview(reviewId, status, comments);
      setReviewComments(prev => ({ ...prev, [reviewId]: '' }));
    } finally {
      setSubmittingReview(null);
    }
  };

  const handleResendReview = async (reviewId: string) => {
    setResendingReview(reviewId);
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

      const { error } = await supabase
        .from('offer_reviews')
        .update({
          status: 'pending',
          comments: null,
          timestamp: null
        })
        .eq('id', reviewId);

      const { error: historyError } = await supabase
        .from('offer_review_history')
        .insert({
          review_id: reviewId,
          review_data: JSON.stringify(currentReview),
          created_at: new Date().toISOString()
        });

      if (historyError) throw historyError;

      toast.success('Review request resent successfully');
      window.location.reload(); // Refresh the page to show updated status
      await onResendReview(reviewId);
    } catch (error) {
      console.error('Error resending review:', error);
    } finally {
      setResendingReview(null);
    }
  };

  const canReview = (review: Review) => {
    return (isAdmin || review.reviewerId === currentUserId) && review.status === 'pending';
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      console.log('Starting document download from OfferReviewSection:', {
        document,
        bucket: 'drp-documents'
      });

      const { data, error } = await supabase.storage
        .from('drp-documents')
        .download(document.file_path);

      if (error) {
        console.error('Supabase storage error in OfferReviewSection:', {
          error,
          errorMessage: error.message,
          errorDetails: error.details,
          statusCode: error.status,
          hint: error.hint
        });
        throw error;
      }

      console.log('Document download successful in OfferReviewSection, creating blob URL');

      // Create a download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.name);
      console.log('Download link created in OfferReviewSection:', {
        url: 'blob URL - not shown for security',
        filename: document.name
      });

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      console.log('Download initiated and cleanup completed in OfferReviewSection');
    } catch (error) {
      console.error('Error downloading document:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to download document');
    }
  };

  const ReviewColumn = ({ reviews, title }: { reviews: Review[]; title: string }) => (
    <div className="flex-1">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-6">
        {reviews.map(review => (
          <div
            key={review.id}
            className={clsx(
              'bg-white rounded-lg border p-4 space-y-4',
              review.status === 'pending' ? 'border-yellow-200' :
              review.status === 'approved' ? 'border-green-200' :
              'border-red-200'
            )}
          >
            {/* Reviewer Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={review.reviewerName} size="sm" />
                <div>
                  <div className="font-medium text-gray-900">{review.reviewerName}</div>
                  <div className="text-sm text-gray-500">{review.reviewerRole}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {review.status === 'pending' && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Pending Review</span>
                  </span>
                )}
                {review.status === 'approved' && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Approved</span>
                  </span>
                )}
                {review.status === 'needs_improvement' && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm">Needs Improvement</span>
                  </span>
                )}
              </div>
            </div>

            {/* Review Comments */}
            {review.comments && (
              <div className="bg-gray-50 rounded-md p-3">
                <div className="prose prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: review.comments }} />
                <div className="mt-2 text-xs text-gray-500">
                  {new Date(review.timestamp).toLocaleString()}
                </div>
              </div>
            )}

            {/* Resend Comments */}
            <ResendReviewComments reviewId={review.id} />

            {/* Review Actions */}
            {canReview(review) ? (
              <div className="space-y-4">
                <RichTextEditor
                  value={reviewComments[review.id] || ''}
                  onChange={value => setReviewComments(prev => ({ ...prev, [review.id]: value }))}
                  placeholder="Enter your review comments..."
                />
                <div className="flex justify-end gap-3">
                  <Button
                    variant="danger"
                    onClick={() => handleSubmitReview(review.id, 'needs_improvement')}
                    isLoading={submittingReview === review.id}
                  >
                    Request Improvements
                  </Button>
                  <Button
                    onClick={() => handleSubmitReview(review.id, 'approved')}
                    isLoading={submittingReview === review.id}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ) : review.status === 'needs_improvement' && (
              <div className="flex justify-end">
                <Button
                  onClick={() => handleResendReview(review.id)}
                  isLoading={resendingReview === review.id}
                >
                  Send for Review Again
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Request Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Review Request Details</h2>
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: requestDetails }} />
      </div>

      {/* DRP Documents */}
      {documents.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <ReviewDocumentsSection
            documents={documents}
            onDownloadDocument={onDownloadDocument}
          />
        </div>
      )}

      {/* Reviews */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Reviews</h2>
        <div className="flex gap-8">
          <ReviewColumn reviews={technicalReviews} title="Technical Review" />
          <div className="w-px bg-gray-200" />
          <ReviewColumn reviews={commercialReviews} title="Commercial Review" />
        </div>
      </div>

      {/* Review History */}
      {reviewHistory.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <ReviewHistorySection history={reviewHistory} />
        </div>
      )}
    </div>
  );
}