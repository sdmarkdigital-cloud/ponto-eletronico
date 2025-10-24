
'use client';
import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '../../../services/api';
import { supabase } from '../../../services/supabase';
import { User, TimeClockEntry, ServiceReport, Justification, Payslip, Sector, AdminJustificationType, ClockType, WorkHours, Benefits, DailyBalance, TimeBankReport, Role } from '../../../typings';
import { UserGroupIcon, DocumentReportIcon, ClockIcon, TrashIcon, PencilIcon, CameraIcon, LocationMarkerIcon, UploadIcon, DownloadIcon, CalculatorIcon, PdfIcon, CogIcon, KeyIcon } from '../../../components/icons';
import EmployeeFormModal from '../../../components/EmployeeFormModal';
import { AuthContext, ThemeContext } from '../../providers';
import TimePicker from '../../../components/TimePicker';
import EmployeeAccessList from './components/AccessManagement';

// Declare global variables from CDN scripts for TypeScript
declare const jspdf: any;

interface PayrollResult {
  employeeName: string;
  monthYear: string;
  baseSalary: number;
  businessDays: number;
  workedDays: number;
  workedHours: number;
  absentDays: number;
  justifiedDays: number;
  earnings: { description: string; value: number }[];
  deductions: { description: string; value: number }[];
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerCharges: { description: string; value: number }[];
}

// Helper function outside the component
const getSundaysInMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let sundays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        if (currentDate.getDay() === 0) { // Sunday
            sundays++;
        }
    }
    return sundays;
};


const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState('employees');
    const [users, setUsers] = useState<User[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
    const [nameFilter, setNameFilter] = useState('');
    const [sectorFilter, setSectorFilter] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [contractFilter, setContractFilter] = useState('');

    const { themeSettings, setThemeSettings } = useContext(ThemeContext);

    const [currentJustifications, setCurrentJustifications] = useState<Justification[]>([]);
    const [currentTimeEntries, setCurrentTimeEntries] = useState<TimeClockEntry[]>([]);
    const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
    const [currentPayslips, setCurrentPayslips] = useState<Payslip[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isCleaning, setIsCleaning] = useState(false);

    // State for the payslip form
    const [payslipEmployeeId, setPayslipEmployeeId] = useState<string>('');
    const [payslipMonth, setPayslipMonth] = useState<string>('');
    const [payslipYear, setPayslipYear] = useState<number>(new Date().getFullYear());
    const [payslipFile, setPayslipFile] = useState<File | null>(null);
    const [isSubmittingPayslip, setIsSubmittingPayslip] = useState(false);
    
    // State for the admin justification form
    const [editingJustification, setEditingJustification] = useState<Justification | null>(null);
    const [justificationEmployeeId, setJustificationEmployeeId] = useState<string>('');
    const [justificationStartDate, setJustificationStartDate] = useState<string>('');
    const [justificationEndDate, setJustificationEndDate] = useState<string>('');
    const [justificationTime, setJustificationTime] = useState<string>('');
    const [justificationType, setJustificationType] = useState<string>(AdminJustificationType.ATESTADO_MEDICO);
    const [justificationDetails, setJustificationDetails] = useState<string>('');
    const [justificationFile, setJustificationFile] = useState<File | null>(null);
    const [isSubmittingJustification, setIsSubmittingJustification] = useState(false);
    const justificationFileRef = useRef<HTMLInputElement>(null);
    
    // State for reports download
    const [reportType, setReportType] = useState('timeclock');
    const [reportEmployeeId, setReportEmployeeId] = useState('');
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
    const [reportSectorFilter, setReportSectorFilter] = useState('');
    
    // State for Payroll Closing
    const [payrollEmployeeId, setPayrollEmployeeId] = useState<string>('');
    const [payrollSectorFilter, setPayrollSectorFilter] = useState<string>('');
    const [payrollContractFilter, setPayrollContractFilter] = useState<string>('');
    const [payrollMonth, setPayrollMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [payrollResult, setPayrollResult] = useState<PayrollResult[] | null>(null);
    const [employeesForPayrollInput, setEmployeesForPayrollInput] = useState<User[] | null>(null);
    const [convenioValues, setConvenioValues] = useState<Record<string, string>>({});

    // State for Settings Tab
    const [adminUser, setAdminUser] = useState<User | null>(null);
    const [adminCredentials, setAdminCredentials] = useState({
        username: '',
        password: '',
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const logoFileInputRef = useRef<HTMLInputElement>(null);
    
    // State for Time Bank
    const [timeBankEmployeeId, setTimeBankEmployeeId] = useState<string>('');
    const [timeBankMonth, setTimeBankMonth] = useState(new Date().toISOString().slice(0, 7));
    const [timeBankReport, setTimeBankReport] = useState<TimeBankReport | null>(null);
    const [isGeneratingTimeBank, setIsGeneratingTimeBank] = useState(false);
    
    // State for Manage Access tab
    const [loadingButtonId, setLoadingButtonId] = useState<string | null>(null);

    // State for the custom confirmation modal
    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void> | void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    const fetchData = async () => {
        setLoading(true);
        setFetchError(null);
        console.log('🔄 Iniciando carregamento de todos os dados...');
        try {
            const [usersData, justificationsData, timeEntriesData, serviceReportsData, payslipsData] = await Promise.all([
                api.getUsers(),
                api.getJustifications(),
                api.getTimeEntries(),
                api.getServiceReports(),
                api.getPayslips(),
            ]);
            setUsers(usersData);
            console.log('✅ Funcionários carregados:', usersData?.length);
            console.log('📊 Com acesso:', usersData?.filter(f => f.tem_acesso).length);
            console.log('📊 Sem acesso:', usersData?.filter(f => !f.tem_acesso).length);

            const currentAdmin = usersData.find(u => u.role === 'admin');
            if (currentAdmin) {
                setAdminUser(currentAdmin);
                setAdminCredentials(prev => ({ ...prev, username: currentAdmin.username }));
            }
            setCurrentJustifications(justificationsData);
            setCurrentTimeEntries(timeEntriesData);
            setServiceReports(serviceReportsData);
            setCurrentPayslips(payslipsData);
        } catch (error) {
            const message = error instanceof Error ? error.message : JSON.stringify(error);
            console.warn("Erro ao carregar dados, mas continuando...", message);
            setFetchError("Alguns dados podem não ter sido carregados devido a configurações de segurança (RLS). Funcionalidades podem ser limitadas até que o RLS seja ajustado.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (editingJustification) {
            setJustificationEmployeeId(String(editingJustification.user_id));
            setJustificationStartDate(editingJustification.start_date?.split('T')[0] || '');
            setJustificationEndDate(editingJustification.end_date?.split('T')[0] || '');
            setJustificationTime(editingJustification.time || '');
            setJustificationType(editingJustification.reason || AdminJustificationType.ATESTADO_MEDICO);
            setJustificationDetails(editingJustification.details || '');
            setJustificationFile(null);
            if (justificationFileRef.current) {
                justificationFileRef.current.value = '';
            }
        } else {
             setJustificationEmployeeId('');
             setJustificationStartDate('');
             setJustificationEndDate('');
             setJustificationTime('');
             setJustificationType(AdminJustificationType.ATESTADO_MEDICO);
             setJustificationDetails('');
             setJustificationFile(null);
             if (justificationFileRef.current) {
                justificationFileRef.current.value = '';
            }
        }
    }, [editingJustification]);


    const handleAddEmployee = () => {
        setSelectedEmployee(null);
        setIsModalOpen(true);
    };

    const handleEditEmployee = (employee: User) => {
        setSelectedEmployee(employee);
        setIsModalOpen(true);
    };

    const excluirFuncionarioPermanentemente = async (funcionario: User) => {
        setLoadingButtonId(funcionario.id);
        try {
          console.log('🗑️ Iniciando exclusão permanente de:', funcionario.name);
    
          const tablesToDeleteFrom = ['time_entries', 'service_reports', 'justifications', 'payslips'];
          for (const table of tablesToDeleteFrom) {
              const { error } = await supabase.from(table).delete().eq('user_id', funcionario.id);
              if (error) {
                  console.warn(`Aviso: Não foi possível excluir registros da tabela ${table}:`, error.message);
              }
          }
          
          const { error: deleteUserError } = await supabase
            .from('users')
            .delete()
            .eq('id', funcionario.id);
    
          if (deleteUserError) {
            console.error('Erro ao excluir funcionário:', deleteUserError);
            throw deleteUserError;
          }
    
          console.log('✅ Exclusão permanente concluída');
    
          setTimeout(async () => {
            await fetchData();
          }, 500);
    
          alert('✅ Funcionário excluído PERMANENTEMENTE do sistema!');
    
        } catch (error: any) {
          console.error('Erro na exclusão permanente:', error);
          alert('❌ Erro ao excluir funcionário: ' + error.message);
        } finally {
          setLoadingButtonId(null);
        }
      };
    
    const limparFuncionariosInativos = async () => {
        setIsCleaning(true);
        try {
          const { data: funcionariosInativos, error } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'employee')
            .or('tem_acesso.is.null,tem_acesso.eq.false');
    
          if (error) throw error;
    
          if (!funcionariosInativos || funcionariosInativos.length === 0) {
            alert('✅ Não há funcionários inativos para excluir.');
            return;
          }
    
          let excluidos = 0;
          let erros = 0;
          const tablesToDeleteFrom = ['time_entries', 'service_reports', 'justifications', 'payslips'];
          
          for (const funcionario of funcionariosInativos) {
            try {
              for (const table of tablesToDeleteFrom) {
                await supabase.from(table).delete().eq('user_id', funcionario.id);
              }
    
              await supabase.from('users').delete().eq('id', funcionario.id);
    
              excluidos++;
            } catch (err: any) {
              console.error(`Erro ao excluir ${funcionario.name}:`, err);
              erros++;
            }
          }
    
          alert(`🧹 LIMPEZA CONCLUÍDA!\n\nExcluídos: ${excluidos} funcionários\nErros: ${erros}`);
    
          await fetchData();
    
        } catch (error: any) {
          console.error('Erro na limpeza:', error);
          alert('❌ Erro na limpeza: ' + error.message);
        } finally {
          setIsCleaning(false);
        }
      };
    
    const handleSaveEmployee = async (employeeData: User) => {
        try {
            const { id, cpf, role } = employeeData;

            if (cpf && role === Role.EMPLOYEE) {
                const cleanCpf = cpf.replace(/[^\d]/g, '');
                if (cleanCpf && cleanCpf.length !== 11) {
                    throw new Error('O CPF deve conter 11 dígitos.');
                }
            }
            
            const isNewUser = !employeeData.id;
            const savedUser = await api.saveUser(employeeData);
            
            if (isNewUser) {
                 alert(`✅ Funcionário cadastrado com sucesso!\n\n📝 Nome: ${savedUser.name}\n🆔 ID: ${savedUser.id}\n\n💡 ANOTE ESTE ID para criar o acesso depois!`);
            }

            const updatedUsers = await api.getUsers();
            setUsers(updatedUsers);
            setIsModalOpen(false);
            
        } catch (error: any) {
            const message = error.message || "Ocorreu um erro desconhecido.";
            console.error("Erro ao salvar funcionário:", error);
            alert(`Erro ao salvar funcionário:\n${message}`);
            throw error;
        }
    };

    const handleJustificationAction = async (justificationId: string, status: 'approved' | 'rejected') => {
        try {
            await api.updateJustificationStatus(justificationId, status);
            setCurrentJustifications(prev => prev.map(j => 
                j.id === justificationId ? { ...j, status } : j
            ));
        } catch (error) {
            console.error("Erro ao atualizar status da justificativa:", error);
            alert("Ocorreu um erro ao atualizar a justificativa.");
        }
    };

    const handlePayslipSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const employee = users.find(u => u.id === payslipEmployeeId);
        if (!payslipEmployeeId || !payslipMonth || !payslipYear || !payslipFile || !employee) {
            alert("Por favor, preencha todos os campos.");
            return;
        }
        
        setIsSubmittingPayslip(true);
        try {
            await api.addPayslip({
                user_id: payslipEmployeeId,
                user_name: employee.name,
                month: payslipMonth,
                year: payslipYear,
            }, payslipFile);

            const updatedPayslips = await api.getPayslips();
            setCurrentPayslips(updatedPayslips);
            
            alert('Contracheque enviado com sucesso!');

            setPayslipEmployeeId('');
            setPayslipMonth('');
            setPayslipYear(new Date().getFullYear());
            setPayslipFile(null);
            form.reset();
            
        } catch (error) {
            let errorMessage = "Ocorreu um erro desconhecido. Verifique o console para mais detalhes.";
            
            console.error("Erro completo ao enviar contracheque:", error);

            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = String((error as { message: string }).message);
            }
            
            alert(`Erro ao enviar contracheque: ${errorMessage}`);
        } finally {
            setIsSubmittingPayslip(false);
        }
    };
    
    const handleDeletePayslip = async (payslipId: string) => {
        console.log('Tentativa de deleção... O DELETE deve ser executado diretamente.');
        try {
            await api.deletePayslip(payslipId);
            setCurrentPayslips(prevPayslips => prevPayslips.filter(p => p.id !== payslipId));
            console.log('Contracheque excluído com sucesso!');
        } catch (error: any) {
            console.error("Erro ao excluir contracheque:", error);
            console.error(`ERRO AO DELETAR: ${error.message}`);
        }
    };

    const handleAdminJustificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!justificationEmployeeId || !justificationStartDate) {
            alert("Funcionário e data de início são obrigatórios.");
            return;
        }
        
        setIsSubmittingJustification(true);
        
        const data: Partial<Justification> = {
            user_id: justificationEmployeeId,
            start_date: justificationStartDate,
            end_date: justificationEndDate || undefined,
            time: justificationTime || undefined,
            reason: justificationType,
            details: justificationDetails,
            status: 'approved',
            timestamp: new Date(),
        };

        if (editingJustification) {
            data.id = editingJustification.id;
        }

        try {
            if (justificationFile) {
                const attachmentUrl = await api.uploadFile(
                    justificationFile,
                    `justifications/${justificationEmployeeId}/${justificationFile.name}`
                );
                data.attachment = attachmentUrl;
            }

            await api.saveJustification(data);
            const updatedJustifications = await api.getJustifications();
            setCurrentJustifications(updatedJustifications);
            
            alert(editingJustification ? 'Lançamento atualizado com sucesso!' : 'Lançamento salvo com sucesso!');
            
            setEditingJustification(null);
            setJustificationEmployeeId('');
            setJustificationStartDate('');
            setJustificationEndDate('');
            setJustificationTime('');
            setJustificationType(AdminJustificationType.ATESTADO_MEDICO);
            setJustificationDetails('');
            setJustificationFile(null);
            if (justificationFileRef.current) {
                justificationFileRef.current.value = '';
            }
            
        } catch (error) {
            console.error("Erro ao salvar justificativa:", error);
            alert("Ocorreu um erro ao salvar a justificativa.");
        } finally {
            setIsSubmittingJustification(false);
        }
    };
    
    const handleEditJustification = (justification: Justification) => {
        setEditingJustification(justification);
        const form = document.getElementById('admin-justification-form');
        form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleDeleteJustification = async (justificationId: string) => {
        console.log('Tentativa de deleção... O DELETE deve ser executado diretamente.');
        try {
            await api.deleteJustification(justificationId);
            setCurrentJustifications(prev => prev.filter(j => j.id !== justificationId));
            console.log('Lançamento excluído com sucesso!');
        } catch (error: any) {
            console.error("Erro ao excluir justificativa:", error);
            console.error(`ERRO AO DELETAR: ${error.message}`);
        }
    };
    
    const downloadPDF = (data: Record<string, any>[], headers: string[], filename: string, title: string, orientation: 'portrait' | 'landscape' = 'portrait') => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation });

        doc.setFontSize(18);
        doc.setTextColor(themeSettings.colors.accent);
        doc.text(title, 14, 22, { maxWidth: doc.internal.pageSize.getWidth() - 28 });
        doc.setFontSize(11);
        doc.setTextColor(100);
        
        const titleHeight = doc.getTextDimensions(title, { maxWidth: doc.internal.pageSize.getWidth() - 28 }).h;
        let startY = 22 + titleHeight + 4;

        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, startY);
        startY += 10;


        const tableColumn = headers;
        const tableRows: string[][] = [];

        data.forEach(item => {
            const rowData = headers.map(header => String(item[header] !== undefined && item[header] !== null ? item[header] : ''));
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: startY,
            theme: 'grid',
            headStyles: {
                fillColor: themeSettings.colors.primary, 
                textColor: themeSettings.colors.accent,
                lineWidth: 0.1,
                lineColor: themeSettings.colors.accent
            },
            styles: {
                cellPadding: 2,
                fontSize: 7,
                valign: 'middle',
                overflow: 'linebreak',
            },
        });

        doc.save(filename);
    };

    const handleDownloadReport = async (e: React.FormEvent) => {
        e.preventDefault();

        if (typeof jspdf === 'undefined' || typeof (new (jspdf as any).jsPDF()).autoTable === 'undefined') {
            alert("As bibliotecas para gerar PDF ainda estão carregando. Por favor, aguarde alguns segundos e tente novamente.");
            console.error("jsPDF or jsPDF-autoTable is not loaded.");
            return;
        }
        
        try {
            if (!reportEmployeeId) {
                alert('Por favor, selecione um funcionário ou "Todos os Funcionários".');
                return;
            }
            
            let usersToReport: User[] = [];
            let titleScope = '';
            let filenameScope = '';

            if (reportEmployeeId === 'all') {
                usersToReport = users.filter(u => u.role === 'employee');
                if (reportSectorFilter) {
                    usersToReport = usersToReport.filter(u => u.setor === reportSectorFilter);
                    titleScope = ` - Setor ${reportSectorFilter}`;
                    filenameScope = `Setor_${reportSectorFilter.replace(/\s+/g, '_')}`;
                } else {
                    titleScope = ' - Todos os Funcionários';
                    filenameScope = 'Todos_Funcionarios';
                }
            } else {
                const selectedUser = users.find(u => u.id === reportEmployeeId);
                if (selectedUser) {
                    usersToReport.push(selectedUser);
                    titleScope = ` - ${selectedUser.name}`;
                    filenameScope = selectedUser.name.replace(/\s+/g, '_');
                }
            }
        
            if (usersToReport.length === 0) {
                alert('Nenhum funcionário encontrado para os filtros selecionados.');
                return;
            }

            const [year, month] = reportMonth.split('-');
            const monthName = new Date(reportMonth + '-02').toLocaleString('pt-BR', { month: 'long' });
            const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        
            let baseReportTitle = '';
            let baseFilename = '';
        
            if (reportType === 'employeeData') {
                const formatBenefitsForPDF = (benefits: Benefits | undefined): string => {
                    if (!benefits) return 'N/A';
                    const activeBenefits: string[] = [];
                    if (benefits.vt?.dailyValue) activeBenefits.push('VT');
                    if (benefits.va?.dailyValue) activeBenefits.push('VA');
                    if (benefits.periculosidade?.percentage) activeBenefits.push('Periculosidade');
                    if (benefits.insalubridade?.percentage) activeBenefits.push('Insalubridade');
                    if (benefits.salario_familia?.percentage) activeBenefits.push('Salário Família');
                    if (benefits.adicional_noturno?.percentage) activeBenefits.push('Ad. Noturno');
                    return activeBenefits.length > 0 ? activeBenefits.join(', ') : 'Nenhum';
                };
                const headers = ['Nome', 'Usuário', 'Cargo', 'Setor', 'Data de Admissão', 'CPF', 'Telefone', 'Salário Base', 'Benefícios'];
                baseReportTitle = 'Dados Cadastrais';
                baseFilename = `Dados_Cadastrais_${filenameScope}`;
                 const dataToExport = usersToReport.map(user => ({
                    'Nome': user.name, 
                    'Usuário': user.username, 
                    'Cargo': user.cargo || 'N/A', 
                    'Setor': user.setor || 'N/A',
                    'Data de Admissão': user.data_admissao ? new Date(user.data_admissao + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A',
                    