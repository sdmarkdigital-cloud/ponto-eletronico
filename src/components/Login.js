import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        throw error;
      }
      
      // O App.tsx irá lidar com o redirecionamento através do onAuthStateChange.
      setMessage('Login bem-sucedido! Redirecionando...');

    } catch (err) {
      setError(err.message || 'Falha no login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-secondary rounded-lg max-w-md mx-auto my-8">
      <h2 className="text-2xl font-bold text-accent mb-6 text-center">Login do Funcionário</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-text-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-primary border-gray-700 rounded-md p-2 text-text-base focus:ring-accent focus:border-accent"
            placeholder="seu@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-text-muted">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-primary border-gray-700 rounded-md p-2 text-text-base focus:ring-accent focus:border-accent"
            placeholder="Sua senha"
          />
        </div>
        
        {message && <p className="text-green-400 text-center">{message}</p>}
        {error && <p className="text-red-400 text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-buttons text-text-button font-bold py-3 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

export default Login;
