'use client';

import React, { createContext, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import { supabase } from '../services/supabase';
import { Role, ThemeSettings, User } from '../typings';

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
  loginmessage: 'Sistema de Ponto Eletrônico',
  companysettings: {
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
  sectorworkhours: {},
};

export const AuthContext = createContext<{
  user: User | null;
  logout: () => void;
  login: (username: string, pass: string) => Promise<boolean>;
  loadingSession: boolean;
}>({
  user: null,
  logout: () => { },
  login: async () => false,
  loadingSession: true,
});

export const ThemeContext = createContext<{
  themeSettings: ThemeSettings;
  setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettings>>;
}>({
  themeSettings: defaultSettings,
  setThemeSettings: () => { },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  // ✅ hooks sempre fora de condicionais
  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(defaultSettings);

  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        const savedSettings = await api.getSettings();
        if (savedSettings) {
          setThemeSettings((prev) => ({
            ...prev,
            ...savedSettings,
            colors: { ...prev.colors, ...savedSettings.colors },
            companysettings: { ...prev.companysettings, ...savedSettings.companysettings },
          }));
        }
      } catch (e) {
        console.error('Could not load initial settings.', e);
      }
    };
    loadInitialSettings();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      let failsafeTimer: number | undefined;

      const handleAuthSession = async () => {
        try {
          if (session?.user) {
            const adminEmails = ['rh1@admin.com', 'rh2@admin.com', 'rh3@admin.com', 'rh4@admin.com'];
            const isAdmin = adminEmails.includes(session.user.email ?? '');

            if (isAdmin) {
              const adminProfile: User = {
                id: session.user.id,
                auth_id: session.user.id,
                username: session.user.email!,
                name: 'Administrador RH',
                role: Role.ADMIN,
                is_active: true,
                tem_acesso: true,
              };
              setUser(adminProfile);
            } else {
              const userProfile = await api.getUserProfile(session.user.id, session.user.email);
              if (userProfile && userProfile.tem_acesso) {
                setUser(userProfile);
              } else {
                const reason = userProfile ? 'não tem permissão de acesso' : 'não foi encontrado';
                alert(`Seu usuário foi autenticado, mas seu perfil ${reason}. Entre em contato com o RH.`);
                await api.logoutUser();
              }
            }
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error('Erro durante a verificação da sessão:', error);
          setUser(null);
        } finally {
          if (failsafeTimer) clearTimeout(failsafeTimer);
          setLoadingSession(false);
        }
      };

      failsafeTimer = window.setTimeout(() => {
        if (loadingSession) {
          setLoadingSession(false);
        }
      }, 8000);

      handleAuthSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = document.documentElement;
    if (themeSettings.theme === 'light') {
      root.style.setProperty('--color-primary', '#F9FAFB');
      root.style.setProperty('--color-secondary', '#FFFFFF');
      root.style.setProperty('--color-text-base', '#111827');
      root.style.setProperty('--color-text-muted', '#4B5563');
      root.style.setProperty('--color-text-button', '#FFFFFF');
    } else {
      root.style.setProperty('--color-primary', themeSettings.colors.primary);
      root.style.setProperty('--color-secondary', themeSettings.colors.secondary);
      root.style.setProperty('--color-text-base', themeSettings.colors.textBase);
      root.style.setProperty('--color-text-muted', themeSettings.colors.textMuted);
      root.style.setProperty('--color-text-button', themeSettings.colors.textButton);
    }
    root.style.setProperty('--color-accent', themeSettings.colors.accent);
    root.style.setProperty('--color-buttons', themeSettings.colors.buttons);
  }, [themeSettings]);

  const authContextValue = useMemo(
    () => ({
      user,
      loadingSession,
      login: (username: string, pass: string) => api.loginUser(username, pass),
      logout: () => {
        api.logoutUser();
        setUser(null);
      },
    }),
    [user, loadingSession]
  );

  const themeContextValue = useMemo(
    () => ({
      themeSettings,
      setThemeSettings,
    }),
    [themeSettings]
  );

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary text-text-muted">
        Carregando sessão...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <ThemeContext.Provider value={themeContextValue}>{children}</ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
