import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000; // 1 second

// Check if we have the required credentials
const hasCredentials = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!hasCredentials) {
  console.error('Missing Supabase credentials');
}

// Helper function to retry failed operations
export async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY,
  backoff = true
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      const nextDelay = backoff ? delay * 2 : delay;
      console.warn(`Operation failed, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, nextDelay, backoff);
    }
    throw error;
  }
}

// Helper function to check if error is a network error
function isNetworkError(error: any) {
  return error instanceof TypeError && error.message === 'Failed to fetch';
}

// Client for normal operations with persistent sessions
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'app-auth-token',
    storage: window?.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    debug: import.meta.env.DEV,
    onAuthStateChange: (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear any cached data when user signs out
        localStorage.removeItem('app-auth-token');
      }
    }
  }
});

// Admin client for operations that require elevated privileges
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      debug: import.meta.env.DEV
    }
  }
);

// Helper function to check if Supabase is connected
export async function checkSupabaseConnection() {
  if (!hasCredentials) {
    return false;
  }
  
  try {
    const { error } = await retryOperation(
      () => supabase.from('users').select('count').single(),
      3, // Fewer retries for connection check
      500, // Shorter delay
      false // No exponential backoff
    );

    if (error) throw error;
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      console.error('Network error connecting to Supabase');
    } else {
      console.error('Supabase connection error:', error);
    }
    return false;
  }
}