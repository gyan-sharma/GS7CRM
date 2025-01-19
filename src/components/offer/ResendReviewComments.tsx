import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';

interface ResendComment {
  id: string;
  comments: string;
  changed_by_name: string;
  changed_by_role: string;
  created_at: string;
}

interface ResendReviewCommentsProps {
  reviewId: string;
  className?: string;
}

export function ResendReviewComments({ reviewId, className }: ResendReviewCommentsProps) {
  const [loading, setLoading] = React.useState(true);
  const [comments, setComments] = React.useState<ResendComment[]>([]);

  React.useEffect(() => {
    fetchResendComments();
  }, [reviewId]);

  const fetchResendComments = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_review_history')
        .select(`
          id,
          comments,
          changed_by:changed_by (
            name,
            role
          ),
          created_at
        `)
        .eq('review_id', reviewId)
        .eq('new_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedComments = data?.map(item => ({
        id: item.id,
        comments: item.comments,
        changed_by_name: item.changed_by.name,
        changed_by_role: item.changed_by.role,
        created_at: item.created_at
      })) || [];

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching resend comments:', error);
      toast.error('Failed to load resend comments');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (comments.length === 0) {
    return null;
  }

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="flex items-center gap-2 text-gray-500">
        <MessageSquare className="w-5 h-5" />
        <h3 className="text-sm font-medium">Resend Comments</h3>
      </div>

      <div className="space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="bg-gray-50 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Avatar name={comment.changed_by_name} size="sm" />
              <div>
                <div className="font-medium text-gray-900">
                  {comment.changed_by_name}
                </div>
                <div className="text-xs text-gray-500">
                  {comment.changed_by_role}
                </div>
              </div>
            </div>

            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: comment.comments }} />

            <div className="text-xs text-gray-500">
              {new Date(comment.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}