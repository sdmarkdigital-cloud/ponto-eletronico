import React, { useState } from 'react';
import { supabase } from '../services/supabase';

// Função auxiliar para salvar o perfil do usuário na tabela 'usuarios'.
// Esta função assume que a coluna 'id' na tabela 'usuarios' é preenchida automaticamente (ex: com uuid_generate_v4()).
const saveUserProfile = async (userData) => {
    // Esta operação pode ser restrita pelas políticas de RLS do Supabase.
    // O formulário deve ser usado em um contexto onde o administrador tem permissão para inserir na tabela 'usuarios'.
    const { error } = await supabase
        .from('usuarios')
        .insert(userData);
    if (error) throw error;
};

const RegisterEmployee = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee'); // O padrão é 'employee'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
        // Passo 1: Criar o usuário no sistema de autenticação do Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) {
          throw new Error(`Erro de autenticação: ${authError.message}`);
        }

        if (!authData.user) {
            throw new Error('Falha ao criar o usuário na autenticação do Supabase.');
        }

        // Passo 2: Criar o perfil do usuário na tabela 'usuarios'
        await saveUserProfile({
            auth_id: authData.user.id,
            name: name,
            username: email,
            role: role,
            tem_acesso: true, // Novos usuários têm acesso por padrão
        });

        setMessage('Funcionário cadastrado com sucesso!');
        // Limpa o formulário após o sucesso
        setName('');
        setEmail('');
        setPassword('');
        setRole('employee');

    } catch (err) {
        setError(err.message || 'Ocorreu um erro desconhecido.');
        // Em uma aplicação real, seria ideal deletar o usuário de autenticação se o salvamento do perfil falhar.
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-secondary rounded-lg max-w-lg mx-auto my-8">
      <h2 className="text-2xl font-bold text-accent mb-6">Cadastrar Novo Funcionário</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-text-muted">Nome Completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-primary border-gray-700 rounded-md p-2 text-text-base focus:ring-accent focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-text-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-primary border-gray-700 rounded-md p-2 text-text-base focus:ring-accent focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-text-muted">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
            className="w-full bg-primary border-gray-700 rounded-md p-2 text-text-base focus:ring-accent focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-text-muted">Tipo de Acesso</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="w-full bg-primary border-gray-700 rounded-md p-2 text-text-base focus:ring-accent focus:border-accent"
          >
            <option value="employee">Funcionário</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        
        {message && <p className="text-green-400 text-center p-2 bg-green-900 rounded-md">{message}</p>}
        {error && <p className="text-red-400 text-center p-2 bg-red-900 rounded-md">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-buttons text-text-button font-bold py-3 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Cadastrando...' : 'Cadastrar Funcionário'}
        </button>
      </form>
    </div>
  );
};

export default RegisterEmployee;
