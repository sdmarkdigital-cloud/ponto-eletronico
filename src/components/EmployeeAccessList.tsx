
'use client';
import { User } from '@/types';
import React, { useEffect, useState } from 'react';
import * as api from '../services/api';

const EmployeeAccessList: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingAccess, setCreatingAccess] = useState<string | null>(null);

  const loadEmployees = async () => {
    setLoading(true);
    // FIX: Use the renamed function getUsersWithoutAccess
    const employeesList = await api.getUsersWithoutAccess();
    setEmployees(employeesList);
    setLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleCreateAccess = async (employee: User) => {
    setCreatingAccess(employee.id);

    const result = await api.createAccessForEmployee(employee);

    if (result.success) {
      alert(result.message);
      // Remove da lista
      setEmployees(prev => prev.filter(emp => emp.id !== employee.id));
    } else {
      alert(`Erro ao criar acesso para ${employee.name}.\n\n${result.message}`);
    }

    setCreatingAccess(null);
  };

  if (loading) {
    return (
      <div className="bg-secondary rounded-lg p-6">
        <div className="text-center text-text-muted">Carregando funcionários...</div>
      </div>
    );
  }

  return (
    <div className="bg-secondary rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Cadastrar Acesso para Funcionários</h2>

      {employees.length === 0 ? (
        <div className="text-center p-8 text-text-muted">
          ✅ Todos os funcionários já têm acesso ao sistema.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-yellow-500 text-yellow-900 p-4 rounded-md mb-4">
            <strong>⚠️ IMPORTANTE:</strong> Por segurança, você pode criar apenas <strong>1 acesso por minuto</strong>.
            Se aparecer erro de tempo, aguarde 60 segundos e tente novamente.
          </div>
          <div className="text-text-muted mb-4">
            {employees.length} funcionário(s) sem acesso ao sistema
          </div>

          {employees.map(employee => (
            <div key={employee.id} className="flex justify-between items-center p-4 bg-primary rounded-md border border-gray-600">
              <div className="flex-1">
                <div className="font-medium text-lg">{employee.name}</div>
                <div className="text-sm text-text-muted mt-1">
                  <div>Email: {employee.username}</div>
                  <div>CPF: {employee.cpf} • Cargo: {employee.cargo} • Setor: {employee.setor}</div>
                  <div>Data de Admissão: {employee.data_admissao}</div>
                </div>
              </div>

              <button
                onClick={() => handleCreateAccess(employee)}
                disabled={creatingAccess === employee.id}
                className="bg-buttons text-text-button px-4 py-2 rounded-md font-medium hover:bg-accent disabled:opacity-50 ml-4"
              >
                {creatingAccess === employee.id ? 'Criando...' : 'Criar Acesso'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeAccessList;
