import React from 'react';
import { Clock, CheckCircle, XCircle, FileText, Download } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ResendReviewComments } from './ResendReviewComments';
import { ResendReviewModal } from './ResendReviewModal';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';

interface Review {
  review_id: string;
  reviewer_name: string;
  reviewer_role: string;
  review_type: 'technical' | 'commercial';
  review_status: 'pending' | 'approved' | 'needs_improvement';
  review_comments: string;
  review_created_at: string;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface OfferReviewDetailsProps {
  offerId: string;
  className?: string;
}

export function OfferReviewDetails({ offerId, className }: OfferReviewDetailsProps) {
  const [loading, setLoading] = React.useState(true);
  const [showResendModal, setShowResendModal] = React.useState(false);
  const [selectedReviewId, setSelectedReviewId] = React.useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = React.useState<{
    request_details: string;
    created_at: string;
    documents: Document[];
    reviews: Review[];
  } | null>(null);

  React.useEffect(() => {
    fetchReviewDetails();
  }, [offerId]);

  const fetchReviewDetails = async () => {
    try {
      // Get the latest review request for this offer
      const { data: requestData, error: requestError } = await supabase
        .from('offer_review_requests')
        .select(`
          *,
          documents:offer_review_documents(
            id,
            name,
            file_path,
            file_type,
            file_size,
            created_at
          ),
          reviews:offer_reviews(
            id,
            reviewer:reviewer_id(name, role),
            review_type,
            status,
            comments,
            created_at
          )
        `)
        .eq('offer_id', offerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (requestError) {
        if (requestError.code === 'PGRST116') {
          // No review request found
          setReviewRequest(null);
          return;
        }
        throw requestError;
      }

      // Transform the data to match our interface
      const reviews: Review[] = requestData.reviews.map((review: any) => ({
        review_id: review.id,
        reviewer_name: review.reviewer.name,
        reviewer_role: review.reviewer.role,
        review_type: review.review_type,
        review_status: review.status,
        review_comments: review.comments,
        review_created_at: review.created_at
      }));

      setReviewRequest({
        request_details: requestData.request_details,
        created_at: requestData.created_at,
        documents: requestData.documents,
        reviews
      });
    } catch (error) {
      console.error('Error fetching review details:', error);
      toast.error('Failed to load review details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('drp-documents')
        .download(document.file_path);

      if (error) throw error;

      // Create a download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const handleResendReview = async (reviewId: string) => {
    try {
      // Get the current review to add to history
      const { data: currentReview, error: reviewFetchError } = await supabase
        .from('offer_reviews')
        .select('status')
        .eq('id', reviewId)
        .single();

      if (reviewFetchError) throw reviewFetchError;

      const { error } = await supabase
        .from('offer_reviews')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;

      // Add history entry for resending review
      const { error: historyError } = await supabase
        .from('offer_review_history')
        .insert({
          review_id: reviewId,
          previous_status: currentReview?.status || 'needs_improvement',
          new_status: 'pending',
          comments: 'Review request resent',
          changed_by: user?.id
        });

      if (historyError) throw historyError;

      toast.success('Review request resent successfully');
      await fetchReviewDetails();
    } catch (error) {
      console.error('Error resending review:', error);
      toast.error('Failed to resend review');
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
      <div className="flex items-center justify-center h-32">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!reviewRequest) {
    return null;
  }

  const technicalReviews = reviewRequest.reviews.filter(r => r.review_type === 'technical');
  const commercialReviews = reviewRequest.reviews.filter(r => r.review_type === 'commercial');

  // Check if any review needs improvement and not all reviews are approved
  const hasNeedsImprovement = reviewRequest.reviews.some(r => r.review_status === 'needs_improvement');
  const allApproved = reviewRequest.reviews.every(r => r.review_status === 'approved');
  const showResendButton = hasNeedsImprovement && !allApproved;

  const ReviewSection = ({ title, reviews }: { title: string; reviews: Review[] }) => (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {reviews.map(review => (
          <div
            key={review.review_id}
            className={clsx(
              'bg-white rounded-lg border p-4 space-y-4',
              review.review_status === 'pending' ? 'border-yellow-200' :
              review.review_status === 'approved' ? 'border-green-200' :
              'border-red-200'
            )}
          >
            {/* Reviewer Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={review.reviewer_name} size="sm" />
                <div>
                  <div className="font-medium text-gray-900">{review.reviewer_name}</div>
                  <div className="text-sm text-gray-500">{review.reviewer_role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {review.review_status === 'pending' && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Pending Review</span>
                  </span>
                )}
                {review.review_status === 'approved' && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Approved</span>
                  </span>
                )}
                {review.review_status === 'needs_improvement' && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm">Needs Improvement</span>
                  </span>
                )}
              </div>
            </div>

            {/* Review Comments */}
            {review.review_comments && (
              <div className="bg-gray-50 rounded-md p-3">
                <div className="prose prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: review.review_comments }} />
                <div className="mt-2 text-xs text-gray-500">
                  {new Date(review.review_created_at).toLocaleString()}
                </div>
              </div>
            )}

            {/* Resend Comments */}
            <ResendReviewComments reviewId={review.review_id} />

            {/* Show Resend Button */}
            {showResendButton && review.review_status === 'needs_improvement' && (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setSelectedReviewId(review.review_id);
                    setShowResendModal(true);
                  }}
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
    <div className={clsx('space-y-6', className)}>
      <h2 className="text-lg font-medium text-gray-900">Review Status</h2>

      {/* Request Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Review Request Details</h3>
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: reviewRequest.request_details }} />
        <div className="mt-2 text-sm text-gray-500">
          Requested on {new Date(reviewRequest.created_at).toLocaleString()}
        </div>
      </div>

      {/* Documents */}
      {reviewRequest.documents.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Supporting Documents</h3>
          <div className="space-y-2">
            {reviewRequest.documents.map((doc, index) => (
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
        </div>
      )}

      {/* Reviews */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Reviews</h2>
        <div className="flex gap-8">
          <div className="flex-1">
            <ReviewSection title="Technical Review" reviews={technicalReviews} />
          </div>
          <div className="w-px bg-gray-200" />
          <div className="flex-1">
            <ReviewSection title="Commercial Review" reviews={commercialReviews} />
          </div>
        </div>
      </div>

      {/* Resend Review Modal */}
      <ResendReviewModal
        isOpen={showResendModal}
        onClose={() => {
          setShowResendModal(false);
          setSelectedReviewId(null);
        }}
        reviewId={selectedReviewId || ''}
        onResendComplete={fetchReviewDetails}
      />
    </div>
  );
}