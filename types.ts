
export type MilitaryCategory = 'praca' | 'oficial' | 'civil';

export type VacationStatus = 'Pendente' | 'Em andamento' | 'Gozado';

export interface VacationParcel {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
}

export interface Employee {
  id: string;
  userId: string;
  name: string;
  warName: string;
  nip: string;
  sector: string;
  category: MilitaryCategory;
  rank: string;
  planningYear: number;
  totalVacationDays: number;
  vacationParcels: VacationParcel[];
  photoUrl?: string;
  justification?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  isBlocked?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  action: 'Criação' | 'Alteração' | 'Exclusão' | 'Senha' | 'Bloqueio' | 'Impressão';
  field: string;
  oldValue: string;
  newValue: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  isPinned?: boolean;
}

export interface SystemSettings {
  institutionName: string;
  logoUrl?: string;
  totalManpower: number;
  notices: Notice[];
}

export const SECTORS = ['01', '02', 'Secom', '10', '20', '30', '40', '50', '60', '70', 'Outro'];

export const PRACA_RANKS = ['RC', 'MN', 'CB', '3SG', '2SG', '1SG', 'SO'];
export const OFICIAL_RANKS = ['GM', '2Ten', '1Ten', 'CT', 'CC', 'CF', 'CMG', 'CA', 'VA', 'AEsq'];
export const CIVIL_RANKS = ['SC'];
