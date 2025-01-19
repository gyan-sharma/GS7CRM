import React from 'react';
import { Clock, CheckCircle, XCircle, History } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';

interface ReviewHistory {
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
}

interface OfferReviewHistoryProps {
  offerId: string;
  className?: string;
}

export function OfferReviewHistory({ offerId, className }: OfferReviewHistoryProps) {
  const [loading, setLoading] = React.useState(true);
  const [history, setHistory] = React.useState<ReviewHistory[]>([]);

  React.useEffect(() => {
    fetchReviewHistory();
  }, [offerId]);

  const fetchReviewHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('review_history_view')
        .select('*')
        .eq('offer_id', offerId)
        .order('change_date', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching review history:', error);
      toast.error('Failed to load review history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'needs_improvement':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600';
      case 'approved':
        return 'text-green-600';
      case 'needs_improvement':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={clsx('bg-white shadow rounded-lg p-6', className)}>
        <div className="flex items-center gap-3 text-gray-500">
          <History className="w-5 h-5" />
          <h2 className="text-lg font-medium">Review History</h2>
        </div>
        <p className="mt-4 text-center text-gray-500">No review history available</p>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white shadow rounded-lg p-6', className)}>
      <div className="flex items-center gap-3 mb-6">
        <History className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-medium text-gray-900">Review History</h2>
      </div>

      <div className="space-y-8">
        {history.map((item) => (
          <div key={item.history_id} className="relative pb-8">
            {/* Timeline connector */}
            <div className="absolute left-4 top-4 -bottom-4 w-0.5 bg-gray-200" />

            <div className="relative flex items-start space-x-3">
              {/* Status icon */}
              <div className="relative">
                <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                  {getStatusIcon(item.new_status)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {item.changed_by_name} ({item.changed_by_role})
                  </div>
                  <p className="mt-0.5 text-gray-500">
                    Changed {item.reviewer_name}'s {item.review_type} review status from{' '}
                    <span className={getStatusColor(item.previous_status)}>
                      {item.previous_status}
                    </span>{' '}
                    to{' '}
                    <span className={getStatusColor(item.new_status)}>
                      {item.new_status}
                    </span>
                  </p>
                </div>
                {item.comments && (
                  <div className="mt-2 text-sm text-gray-700">
                    <div className="bg-gray-50 rounded-md p-3">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: item.comments }} />
                    </div>
                  </div>
                )}
                <div className="mt-2 text-sm text-gray-500">
                  {new Date(item.change_date).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}