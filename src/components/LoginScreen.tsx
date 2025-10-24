'use client';
import React, { useState, useContext } from 'react';
import { supabase } from '../services/supabase';
import { AuthContext } from '../app/providers';

interface LoginScreenProps {
  customMessage?: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ customMessage }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');

  const { login } = useContext(AuthContext);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(username, password);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      alert('Por favor, digite seu e-mail');
      return;
    }

    setLoading(true);
    setForgotPasswordMessage('');
    try {
      // O redirectTo deve apontar para a página onde o usuário irá definir a nova senha.
      // Como não temos um router, vamos redirecionar para a raiz. O Supabase irá adicionar
      // um hash na URL que o onAuthStateChange irá detectar.
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) throw error;

      setForgotPasswordMessage('Instruções para redefinir sua senha foram enviadas para seu e-mail.');
      setForgotPasswordEmail('');
    } catch (error: any) {
      setForgotPasswordMessage('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-secondary rounded-xl shadow-lg p-8 space-y-6">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-accent rounded-full flex items-center justify-center font-bold text-text-button text-4xl mb-4">
                SG
              </div>
              <h2 className="text-3xl font-extrabold text-accent">STARKER GOOT ENGENHARIA</h2>
              <p className="text-text-muted mt-1">Redefinir Senha</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="w-full p-3 bg-primary border border-gray-600 rounded-lg text-text-base"
                  placeholder="seu@email.com"
                  required
                />
              </div>

              {forgotPasswordMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  forgotPasswordMessage.includes('Erro') 
                    ? 'bg-red-800 text-red-200' 
                    : 'bg-green-800 text-green-200'
                }`}>
                  {forgotPasswordMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-buttons text-text-button font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar Instruções'}
              </button>

              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setForgotPasswordMessage(''); }}
                className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700"
              >
                Voltar para Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-secondary rounded-xl shadow-lg p-8 space-y-6">
          <div className="text-center">
             <div className="mx-auto w-20 h-20 bg-accent rounded-full flex items-center justify-center font-bold text-text-button text-4xl mb-4">
                SG
            </div>
            <h2 className="text-3xl font-extrabold text-accent">
              STARKER GOOT ENGENHARIA
            </h2>
            <p className="text-text-muted mt-1">
              {customMessage || 'Sistema de Ponto Eletrônico'}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-base mb-2">
                CPF / E-mail
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-primary border border-gray-600 rounded-lg text-text-base"
                placeholder="Digite seu CPF ou e-mail"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-base mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-primary border border-gray-600 rounded-lg text-text-base"
                placeholder="Digite sua senha"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-buttons text-text-button font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-accent hover:underline text-sm"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;