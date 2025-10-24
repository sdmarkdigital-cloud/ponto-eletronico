'use client';
import { CreateEmployeeData, Sector } from '@/types';
import React, { useState } from 'react';
import * as api from '../services/api';

interface EmployeeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<CreateEmployeeData>({
    name: '',
    email: '',
    cargo: '',
    setor: Sector.ADMINISTRATIVO,
    data_admissao: new Date().toISOString().split('T')[0],
    cpf: '',
    telefone: '',
    endereco: '',
    salario_base: 0,
    cbo: '',
    state: '',
    city: '',
    contract: 'CLT'
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'salario_base' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const success = await api.createEmployeeWithAccess(formData);

      if (success) {
        const defaultPassword = formData.cpf.replace(/\D/g, '').slice(0, 6);
        setMessage({
          type: 'success',
          text: `Funcionário cadastrado com sucesso! Senha inicial: ${defaultPassword}`
        });

        setFormData({
          name: '',
          email: '',
          cargo: '',
          setor: Sector.ADMINISTRATIVO,
          data_admissao: new Date().toISOString().split('T')[0],
          cpf: '',
          telefone: '',
          endereco: '',
          salario_base: 0,
          cbo: '',
          state: '',
          city: '',
          contract: 'CLT'
        });

        if (onSuccess) onSuccess();
      } else {
        setMessage({
          type: 'error',
          text: 'Erro ao cadastrar funcionário. Verifique os dados e tente novamente.'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Erro inesperado ao cadastrar funcionário.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-secondary rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Cadastrar Novo Funcionário</h2>

      {message && (
        <div className={`p-4 mb-4 rounded-md ${message.type === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
          }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              CPF *
            </label>
            <input
              type="text"
              name="cpf"
              value={formData.cpf}
              onChange={handleChange}
              required
              placeholder="000.000.000-00"
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Cargo *
            </label>
            <input
              type="text"
              name="cargo"
              value={formData.cargo}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Setor *
            </label>
            <select
              name="setor"
              value={formData.setor}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            >
              {Object.values(Sector).map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Data de Admissão *
            </label>
            <input
              type="date"
              name="data_admissao"
              value={formData.data_admissao}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Salário Base *
            </label>
            <input
              type="number"
              step="0.01"
              name="salario_base"
              value={formData.salario_base}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Telefone *
            </label>
            <input
              type="text"
              name="telefone"
              value={formData.telefone}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">
            Endereço Completo *
          </label>
          <textarea
            name="endereco"
            value={formData.endereco}
            onChange={handleChange}
            required
            rows={2}
            className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Cidade *
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Estado *
            </label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              CBO *
            </label>
            <input
              type="text"
              name="cbo"
              value={formData.cbo}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md text-text-base"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-buttons text-text-button py-2 px-4 rounded-md font-medium hover:bg-accent disabled:opacity-50"
          >
            {loading ? 'Cadastrando...' : 'Cadastrar Funcionário'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default EmployeeForm;
