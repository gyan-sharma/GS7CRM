import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FormInput } from '../../components/ui/FormInput';
import { Combobox } from '../../components/ui/Combobox';
import { Avatar } from '../../components/ui/Avatar';
import { PasswordRequirements, validatePassword } from '../../components/ui/PasswordRequirements';
import bcrypt from 'bcryptjs';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { USER_ROLES } from '../../constants/roles';
import type { Database } from '../../types/supabase';

type User = Database['public']['Tables']['users']['Row'];

export function UserForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    role: USER_ROLES[0],
    password: 'password'
  });

  const isNewUser = id === 'new';

  React.useEffect(() => {
    if (!isNewUser) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setUser(data);
      setFormData({
        name: data.name,
        email: data.email,
        role: data.role as typeof USER_ROLES[number],
        password: 'password'
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Failed to load user details');
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const hasServiceRole = Boolean(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

    try {
      let userId = user?.id;

      if (!validatePassword(formData.password)) {
        toast.error('Password does not meet requirements');
        return;
      }

      if (isNewUser) {
        let authData;
        
        if (hasServiceRole) {
          // Create auth user using admin API if service role is available
          const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: formData.email,
            password: formData.password,
            email_confirm: true
          });
          
          if (authError) throw authError;
          authData = data;
        } else {
          // Fallback to regular signup if no service role
          const { data, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              emailRedirectTo: window.location.origin
            }
          });
          
          if (authError) throw authError;
          if (!data.user) throw new Error('Failed to create auth user');
          authData = { user: data.user };
        }

        if (!authData?.user) throw new Error('Failed to create auth user');
        userId = authData.user.id;
      }

      const userData = {
        id: userId,
        ...formData,
        password: await bcrypt.hash(formData.password, 10), // Store hashed password
        user_human_id: isNewUser
          ? `USR${Math.random().toString(36).substr(2, 6).toUpperCase()}`
          : user?.user_human_id
      };

      if (isNewUser) {
        const { error } = await supabase
          .from('users')
          .insert([userData]);

        if (error) throw error;
        toast.success('User created successfully');
      } else {
        const { error } = await supabase 
          .from('users')
          .update({
            name: userData.name,
            role: userData.role,
            password: userData.password
          })
          .eq('id', id);

        if (error) throw error;
        toast.success('User updated successfully');
      }

      navigate('/users');
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(isNewUser ? 'Failed to create user: ' + (error as Error).message : 'Failed to update user: ' + (error as Error).message);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={formData.name || 'New User'} size="lg" />
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNewUser ? 'Create User' : 'Edit User'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-medium text-gray-900">User Details</h2>
          
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
                value={formData.email}
                onChange={e =>
                  setFormData(prev => ({ ...prev, email: e.target.value }))
                }
                disabled={!isNewUser}
              />
              {!isNewUser && (
                <p className="mt-1 text-sm text-gray-500">
                  Email cannot be changed after user creation
                </p>
              )}
            </div>

            <div>
              <Combobox
                label="Role"
                value={formData.role}
                onChange={role => setFormData(prev => ({ ...prev, role }))}
                options={USER_ROLES}
                placeholder="Select role..."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/users')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isNewUser ? 'Create User' : 'Update User'}
          </Button>
        </div>
      </form>

      {/* User Information Section */}
      {!isNewUser && user && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Account Information
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.user_human_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.created_at
                  ? new Date(user.created_at).toLocaleString()
                  : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.updated_at
                  ? new Date(user.updated_at).toLocaleString()
                  : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Login</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.last_login
                  ? new Date(user.last_login).toLocaleString()
                  : 'Never'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Password Section */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-medium text-gray-900">Password</h2>
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
              placeholder="Enter password"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pr-10"
              value={formData.password}
              onChange={e =>
                setFormData(prev => ({ ...prev, password: e.target.value }))
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
          <PasswordRequirements password={formData.password} />
        </div>
      </div>
    </div>
  );
}