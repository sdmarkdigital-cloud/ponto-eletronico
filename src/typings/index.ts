// FIX: Removed self-import of `Role` and `Sector` to resolve declaration conflicts.

export enum Role {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
}

export enum Sector {
  ADMINISTRATIVO = 'Administrativo',
  OPERACIONAL = 'Operacional',
  TECNICO = 'Técnico',
  COMERCIAL = 'Comercial',
  FINANCEIRO = 'Financeiro',
}

export enum ClockType {
  ENTRADA = 'Entrada',
  SAIDA_ALMOCO = 'Saída Almoço',
  RETORNO_ALMOCO = 'Retorno Almoço',
  SAIDA = 'Saída',
}

export enum AdminJustificationType {
    ATESTADO_MEDICO = 'Atestado Médico',
    ATESTADO_ACOMPANHAMENTO = 'Atestado de Acompanhamento',
    DECLARACAO_HORAS = 'Declaração de Horas',
    FERIAS = 'Férias',
    FOLGA = 'Folga',
    OUTROS = 'Outros',
}

export interface WorkHours {
  workStartTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  workEndTime: string;
}

export interface Benefits {
  vt?: { dailyValue: number };
  va?: { dailyValue: number };
  periculosidade?: { percentage: number };
  insalubridade?: { percentage: number };
  salario_familia?: { percentage: number };
  adicional_noturno?: { percentage: number };
}

export interface CreateEmployeeData {
  name: string;
  email: string;
  cargo: string;
  setor: Sector;
  data_admissao: string;
  cpf: string;
  telefone: string;
  endereco: string;
  salario_base: number;
  beneficios?: Benefits;
  cbo: string;
  state: string;
  city: string;
  contract: string;
  custom_work_hours?: WorkHours;
}

export interface User {
  id: string;
  name: string;
  username: string; // Contact email
  password?: string;
  role: Role;
  is_active?: boolean;
  deleted_at?: string | null;
  auth_id?: string | null;
  cargo?: string;
  setor?: Sector;
  data_admissao?: string | null;
  cpf?: string;
  telefone?: string;
  endereco?: string;
  salario_base?: number;
  beneficios?: Benefits;
  cbo?: string;
  state?: string;
  city?: string;
  contract?: string;
  custom_work_hours?: WorkHours;
  tem_acesso?: boolean;
  senha_padrao?: boolean;
  criado_em?: string;
}

export interface ThemeSettings {
  id?: string;
  theme: 'dark' | 'light';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    buttons: string;
    textBase: string;
    textMuted: string;
    textButton: string;
  };
  loginmessage: string;
  companysettings: {
    companyName: string;
    cnpj: string;
    legalName: string;
    address: string;
    contactEmail: string;
    logoUrl: string | null;
    workStartTime: string;
    lunchStartTime: string;
    lunchEndTime: string;
    workEndTime: string;
  };
  sectorworkhours: Record<string, Partial<WorkHours>>;
  criado_em?: string;
}

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
}

export interface TimeClockEntry {
  id: string;
  user_id: string;
  user_name: string;
  type: ClockType;
  timestamp: Date;
  location: LocationData | null;
  photo: string;
  criado_em?: string;
}

export interface ServiceReport {
  id: string;
  user_id: string;
  user_name: string;
  timestamp: Date;
  client: string;
  photo: string;
  signature: string;
  criado_em?: string;
}

export interface Justification {
  id?: string;
  user_id: string;
  user_name?: string;
  timestamp: Date;
  date?: string;
  start_date?: string;
  end_date?: string;
  time?: string;
  reason: string;
  details: string;
  attachment?: string;
  status: 'pending' | 'approved' | 'rejected';
  criado_em?: string;
}

export interface Payslip {
  id?: string;
  user_id: string;
  user_name: string;
  month: string;
  year: number;
  file_url: string;
  criado_em?: string;
}

export interface DailyBalance {
    date: string;
    dayOfWeek: string;
    expectedMinutes: number;
    workedMinutes: number;
    balance: number;
    observation: string;
}

export interface TimeBankReport {
    employeeName: string;
    period: string;
    totalExpected: number;
    totalWorked: number;
    totalBalance: number;
    dailyBalances: DailyBalance[];
}