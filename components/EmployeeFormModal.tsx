import React, { useState, useEffect } from 'react';
import { User, Role, Benefits, Sector, WorkHours } from '../types';
import TimePicker from './TimePicker';

interface EmployeeFormModalProps {
  employee: User | null;
  onClose: () => void;
  onSave: (employee: User) => Promise<void>; // Make onSave return a promise to handle loading state
}

const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({ employee, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const emptyBeneficios: Benefits = {
        vt: { dailyValue: 0 },
        va: { dailyValue: 0 },
        periculosidade: { percentage: 0 },
        insalubridade: { percentage: 0 },
        salario_familia: { percentage: 0 },
        adicional_noturno: { percentage: 0 },
    };
    
    if (employee) {
      const initialBeneficios = {
          ...emptyBeneficios,
          ...employee.beneficios,
      };
      setFormData({...employee, beneficios: initialBeneficios, custom_work_hours: employee.custom_work_hours});
    } else {
      setFormData({
        name: '',
        username: '',
        cargo: '',
        setor: Sector.OPERACIONAL,
        data_admissao: '',
        cpf: '',
        telefone: '',
        endereco: '',
        salario_base: 0,
        cbo: '',
        state: '',
        city: '',
        contract: '',
        beneficios: emptyBeneficios,
        role: Role.EMPLOYEE,
        custom_work_hours: undefined, // Start with no custom hours for new employees
        tem_acesso: true, // Novos funcionários são criados com acesso ativo por padrão
      });
    }
  }, [employee]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'salario_base' ? parseFloat(value) || 0 : value }));
  };
  
  const handleBenefitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const [benefitName, benefitType] = name.split('.'); // e.g., 'vt.dailyValue'

    setFormData(prev => {
        const currentBenefits = prev.beneficios || {};
        const currentBenefit = currentBenefits[benefitName as keyof Benefits] || {};

        return {
            ...prev,
            beneficios: {
                ...currentBenefits,
                [benefitName]: {
                    ...currentBenefit,
                    [benefitType]: parseFloat(value) || 0
                }
            }
        };
    });
  };

  const handleCustomHoursChange = (name: keyof WorkHours, value: string) => {
    setFormData(prev => ({
        ...prev,
        custom_work_hours: {
            ...(prev.custom_work_hours || { workStartTime: '', lunchStartTime: '', lunchEndTime: '', workEndTime: '' }),
            [name]: value
        } as WorkHours
    }));
  };

  const toggleCustomHours = (checked: boolean) => {
    if (checked) {
        setFormData(prev => ({
            ...prev,
            custom_work_hours: {
                workStartTime: '',
                lunchStartTime: '',
                lunchEndTime: '',
                workEndTime: '',
            }
        }));
    } else {
        setFormData(prev => {
            const { custom_work_hours, ...rest } = prev;
            return rest;
        });
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
        await onSave(formData as User);
    } catch (error: any) {
        // Log detalhado do erro para depuração.
        console.error("--- FALHA CATASTRÓFICA NA SUBMISSÃO ---");
        console.error("Ocorreu um erro ao salvar o funcionário. Isso geralmente é causado por uma falha de conexão ou um erro de sessão (GoTrueClient).");
        console.error("Objeto do erro:", error);
        console.error("Mensagem do erro:", error.message || "Nenhuma mensagem de erro específica disponível.");
    } finally {
        // Garante que o estado de carregamento seja SEMPRE desligado, com sucesso ou falha.
        setIsLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const useCustomHours = formData.custom_work_hours !== undefined;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-secondary p-6 md:p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-accent mb-6">{employee ? 'Editar Funcionário' : 'Adicionar Funcionário'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            
            <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Dados Pessoais</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Nome Completo</label>
                        <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">CPF</label>
                        <input type="text" name="cpf" value={formData.cpf || ''} onChange={handleChange} placeholder="CPF do funcionário" className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">E-mail de Contato</label>
                        <input type="email" name="username" value={formData.username || ''} onChange={handleChange} placeholder="E-mail para comunicados" className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Telefone</label>
                        <input type="text" name="telefone" value={formData.telefone || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Endereço</label>
                        <input type="text" name="endereco" value={formData.endereco || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                </div>
            </fieldset>

            <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Dados Contratuais</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Cargo</label>
                        <input type="text" name="cargo" value={formData.cargo || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">CBO</label>
                        <input type="text" name="cbo" value={formData.cbo || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Setor</label>
                        <select name="setor" value={formData.setor || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                          {/* FIX: Explicitly type 'sector' as string to resolve TS error. */}
                          {Object.values(Sector).map((sector: string) => (
                            <option key={sector} value={sector}>{sector}</option>
                          ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Data de Admissão</label>
                        <input type="date" name="data_admissao" value={formData.data_admissao || ''} onChange={handleChange} max={today} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                     <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-text-muted mb-1">Salário Base (R$)</label>
                        <input type="number" step="0.01" name="salario_base" value={formData.salario_base || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Estado</label>
                        <input type="text" name="state" value={formData.state || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Cidade</label>
                        <input type="text" name="city" value={formData.city || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Contrato</label>
                        <input type="text" name="contract" value={formData.contract || ''} onChange={handleChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                    </div>
                </div>
            </fieldset>

             <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Horário de Trabalho Personalizado</legend>
                <div className="flex items-center mb-4">
                    <input
                        id="useCustomHours"
                        type="checkbox"
                        checked={useCustomHours}
                        onChange={(e) => toggleCustomHours(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-primary text-accent focus:ring-accent"
                    />
                    <label htmlFor="useCustomHours" className="ml-2 block text-sm text-text-muted">
                        Usar horário de trabalho diferente do padrão do setor.
                    </label>
                </div>
                {useCustomHours && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Entrada</label>
                            <TimePicker
                                value={formData.custom_work_hours?.workStartTime}
                                onChange={(value) => handleCustomHoursChange('workStartTime', value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Saída Almoço</label>
                            <TimePicker
                                value={formData.custom_work_hours?.lunchStartTime}
                                onChange={(value) => handleCustomHoursChange('lunchStartTime', value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Retorno Almoço</label>
                            <TimePicker
                                value={formData.custom_work_hours?.lunchEndTime}
                                onChange={(value) => handleCustomHoursChange('lunchEndTime', value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Saída Final</label>
                            <TimePicker
                                value={formData.custom_work_hours?.workEndTime}
                                onChange={(value) => handleCustomHoursChange('workEndTime', value)}
                            />
                        </div>
                    </div>
                )}
            </fieldset>

            <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Benefícios</legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">VT (diário)</label>
                        <input type="number" step="0.01" name="vt.dailyValue" value={formData.beneficios?.vt?.dailyValue || ''} onChange={handleBenefitChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                        {(formData.beneficios?.vt?.dailyValue ?? 0) > 0 && <p className="text-xs text-text-muted mt-1">Estimativa Mensal: {formatCurrency((formData.beneficios?.vt?.dailyValue || 0) * 22)}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">VA (diário)</label>
                        <input type="number" step="0.01" name="va.dailyValue" value={formData.beneficios?.va?.dailyValue || ''} onChange={handleBenefitChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                        {(formData.beneficios?.va?.dailyValue ?? 0) > 0 && <p className="text-xs text-text-muted mt-1">Estimativa Mensal: {formatCurrency((formData.beneficios?.va?.dailyValue || 0) * 22)}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Periculosidade (%)</label>
                        <input type="number" step="0.01" name="periculosidade.percentage" value={formData.beneficios?.periculosidade?.percentage || ''} onChange={handleBenefitChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                        {(formData.beneficios?.periculosidade?.percentage ?? 0) > 0 && (formData.salario_base ?? 0) > 0 && <p className="text-xs text-text-muted mt-1">Valor: {formatCurrency(((formData.salario_base || 0) * (formData.beneficios?.periculosidade?.percentage || 0)) / 100)}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Insalubridade (%)</label>
                        <input type="number" step="0.01" name="insalubridade.percentage" value={formData.beneficios?.insalubridade?.percentage || ''} onChange={handleBenefitChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                        {(formData.beneficios?.insalubridade?.percentage ?? 0) > 0 && (formData.salario_base ?? 0) > 0 && <p className="text-xs text-text-muted mt-1">Valor: {formatCurrency(((formData.salario_base || 0) * (formData.beneficios?.insalubridade?.percentage || 0)) / 100)}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Salário Família (%)</label>
                        <input type="number" step="0.01" name="salario_familia.percentage" value={formData.beneficios?.salario_familia?.percentage || ''} onChange={handleBenefitChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                        {(formData.beneficios?.salario_familia?.percentage ?? 0) > 0 && (formData.salario_base ?? 0) > 0 && <p className="text-xs text-text-muted mt-1">Valor: {formatCurrency(((formData.salario_base || 0) * (formData.beneficios?.salario_familia?.percentage || 0)) / 100)}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-muted mb-1">Adicional Noturno (%)</label>
                        <input type="number" step="0.01" name="adicional_noturno.percentage" value={formData.beneficios?.adicional_noturno?.percentage || ''} onChange={handleBenefitChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                        {(formData.beneficios?.adicional_noturno?.percentage ?? 0) > 0 && (formData.salario_base ?? 0) > 0 && <p className="text-xs text-text-muted mt-1">Valor: {formatCurrency(((formData.salario_base || 0) * (formData.beneficios?.adicional_noturno?.percentage || 0)) / 100)}</p>}
                    </div>
                </div>
            </fieldset>
          
          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition">Cancelar</button>
            <button type="submit" disabled={isLoading} className="bg-buttons text-text-button font-bold px-4 py-2 rounded-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-wait">
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormModal;