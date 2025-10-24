
import { CreateEmployeeData, Justification, Payslip, Role, ServiceReport, ThemeSettings, TimeClockEntry, User } from '../typings';
import { fileToBase64 } from '../utils/fileToBase64';
import { generateUUID } from '../utils/uuid';
import { supabase } from './supabase';

// Auth and User Management
export const loginUser = async (username: string, password: string): Promise<boolean> => {
  let loginIdentifier = username;
  const cleanedUsername = username.replace(/[^\d]/g, '');
  if (cleanedUsername.length === 11) {
    loginIdentifier = `${cleanedUsername}@starkergoot.com`;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: loginIdentifier,
    password: password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('CPF/E-mail ou senha inválidos.');
    }
    throw new Error(error.message);
  }
  return true;
};

export const logoutUser = async (): Promise<void> => {
  await supabase.auth.signOut();
};

// Função para criar funcionário com acesso automático
export const createEmployeeWithAccess = async (employeeData: CreateEmployeeData): Promise<boolean> => {
  try {
    // 1. Gerar senha padrão (CPF sem pontuação)
    const defaultPassword = employeeData.cpf.replace(/\D/g, '').slice(0, 6);

    // 2. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: employeeData.email,
      password: defaultPassword,
      options: {
        data: {
          name: employeeData.name,
          role: Role.EMPLOYEE
        }
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário no auth:', authError);
      return false;
    }

    if (!authData.user) {
      console.error('Nenhum usuário retornado do auth');
      return false;
    }

    // 3. Criar perfil do funcionário na tabela users
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        auth_id: authData.user.id,
        name: employeeData.name,
        username: employeeData.email,
        role: Role.EMPLOYEE,
        is_active: true,
        tem_acesso: true,
        senha_padrao: true,
        cargo: employeeData.cargo,
        setor: employeeData.setor,
        data_admissao: employeeData.data_admissao,
        cpf: employeeData.cpf,
        telefone: employeeData.telefone,
        endereco: employeeData.endereco,
        salario_base: employeeData.salario_base,
        beneficios: employeeData.beneficios || {},
        cbo: employeeData.cbo,
        state: employeeData.state,
        city: employeeData.city,
        contract: employeeData.contract,
        custom_work_hours: employeeData.custom_work_hours || {},
        criado_em: new Date().toISOString()
      });

    if (dbError) {
      console.error('Erro ao inserir usuário no banco:', dbError);
      // Se a inserção no banco falhar, remove o usuário criado na autenticação para evitar órfãos.
      await supabase.auth.admin.deleteUser(authData.user.id);
      return false;
    }

    console.log('✅ Funcionário criado com sucesso:', {
      email: employeeData.email,
      senha_inicial: defaultPassword
    });

    return true;
  } catch (error) {
    console.error('Erro geral ao criar funcionário:', error);
    return false;
  }
};

// Função para listar todos os funcionários
export const getEmployees = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', Role.EMPLOYEE)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    return [];
  }
};

// Função para atualizar senha do funcionário
export const updateEmployeePassword = async (userId: string, newPassword: string): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) throw error;

    await supabase
      .from('users')
      .update({
        senha_padrao: false
      })
      .eq('auth_id', userId);

    return true;
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    return false;
  }
};

// FIX: Renamed from getEmployeesWithoutAccess for clarity and to fix missing export error in AccessManager.
// Buscar funcionários que ainda não têm acesso ao sistema
export const getUsersWithoutAccess = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')  // Certifique-se que está usando 'users' aqui também
      .select('*')
      .is('auth_id', null) // Que não têm auth_id (não têm acesso)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar funcionários sem acesso:', error);
    return [];
  }
};

// Criar acesso para um funcionário específico
export const createAccessForEmployee = async (employee: User): Promise<{ success: boolean, message: string }> => {
  try {
    // Verificar se o email já está em uso no Auth
    const { data: existingUser, error: checkError } = await supabase.auth.signInWithPassword({
      email: employee.username,
      password: 'tempPassword123' // Senha temporária só para verificar
    });

    // Se não deu erro de "invalid credentials", significa que o usuário JÁ EXISTE no Auth
    if (!checkError || checkError.message !== 'Invalid login credentials') {
      return {
        success: false,
        message: 'Este email já está em uso por outro usuário no sistema.'
      };
    }

    // Gerar senha padrão (CPF sem pontuação)
    const defaultPassword = employee.cpf?.replace(/\D/g, '').slice(0, 6) || '123456';

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: employee.username,
      password: defaultPassword,
      options: {
        data: {
          name: employee.name,
          role: Role.EMPLOYEE
        }
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário no auth:', authError);

      // Se for erro de tempo, sugerir esperar
      if (authError.message.includes('seconds')) {
        return {
          success: false,
          message: 'Por segurança, aguarde 1 minuto antes de criar outro acesso. Esta é uma limitação do sistema.'
        };
      }

      return {
        success: false,
        message: `Erro de autenticação: ${authError.message}`
      };
    }

    if (!authData.user) {
      return {
        success: false,
        message: 'Nenhum usuário foi criado no sistema de autenticação.'
      };
    }

    // ATUALIZAÇÃO CORRIGIDA: Usando apenas colunas que EXISTEM na tabela 'users'
    const { error: updateError } = await supabase
      .from('users')  // Usando a tabela CORRETA
      .update({
        auth_id: authData.user.id,
        tem_acesso: true,
        senha_padrao: true
        // REMOVIDO: atualizado_em - esta coluna não existe na tabela 'users'
      })
      .eq('id', employee.id);

    if (updateError) {
      console.error('Erro ao atualizar funcionário:', updateError);
      return {
        success: false,
        message: `Erro ao atualizar perfil: ${updateError.message}`
      };
    }

    console.log('✅ Acesso criado para:', employee.name, 'Senha:', defaultPassword);
    return {
      success: true,
      message: `Acesso criado com sucesso!\n\nEmail: ${employee.username}\nSenha Inicial: ${defaultPassword}`
    };
  } catch (error: any) {
    console.error('Erro completo ao criar acesso:', error);
    return {
      success: false,
      message: `Erro inesperado: ${error.message}`
    };
  }
};

// FIX: Added missing functions below

export const getSettings = async (): Promise<ThemeSettings | null> => {
  try {
    const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116: no rows found, which is ok
    return data;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return null;
  }
};

export const saveSettings = async (settings: ThemeSettings): Promise<ThemeSettings> => {
  if (!settings.id) throw new Error('O campo "id" é obrigatório para atualizar as configurações.');

  const { data, error } = await supabase
    .from('configuracoes')
    .update(settings)
    .eq('id', settings.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Erro ao atualizar configurações:', error);
    throw error;
  }

  return data;
};

export const getUserProfile = async (authId: string, email?: string | null): Promise<User | null> => {
  const { data, error } = await supabase.from('users').select('*').eq('auth_id', authId).single();
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user profile:', error);
    throw error;
  }
  return data;
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar todos os usuários:', error);
    return [];
  }
};

export const saveUser = async (user: Partial<User>): Promise<User> => {
  // If id is not provided, it's an insert, otherwise it's an update
  const { data, error } = await supabase.from('users').upsert(user).select().single();
  if (error) {
    console.error('Error saving user:', error);
    throw error;
  }
  return data;
};

export const updateUserPassword = async (authId: string, newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.admin.updateUserById(authId, { password: newPassword });
  if (error) {
    console.error("Error updating user password:", error);
    throw error;
  }
};

export const getTimeEntries = async (userId?: string): Promise<TimeClockEntry[]> => {
  let query = supabase.from('time_entries').select('*').order('timestamp', { ascending: false });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((e: { timestamp: string | number | Date; }) => ({ ...e, timestamp: new Date(e.timestamp) }));
};

export const addTimeEntry = async (entry: Omit<TimeClockEntry, 'id' | 'criado_em'>): Promise<TimeClockEntry> => {
  const { data, error } = await supabase.from('time_entries').insert(entry).select().single();
  if (error) throw error;
  return { ...data, timestamp: new Date(data.timestamp) };
};

export const getServiceReports = async (userId?: string): Promise<ServiceReport[]> => {
  let query = supabase.from('service_reports').select('*').order('timestamp', { ascending: false });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r: { timestamp: string | number | Date; }) => ({ ...r, timestamp: new Date(r.timestamp) }));
};

export const addServiceReport = async (report: Omit<ServiceReport, 'id' | 'criado_em'>): Promise<ServiceReport> => {
  const { data, error } = await supabase.from('service_reports').insert(report).select().single();
  if (error) throw error;
  return { ...data, timestamp: new Date(data.timestamp) };
};

export const getJustifications = async (userId?: string): Promise<Justification[]> => {
  let query = supabase.from('justifications').select('*').order('timestamp', { ascending: false });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data  || []).map((j: { timestamp: string | number | Date; }) => ({ ...j, timestamp: new Date(j.timestamp) }));
};

export const saveJustification = async (justification: Partial<Justification>): Promise<Justification> => {
  const { data, error } = await supabase.from('justifications').upsert(justification, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return { ...data, timestamp: new Date(data.timestamp) };
};

export const updateJustificationStatus = async (id: string, status: 'approved' | 'rejected'): Promise<Justification> => {
  const { data, error } = await supabase.from('justifications').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return { ...data, timestamp: new Date(data.timestamp) };
};

export const deleteJustification = async (id: string): Promise<void> => {
  const { error } = await supabase.from('justifications').delete().eq('id', id);
  if (error) throw error;
};

export const getPayslips = async (userId?: string): Promise<Payslip[]> => {
  let query = supabase.from('payslips').select('*').order('year', { ascending: false }).order('month', { ascending: false });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const fileConvert = await fileToBase64(file);

    const response = await fetch('/api/upload-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64: fileConvert, path })
    })

    const data = await response.json()

    if (data.publicUrl) return data.publicUrl
    throw new Error('Failed to get public URL')

  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export const addPayslip = async (payslip: Omit<Payslip, 'id' | 'file_url' | 'criado_em'>, file: File): Promise<Payslip> => {
  const filePath = `payslips/${payslip.user_id}/${payslip.year}-${payslip.month}-${generateUUID()}`;
  const fileUrl = await uploadFile(file, filePath);

  const newPayslip: Omit<Payslip, 'id' | 'criado_em'> = {
    ...payslip,
    file_url: fileUrl
  };

  const { data, error } = await supabase.from('payslips').insert(newPayslip).select().single();
  if (error) throw error;
  return data;
};

export const deleteFile = async (path: string): Promise<void> => {
  const bucket = 'documents';
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.warn('Could not delete file from storage, it might have been already removed:', error.message);
    }
  } catch (e) {
    console.warn('Exception while deleting file from storage:', e);
  }
};

export const deletePayslip = async (id: string): Promise<void> => {
  const { data: payslip, error: fetchError } = await supabase.from('payslips').select('file_url').eq('id', id).single();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

  if (payslip && payslip.file_url) {
    try {
      const url = new URL(payslip.file_url);
      const path = decodeURIComponent(url.pathname.split('/public/documents/')[1]);
      await deleteFile(path);
    } catch (e) {
      console.error("Could not parse or delete file from URL:", payslip.file_url, e);
    }
  }

  const { error } = await supabase.from('payslips').delete().eq('id', id);
  if (error) throw error;
};

export const toggleUserAccess = async (userId: string, currentAccess: boolean): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ tem_acesso: !currentAccess })
    .eq('id', userId);
  if (error) throw error;
};
