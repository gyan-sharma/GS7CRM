export const USER_ROLES = [
  'CTO',
  'CGO',
  'CFO',
  'CEO',
  'Sales Rep',
  'Sales Manager',
  'Presales Engineer',
  'Project Manager',
  'Customer Success',
  'Blockchain Developer',
  'Front End Developer',
  'Back End Developer',
  'Ui-Ux Developer',
  'Quality Assurance Engineer',
  'Solution Architect',
  'Project Director',
  'Customer',
  'Subcontractor'
] as const;

export type UserRole = typeof USER_ROLES[number];