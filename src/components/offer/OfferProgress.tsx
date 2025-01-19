import React from 'react';
import { FileText, Clock, CheckCircle, Send, Check, X, Pause, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { ReviewRequestModal } from './ReviewRequestModal';
import { ContractFormModal } from '../contract/ContractFormModal';
import { supabase } from '../../lib/supabase';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface OfferProgressProps {
  status: string;
  dates: {
    draft?: string;
    review?: string;
    approved?: string;
    sent?: string;
    won?: string;
    lost?: string;
    onHold?: string;
  };
  onStatusChange: (newStatus: string) => Promise<void>;
  className?: string;
}

export function OfferProgress({ status, dates, onStatusChange, className }: OfferProgressProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showReviewModal, setShowReviewModal] = React.useState(false);
  const [showContractModal, setShowContractModal] = React.useState(false);
  const [users, setUsers] = React.useState<Array<{
    id: string;
    name: string;
    role: string;
  }>>([]);
  const [totalMRR, setTotalMRR] = React.useState(0);
  const [totalServicesRevenue, setTotalServicesRevenue] = React.useState(0);

  React.useEffect(() => {
    fetchUsers();
  }, []);
  
  React.useEffect(() => {
    calculateRevenue();
  }, []);

  const calculateRevenue = async () => {
    try {
      // Get environments and their components
      const { data: environments, error: envError } = await supabase
        .from('offer_environments')
        .select(`
          *,
          components:offer_environment_components(*)
        `)
        .eq('offer_id', window.location.pathname.split('/')[2]);

      if (envError) throw envError;

      // Calculate total MRR
      const mrr = environments?.reduce((sum, env) => {
        return sum + (env.components?.reduce((compSum, comp) => 
          compSum + (comp.monthly_price * comp.quantity), 0) || 0);
      }, 0) || 0;

      // Get service sets and their components
      const { data: serviceSets, error: servicesError } = await supabase
        .from('offer_service_sets')
        .select(`
          *,
          services:offer_service_components(*)
        `)
        .eq('offer_id', window.location.pathname.split('/')[2]);

      if (servicesError) throw servicesError;

      // Calculate total services revenue
      const servicesRevenue = serviceSets?.reduce((sum, set) => {
        return sum + (set.services?.reduce((servSum, serv) => 
          servSum + (serv.manday_rate * serv.number_of_mandays * (1 + serv.profit_percentage / 100)), 0) || 0);
      }, 0) || 0;

      setTotalMRR(mrr);
      setTotalServicesRevenue(servicesRevenue);
    } catch (error) {
      console.error('Error calculating revenue:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  };

  // Get the latest date for a given status
  const getLatestDate = (status: string) => {
    switch (status) {
      case 'Draft':
        return dates.draft;
      case 'In Review':
        return dates.review;
      case 'Approved':
        return dates.approved;
      case 'Sent':
        return dates.sent;
      case 'Won':
        return dates.won;
      case 'Lost':
        return dates.lost;
      case 'Hold':
        return dates.onHold;
      default:
        return undefined;
    }
  };

  const steps = [
    { key: 'draft', label: 'Draft', status: 'Draft', date: dates.draft },
    { key: 'review', label: 'Under Review', status: 'In Review', date: status === 'In Review' ? new Date().toISOString() : dates.review },
    { key: 'approved', label: 'Approved', status: 'Approved', date: dates.approved },
    { key: 'sent', label: 'Sent', status: 'Sent', date: dates.sent },
    { 
      key: 'final', 
      label: status === 'Hold' ? 'On Hold' : status === 'Lost' ? 'Contract Lost' : 'Contract Won', 
      status: status,
      date: getLatestDate(status)
    }
  ];

  const currentStepIndex = steps.findIndex(step => 
    step.status === status || 
    (status === 'Won' && step.status === 'Won') ||
    (status === 'Lost' && step.status === 'final') ||
    (status === 'Hold' && step.status === 'final')
  );

  // Helper function to determine if a step should show its date
  const shouldShowDate = (step: typeof steps[0], index: number) => {
    // Show date for completed steps and current step
    return index <= currentStepIndex && Boolean(step.date);
  };

  return (
    <div className={clsx('space-y-8', className)}>
      {/* Action Buttons */}
      <div className="flex justify-end">
        {status === 'Draft' && (
          <Button
            variant="secondary"
            onClick={() => {
              if (!onStatusChange) {
                toast.error('Status change handler not provided');
                return;
              }
              setShowReviewModal(true);
            }}
            className="flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Send for Review
          </Button>
        )}

        {status === 'In Review' && (
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => onStatusChange('Draft')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Draft
            </Button>
            <Button
              onClick={() => onStatusChange('Approved')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </Button>
          </div>
        )}

        {status === 'Approved' && (
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => onStatusChange('In Review')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Review
            </Button>
            <Button
              onClick={() => onStatusChange('Sent')}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send to Customer
            </Button>
          </div>
        )}

        {status === 'Sent' && (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => onStatusChange('Won')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Contract Won
            </Button>
            <Button
              onClick={() => onStatusChange('Lost')}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Contract Lost
            </Button>
            <Button
              onClick={() => onStatusChange('Hold')}
              className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              On Hold
            </Button>
          </div>
        )}

        {status === 'Won' && (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setShowContractModal(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Create Contract
            </Button>
          </div>
        )}

        {status === 'Hold' && (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => onStatusChange('Won')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Contract Won
            </Button>
            <Button
              onClick={() => onStatusChange('Lost')}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Contract Lost
            </Button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative pt-2 pb-8">
        {/* Steps */}
        <div className="relative flex justify-between">
          {/* Progress Line - Background */}
          <div className="absolute top-6 left-0 w-full h-[2px] bg-gray-200" />

          {/* Progress Line - Colored */}
          <div 
            className="absolute top-6 left-0 h-[2px] bg-indigo-600 transition-all duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, (currentStepIndex / (steps.length - 1)) * 100))}%`
            }}
          />

          {/* Step Circles */}
          {steps.map((step, index) => {
            const isActive = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const Icon = getStepIcon(step.status);
            const bgColor = getStepColor(step.status);

            return (
              <div
                key={step.key}
                className={clsx(
                  'relative flex flex-col items-center flex-1',
                  isActive ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                <div
                  className={clsx(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 z-10',
                    isActive ? bgColor : 'bg-gray-200',
                    isActive ? 'text-white' : 'text-gray-400'
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="mt-2 text-sm font-medium">{step.label}</div>
                {shouldShowDate(step, index) && step.date && (
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(step.date).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Request Modal */}
      <ReviewRequestModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        offerId={window.location.pathname.split('/')[2]}
        users={users}
      />
      
      {/* Contract Form Modal */}
      <ContractFormModal
        isOpen={showContractModal}
        onClose={() => setShowContractModal(false)}
        offerId={window.location.pathname.split('/')[2]}
        totalMRR={totalMRR}
        totalServicesRevenue={totalServicesRevenue}
      />
    </div>
  );
}

function getStepIcon(status: string) {
  switch (status) {
    case 'Draft':
      return FileText;
    case 'In Review':
      return Clock;
    case 'Approved':
      return CheckCircle;
    case 'Sent':
      return Send;
    case 'Won':
      return Check;
    case 'Hold':
      return Pause;
    default:
      return Check;
  }
}

function getStepColor(status: string) {
  switch (status) {
    case 'Draft':
      return 'bg-gray-600';
    case 'In Review':
      return 'bg-indigo-600';
    case 'Approved':
      return 'bg-emerald-600';
    case 'Sent':
      return 'bg-indigo-600';
    case 'Won':
      return 'bg-emerald-600';
    case 'Lost':
      return 'bg-red-600';
    case 'Hold':
      return 'bg-amber-600';
    default:
      return 'bg-gray-200';
  }
}