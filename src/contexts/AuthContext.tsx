import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { toast } from 'react-hot-toast';
import { retryOperation } from '../lib/supabase';

type User = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { session }, error: sessionError } = await retryOperation(() =>
        supabase.auth.getSession()
      );

      if (sessionError) {
        console.error('Session error:', sessionError);
        setUser(null);
        setLoading(false);
        toast.error('Authentication error. Please try logging in again.');
        return;
      }

      if (!session?.user?.id) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data, error } = await retryOperation(() =>
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
      );

      if (error) throw error;
      
      // If no user found
      if (!data) {
        console.error('No user found in database or not authenticated');
        setUser(null);
        return;
      }

      setUser(data);
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error('Connection error. Please check your internet connection and try again.');
      try {
        setUser(null);
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('Error signing out:', signOutError);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string, remember: boolean) {
    try {
      const { data: { session }, error } = await retryOperation(() =>
        supabase.auth.signInWithPassword({
          email,
          password,
        })
      );

      if (error) throw error;
      if (!session?.user) throw new Error('No session after login');
      
      // Get the role from the user's metadata
      const userRole = session.user.app_metadata?.role || 'user';

      // Get user data from database
      const { data: userData, error: userError } = await retryOperation(() =>
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
      );
      
      if (userError) throw userError;
      if (!userData) throw new Error('User not found in database');

      // Verify role matches between auth and database
      if (userData.role !== userRole) {
        console.warn('Role mismatch between auth and database');
      }

      // Update last login
      const { error: updateError } = await retryOperation(() =>
        supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userData.id)
      );

      if (updateError) {
        console.error('Error updating last login:', updateError);
        // Don't throw here, as login was successful
      }

      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}