export const INDUSTRIES = [
  'Agriculture',
  'Automotive',
  'Banking',
  'Chemicals',
  'Construction',
  'Consumer Goods',
  'Education',
  'Energy',
  'Entertainment',
  'Financial Services',
  'Food & Beverage',
  'Government',
  'Healthcare',
  'Hospitality',
  'Insurance',
  'IT & Technology',
  'Legal',
  'Logistics',
  'Manufacturing',
  'Media',
  'Mining',
  'Non-Profit',
  'Pharmaceuticals',
  'Real Estate',
  'Retail',
  'Telecommunications',
  'Transportation',
  'Utilities',
  'Others'
] as const;

export const REGIONS = ['EMEA', 'JAPAC', 'AMERICAS'] as const;

export const EMPLOYEE_RANGES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001-10000',
  '10000+'
] as const;

export type Industry = typeof INDUSTRIES[number];
export type Region = typeof REGIONS[number];
export type EmployeeRange = typeof EMPLOYEE_RANGES[number];