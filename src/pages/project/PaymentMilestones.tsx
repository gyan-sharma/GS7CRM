import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, AlertTriangle, FileText, CreditCard } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { Combobox } from '../../components/ui/Combobox';
import { Modal } from '../../components/ui/Modal';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';

interface PaymentMilestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  invoice_number: string | null;
}

const MILESTONE_STATUSES = ['Pending', 'Invoiced', 'Paid'] as const;

export function PaymentMilestones() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [milestones, setMilestones] = React.useState<PaymentMilestone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = React.useState<PaymentMilestone | null>(null);
  const [showStatusModal, setShowStatusModal] = React.useState(false);
  const [selectedMilestone, setSelectedMilestone] = React.useState<PaymentMilestone | null>(null);
  const [statusFormData, setStatusFormData] = React.useState({
    status: '',
    payment_date: '',
    invoice_number: ''
  });
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    amount: '',
    due_date: '',
    status: MILESTONE_STATUSES[0],
    payment_date: '',
    invoice_number: ''
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetchMilestones();
  }, [projectId]);

  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date');

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error('Error fetching milestones:', error);
      toast.error('Failed to load payment milestones');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('payment_milestones')
        .insert({
          project_id: projectId,
          ...formData,
          amount: parseFloat(formData.amount),
          payment_date: formData.status === 'Paid' ? formData.payment_date : null
        });

      if (error) throw error;

      toast.success('Payment milestone added successfully');
      setShowAddModal(false);
      setFormData({
        title: '',
        description: '',
        amount: '',
        due_date: '',
        status: MILESTONE_STATUSES[0],
        payment_date: '',
        invoice_number: ''
      });
      await fetchMilestones();
    } catch (error) {
      console.error('Error adding payment milestone:', error);
      toast.error('Failed to add payment milestone');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!milestoneToDelete) return;

    try {
      const { error } = await supabase
        .from('payment_milestones')
        .delete()
        .eq('id', milestoneToDelete.id);

      if (error) throw error;

      toast.success('Payment milestone deleted successfully');
      setMilestoneToDelete(null);
      await fetchMilestones();
    } catch (error) {
      console.error('Error deleting payment milestone:', error);
      toast.error('Failed to delete payment milestone');
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestone) return;
    if (!user) {
      toast.error('You must be logged in to update milestone status');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('payment_milestones')
        .update({
          status: statusFormData.status,
          updated_by: user.id,
          payment_date: statusFormData.status === 'Paid' ? statusFormData.payment_date : null,
          invoice_number: statusFormData.status === 'Invoiced' || statusFormData.status === 'Paid' 
            ? statusFormData.invoice_number 
            : null
        })
        .eq('id', selectedMilestone.id);

      if (error) throw error;

      toast.success('Payment status updated successfully');
      setShowStatusModal(false);
      setSelectedMilestone(null);
      setStatusFormData({
        status: '',
        payment_date: '',
        invoice_number: ''
      });
      await fetchMilestones();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('Failed to update payment status');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-gray-100 text-gray-800';
      case 'Invoiced':
        return 'bg-yellow-100 text-yellow-800';
      case 'Paid':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Payment Milestones</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate(`/projects/${projectId}/details`)}
            variant="secondary"
          >
            Back to Project
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </Button>
        </div>
      </div>

      {/* Milestones List */}
      <div className="bg-white shadow rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Details
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {milestones.map(milestone => (
                <tr key={milestone.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {milestone.title}
                    </div>
                    {milestone.description && (
                      <div className="text-sm text-gray-500">{milestone.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      €{milestone.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      getStatusColor(milestone.status)
                    )}>
                      {milestone.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(milestone.due_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {milestone.status === 'Paid' ? (
                      <div>
                        <div className="text-sm text-gray-900">
                          Paid on: {new Date(milestone.payment_date!).toLocaleDateString()}
                        </div>
                        {milestone.invoice_number && (
                          <div className="text-sm text-gray-500">
                            Invoice: {milestone.invoice_number}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                     <select
                       className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                       value={milestone.status}
                       onChange={async (e) => {
                         setSelectedMilestone(milestone);
                         setStatusFormData({
                           status: e.target.value,
                           payment_date: e.target.value === 'Paid' ? new Date().toISOString().split('T')[0] : '',
                           invoice_number: milestone.invoice_number || ''
                         });
                         setShowStatusModal(true);
                       }}
                     >
                       {MILESTONE_STATUSES.map(status => (
                         <option key={status} value={status}>{status}</option>
                       ))}
                     </select>
                      <button
                        onClick={() => {
                          setSelectedMilestone(milestone);
                          setStatusFormData({
                            status: milestone.status,
                            payment_date: milestone.payment_date || '',
                            invoice_number: milestone.invoice_number || ''
                          });
                          setShowStatusModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {milestone.status === 'Pending' ? (
                          <FileText className="w-4 h-4" title="Raise Invoice" />
                        ) : milestone.status === 'Invoiced' ? (
                          <CreditCard className="w-4 h-4" title="Mark as Paid" />
                        ) : null}
                      </button>
                    <button
                      onClick={() => setMilestoneToDelete(milestone)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
              {milestones.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No payment milestones created yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Milestone Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Payment Milestone"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Title"
            type="text"
            required
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />

          <RichTextEditor
            label="Description"
            value={formData.description}
            onChange={value => setFormData(prev => ({ ...prev, description: value }))}
            placeholder="Enter milestone description..."
          />

          <FormInput
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={formData.amount}
            onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
          />

          <FormInput
            label="Due Date"
            type="date"
            required
            value={formData.due_date}
            onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
          />

          <Combobox
            label="Status"
            value={formData.status}
            onChange={status => setFormData(prev => ({ ...prev, status }))}
            options={MILESTONE_STATUSES}
            placeholder="Select status..."
          />

          {formData.status === 'Paid' && (
            <>
              <FormInput
                label="Payment Date"
                type="date"
                required
                value={formData.payment_date}
                onChange={e => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
              />

              <FormInput
                label="Invoice Number"
                type="text"
                value={formData.invoice_number}
                onChange={e => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
              />
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Add Milestone
            </Button>
          </div>
        </form>
      </Modal>

      {/* Status Change Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedMilestone(null);
          setStatusFormData({
            status: '',
            payment_date: '',
            invoice_number: ''
          });
        }}
        title="Update Payment Status"
      >
        <form onSubmit={handleStatusChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Current Status
            </label>
            <p className="mt-1">
              <span className={clsx(
                'px-2 py-1 text-xs font-medium rounded-full',
                getStatusColor(selectedMilestone?.status || '')
              )}>
                {selectedMilestone?.status}
              </span>
            </p>
          </div>

          <Combobox
            label="New Status"
            value={statusFormData.status}
            onChange={status => setStatusFormData(prev => ({ ...prev, status }))}
            options={MILESTONE_STATUSES.filter(s => s !== selectedMilestone?.status)}
            placeholder="Select new status..."
          />

          {statusFormData.status === 'Invoiced' && (
            <FormInput
              label="Invoice Number"
              type="text"
              required
              value={statusFormData.invoice_number}
              onChange={e => setStatusFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
            />
          )}

          {statusFormData.status === 'Paid' && (
            <>
              <FormInput
                label="Invoice Number"
                type="text"
                required
                value={statusFormData.invoice_number}
                onChange={e => setStatusFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
              />
              <FormInput
                label="Payment Date"
                type="date"
                required
                value={statusFormData.payment_date}
                onChange={e => setStatusFormData(prev => ({ ...prev, payment_date: e.target.value }))}
              />
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowStatusModal(false);
                setSelectedMilestone(null);
                setStatusFormData({
                  status: '',
                  payment_date: '',
                  invoice_number: ''
                });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Update Status
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(milestoneToDelete)}
        onClose={() => setMilestoneToDelete(null)}
        title="Confirm Delete Milestone"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the milestone{' '}
            <span className="font-medium">{milestoneToDelete?.title}</span>?
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setMilestoneToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}