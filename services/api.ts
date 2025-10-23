import { supabase } from './supabase';
import { User, TimeClockEntry, ServiceReport, Justification, Payslip, ThemeSettings, Role, CreateEmployeeData } from '../types';
import { generateUUID } from '../utils/uuid';

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

// Buscar funcionários que ainda não têm acesso ao sistema
export const getEmployeesWithoutAccess = async (): Promise<User[]> => {
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
export const createAccessForEmployee = async (employee: User): Promise<{success: boolean, message: string}> => {
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
      message: `Acesso criado com sucesso!\n\nEmail: ${employee.username}\nSenha inicial: ${defaultPassword}\n\nComunique estas credenciais ao funcionário.`
    };
  } catch (error) {
    console.error('Erro geral ao criar acesso:', error);
    return {
      success: false,
      message: 'Erro inesperado. Tente novamente em alguns instantes.'
    };
  }
};


export const getUserProfile = async (authId: string, userEmail?: string): Promise<User | null> => {
  try {
    if (userEmail) {
      const { data: emailData, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('username', userEmail)
        .single();
      
      if (emailData && !emailError) {
        return emailData;
      }
    }
    
    const { data: authData, error: authError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();
    
    if (authError) return null;
    return authData;
  } catch (error: any) {
    return null;
  }
};

export const getUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const saveUser = async (userData: Partial<User>): Promise<User> => {
    const dataToSave = { ...userData };
    
    // Remove campos undefined
    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof User] === undefined) {
            delete dataToSave[key as keyof User];
        }
    });

    if (dataToSave.id) {
        const { id, ...updateData } = dataToSave;
        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        if (!dataToSave.id) dataToSave.id = generateUUID();
        const { data, error } = await supabase
            .from('users')
            .insert(dataToSave)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

export const deleteUser = async (userId: string): Promise<void> => {
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

    if (error) {
        console.error("Error deleting user:", error.message || JSON.stringify(error));
        throw error;
    }
};

export const updateUserPassword = async (authId: string, newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
};

// Gerenciamento de Acessos
export const getUsersWithoutAccess = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tem_acesso', false)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const createUserAccess = async (userId: string, email: string, password: string): Promise<void> => {
    try {
        console.log('🔄 Tentando criar usuário no Auth:', email);
        
        // Tenta criar o usuário com confirmação de email
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (authError) {
            console.error('❌ Erro ao criar usuário:', authError);
            
            // Se o usuário já existe, tenta fazer login
            if (authError.message.includes('already registered')) {
                console.log('⚠️ Usuário já existe, tentando login...');
                
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });
                
                if (signInError) {
                    console.error('❌ Erro no login:', signInError);
                    throw new Error(`Usuário já existe mas a senha está incorreta. Use a opção "Esqueci minha senha" ou crie com outro email.`);
                }
                
                // Se login funcionou, atualiza o auth_id
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ 
                        auth_id: signInData.user.id,
                        tem_acesso: true,
                        username: email,
                        role: 'employee'
                    })
                    .eq('id', userId);
                    
                if (updateError) throw updateError;
                
                console.log('✅ Usuário existente vinculado com sucesso!');
                return;
            }
            
            throw authError;
        }

        // Se criou novo usuário com sucesso
        if (authData.user) {
            console.log('✅ Novo usuário criado no Auth:', authData.user.id);
            
            const { error: updateError } = await supabase
                .from('users')
                .update({ 
                    auth_id: authData.user.id,
                    tem_acesso: true,
                    username: email,
                    role: 'employee'
                })
                .eq('id', userId);

            if (updateError) throw updateError;
            
            console.log('✅ Usuário atualizado na tabela users');
        }
        
        // Verifica se precisa de confirmação de email
        if (authData.session === null) {
            console.log('📧 Email de confirmação enviado para:', email);
            alert(`✅ Acesso criado com sucesso!\n\nFoi enviado um email de confirmação para: ${email}\n\nO funcionário deve confirmar o email antes de fazer o primeiro login.`);
        } else {
            console.log('✅ Usuário criado e logado automaticamente');
            alert(`✅ Acesso criado com sucesso!\n\nEmail: ${email}\nSenha: ${password}\n\nO funcionário já pode fazer login.`);
        }
        
    } catch (error: any) {
        console.error('💥 Erro completo ao criar acesso:', error);
        throw error;
    }
};


// Ativar/desativar acesso
export const toggleUserAccess = async (userId: string, hasAccess: boolean): Promise<void> => {
    const { error } = await supabase
        .from('users')
        .update({ tem_acesso: hasAccess })
        .eq('id', userId);

    if (error) throw error;
};

// Criar usuário sem autenticação (alternativa)
export const createUserWithoutAuth = async (userId: string, email: string): Promise<void> => {
    // Apenas atualiza o usuário existente com email e acesso
    const { error } = await supabase
        .from('users')
        .update({ 
            username: email,
            tem_acesso: true
        })
        .eq('id', userId);

    if (error) throw error;
};


// Settings
export const getSettings = async (): Promise<ThemeSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();
    if (error) return null;
    return data as ThemeSettings;
  } catch (error) {
    return null;
  }
};

export const saveSettings = async (settings: ThemeSettings): Promise<void> => {
    const { id, ...settingsData } = settings;
    const recordId = id || generateUUID();
    const { error } = await supabase
        .from('settings')
        .upsert({ id: recordId, ...settingsData });
    if (error) throw error;
};

// File Management
export const uploadFile = async (file: File, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from('documents').upload(path, file, {
        cacheControl: '3600', upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
    if (!publicUrl) throw new Error("Could not get public URL for uploaded file.");
    return publicUrl;
};

export const deleteFile = async (path: string): Promise<void> => {
    await supabase.storage.from('documents').remove([path]);
};

// Time Clock
export const getTimeEntries = async (userId?: string): Promise<TimeClockEntry[]> => {
    let query = supabase.from('time_entries').select('*').order('timestamp', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(entry => ({...entry, timestamp: new Date(entry.timestamp)}));
};

export const addTimeEntry = async (entry: Omit<TimeClockEntry, 'id'>): Promise<TimeClockEntry> => {
    const entryForDb = { ...entry, timestamp: entry.timestamp.toISOString() };
    const { data, error } = await supabase.from('time_entries').insert(entryForDb).select().single();
    if (error) throw error;
    return { ...data, timestamp: new Date(data.timestamp) };
};

// Service Reports
export const getServiceReports = async (userId?: string): Promise<ServiceReport[]> => {
    let query = supabase.from('service_reports').select('*').order('timestamp', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(report => ({ ...report, timestamp: new Date(report.timestamp) }));
};

export const addServiceReport = async (report: Omit<ServiceReport, 'id'>): Promise<ServiceReport> => {
    const reportForDb = { ...report, timestamp: report.timestamp.toISOString() };
    const { data, error } = await supabase.from('service_reports').insert(reportForDb).select().single();
    if (error) throw error;
    return { ...data, timestamp: new Date(data.timestamp) };
};

// Justifications
export const getJustifications = async (userId?: string): Promise<Justification[]> => {
    let query = supabase.from('justifications').select('*').order('timestamp', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(j => ({ ...j, timestamp: new Date(j.timestamp) }));
};

export const saveJustification = async (justification: Partial<Justification>): Promise<Justification> => {
    if (justification.id) {
        const { id, ...updateData } = justification;
        const { data, error } = await supabase
            .from('justifications')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return { ...data, timestamp: new Date(data.timestamp) };
    } else {
        const { data, error } = await supabase.from('justifications').insert(justification).select().single();
        if (error) throw error;
        return { ...data, timestamp: new Date(data.timestamp) };
    }
};

export const updateJustificationStatus = async (justificationId: string, status: 'approved' | 'rejected'): Promise<void> => {
    const { error } = await supabase.from('justifications').update({ status }).eq('id', justificationId);
    if (error) throw error;
};

export const deleteJustification = async (justificationId: string): Promise<void> => {
    const { error } = await supabase.from('justifications').delete().eq('id', justificationId);
    if (error) throw error;
};

// Payslips
export const getPayslips = async (userId?: string): Promise<Payslip[]> => {
    let query = supabase.from('payslips').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const addPayslip = async (payslip: Omit<Payslip, 'id' | 'file_url'>, file: File): Promise<void> => {
    const filePath = `payslips/${payslip.user_id}/${payslip.year}-${payslip.month.replace(/\s+/g, '_')}-${file.name}`;
    const fileUrl = await uploadFile(file, filePath);
    const payslipForDb = { ...payslip, file_url: fileUrl };
    const { error } = await supabase.from('payslips').insert(payslipForDb);
    if (error) {
        await deleteFile(filePath);
        throw error;
    }
};

export const deletePayslip = async (payslipId: string): Promise<void> => {
    const { data: payslip, error: fetchError } = await supabase
        .from('payslips')
        .select('file_url')
        .eq('id', payslipId)
        .single();
    if (payslip?.file_url) {
        try {
            const path = new URL(payslip.file_url).pathname.split('/documents/')[1];
            await deleteFile(path);
        } catch(e: any) {}
    }
    const { error: deleteError } = await supabase.from('payslips').delete().eq('id', payslipId);
    if (deleteError) throw deleteError;
};

// Adicione esta função temporária para ver as colunas
export const checkUsersTableColumns = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (data && data.length > 0) {
      console.log('Colunas disponíveis na tabela users:', Object.keys(data[0]));
    }
  } catch (error) {
    console.error('Erro ao verificar colunas:', error);
  }
};

// Redefinir senha de um usuário (apenas admin)
export const resetUserPassword = async (userId: string, newPassword: string): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return false;
  }
};