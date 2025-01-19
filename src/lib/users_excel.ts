import { read, utils } from 'xlsx';
import { USER_ROLES } from '../constants/roles';
import { supabaseAdmin } from './supabase';
import bcrypt from 'bcryptjs';

interface ImportUser {
  name: string;
  email: string;
  role: string;
}

export async function parseExcelFile(file: File): Promise<ImportUser[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = utils.sheet_to_json(firstSheet, { header: 1 });
        
        // Validate header row
        const headers = rows[0].map((h: string) => h.toLowerCase().trim());
        const requiredColumns = ['name', 'email', 'role'];
        
        const missingColumns = requiredColumns.filter(
          col => !headers.includes(col)
        );
        
        if (missingColumns.length > 0) {
          throw new Error(
            `Missing required columns: ${missingColumns.join(', ')}`
          );
        }
        
        // Map column indices
        const nameIndex = headers.indexOf('name');
        const emailIndex = headers.indexOf('email');
        const roleIndex = headers.indexOf('role');
        
        // Process data rows
        const users: ImportUser[] = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[nameIndex] || !row[emailIndex] || !row[roleIndex]) continue;
          
          const user: ImportUser = {
            name: String(row[nameIndex]).trim(),
            email: String(row[emailIndex]).trim().toLowerCase(),
            role: String(row[roleIndex]).trim()
          };
          
          users.push(user);
        }
        
        resolve(users);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsBinaryString(file);
  });
}

export function validateUsers(users: ImportUser[]): string[] {
  const errors: string[] = [];
  const emailSet = new Set<string>();
  
  users.forEach((user, index) => {
    const rowNumber = index + 2; // +2 because of 0-based index and header row
    
    // Validate name
    if (user.name.length < 2) {
      errors.push(`Row ${rowNumber}: Name must be at least 2 characters long`);
    }
    
    // Validate email
    if (!user.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.push(`Row ${rowNumber}: Invalid email format`);
    }
    if (emailSet.has(user.email)) {
      errors.push(`Row ${rowNumber}: Duplicate email address`);
    }
    emailSet.add(user.email);
    
    // Validate role
    if (!USER_ROLES.includes(user.role as any)) {
      errors.push(
        `Row ${rowNumber}: Invalid role. Must be one of: ${USER_ROLES.join(', ')}`
      );
    }
  });
  
  return errors;
}

export async function importUsers(users: ImportUser[], onProgress: (progress: number) => void) {
  const defaultPassword = 'Welcome123!';
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: defaultPassword,
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
          password: await bcrypt.hash('password', 10),
          user_human_id: `USR${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        });
      
      if (dbError) throw dbError;
      
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push(
        `Failed to import ${user.email}: ${(error as Error).message}`
      );
    }
    
    onProgress((i + 1) / users.length * 100);
  }
  
  return results;
}