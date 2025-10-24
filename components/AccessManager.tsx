'use client';
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getUsers, getUsersWithoutAccess, toggleUserAccess } from '../services/api';

const AccessManager: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [showIds, setShowIds] = useState(false);

    useEffect(() => {
        loadUsers();
        
        // Recarrega a lista a cada 5 segundos quando na aba de acessos
        const interval = setInterval(() => {
            loadUsers();
        }, 5000);
        
        return () => clearInterval(interval);
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const allUsers = await getUsers();
            setUsers(allUsers);
        } catch (error) {
            alert('Erro ao carregar usuários');
        }
        setLoading(false);
    };

    const handleToggleAccess = async (userId: string, currentAccess: boolean) => {
        setLoading(true);
        try {
            await toggleUserAccess(userId, !currentAccess);
            alert(`Acesso ${!currentAccess ? 'ativado' : 'desativado'}!`);
            loadUsers();
        } catch (error: any) {
            alert('Erro: ' + error.message);
        }
        setLoading(false);
    };

    const showManualInstructions = (user: User) => {
        const suggestedEmail = user.cpf ? 
            user.cpf.replace(/\D/g, '') + '@starkergoot.com' : 
            user.name.toLowerCase().replace(/\s+/g, '.') + '@starkergoot.com';

        const instructions = `📋 PARA CRIAR ACESSO PARA ${user.name}:

🔑 ID DO FUNCIONÁRIO: ${user.id}

1️⃣ NO SUPABASE:
• Authentication → Users → Add User
• Email: ${suggestedEmail}
• Password: 123456
• Confirm: 123456
• Clique "Create User"
• ANOTE O UID GERADO

2️⃣ NO SQL EDITOR:
UPDATE users 
SET auth_id = 'UID_ANOTADO_AQUI', 
    username = '${suggestedEmail}',
    tem_acesso = true,
    role = 'employee'
WHERE id = '${user.id}';

3️⃣ TESTE LOGIN:
Email: ${suggestedEmail}
Senha: 123456

🎯 FUNCIONA 100%!`;
        
        alert(instructions);
    };

    return (
        <div className="p-6 bg-secondary rounded-lg">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Gerenciar Acessos</h2>
                <button
                    onClick={() => setShowIds(!showIds)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                    {showIds ? 'Ocultar IDs' : 'Mostrar IDs'}
                </button>
            </div>

            {/* Funcionários sem Acesso */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">
                    Funcionários sem Acesso ({users.filter(u => !u.tem_acesso).length})
                </h3>
                {users.filter(u => !u.tem_acesso).map(user => (
                    <div key={user.id} className="p-4 bg-primary rounded-lg mb-2 flex justify-between items-center">
                        <div>
                            <div className="font-semibold">{user.name}</div>
                            <div className="text-text-muted text-sm">
                                {user.cpf || 'Sem CPF'}
                                {showIds && (
                                    <span className="ml-4 text-accent">
                                        ID: {user.id}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => showManualInstructions(user)}
                            className="px-4 py-2 bg-buttons text-text-button rounded hover:opacity-90"
                        >
                            Criar Acesso
                        </button>
                    </div>
                ))}
            </div>

            {/* Funcionários com Acesso */}
            <div>
                <h3 className="text-lg font-semibold mb-4">
                    Funcionários com Acesso ({users.filter(u => u.tem_acesso && u.auth_id).length})
                </h3>
                {users.filter(u => u.tem_acesso && u.auth_id).map(user => (
                    <div key={user.id} className="p-4 bg-primary rounded-lg mb-2 flex justify-between items-center">
                        <div>
                            <div className="font-semibold">{user.name}</div>
                            <div className="text-text-muted text-sm">
                                {user.username}
                                {showIds && (
                                    <span className="ml-4 text-accent">
                                        ID: {user.id}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-600 text-white text-sm rounded">Ativo</span>
                            <button
                                onClick={() => handleToggleAccess(user.id, true)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                            >
                                Desativar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AccessManager;