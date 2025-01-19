import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { OfferReviewSection } from '../../components/offer/OfferReviewSection';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';

interface Review {
  review_id: string;
  request_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  review_type: 'technical' | 'commercial';
  review_status: 'pending' | 'approved' | 'needs_improvement';
  review_comments: string;
  review_created_at: string;
  review_updated_at: string;
  request_details: string;
  requested_by: string;
  request_created_at: string;
  offer_id: string;
  offer_human_id: string;
  offer_name: string;
  offer_status: string;
  customer_name: string;
  customer_id: string;
  documents: Array<{
    id: string;
    name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    created_at: string;
  }>;
}

export function DealReviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [selectedReview, setSelectedReview] = React.useState<Review | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      console.log('Fetching reviews...');

      const { data, error } = await supabase
        .from('review_details_view') 
        .select('*')
        .order('review_created_at', { ascending: false });

      if (error) {
        console.error('Error from Supabase:', error);
        throw error;
      }

      console.log('Raw data from review_details_view:', data);

      // Filter reviews based on user role and permissions
      const filteredReviews = data
        .filter(review => {
          console.log('Filtering review:', review);
          console.log('Current user:', user);
          // Admin can see all reviews
          if (user?.role === 'admin') return true;
          // Users can see reviews they are assigned to
          return review.reviewer_id === user?.id;
        })
        .map(review => ({
          ...review,
          documents: typeof review.documents === 'string' 
            ? JSON.parse(review.documents) 
            : review.documents
        }));

      console.log('Filtered and processed reviews:', filteredReviews);
      setReviews(filteredReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (document: {
    name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }) => {
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
      console.error('Error downloading document:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to download document. Please try again.');
    }
  };

  const handleSubmitReview = async (
    reviewId: string,
    status: 'approved' | 'needs_improvement',
    comments: string
  ) => {
    setSubmitting(true);
    try {
      // Get the current review to know its previous status
      const { data: currentReview, error: reviewFetchError } = await supabase
        .from('offer_reviews')
        .select('status')
        .eq('id', reviewId)
        .single();

      if (reviewFetchError) throw reviewFetchError;

      // Update review status and comments
      const { error: reviewError } = await supabase
        .from('offer_reviews')
        .update({
          status,
          comments,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (reviewError) throw reviewError;

      // Add review history entry
      const { error: historyError } = await supabase
        .from('offer_review_history')
        .insert({
          review_id: reviewId,
          previous_status: currentReview?.status || 'pending',
          new_status: status,
          comments,
          changed_by: user?.id
        });

      if (historyError) throw historyError;

      toast.success('Review submitted successfully');
      await fetchReviews();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
      throw error;
    } finally {
      setSubmitting(false);
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
      await fetchReviews();
    } catch (error) {
      console.error('Error resending review:', error);
      toast.error('Failed to resend review');
      throw error;
    }
  };

  const handleCreateReviewRequest = async (data: {
    requestDetails: string;
    technicalReviewers: string[];
    commercialReviewers: string[];
    documents: Array<{
      name: string;
      path: string;
      type: string;
      size: number;
    }>;
  }) => {
    try {
      // Create review request
      const { data: request, error: requestError } = await supabase
        .from('offer_review_requests')
        .insert({
          offer_id: data.offerId,
          request_details: data.requestDetails,
          requested_by: user?.id
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create technical reviews
      if (data.technicalReviewers.length > 0) {
        const { error: technicalError } = await supabase
          .from('offer_reviews')
          .insert(
            data.technicalReviewers.map(reviewerId => ({
              request_id: request.id,
              reviewer_id: reviewerId,
              review_type: 'technical',
              status: 'pending'
            }))
          );

        if (technicalError) throw technicalError;
      }

      // Create commercial reviews
      if (data.commercialReviewers.length > 0) {
        const { error: commercialError } = await supabase
          .from('offer_reviews')
          .insert(
            data.commercialReviewers.map(reviewerId => ({
              request_id: request.id,
              reviewer_id: reviewerId,
              review_type: 'commercial',
              status: 'pending'
            }))
          );

        if (commercialError) throw commercialError;
      }

      // Save documents
      if (data.documents.length > 0) {
        const { error: docsError } = await supabase
          .from('offer_review_documents')
          .insert(
            data.documents.map(doc => ({
              request_id: request.id,
              name: doc.name,
              file_path: doc.path,
              file_type: doc.type,
              file_size: doc.size,
              uploaded_by: user?.id
            }))
          );

        if (docsError) throw docsError;
      }

      toast.success('Review request created successfully');
      await fetchReviews();
    } catch (error) {
      console.error('Error creating review request:', error);
      toast.error('Failed to create review request');
      throw error;
    }
  };

  const pendingReviews = reviews.filter(r => r.review_status === 'pending');
  const completedReviews = reviews.filter(r => r.review_status !== 'pending');

  console.log('Pending reviews:', pendingReviews);
  console.log('Completed reviews:', completedReviews);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (selectedReview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Review Details</h1>
            <p className="text-sm text-gray-500 mt-1">
              {selectedReview.offer_name} - {selectedReview.customer_name}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setSelectedReview(null)}
          >
            Back to Reviews
          </Button>
        </div>

        <OfferReviewSection
          requestDetails={selectedReview.request_details}
          documents={selectedReview.documents}
          reviews={[{
            id: selectedReview.review_id,
            reviewerId: selectedReview.reviewer_id,
            reviewerName: selectedReview.reviewer_name,
            reviewerRole: selectedReview.reviewer_role,
            type: selectedReview.review_type,
            status: selectedReview.review_status,
            comments: selectedReview.review_comments,
            timestamp: selectedReview.review_created_at
          }]}
          onDownloadDocument={handleDownloadDocument}
          onSubmitReview={handleSubmitReview}
          onResendReview={handleResendReview}
          currentUserId={user?.id || ''}
          isAdmin={user?.role === 'admin'}
        />
      </div>
    );
  }

  const ReviewTable = ({ reviews, title }: { reviews: Review[]; title: string }) => (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text -3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Offer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reviewer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reviews.map(review => (
              <tr key={review.review_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-indigo-100 rounded-lg">
                      <FileText className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {review.offer_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {review.offer_human_id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {review.customer_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={clsx(
                    'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                    review.review_type === 'technical' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  )}>
                    {review.review_type === 'technical' ? 'Technical' : 'Commercial'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {review.review_status === 'pending' && (
                      <>
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-yellow-500">Pending Review</span>
                      </>
                    )}
                    {review.review_status === 'approved' && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500">Approved</span>
                      </>
                    )}
                    {review.review_status === 'needs_improvement' && (
                      <>
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-500">Needs Improvement</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <Avatar name={review.reviewer_name} size="sm" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {review.reviewer_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {review.reviewer_role}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(review.review_created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button
                    onClick={() => setSelectedReview(review)}
                  >
                    View Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {reviews.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No reviews found
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Deal Reviews</h1>

      {/* New Review Requests */}
      <ReviewTable
        reviews={pendingReviews}
        title="New Review Requests"
      />

      {/* Completed Reviews */}
      <ReviewTable
        reviews={completedReviews}
        title="Completed Reviews"
      />
    </div>
  );
}