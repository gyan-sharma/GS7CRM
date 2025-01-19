import { read, utils } from 'xlsx';
import { supabase } from './supabase';

interface ImportPricing {
  pretty_name: string;
  type: string;
  size: string;
  price: number;
}

export async function parseExcelFile(file: File): Promise<ImportPricing[]> {
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
        const requiredColumns = ['pretty_name', 'type', 'size', 'price'];
        
        const missingColumns = requiredColumns.filter(
          col => !headers.includes(col)
        );
        
        if (missingColumns.length > 0) {
          throw new Error(
            `Missing required columns: ${missingColumns.join(', ')}`
          );
        }
        
        // Map column indices
        const nameIndex = headers.indexOf('pretty_name');
        const typeIndex = headers.indexOf('type');
        const sizeIndex = headers.indexOf('size');
        const priceIndex = headers.indexOf('price');
        
        // Process data rows
        const pricing: ImportPricing[] = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[nameIndex] || !row[typeIndex] || !row[sizeIndex] || !row[priceIndex]) continue;
          
          const item: ImportPricing = {
            pretty_name: String(row[nameIndex]).trim(),
            type: String(row[typeIndex]).trim(),
            size: String(row[sizeIndex]).trim(),
            price: Number(row[priceIndex])
          };
          
          pricing.push(item);
        }
        
        resolve(pricing);
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

export function validatePricing(pricing: ImportPricing[]): string[] {
  const errors: string[] = [];
  
  pricing.forEach((item, index) => {
    const rowNumber = index + 2; // +2 because of 0-based index and header row
    
    // Validate name
    if (item.pretty_name.length < 2) {
      errors.push(`Row ${rowNumber}: Name must be at least 2 characters long`);
    }
    
    // Validate price
    if (isNaN(item.price)) {
      errors.push(`Row ${rowNumber}: Price must be a number`);
    }
    
    // Validate type and size are not empty
    if (!item.type.trim()) {
      errors.push(`Row ${rowNumber}: Type is required`);
    }
    if (!item.size.trim()) {
      errors.push(`Row ${rowNumber}: Size is required`);
    }
  });
  
  return errors;
}

export async function importPricing(
  pricing: ImportPricing[],
  onProgress: (progress: number) => void
) {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  for (let i = 0; i < pricing.length; i++) {
    const item = pricing[i];
    try {
      const { error } = await supabase
        .from('license_pricing')
        .insert({
          pretty_name: item.pretty_name,
          type: item.type,
          size: item.size,
          hourly_price: item.price
        });
      
      if (error) throw error;
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push(
        `Failed to import ${item.pretty_name}: ${(error as Error).message}`
      );
    }
    
    onProgress((i + 1) / pricing.length * 100);
  }
  
  return results;
}