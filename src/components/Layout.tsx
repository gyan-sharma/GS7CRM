import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Users, User, LogOut, DollarSign, Briefcase, Building2, Box, Target, FileText, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from './ui/Avatar';
import { clsx } from 'clsx';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navigation = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Users', href: '/users', icon: Users, adminOnly: true },
    { name: 'Reviews', href: '/reviews', icon: FileText, adminOnly: false },
    { name: 'Offers', href: '/offers', icon: FileText, adminOnly: true },
    { name: 'Contracts', href: '/contracts', icon: Briefcase, adminOnly: true },
    { name: 'Projects', href: '/projects', icon: Box, adminOnly: true },
    { name: 'Environments', href: '/environments', icon: Layers, adminOnly: true },
    { name: 'Services', href: '/services', icon: Briefcase, adminOnly: true },
    { name: 'Opportunities', href: '/opportunities', icon: Target, adminOnly: true },
    { name: 'Partners', href: '/partners', icon: Building2, adminOnly: true },
    { name: 'Customers', href: '/customers', icon: Building2, adminOnly: true },
    { name: 'Pricing', href: '/pricing', icon: DollarSign, adminOnly: true }
  ];

  const filteredNavigation = navigation.filter(
    item => !item.adminOnly || user?.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-gray-100 flex overflow-hidden">
      {/* Sidebar */}
      <div className="fixed inset-y-0 flex w-64 flex-col">
        <div className="flex flex-grow flex-col overflow-y-auto bg-white shadow-lg">
          <div className="flex h-16 flex-shrink-0 items-center px-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-lg">
                <Box className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            </div>
          </div>
          <nav className="mt-4 flex-1 space-y-1 px-2">
            {filteredNavigation.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'group flex items-center px-2 py-2 text-base font-medium rounded-md',
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="mr-4 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex flex-col flex-1 pl-64 w-0">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="h-16 flex items-center justify-end px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={user?.name || ''} size="sm" />
                <span className="text-sm font-medium text-gray-700">
                  {user?.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4">
          <div className="px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              © {new Date().getFullYear()} Your Company. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}