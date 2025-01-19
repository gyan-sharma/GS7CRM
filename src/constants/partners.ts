export const CERTIFICATION_LEVELS = ['platinum', 'gold', 'silver', 'bronze'] as const;

export const SERVICE_AREAS = [
  'Blockchain Development',
  'Smart Contract Development',
  'Front-end Development',
  'Back-end Development',
  'DevOps',
  'UI/UX Design',
  'Quality Assurance',
  'Project Management',
  'Business Analysis',
  'Technical Writing'
] as const;

export type CertificationLevel = typeof CERTIFICATION_LEVELS[number];
export type ServiceArea = typeof SERVICE_AREAS[number];