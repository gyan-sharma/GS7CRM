import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileDown, FileUp, Users as UsersIcon, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import bcrypt from 'bcryptjs';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FileUpload } from '../../components/ui/FileUpload';
import { Modal } from '../../components/ui/Modal';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { parseExcelFile, validateUsers, importUsers } from '../../lib/users_excel';
import type { Database } from '../../types/supabase';
import { USER_ROLES } from '../../constants/roles';
import * as XLSX from 'xlsx';

type User = Database['public']['Tables']['users']['Row'];

export function UserList() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<keyof User>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showProgressModal, setShowProgressModal] = React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [importErrors, setImportErrors] = React.useState<string[]>([]);
  const [importStatus, setImportStatus] = React.useState<Array<{ email: string; status: 'pending' | 'success' | 'error'; message?: string }>>([]);
  const [isImporting, setIsImporting] = React.useState(false);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) throw error;
      
      if (data) {
        const sortedData = [...data].sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          
          if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
          if (bVal === null) return sortDirection === 'asc' ? -1 : 1;
          
          return sortDirection === 'asc' 
            ? aVal > bVal ? 1 : -1
            : aVal < bVal ? 1 : -1;
        });
        
        setUsers(sortedData);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users. Please try refreshing the page.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, [sortColumn, sortDirection]);

  const handleSort = (column: keyof User) => {
    if (column === sortColumn) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleDeleteAllUsers = async () => {
    setShowDeleteModal(false);
    setIsDeleting(true);
    setShowProgressModal(true);
    setProgress(0);

    try {
      // Get all non-admin users first
      const { data: usersToDelete, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .neq('role', 'admin');

      if (fetchError) throw fetchError;
      if (!usersToDelete || usersToDelete.length === 0) {
        toast.info('No users to delete');
        return;
      }

      // Delete users from auth system
      for (let i = 0; i < usersToDelete.length; i++) {
        const user = usersToDelete[i];
        try {
          await supabaseAdmin.auth.admin.deleteUser(user.id);
        } catch (error) {
          // Log the error but continue with other deletions
          console.error(`Error deleting auth user ${user.id}:`, error);
        }
        setProgress((i + 1) / usersToDelete.length * 100);
      }

      // Delete users from the database
      const { error } = await supabase
        .from('users')
        .delete()
        .neq('role', 'admin');

      if (error) {
        console.error('Error deleting users from database:', error);
        throw new Error('Failed to delete users from database');
      }

      setProgress(100);

      toast.success('All non-admin users deleted successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting users:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete users');
    } finally {
      setIsDeleting(false);
      setShowProgressModal(false);
      setProgress(0);
    }
  };

  const handleGenerateDummyUsers = async () => {
    try {
      setIsGenerating(true);
      setShowProgressModal(true);
      setProgress(0);

      const createdUsers = [];
      const existingUsers = new Set(users.map(u => u.email));
      const rolesToCreate = USER_ROLES.filter(r => r !== 'admin');

      for (let i = 0; i < rolesToCreate.length; i++) {
        const role = rolesToCreate[i];
        const email = `${role.toLowerCase().replace(/\s+/g, '.')}@mail.com`;
        
        // Skip if user already exists
        if (existingUsers.has(email)) {
          console.log(`Skipping existing user: ${email}`);
          setProgress((i + 1) / rolesToCreate.length * 100);
          continue;
        }
        
        const password = 'password';
        
        // Create auth user first
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true
        });
        setProgress((i + 1) / rolesToCreate.length * 100);

        if (authError) throw authError;
        if (!authData?.user) throw new Error('Failed to create auth user');

        // Add user to our users table with the auth user's ID
        createdUsers.push({
          id: authData.user.id,
          name: role,
          email,
          role,
          password: await bcrypt.hash('password', 10),
          user_human_id: `USR${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        });
      }

      if (createdUsers.length === 0) {
        toast.info('No new users to create - all roles already exist');
        return;
      }

      // Batch insert all users
      const { error: usersError } = await supabase
        .from('users')
        .insert(createdUsers);

      if (usersError) { 
        // Cleanup auth users if user table insert fails
        for (const user of createdUsers) {
          await supabaseAdmin.auth.admin.deleteUser(user.id);
        }
        throw usersError;
      }

      toast.success('Dummy users generated successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Error generating dummy users:', error);
      toast.error('Failed to generate dummy users: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
      setShowProgressModal(false);
      setProgress(0);
    }
  };

  const handleExportToExcel = () => {
    const exportData = users.map(({ password, ...user }) => ({
      ...user,
      created_at: new Date(user.created_at).toLocaleString(),
      updated_at: new Date(user.updated_at).toLocaleString(),
      last_login: user.last_login
        ? new Date(user.last_login).toLocaleString()
        : 'Never'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'users.xlsx');
  };

  const handleImportFile = async (file: File) => {
    try {
      setImportErrors([]);
      setImportStatus([]);

      // Parse Excel file
      const users = await parseExcelFile(file);

      // Validate users
      const validationErrors = validateUsers(users);
      if (validationErrors.length > 0) {
        setImportErrors(validationErrors);
        return;
      }

      // Initialize status for all users
      setImportStatus(users.map(user => ({
        email: user.email,
        status: 'pending'
      })));

      // Start import
      setIsImporting(true);

      // Import users one by one
      const results = { successful: 0, failed: 0, errors: [] as string[] };

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          // Create auth user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: user.email,
            password: 'Welcome123!',
            email_confirm: true
          });

          if (authError) throw authError;
          if (!authData?.user) throw new Error('Failed to create auth user');

          // Create database user
          const { error: dbError } = await supabaseAdmin
            .from('users')
            .insert({
              id: authData.user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              password: await bcrypt.hash('Welcome123!', 10),
              user_human_id: `USR${Math.random().toString(36).substr(2, 6).toUpperCase()}`
            });

          if (dbError) throw dbError;

          results.successful++;
          setImportStatus(prev => prev.map((status, index) => 
            index === i ? { ...status, status: 'success' } : status
          ));
        } catch (error) {
          results.failed++;
          const errorMessage = (error as Error).message;
          results.errors.push(`Failed to import ${user.email}: ${errorMessage}`);
          setImportStatus(prev => prev.map((status, index) => 
            index === i ? { ...status, status: 'error', message: errorMessage } : status
          ));
        }
        setProgress((i + 1) / users.length * 100);
      }

      if (results.successful > 0) {
        toast.success(`Successfully imported ${results.successful} users`);
      }

      if (results.failed > 0) {
        setImportErrors(results.errors);
      }

      await fetchUsers();
      setShowImportModal(false);
    } catch (error) {
      console.error('Import error:', error);
      toast.error((error as Error).message);
    } finally {
      setIsImporting(false);
      setShowProgressModal(false);
      setProgress(0);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsDeleting(true);
    setShowProgressModal(true);
    setProgress(0);

    try {
      // Delete from auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) {
        console.error('Error deleting auth user:', authError);
        throw authError;
      }
      setProgress(50);

      // Then delete from our users table
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      setProgress(100);

      toast.success('User deleted successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setIsDeleting(false);
      setShowProgressModal(false);
      setProgress(0);
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(user =>
    Object.values(user).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateDummyUsers}
            variant="secondary"
            className="flex items-center gap-2"
            isLoading={isGenerating}
            disabled={isGenerating || isDeleting}
          >
            <UsersIcon className="w-4 h-4" />
            Generate Dummy Users
          </Button>
          <Button
            onClick={handleExportToExcel}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export to Excel
          </Button>
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => setShowImportModal(true)}
          >
            <FileUp className="w-4 h-4" />
            Bulk Import
          </Button>
          <Button
            variant="danger"
            className="flex items-center gap-2"
            onClick={() => setShowDeleteModal(true)}
            isLoading={isDeleting}
            disabled={isGenerating || isDeleting}
          >
            <Trash2 className="w-4 h-4" />
            Delete All Users
          </Button>
          <Link to="/users/new">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search users..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={rowsPerPage}
              onChange={e => setRowsPerPage(Number(e.target.value))}
            >
              {[10, 15, 20, 50, 100, 200].map(value => (
                <option key={value} value={value}>
                  {value} rows
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-1/3 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                  <div className="flex items-center gap-2">
                    Name
                    {sortColumn === 'name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                  <div className="flex items-center gap-2">
                    Email
                    {sortColumn === 'email' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                  <div className="flex items-center gap-2">
                    Role
                    {sortColumn === 'role' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                  <div className="flex items-center gap-2">
                    Last Login
                    {sortColumn === 'last_login' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="w-24 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size="sm" />
                      <div className="font-medium text-gray-900 truncate max-w-[200px]" title={user.name}>
                        {user.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 truncate max-w-[200px]" title={user.email}>
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 truncate max-w-[150px]" title={user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleString()
                        : 'Never'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/users/${user.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setUserToDelete(user)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No users found. Try adjusting your search or create a new user.
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {Math.min(startIndex + 1, filteredUsers.length)}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(startIndex + rowsPerPage, filteredUsers.length)}
              </span>{' '}
              of <span className="font-medium">{filteredUsers.length}</span>{' '}
              results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Delete All Users"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete all non-admin users? This will permanently remove them from both the database and authentication system.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAllUsers}
              isLoading={isDeleting}
            >
              Delete All Users
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Single User Modal */}
      <Modal
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        title="Confirm Delete User"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete the user{' '}
            <span className="font-medium">{userToDelete?.name}</span>? This will permanently remove them from both the database and authentication system.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setUserToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (userToDelete) {
                  handleDeleteUser(userToDelete.id);
                }
              }}
              isLoading={isDeleting}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Progress Modal */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => {}}
        title={isGenerating ? "Generating Users" : userToDelete ? `Deleting ${userToDelete.name}` : "Deleting Users"}
        className="sm:max-w-md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {isGenerating
              ? "Creating new users. Please wait..."
              : userToDelete
                ? "Deleting user. Please wait..."
                : "Deleting users. Please wait..."}
          </p>
          <ProgressBar progress={progress} />
          <p className="text-sm text-gray-500 text-center">
            {Math.round(progress)}% Complete
          </p>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          if (!isImporting) {
            setShowImportModal(false);
            setImportStatus([]);
            setImportErrors([]);
            setProgress(0);
          }
        }}
        title="Import Users"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Upload an Excel file with the following columns: name, email, and role.
            Users will be created with a default password: Welcome123!
          </p>

          {!isImporting && <FileUpload
            onFileSelect={handleImportFile}
            accept=".xlsx,.xls"
            className="mt-4"
          />}

          {isImporting && importStatus.length > 0 && (
            <div className="mt-4 space-y-4">
              <ProgressBar progress={progress} />
              <p className="text-sm text-gray-500 text-center">
                Importing users... {Math.round(progress)}% Complete
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {importStatus.map((status, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-md bg-gray-50"
                  >
                    <span className="text-sm text-gray-700">{status.email}</span>
                    <div className="flex items-center gap-2">
                      {status.status === 'pending' && (
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      {status.status === 'success' && (
                        <span className="text-green-600">✓</span>
                      )}
                      {status.status === 'error' && (
                        <span className="text-red-600" title={status.message}>✗</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {importErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-md">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Import Errors:
              </h4>
              <ul className="text-sm text-red-700 list-disc list-inside">
                {importErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}