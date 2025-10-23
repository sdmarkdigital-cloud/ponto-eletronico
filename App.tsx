import React, { useState, useMemo, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import { User, Role, ThemeSettings } from './types';
import * as api from './services/api';
import { supabase, supabaseError } from './services/supabase';

// Mock Auth Context
export const AuthContext = React.createContext<{
  user: User | null;
  logout: () => void;
  login: (username: string, pass: string) => Promise<boolean>;
}>({
  user: null,
  logout: () => {},
  login: async () => false,
});

// Default settings provide a fallback if nothing is in the DB
const defaultSettings: ThemeSettings = {
    theme: 'dark',
    colors: {
      primary: '#1A1A1A',
      secondary: '#2D2D2D',
      accent: '#FFC700',
      buttons: '#FFC700',
      textBase: '#FFFFFF',
      textMuted: '#9CA3AF',
      textButton: '#1A1A1A',
    },
    loginMessage: 'Sistema de Ponto Eletrônico',
    companySettings: {
        companyName: 'Starker Goot Engenharia LTDA',
        cnpj: '12.345.678/0001-99',
        legalName: 'Starker Goot Engenharia e Serviços LTDA',
        address: 'Rua Principal, 123, São Paulo - SP',
        contactEmail: 'contato@starkergoot.com.br',
        logoUrl: null,
        workStartTime: '08:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
        workEndTime: '18:00',
    },
    sectorWorkHours: {},
};

// New Theme Context
export const ThemeContext = React.createContext<{
  themeSettings: ThemeSettings;
  setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettings>>;
}>({
  themeSettings: defaultSettings,
  setThemeSettings: () => {},
});


const App: React.FC = () => {
  // Check for initialization error before doing anything else
  if (supabaseError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary text-text-base p-4">
        <div className="w-full max-w-2xl p-8 space-y-4 bg-secondary rounded-xl shadow-lg text-center">
          <h2 className="text-3xl font-extrabold text-red-500">Erro de Configuração</h2>
          <p className="text-lg text-text-muted">A conexão com o banco de dados falhou.</p>
          <div className="text-left bg-primary p-4 rounded-md font-mono text-sm text-red-400 overflow-x-auto">
            <code>{supabaseError}</code>
          </div>
          <p className="text-text-muted">
            Por favor, siga as instruções no arquivo <strong>services/supabase.ts</strong> para configurar suas credenciais do Supabase e recarregue a página.
          </p>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(defaultSettings);
  
  useEffect(() => {
    // 1. Load initial settings on mount without trying to save.
    const loadInitialSettings = async () => {
        try {
            const savedSettings = await api.getSettings();
            if (savedSettings) {
                setThemeSettings(prev => ({
                    ...prev,
                    ...savedSettings,
                    colors: { ...prev.colors, ...savedSettings.colors },
                    companySettings: { ...prev.companySettings, ...savedSettings.companySettings }
                }));
            }
        } catch (e) {
            console.error("Could not load initial settings.", e);
        }
    };
    loadInitialSettings();

    // 2. Set up the auth listener to handle session changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        let failsafeTimer: number | undefined;

        const handleAuthSession = async () => {
            try {
                if (session?.user) {
                    console.log("🔐 Auth State Change:", event, session);
                    console.log("📧 User Email:", session?.user?.email);
                    console.log("🆔 User ID:", session?.user?.id);

                    // --- SOLUÇÃO HÍBRIDA: ADMIN LOCAL, FUNCIONÁRIO NO BANCO ---
                    // Valida administradores por uma lista local para contornar a ausência da role 'admin' no banco.
                    // Para funcionários, a verificação continua sendo feita no banco de dados.
                    const adminEmails = ['rh1@admin.com', 'rh2@admin.com', 'rh3@admin.com', 'rh4@admin.com'];
                    const isAdmin = adminEmails.includes(session.user.email ?? '');

                    if (isAdmin) {
                        // Cria um perfil de administrador manualmente, sem consultar o banco.
                        const adminProfile: User = {
                            id: session.user.id,
                            auth_id: session.user.id,
                            username: session.user.email!, // 'username' é o campo para email na UI
                            name: 'Administrador RH',
                            role: Role.ADMIN,
                            is_active: true,
                            tem_acesso: true
                        };
                        console.log("👤 Perfil de Admin criado localmente:", adminProfile);
                        setUser(adminProfile);
                    } else {
                        // Se não for admin, busca o perfil do funcionário no banco de dados.
                        console.log("👤 Buscando perfil de funcionário no banco de dados...");
                        const userProfile = await api.getUserProfile(session.user.id, session.user.email);
                        console.log("👤 Perfil de funcionário encontrado:", userProfile);
                        
                        // Garante que o usuário tem um perfil válido e permissão de acesso.
                        if (userProfile && userProfile.tem_acesso) {
                            setUser(userProfile);
                        } else {
                            const reason = userProfile ? "não tem permissão de acesso" : "não foi encontrado";
                            console.error(`Acesso negado. Perfil de funcionário ${reason} para auth_id: ${session.user.id}`);
                            alert(`Seu usuário foi autenticado, mas seu perfil ${reason}. Entre em contato com o RH.`);
                            await api.logoutUser();
                        }
                    }

                } else {
                    // Se não há sessão (logout, token expirado), limpa o usuário.
                    setUser(null);
                }
            } catch (error) {
                console.error("Erro durante a verificação da sessão:", error);
                setUser(null);
            } finally {
                if (failsafeTimer) clearTimeout(failsafeTimer);
                setLoadingSession(false);
            }
        };

        failsafeTimer = window.setTimeout(() => {
            console.error("Session loading timed out. Forcing UI to unlock.");
            if (loadingSession) {
              setLoadingSession(false);
            }
        }, 8000);

        handleAuthSession();
    });

    return () => {
        subscription.unsubscribe();
    };
  }, []);

  // Apply theme changes globally using CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (themeSettings.theme === 'light') {
      root.style.setProperty('--color-primary', '#F9FAFB'); // gray-50
      root.style.setProperty('--color-secondary', '#FFFFFF'); // white
      root.style.setProperty('--color-text-base', '#111827'); // gray-900
      root.style.setProperty('--color-text-muted', '#4B5563'); // gray-600
      root.style.setProperty('--color-text-button', '#FFFFFF');
    } else { // dark theme
      root.style.setProperty('--color-primary', themeSettings.colors.primary);
      root.style.setProperty('--color-secondary', themeSettings.colors.secondary);
      root.style.setProperty('--color-text-base', themeSettings.colors.textBase);
      root.style.setProperty('--color-text-muted', themeSettings.colors.textMuted);
      root.style.setProperty('--color-text-button', themeSettings.colors.textButton);
    }
    root.style.setProperty('--color-accent', themeSettings.colors.accent);
    root.style.setProperty('--color-buttons', themeSettings.colors.buttons);

  }, [themeSettings]);


  const authContextValue = useMemo(() => ({
    user,
    login: async (username: string, pass: string): Promise<boolean> => {
      // A função de login apenas tenta autenticar.
      // O listener onAuthStateChange é quem gerencia o estado e o perfil do usuário.
      return api.loginUser(username, pass);
    },
    logout: () => {
      api.logoutUser();
      setUser(null);
    },
  }), [user]);
  
  const themeContextValue = useMemo(() => ({
    themeSettings,
    setThemeSettings,
  }), [themeSettings]);

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary text-text-muted">
        Carregando sessão...
      </div>
    );
  }


  const renderContent = () => {
    if (!user) {
      return <LoginScreen customMessage={themeSettings.loginMessage} />;
    }
    // O redirecionamento acontece aqui, com base na role verificada no onAuthStateChange.
    if (user.role === Role.ADMIN) {
      return <AdminDashboard />;
    }
    if (user.role === Role.EMPLOYEE) {
      return <EmployeeDashboard user={user} />;
    }
    // Se o usuário tiver uma role desconhecida (embora já filtrado), volta para o login.
    return <LoginScreen customMessage={themeSettings.loginMessage}/>;
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <ThemeContext.Provider value={themeContextValue}>
        <div className="min-h-screen bg-primary">
          {renderContent()}
        </div>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
};

export default App;