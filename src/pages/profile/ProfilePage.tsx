import React from 'react';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { FormInput } from '../../components/ui/FormInput';
import { PasswordRequirements, validatePassword } from '../../components/ui/PasswordRequirements';
import bcrypt from 'bcryptjs';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { USER_ROLES } from '../../constants/roles';

export function ProfilePage() {
  const { user } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: user?.name || '',
    email: user?.email || '',
    role: (user?.role as typeof USER_ROLES[number]) || USER_ROLES[0]
  });
  const [passwordForm, setPasswordForm] = React.useState({
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!validatePassword(passwordForm.password)) {
      toast.error('Password does not meet requirements');
      return;
    }

    setSavingPassword(true);
    try {
      // Update password in auth
      let authUpdateSuccessful = false;

      try {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUser(user.id, {
          password: passwordForm.password
        });
        if (!authError) {
          authUpdateSuccessful = true;
        } else {
          throw authError;
        }
      } catch (authError) {
        // Fallback to regular password update if admin update fails
        const { error: regularAuthError } = await supabase.auth.updateUser({
          password: passwordForm.password
        });
        if (!regularAuthError) {
          authUpdateSuccessful = true;
        } else {
          throw regularAuthError;
        }
      }

      if (!authUpdateSuccessful) {
        throw new Error('Failed to update password in authentication system');
      }

      // Update password in users table
      const { error: dbError } = await supabase
        .from('users')
        .update({
          password: await bcrypt.hash(passwordForm.password, 10)
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      toast.success('Password updated successfully');
      setPasswordForm({ password: '' });
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password. Please ensure you are logged in and try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={formData.name} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Profile Details</h2>
          
          <div className="space-y-4">
            <div>
              <FormInput
                label="Name"
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={e =>
                  setFormData(prev => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div>
              <FormInput
                label="Email"
                type="email"
                id="email"
                disabled
                value={formData.email}
              />
              <p className="mt-1 text-sm text-gray-500">
                Email cannot be changed
              </p>
            </div>

            <div>
              <FormInput
                label="Role"
                type="text"
                id="role"
                disabled
                value={formData.role}
              />
              <p className="mt-1 text-sm text-gray-500">
                Role can only be changed by an administrator
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" isLoading={saving}>
            Save Changes
          </Button>
        </div>
      </form>

      {/* Password Management Section */}
      <form onSubmit={handlePasswordUpdate} className="mt-8">
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Password Management</h2>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                required
                placeholder="Enter new password"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pr-10"
                value={passwordForm.password}
                onChange={e =>
                  setPasswordForm(prev => ({ ...prev, password: e.target.value }))
                }
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            <PasswordRequirements password={passwordForm.password} />
            <div className="flex justify-end">
              <Button type="submit" isLoading={savingPassword}>
                Update Password
              </Button>
            </div>
          </div>
        </div>
      </form>

      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Account Information
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">User ID</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.user_human_id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {user?.created_at
                ? new Date(user.created_at).toLocaleString()
                : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {user?.updated_at
                ? new Date(user.updated_at).toLocaleString()
                : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Login</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {user?.last_login
                ? new Date(user.last_login).toLocaleString()
                : 'Never'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}