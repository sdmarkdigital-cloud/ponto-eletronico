'use client';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../services/api';
import { supabase } from '../services/supabase';
import { AdminJustificationType, Benefits, ClockType, DailyBalance, Justification, Payslip, Role, Sector, ServiceReport, TimeBankReport, TimeClockEntry, User, WorkHours } from '../types';
import EmployeeAccessList from './EmployeeAccessList';
import EmployeeFormModal from './EmployeeFormModal';
import Header from './Header';
import { CalculatorIcon, CameraIcon, ClockIcon, CogIcon, DocumentReportIcon, DownloadIcon, KeyIcon, LocationMarkerIcon, PdfIcon, PencilIcon, TrashIcon, UploadIcon, UserGroupIcon } from './icons';
import { ThemeContext } from './Providers';
import TimePicker from './TimePicker';

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
    onConfirm: () => { },
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

      await fetch(`/api/delete-user`, {
        method: 'POST',
        body: JSON.stringify({ userId: funcionario.auth_id }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

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
          'CPF': user.cpf || 'N/A',
          'Telefone': user.telefone || 'N/A',
          'Salário Base': user.salario_base?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A',
          'Benefícios': formatBenefitsForPDF(user.beneficios),
        }));
        if (dataToExport.length === 0) { alert('Nenhum dado encontrado.'); return; }
        const fullReportTitleSingle = `${baseReportTitle}${titleScope}`;
        const filenameSingle = `${baseFilename}.pdf`;
        downloadPDF(dataToExport, headers, filenameSingle, fullReportTitleSingle, 'landscape');
        return;
      }

      const { jsPDF } = jspdf;
      const doc = new jsPDF();
      let hasAnyData = false;

      if (reportType === 'timeBank') {
        baseReportTitle = `Relatório de Banco de Horas`;
        baseFilename = `Banco_Horas_${filenameScope}_${year}-${month}.pdf`;
      } else if (reportType === 'timeclock') {
        baseReportTitle = 'Relatório de Ponto';
        baseFilename = `Relatorio_Ponto_${filenameScope}_${year}-${month}.pdf`;
      } else if (reportType === 'justifications') {
        baseReportTitle = 'Relatório de Justificativas';
        baseFilename = `Relatorio_Justificativas_${filenameScope}_${year}-${month}.pdf`;
      }

      const fullReportTitle = `${baseReportTitle}${titleScope}${` (${capitalizedMonthName}/${year})`}`;
      const filename = `${baseFilename}.pdf`;

      doc.setFontSize(18).setTextColor(themeSettings.colors.accent);
      doc.text(fullReportTitle, 14, 22, { maxWidth: doc.internal.pageSize.getWidth() - 28 });

      const titleHeight = doc.getTextDimensions(fullReportTitle, { maxWidth: doc.internal.pageSize.getWidth() - 28 }).h;
      let startY = 22 + titleHeight + 4;

      doc.setFontSize(11).setTextColor(100).text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, startY);
      startY += 15;

      usersToReport.forEach((user, index) => {
        if (index > 0) {
          doc.addPage();
          startY = 22; // Reset Y for new page
          doc.setFontSize(14).setTextColor(themeSettings.colors.accent).setFont(undefined, 'bold').text(user.name, 15, startY);
          startY += 12;
        } else if (usersToReport.length > 1) {
          doc.setFontSize(14).setTextColor(themeSettings.colors.accent).setFont(undefined, 'bold').text(user.name, 15, startY);
          startY += 12;
        }

        if (reportType === 'timeBank') {
          const generatedReport = generateTimeBankReportForEmployee(user, reportMonth);
          hasAnyData = true;
          doc.autoTable({
            startY,
            theme: 'grid',
            headStyles: { fillColor: themeSettings.colors.primary, textColor: themeSettings.colors.accent },
            body: [
              ['Total Previsto', 'Total Realizado', 'Saldo Final'],
              [formatMinutesToHours(generatedReport.totalExpected), formatMinutesToHours(generatedReport.totalWorked), formatMinutesToHours(generatedReport.totalBalance)],
            ],
          });

          startY = (doc as any).lastAutoTable.finalY + 10;

          const dailyHeaders = ['Data', 'Dia', 'Previsto', 'Realizado', 'Saldo', 'Obs.'];
          const dailyData = generatedReport.dailyBalances.map(d => [d.date, d.dayOfWeek, formatMinutesToHours(d.expectedMinutes), formatMinutesToHours(d.workedMinutes), formatMinutesToHours(d.balance), d.observation]);
          doc.autoTable({ startY, head: [dailyHeaders], body: dailyData, theme: 'striped', headStyles: { fillColor: themeSettings.colors.secondary } });
          startY = (doc as any).lastAutoTable.finalY + 15;
        } else {
          let userData: Record<string, any>[] = [];
          let headers: string[] = [];

          if (reportType === 'timeclock') {
            headers = ['ID', 'Tipo', 'Data e Hora', 'Latitude', 'Longitude'];
            userData = currentTimeEntries.filter(e => e.user_id === user.id && new Date(e.timestamp).getFullYear() === parseInt(year) && new Date(e.timestamp).getMonth() + 1 === parseInt(month))
              .map(e => ({ 'ID': e.id, 'Tipo': e.type, 'Data e Hora': new Date(e.timestamp).toLocaleString('pt-BR'), 'Latitude': e.location?.latitude.toFixed(5) || 'N/A', 'Longitude': e.location?.longitude.toFixed(5) || 'N/A' }));
          } else if (reportType === 'justifications') {
            headers = ['ID', 'Data Lançamento', 'Motivo', 'Detalhes', 'Status', 'Data Início', 'Data Fim', 'Hora'];
            userData = currentJustifications.filter(j => j.user_id === user.id && (new Date(j.start_date || j.timestamp).getFullYear() === parseInt(year) && new Date(j.start_date || j.timestamp).getMonth() + 1 === parseInt(month)))
              .map(j => ({ 'ID': j.id, 'Data Lançamento': new Date(j.timestamp).toLocaleString('pt-BR'), 'Motivo': j.reason, 'Detalhes': j.details, 'Status': j.status, 'Data Início': j.start_date ? new Date(j.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A', 'Data Fim': j.end_date ? new Date(j.end_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A', 'Hora': j.time || 'N/A' }));
          }

          if (userData.length > 0) {
            hasAnyData = true;
            const bodyData = userData.map(row => headers.map(header => {
              const value = row[header];
              return String(value !== undefined && value !== null ? value : '');
            }));

            doc.autoTable({ head: [headers], body: bodyData, startY, theme: 'grid', headStyles: { fillColor: themeSettings.colors.primary, textColor: themeSettings.colors.accent }, styles: { fontSize: 8 } });
            startY = (doc as any).lastAutoTable.finalY + 15;
          }
        }
      });

      if (!hasAnyData) { alert('Nenhum dado encontrado para os filtros selecionados.'); return; }
      doc.save(filename);

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      if (error instanceof Error) {
        alert(`Ocorreu um erro ao baixar o relatório: ${error.message}`);
      } else {
        alert("Ocorreu um erro desconhecido ao baixar o relatório.");
      }
    }
  };

  const handlePreparePayroll = (e: React.FormEvent) => {
    e.preventDefault();
    setPayrollResult(null);
    setConvenioValues({});

    let employeesToProcess: User[] = [];
    if (payrollEmployeeId === 'all') {
      employeesToProcess = users.filter(u => u.role === 'employee');
      if (payrollSectorFilter) {
        employeesToProcess = employeesToProcess.filter(u => u.setor === payrollSectorFilter);
      }
      if (payrollContractFilter) {
        employeesToProcess = employeesToProcess.filter(u =>
          u.contract?.toLowerCase().includes(payrollContractFilter.toLowerCase())
        );
      }
    } else {
      const selectedEmployee = users.find(u => u.id === payrollEmployeeId);
      if (selectedEmployee) {
        employeesToProcess.push(selectedEmployee);
      }
    }

    if (employeesToProcess.length === 0) {
      alert("Nenhum funcionário encontrado para os filtros selecionados.");
      setEmployeesForPayrollInput(null);
      return;
    }

    setEmployeesForPayrollInput(employeesToProcess);
  };

  const handleConvenioChange = (userId: string, value: string) => {
    setConvenioValues(prev => ({ ...prev, [userId]: value }));
  };

  const handleGeneratePayroll = () => {
    if (!employeesForPayrollInput) return;

    const allResults: PayrollResult[] = [];
    const [year, month] = payrollMonth.split('-').map(Number);

    employeesForPayrollInput.forEach(employee => {
      const monthName = new Date(year, month - 1, 2).toLocaleString('pt-BR', { month: 'long' });
      const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const getDaysFromJustifications = () => {
        const justifiedDaysSet = new Set<string>();
        currentJustifications
          .filter(j => j.user_id === employee.id && j.status === 'approved' && j.start_date)
          .forEach(j => {
            const start = new Date(j.start_date + 'T00:00:00');
            const end = j.end_date ? new Date(j.end_date + 'T00:00:00') : start;
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              if (d.getFullYear() === year && d.getMonth() === month - 1) {
                justifiedDaysSet.add(d.toISOString().split('T')[0]);
              }
            }
          });
        return justifiedDaysSet;
      };

      const getWorkedDays = () => {
        const workedDaysSet = new Set<string>();
        currentTimeEntries
          .filter(t => t.user_id === employee.id && t.type === ClockType.ENTRADA)
          .forEach(t => {
            const entryDate = new Date(t.timestamp);
            if (entryDate.getFullYear() === year && entryDate.getMonth() === month - 1) {
              workedDaysSet.add(entryDate.toISOString().split('T')[0]);
            }
          });
        return workedDaysSet;
      };

      const calculateWorkedHours = (userId: string, year: number, month: number): number => {
        const userEntries = currentTimeEntries.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          return entry.user_id === userId &&
            entryDate.getFullYear() === year &&
            entryDate.getMonth() === month - 1;
        });

        if (userEntries.length === 0) return 0;

        const entriesByDay = userEntries.reduce((acc, entry) => {
          const day = new Date(entry.timestamp).toISOString().split('T')[0];
          if (!acc[day]) acc[day] = [];
          acc[day].push(entry);
          return acc;
        }, {} as Record<string, TimeClockEntry[]>);

        let totalMilliseconds = 0;

        for (const day in entriesByDay) {
          const dayEntries = entriesByDay[day].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const entrada = dayEntries.find(e => e.type === ClockType.ENTRADA);
          const saidaAlmoco = dayEntries.find(e => e.type === ClockType.SAIDA_ALMOCO);
          const retornoAlmoco = dayEntries.find(e => e.type === ClockType.RETORNO_ALMOCO);
          const saida = dayEntries.find(e => e.type === ClockType.SAIDA);

          if (entrada && saida) {
            let workMillis = new Date(saida.timestamp).getTime() - new Date(entrada.timestamp).getTime();
            if (saidaAlmoco && retornoAlmoco) {
              const lunchMillis = new Date(retornoAlmoco.timestamp).getTime() - new Date(saidaAlmoco.timestamp).getTime();
              workMillis -= lunchMillis > 0 ? lunchMillis : 0;
            }
            totalMilliseconds += workMillis > 0 ? workMillis : 0;
          }
        }
        return totalMilliseconds / (1000 * 60 * 60); // Convert to hours
      };

      const calculateINSS = (base: number) => {
        if (base <= 1412.00) return base * 0.075;
        if (base <= 2666.68) return base * 0.09 - 21.18;
        if (base <= 4000.03) return base * 0.12 - 101.18;
        if (base <= 7786.02) return base * 0.14 - 181.18;
        return 7786.02 * 0.14 - 181.18; // Teto
      }

      const admissionDateStr = employee.data_admissao;
      const admissionDate = admissionDateStr ? new Date(admissionDateStr + 'T00:00:00') : null;
      const isValidAdmissionDate = admissionDate && !isNaN(admissionDate.getTime());

      const daysInMonth = new Date(year, month, 0).getDate();
      let periodStartDay = 1;
      let isNewHireThisMonth = false;

      if (isValidAdmissionDate) {
        const admissionYear = admissionDate.getFullYear();
        const admissionMonth = admissionDate.getMonth() + 1;

        if (admissionYear > year || (admissionYear === year && admissionMonth > month)) {
          allResults.push({ employeeName: employee.name, monthYear: `${capitalizedMonthName} / ${year}`, baseSalary: employee.salario_base || 0, businessDays: 0, workedDays: 0, workedHours: 0, absentDays: 0, justifiedDays: 0, earnings: [], deductions: [], totalEarnings: 0, totalDeductions: 0, netPay: 0, employerCharges: [] });
          return;
        }

        if (admissionYear === year && admissionMonth === month) {
          periodStartDay = admissionDate.getDate();
          isNewHireThisMonth = true;
        }
      }

      let businessDays = 0;
      for (let day = periodStartDay; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          businessDays++;
        }
      }

      const justifiedDaysSet = getDaysFromJustifications();
      const workedDaysSet = getWorkedDays();

      justifiedDaysSet.forEach(day => workedDaysSet.delete(day));

      const workedDays = workedDaysSet.size;
      const justifiedDays = justifiedDaysSet.size;

      const baseSalary = employee.salario_base || 0;
      const dailySalary = baseSalary / 30;

      const earnings: { description: string; value: number }[] = [];
      const deductions: { description: string; value: number }[] = [];
      const employerCharges: { description: string; value: number }[] = [];

      let salaryBaseForMonth = baseSalary;
      let salaryDescription = 'Salário Base';

      if (isNewHireThisMonth) {
        const daysInContract = daysInMonth - periodStartDay + 1;
        salaryBaseForMonth = (baseSalary / 30) * daysInContract;
        salaryDescription = `Salário Proporcional (${daysInContract} dias)`;
      }
      earnings.push({ description: salaryDescription, value: salaryBaseForMonth });

      const absentDays = Math.max(0, businessDays - workedDays - justifiedDays);
      let absenceDeductionValue = 0;
      if (absentDays > 0) {
        absenceDeductionValue = dailySalary * absentDays;
        deductions.push({ description: `Faltas (${absentDays} dias)`, value: absenceDeductionValue });

        const sundaysInMonth = getSundaysInMonth(year, month);
        const dsrDaysToDiscount = Math.min(absentDays, sundaysInMonth);
        if (dsrDaysToDiscount > 0) {
          const dsrDeductionValue = dsrDaysToDiscount * dailySalary;
          deductions.push({ description: 'Desconto DSR s/ Faltas', value: dsrDeductionValue });
          absenceDeductionValue += dsrDeductionValue;
        }
      }

      const workedHours = calculateWorkedHours(employee.id, year, month);
      const benefits = employee.beneficios || {};

      if (benefits.va?.dailyValue) {
        const vaTotalValue = benefits.va.dailyValue * workedDays;
        if (vaTotalValue > 0) {
          earnings.push({ description: 'Vale Alimentação (VA)', value: vaTotalValue });
          const vaDeduction = vaTotalValue * 0.11;
          if (vaDeduction > 0) {
            deductions.push({ description: 'Desconto Vale Alimentação', value: vaDeduction });
          }
        }
      }
      if (benefits.vt?.dailyValue) {
        const vtValue = benefits.vt.dailyValue * workedDays;
        if (vtValue > 0) {
          earnings.push({ description: 'Vale Transporte (VT)', value: vtValue });
          deductions.push({ description: 'Desconto VT (6%)', value: Math.min(vtValue, (salaryBaseForMonth - absenceDeductionValue) * 0.06) });
        }
      }

      let periculosidadeValue = 0;
      let insalubridadeValue = 0;

      if (benefits.periculosidade?.percentage) {
        periculosidadeValue = salaryBaseForMonth * (benefits.periculosidade.percentage / 100);
        earnings.push({ description: 'Periculosidade', value: periculosidadeValue });
      }
      if (benefits.insalubridade?.percentage) {
        insalubridadeValue = salaryBaseForMonth * (benefits.insalubridade.percentage / 100);
        earnings.push({ description: 'Insalubridade', value: insalubridadeValue });
      }

      const convenioDeduction = parseFloat(convenioValues[employee.id] || '0');
      if (convenioDeduction > 0) {
        deductions.push({ description: 'Desconto Convênio', value: convenioDeduction });
      }

      const totalEarnings = earnings.reduce((sum, item) => sum + item.value, 0);

      const inssBase = (salaryBaseForMonth - absenceDeductionValue) + periculosidadeValue + insalubridadeValue;

      const inssValue = calculateINSS(inssBase);
      if (inssValue > 0) {
        deductions.push({ description: 'INSS', value: inssValue });
      }

      const fgtsValue = inssBase * 0.08;
      if (fgtsValue > 0) {
        employerCharges.push({ description: 'FGTS (8%)', value: fgtsValue });
      }

      const totalDeductions = deductions.reduce((sum, item) => sum + item.value, 0);
      const netPay = Math.max(0, totalEarnings - totalDeductions);

      allResults.push({
        employeeName: employee.name,
        monthYear: `${capitalizedMonthName} / ${year}`,
        baseSalary,
        businessDays,
        workedDays,
        workedHours,
        absentDays,
        justifiedDays,
        earnings,
        deductions,
        totalEarnings,
        totalDeductions,
        netPay,
        employerCharges
      });
    });

    setPayrollResult(allResults);
    setEmployeesForPayrollInput(null);
  };

  const handleDownloadPayrollReport = () => {
    if (!payrollResult) return;

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const [year, month] = payrollMonth.split('-');

    let filenameScope = '';
    let titleScope = '';

    if (payrollEmployeeId === 'all') {
      const scopes = [];
      const filenameScopes = [];

      if (payrollSectorFilter) {
        scopes.push(`Setor ${payrollSectorFilter}`);
        filenameScopes.push(`Setor_${payrollSectorFilter.replace(/\s+/g, '_')}`);
      }
      if (payrollContractFilter) {
        scopes.push(`Contrato ${payrollContractFilter}`);
        filenameScopes.push(`Contrato_${payrollContractFilter.replace(/\s+/g, '_')}`);
      }

      if (scopes.length > 0) {
        titleScope = ` - ${scopes.join(' & ')}`;
        filenameScope = filenameScopes.join('_');
      } else {
        titleScope = ' - Todos os Funcionários';
        filenameScope = 'Todos_Funcionarios';
      }
    } else {
      const employee = users.find(u => u.id === payrollEmployeeId);
      if (employee) {
        filenameScope = employee.name.replace(/\s+/g, '_');
        titleScope = ` - ${employee.name}`;
      }
    }

    const filename = `Fechamento_Folha_${filenameScope}_${year}-${month}.pdf`;
    const title = `Relatório de Fechamento de Folha${titleScope} - ${payrollResult[0].monthYear}`;

    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    let startY = 22;

    doc.setFontSize(18).setTextColor(themeSettings.colors.accent);
    doc.text(title, 14, startY, { maxWidth: doc.internal.pageSize.getWidth() - 28 });

    const titleHeight = doc.getTextDimensions(title, { maxWidth: doc.internal.pageSize.getWidth() - 28 }).h;
    startY += titleHeight + 4;

    doc.setFontSize(11).setTextColor(100).text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, startY);

    payrollResult.forEach((result, index) => {
      if (index > 0) {
        doc.addPage();
        startY = 22;
      }

      startY += 15;
      doc.setFillColor(themeSettings.colors.secondary);
      doc.rect(14, startY - 6, (doc as any).internal.pageSize.width - 28, 9, 'F');
      doc.setFontSize(14).setTextColor(themeSettings.colors.accent).setFont(undefined, 'bold').text(result.employeeName, 15, startY);
      doc.setFont(undefined, 'normal');
      startY += 12;

      doc.autoTable({
        body: [
          ['Dias Úteis', 'Trabalhados', 'Horas Trab.', 'Justificados', 'Faltas'],
          [result.businessDays, result.workedDays, result.workedHours.toFixed(2).replace('.', ','), result.justifiedDays, result.absentDays],
        ],
        startY, theme: 'grid',
        headStyles: { fillColor: themeSettings.colors.secondary },
        bodyStyles: { halign: 'center' }
      });
      startY = (doc as any).lastAutoTable.finalY + 5;

      doc.autoTable({
        body: [['Salário Base (Contratual)', formatCurrency(result.baseSalary)]],
        startY, theme: 'grid',
        headStyles: { fillColor: themeSettings.colors.secondary },
      });
      startY = (doc as any).lastAutoTable.finalY + 10;

      const earningsData = result.earnings.map(e => [e.description, formatCurrency(e.value)]);
      const deductionsData = result.deductions.map(d => [d.description, formatCurrency(d.value)]);

      doc.autoTable({
        head: [['PROVENTOS', 'Valor']],
        body: earningsData,
        startY, theme: 'grid',
        headStyles: { fillColor: '#166534', textColor: '#A7F3D0' },
        margin: { left: 14, right: 107 },
      });

      doc.autoTable({
        head: [['DESCONTOS', 'Valor']],
        body: deductionsData,
        startY, theme: 'grid',
        headStyles: { fillColor: '#991B1B', textColor: '#FCA5A5' },
        margin: { left: 107, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 5;

      doc.autoTable({
        body: [
          ['Salário Bruto (Proventos)', formatCurrency(result.totalEarnings)],
          ['Total de Descontos', formatCurrency(result.totalDeductions)],
          ['LÍQUIDO A RECEBER', formatCurrency(result.netPay)],
        ],
        startY, theme: 'grid',
        didParseCell: function (data: any) {
          if (data.row.index === 2) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = themeSettings.colors.accent;
          }
        }
      });
      startY = (doc as any).lastAutoTable.finalY + 10;

      doc.autoTable({
        head: [['Encargos do Empregador', 'Valor']],
        body: result.employerCharges.map(e => [e.description, formatCurrency(e.value)]),
        startY, theme: 'grid',
        headStyles: { fillColor: '#4B5563' },
      });

    });
    doc.save(filename);
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let settingsToSave = { ...themeSettings };
    let settingsSaved = false;

    try {
      if (logoFile) {
        const oldLogoUrl = themeSettings.companySettings.logoUrl;
        if (oldLogoUrl) {
          const oldPath = new URL(oldLogoUrl).pathname.split('/documents/')[1];
          await api.deleteFile(oldPath);
        }
        const logoUrl = await api.uploadFile(logoFile, `logos/${logoFile.name}`);
        settingsToSave = {
          ...settingsToSave,
          companySettings: {
            ...settingsToSave.companySettings,
            logoUrl: logoUrl,
          },
        };
        setLogoFile(null);
      }

      await api.saveSettings(settingsToSave);
      setThemeSettings(settingsToSave);
      settingsSaved = true;

    } catch (error) {
      alert("Erro ao salvar as configurações gerais.");
      console.error(error);
    }

    if (adminUser) {
      try {
        const updatedAdmin: Partial<User> = { id: adminUser.id, username: adminCredentials.username };
        if (adminCredentials.password) {
          if (adminCredentials.password.length < 6) {
            alert("A nova senha do administrador deve ter pelo menos 6 caracteres.");
            return;
          }
          await api.updateUserPassword(adminUser.auth_id!, adminCredentials.password);
        }
        await api.saveUser(updatedAdmin);

        const usersData = await api.getUsers();
        setUsers(usersData);
        const currentAdmin = usersData.find(u => u.role === 'admin');
        if (currentAdmin) setAdminUser(currentAdmin);

        setAdminCredentials(prev => ({ ...prev, password: '' }));

        if (settingsSaved) alert("Configurações salvas com sucesso!");

      } catch (error) {
        alert("Erro ao salvar as credenciais do administrador.");
        console.error(error);
      }
    } else if (settingsSaved) {
      alert("Configurações salvas com sucesso!");
    }
  };

  const handleThemeSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'theme') {
      setThemeSettings(prev => ({ ...prev, theme: value as 'dark' | 'light' }));
    } else if (name === 'loginMessage') {
      setThemeSettings(prev => ({ ...prev, loginMessage: value }));
    } else { // It's a color
      setThemeSettings(prev => ({
        ...prev,
        colors: {
          ...prev.colors,
          [name]: value,
        }
      }));
    }
  };

  const handleCompanySettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setThemeSettings(prev => ({
      ...prev,
      companySettings: {
        ...prev.companySettings,
        [name]: value
      }
    }));
  };

  const handleAdminCredentialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdminCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      const localUrl = URL.createObjectURL(file);
      setThemeSettings(prev => ({ ...prev, companySettings: { ...prev.companySettings, logoUrl: localUrl } }));
    }
  };

  const handleDeleteLogo = async () => {
    if (themeSettings.companySettings.logoUrl) {
      try {
        if (themeSettings.companySettings.logoUrl.startsWith('https')) {
          const path = new URL(themeSettings.companySettings.logoUrl).pathname.split('/documents/')[1];
          await api.deleteFile(path);
        }
      } catch (error) {
        console.error("Could not delete logo file from storage. It might be a local file.", error);
      }
    }

    setThemeSettings(prev => ({ ...prev, companySettings: { ...prev.companySettings, logoUrl: null } }));
    setLogoFile(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
  };

  const handleSectorHoursChange = (sector: Sector, field: keyof WorkHours, value: string) => {
    setThemeSettings(prev => ({
      ...prev,
      sectorWorkHours: {
        ...prev.sectorWorkHours,
        [sector]: {
          ...prev.sectorWorkHours[sector],
          [field]: value
        }
      }
    }));
  };

  const parseTimeStringToMinutes = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatMinutesToHours = (totalMinutes: number): string => {
    const sign = totalMinutes < 0 ? '-' : '';
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = Math.round(absMinutes % 60);
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const generateTimeBankReportForEmployee = (employee: User, monthString: string): TimeBankReport => {
    const [year, month] = monthString.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyBalances: DailyBalance[] = [];

    const justifiedDaysSet = new Set<string>();
    currentJustifications
      .filter(j => j.user_id === employee.id && j.status === 'approved' && j.start_date)
      .forEach(j => {
        const start = new Date(j.start_date + 'T00:00:00');
        const end = j.end_date ? new Date(j.end_date + 'T00:00:00') : start;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() === year && d.getMonth() === month - 1) {
            justifiedDaysSet.add(d.toISOString().split('T')[0]);
          }
        }
      });

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const dateString = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.toLocaleDateString('pt-BR', { weekday: 'short' });
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

      const employeeSchedule = employee.custom_work_hours ||
        (employee.setor && themeSettings.sectorWorkHours[employee.setor]) ||
        themeSettings.companySettings;

      let expectedMinutes = 0;
      if (!isWeekend && employeeSchedule.workStartTime && employeeSchedule.workEndTime) {
        const start = parseTimeStringToMinutes(employeeSchedule.workStartTime);
        const end = parseTimeStringToMinutes(employeeSchedule.workEndTime);
        const lunchStart = parseTimeStringToMinutes(employeeSchedule.lunchStartTime);
        const lunchEnd = parseTimeStringToMinutes(employeeSchedule.lunchEndTime);
        expectedMinutes = (end - start) - (lunchEnd - lunchStart);
      }

      const dayEntries = currentTimeEntries
        .filter(entry => {
          const entryDate = new Date(entry.timestamp);
          return entry.user_id === employee.id &&
            entryDate.getFullYear() === year &&
            entryDate.getMonth() === month - 1 &&
            entryDate.getDate() === day;
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let workedMinutes = 0;
      if (dayEntries.length > 0) {
        const entrada = dayEntries.find(e => e.type === ClockType.ENTRADA);
        const saidaAlmoco = dayEntries.find(e => e.type === ClockType.SAIDA_ALMOCO);
        const retornoAlmoco = dayEntries.find(e => e.type === ClockType.RETORNO_ALMOCO);
        const saida = dayEntries.find(e => e.type === ClockType.SAIDA);

        if (entrada && saida) {
          let workMillis = new Date(saida.timestamp).getTime() - new Date(entrada.timestamp).getTime();
          if (saidaAlmoco && retornoAlmoco) {
            const lunchMillis = new Date(retornoAlmoco.timestamp).getTime() - new Date(saidaAlmoco.timestamp).getTime();
            workMillis -= Math.max(0, lunchMillis);
          }
          workedMinutes = Math.round(workMillis / (1000 * 60));
        }
      }

      let observation = '';
      let balance = workedMinutes - expectedMinutes;

      if (isWeekend && workedMinutes > 0) {
        observation = 'Hora Extra (Fim de Semana)';
      } else if (justifiedDaysSet.has(dateString)) {
        observation = 'Dia Justificado';
        balance = 0;
      } else if (!isWeekend && workedMinutes === 0 && expectedMinutes > 0) {
        observation = 'Falta';
        balance = -expectedMinutes;
      }

      if (workedMinutes > 0 || !isWeekend) {
        dailyBalances.push({
          date: currentDate.toLocaleDateString('pt-BR'),
          dayOfWeek,
          expectedMinutes,
          workedMinutes,
          balance,
          observation,
        });
      }
    }

    const totalExpected = dailyBalances.reduce((sum, d) => sum + d.expectedMinutes, 0);
    const totalWorked = dailyBalances.reduce((sum, d) => sum + d.workedMinutes, 0);
    const totalBalance = dailyBalances.reduce((sum, d) => sum + d.balance, 0);

    const monthName = new Date(year, month - 1, 2).toLocaleString('pt-BR', { month: 'long' });
    const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return {
      employeeName: employee.name,
      period: `${capitalizedMonthName}/${year}`,
      totalExpected,
      totalWorked,
      totalBalance,
      dailyBalances,
    };
  };

  const handleGenerateTimeBankReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeBankEmployeeId) {
      alert("Por favor, selecione um funcionário.");
      return;
    }

    setIsGeneratingTimeBank(true);
    setTimeBankReport(null);

    const employee = users.find(u => u.id === timeBankEmployeeId);
    if (!employee) {
      alert("Funcionário não encontrado.");
      setIsGeneratingTimeBank(false);
      return;
    }

    const report = generateTimeBankReportForEmployee(employee, timeBankMonth);
    setTimeBankReport(report);
    setIsGeneratingTimeBank(false);
  };

  const criarAcessoAutomatico = async (funcionario: User) => {
    setLoadingButtonId(funcionario.id);

    if (!funcionario.cpf) {
      alert('Este funcionário não tem CPF cadastrado. Adicione o CPF primeiro.');
      setLoadingButtonId(null);
      return;
    }

    const cleanCpf = funcionario.cpf.replace(/[^\d]/g, '');

    if (cleanCpf.length !== 11) {
      alert('CPF deve ter 11 números');
      setLoadingButtonId(null);
      return;
    }

    try {
      const emailLogin = `${cleanCpf}@starkergoot.com`;

      console.log('1. Iniciando criação de acesso para:', funcionario.name);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailLogin,
        password: cleanCpf,
      });

      let authId = null;

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log('2. Usuário já existe, não é possível criar novo acesso.');
          throw new Error('Já existe um usuário com este CPF. Para vincular, exclua o acesso existente ou use outro CPF.');
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) {
          throw new Error("Falha ao criar usuário: dados do usuário não retornados pelo Supabase.");
        }
        authId = authData.user.id;
        console.log('2. Novo usuário criado, ID:', authId);
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          auth_id: authId,
          cpf: cleanCpf,
          tem_acesso: true,
          senha_padrao: true,
        })
        .eq('id', funcionario.id);

      if (updateError) {
        console.error('Erro ao atualizar funcionário:', updateError);
        throw updateError;
      }

      console.log('4. Funcionário atualizado com sucesso');

      setTimeout(async () => {
        await fetchData();
        console.log('5. Lista recarregada');
      }, 500);

      alert(`✅ ACESSO CRIADO COM SUCESSO!\n\n${funcionario.name}\nLogin: ${cleanCpf}\nSenha: ${cleanCpf}\n\nO funcionário já pode fazer login!`);

    } catch (error: any) {
      console.error('Erro completo:', error);
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoadingButtonId(null);
    }
  };

  const handleExcluirFuncionarioClick = (funcionario: User) => {
    setConfirmationModal({
      isOpen: true,
      title: '🚨 ATENÇÃO: EXCLUSÃO PERMANENTE!',
      message: `Deseja excluir PERMANENTEMENTE o funcionário ${funcionario.name}?\n\n📢 Esta ação não pode ser desfeita! Todos os dados serão apagados completamente.`,
      onConfirm: () => excluirFuncionarioPermanentemente(funcionario),
    });
  };

  const handleLimparInativosClick = () => {
    setConfirmationModal({
      isOpen: true,
      title: '🧹 LIMPEZA DE SISTEMA',
      message: `Deseja excluir TODOS os funcionários sem acesso?\n\nEsta ação removerá permanentemente todos os funcionários que não possuem login ativo.`,
      onConfirm: limparFuncionariosInativos,
    });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => { } });
  };

  const handleConfirm = async () => {
    await confirmationModal.onConfirm();
    closeConfirmationModal();
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter(u => u.role !== 'admin')
      .filter(user => {
        const nameMatch = user.name.toLowerCase().includes(nameFilter.toLowerCase());
        const sectorMatch = sectorFilter ? user.setor === sectorFilter : true;
        const stateMatch = stateFilter ? user.state?.toLowerCase().includes(stateFilter.toLowerCase()) : true;
        const cityMatch = cityFilter ? user.city?.toLowerCase().includes(cityFilter.toLowerCase()) : true;
        const contractMatch = contractFilter ? user.contract?.toLowerCase().includes(contractFilter.toLowerCase()) : true;

        return nameMatch && sectorMatch && stateMatch && cityMatch && contractMatch;
      });
  }, [users, nameFilter, sectorFilter, stateFilter, cityFilter, contractFilter]);

  const renderContent = () => {
    if (loading) {
      return <div className="text-center p-8">Carregando dados...</div>;
    }

    switch (activeTab) {
      case 'employees':
        return (
          <div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
              <h3 className="text-xl font-bold text-accent">Gerenciamento de Funcionários</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleLimparInativosClick}
                  disabled={isCleaning}
                  className="bg-yellow-600 text-white font-bold py-2 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-wait">
                  {isCleaning ? 'Limpando...' : '🧹 Limpar Inativos'}
                </button>
                <button onClick={handleAddEmployee} className="bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition">Adicionar Funcionário</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-muted">Pesquisar por Nome</label>
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Digite o nome..."
                  className="mt-1 block w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted">Filtrar por Setor</label>
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="mt-1 block w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"
                >
                  <option value="">Todos os Setores</option>
                  {Object.values(Sector).map((sector: string) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted">Filtrar por Estado</label>
                <input
                  type="text"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  placeholder="Digite o estado..."
                  className="mt-1 block w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted">Filtrar por Cidade</label>
                <input
                  type="text"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  placeholder="Digite a cidade..."
                  className="mt-1 block w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-text-muted">Filtrar por Contrato</label>
                <input
                  type="text"
                  value={contractFilter}
                  onChange={(e) => setContractFilter(e.target.value)}
                  placeholder="Digite o contrato..."
                  className="mt-1 block w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"
                />
              </div>
            </div>

            <div className="bg-primary rounded-lg overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Cargo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Setor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">CBO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Estado/Cidade/Contrato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredUsers.map(user => {
                    const contractInfo = user.state && user.city && user.contract ? `${user.state} / ${user.city} / ${user.contract}` : 'N/A';
                    return (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-base">{user.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{user.cargo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{user.setor}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{user.cbo || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{contractInfo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-4">
                            <button onClick={() => handleEditEmployee(user)} className="text-accent hover:opacity-80" title="Editar"><PencilIcon className="h-5 w-5" /></button>
                            <button
                              onClick={() => handleExcluirFuncionarioClick(user)}
                              disabled={loadingButtonId === user.id}
                              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition ${loadingButtonId === user.id
                                ? 'bg-gray-500 text-white cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                            >
                              {loadingButtonId === user.id ? (
                                'Excluindo...'
                              ) : (
                                <>
                                  <TrashIcon className="h-4 w-4" />
                                  <span>Excluir</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'registerAccess':
        return <EmployeeAccessList />;
      case 'timeclock':
        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-4">Registros de Ponto</h3>
            <div className="space-y-4">
              {currentTimeEntries.map((entry: TimeClockEntry) => {
                const employeeName = users.find(u => u.id === entry.user_id)?.name || entry.user_name || 'Funcionário não encontrado';
                return (
                  <div key={entry.id} className="bg-primary p-4 rounded-md flex justify-between items-center">
                    <div>
                      <p className="font-bold text-text-base">{employeeName}</p>
                      <span className="text-sm font-medium text-accent">{entry.type}</span>
                      <p className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <LocationMarkerIcon className="h-6 w-6 text-blue-400" title={`Lat: ${entry.location?.latitude.toFixed(4)}, Lon: ${entry.location?.longitude.toFixed(4)}`} />
                      <a href={entry.photo} target="_blank" rel="noopener noreferrer"><CameraIcon className="h-6 w-6 text-green-400 cursor-pointer" title="Ver Foto" /></a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'reports':
        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-4">Relatórios de Serviço</h3>
            <div className="space-y-4">
              {serviceReports.map((report: ServiceReport) => {
                const employeeName = users.find(u => u.id === report.user_id)?.name || report.user_name || 'Funcionário não encontrado';
                return (
                  <div key={report.id} className="bg-primary p-4 rounded-md">
                    <p className="font-bold text-text-base">{employeeName} - {report.client}</p>
                    <p className="text-xs text-text-muted mb-2">{new Date(report.timestamp).toLocaleString('pt-BR')}</p>
                    <a href={report.photo} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Ver foto do serviço</a>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'justifications':
        const employeeJustifications = currentJustifications.filter(j => j.date);
        const adminJustifications = currentJustifications.filter(j => j.start_date && !j.date);

        const JustificationItem: React.FC<{ justification: Justification }> = ({ justification }) => {
          const employeeName = users.find(u => u.id === justification.user_id)?.name || justification.user_name || 'Funcionário não encontrado';
          return (
            <div className="bg-primary p-4 rounded-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-text-base">{employeeName}</p>
                  {justification.start_date ? (
                    <>
                      <p className="text-sm text-text-muted"><b>Período:</b> {new Date(justification.start_date + 'T00:00:00').toLocaleDateString('pt-BR')} {justification.end_date ? `a ${new Date(justification.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</p>
                      {justification.time && <p className="text-sm text-text-muted"><b>Hora:</b> {justification.time}</p>}
                    </>
                  ) : (
                    <p className="text-sm text-text-muted"><b>Data do ocorrido:</b> {justification.date ? new Date(justification.date).toLocaleString('pt-BR') : 'N/A'}</p>
                  )}
                  <p className="text-sm text-text-muted"><b>Motivo:</b> {justification.reason}</p>
                  {justification.details && <p className="text-sm text-text-muted mt-2"><b>Detalhes:</b> {justification.details}</p>}
                  {justification.attachment && (
                    <a href={justification.attachment} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm mt-2 flex items-center gap-1">
                      <DocumentReportIcon className="h-4 w-4" /> Ver anexo
                    </a>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${justification.status === 'approved' ? 'bg-green-600' : justification.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-500'} text-white`}>{justification.status}</span>
                  {justification.status === 'pending' && justification.id && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleJustificationAction(justification.id!, 'approved')} className="bg-green-600 text-white px-3 py-1 text-xs rounded-md hover:bg-green-700 transition">Aprovar</button>
                      <button onClick={() => handleJustificationAction(justification.id!, 'rejected')} className="bg-red-600 text-white px-3 py-1 text-xs rounded-md hover:bg-red-700 transition">Rejeitar</button>
                    </div>
                  )}
                  {justification.start_date && justification.id && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleEditJustification(justification)} className="text-accent hover:opacity-80" title="Editar"><PencilIcon className="h-5 w-5" /></button>
                      <button onClick={() => handleDeleteJustification(justification.id!)} className="text-red-500 hover:text-red-400" title="Excluir"><TrashIcon className="h-5 w-5" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        };

        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-4">{editingJustification ? 'Editar Lançamento' : 'Lançar Documentos/Justificativas'}</h3>
            <form id="admin-justification-form" onSubmit={handleAdminJustificationSubmit} className="bg-primary p-4 rounded-lg space-y-4 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-text-muted mb-1">Funcionário</label>
                  <select value={justificationEmployeeId} onChange={e => setJustificationEmployeeId(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                    <option value="">Selecione um funcionário</option>
                    {users.filter(u => u.role === 'employee').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Data Inicial</label>
                  <input type="date" value={justificationStartDate} onChange={e => setJustificationStartDate(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Data Final</label>
                  <input type="date" value={justificationEndDate} onChange={e => setJustificationEndDate(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Hora</label>
                  <TimePicker
                    value={justificationTime}
                    onChange={(value) => setJustificationTime(value)}
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-text-muted mb-1">Tipo de Justificativa</label>
                  <select value={justificationType} onChange={e => setJustificationType(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                    {Object.values(AdminJustificationType).map((type: string) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-text-muted mb-1">Detalhes/Observações</label>
                  <textarea value={justificationDetails} onChange={e => setJustificationDetails(e.target.value)} rows={3} className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"></textarea>
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-text-muted mb-1">Anexar Documento</label>
                  <input ref={justificationFileRef} type="file" onChange={e => setJustificationFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-buttons file:text-text-button hover:file:opacity-90" />
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4 mt-4">
                {editingJustification && (
                  <button type="button" onClick={() => setEditingJustification(null)} className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500 transition">
                    Cancelar Edição
                  </button>
                )}
                <button type="submit" disabled={isSubmittingJustification} className="w-full flex items-center justify-center gap-2 bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50">
                  <UploadIcon className="h-5 w-5" />
                  {isSubmittingJustification ? 'Salvando...' : (editingJustification ? 'Atualizar Lançamento' : 'Salvar Lançamento')}
                </button>
              </div>
            </form>

            <div className="mt-8">
              <h3 className="text-xl font-bold text-accent mb-4">Justificativas Recebidas dos Funcionários</h3>
              <div className="space-y-4">
                {employeeJustifications.length > 0 ? (
                  employeeJustifications.map(j => <JustificationItem key={j.id} justification={j} />)
                ) : (
                  <p className="text-text-muted bg-primary p-4 rounded-md">Nenhuma justificativa recebida de funcionários.</p>
                )}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-bold text-accent mb-4">Documentos Lançados pelo Administrador</h3>
              <div className="space-y-4">
                {adminJustifications.length > 0 ? (
                  adminJustifications.map(j => <JustificationItem key={j.id} justification={j} />)
                ) : (
                  <p className="text-text-muted bg-primary p-4 rounded-md">Nenhum documento lançado pelo administrador.</p>
                )}
              </div>
            </div>
          </div>
        );
      case 'payslips':
        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-4">Enviar Contracheque</h3>
            <form onSubmit={handlePayslipSubmit} className="bg-primary p-4 rounded-lg space-y-4 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Funcionário</label>
                  <select value={payslipEmployeeId} onChange={e => setPayslipEmployeeId(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                    <option value="">Selecione um funcionário</option>
                    {users.filter(u => u.role === 'employee').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Mês de Referência</label>
                  <input type="month" onChange={e => {
                    if (e.target.value) {
                      const [year, month] = e.target.value.split('-');
                      const monthName = new Date(e.target.value + '-02').toLocaleString('pt-BR', { month: 'long' });
                      setPayslipMonth(monthName.charAt(0).toUpperCase() + monthName.slice(1));
                      setPayslipYear(parseInt(year));
                    } else {
                      setPayslipMonth('');
                      setPayslipYear(new Date().getFullYear());
                    }
                  }} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Arquivo PDF</label>
                <input type="file" accept="application/pdf" onChange={e => setPayslipFile(e.target.files ? e.target.files[0] : null)} required className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-buttons file:text-text-button hover:file:opacity-90" />
              </div>
              <button type="submit" disabled={isSubmittingPayslip} className="w-full flex items-center justify-center gap-2 bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50">
                <UploadIcon className="h-5 w-5" />
                {isSubmittingPayslip ? 'Enviando...' : 'Enviar'}
              </button>
            </form>

            <h3 className="text-xl font-bold text-accent mb-4">Contracheques Enviados</h3>
            <div className="space-y-4">
              {currentPayslips.map((p: Payslip) => {
                const employeeName = users.find(u => u.id === p.user_id)?.name || p.user_name || 'Funcionário não encontrado';
                return (
                  <div key={p.id} className="bg-primary p-4 rounded-md flex justify-between items-center">
                    <div>
                      <p className="font-bold text-text-base">{employeeName}</p>
                      <p className="text-sm text-text-muted">{p.month} de {p.year}</p>
                    </div>
                    <button onClick={() => handleDeletePayslip(p.id!)} className="text-red-500 hover:text-red-400" title="Excluir"><TrashIcon className="h-5 w-5" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'timeBank':
        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-4">Relatório de Banco de Horas</h3>
            <form onSubmit={handleGenerateTimeBankReport} className="bg-primary p-4 rounded-lg space-y-4 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Funcionário</label>
                  <select value={timeBankEmployeeId} onChange={e => setTimeBankEmployeeId(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                    <option value="">Selecione um funcionário</option>
                    {users.filter(u => u.role === 'employee').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Mês de Referência</label>
                  <input type="month" value={timeBankMonth} onChange={e => setTimeBankMonth(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                </div>
              </div>
              <button type="submit" disabled={isGeneratingTimeBank} className="w-full flex items-center justify-center gap-2 bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50">
                <CalculatorIcon className="h-5 w-5" />
                {isGeneratingTimeBank ? 'Gerando...' : 'Gerar Relatório'}
              </button>
            </form>

            {isGeneratingTimeBank && <div className="text-center p-4">Calculando banco de horas...</div>}

            {timeBankReport && (
              <div className="bg-primary p-6 rounded-lg animate-fade-in">
                <h4 className="text-lg font-bold text-accent mb-4">Resumo para {timeBankReport.employeeName} - {timeBankReport.period}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <p className="text-sm text-text-muted">Total de Horas Previstas</p>
                    <p className="font-bold text-xl">{formatMinutesToHours(timeBankReport.totalExpected)}</p>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <p className="text-sm text-text-muted">Total de Horas Realizadas</p>
                    <p className="font-bold text-xl">{formatMinutesToHours(timeBankReport.totalWorked)}</p>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <p className="text-sm text-text-muted">Saldo Final do Mês</p>
                    <p className={`font-bold text-2xl ${timeBankReport.totalBalance < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatMinutesToHours(timeBankReport.totalBalance)}</p>
                  </div>
                </div>

                <h5 className="font-bold text-accent mb-2">Detalhamento Diário</h5>
                <div className="overflow-x-auto rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-text-muted">Data</th>
                        <th className="px-4 py-2 text-left text-text-muted">Dia</th>
                        <th className="px-4 py-2 text-left text-text-muted">Previsto</th>
                        <th className="px-4 py-2 text-left text-text-muted">Realizado</th>
                        <th className="px-4 py-2 text-left text-text-muted">Saldo</th>
                        <th className="px-4 py-2 text-left text-text-muted">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {timeBankReport.dailyBalances.map((day, index) => (
                        <tr key={index} className="hover:bg-gray-800">
                          <td className="px-4 py-2">{day.date}</td>
                          <td className="px-4 py-2">{day.dayOfWeek}</td>
                          <td className="px-4 py-2">{formatMinutesToHours(day.expectedMinutes)}</td>
                          <td className="px-4 py-2">{formatMinutesToHours(day.workedMinutes)}</td>
                          <td className={`px-4 py-2 font-semibold ${day.balance < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatMinutesToHours(day.balance)}</td>
                          <td className="px-4 py-2 text-text-muted">{day.observation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case 'reportsDownload':
        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-4">Baixar Relatórios</h3>
            <form onSubmit={handleDownloadReport} className="bg-primary p-4 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Tipo de Relatório</label>
                <select value={reportType} onChange={e => setReportType(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                  <option value="timeclock">Registro de Pontos</option>
                  <option value="employeeData">Dados Cadastrais do Funcionário</option>
                  <option value="justifications">Justificativas</option>
                  <option value="timeBank">Relatório de Banco de Horas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Funcionário</label>
                <select value={reportEmployeeId} onChange={e => setReportEmployeeId(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                  <option value="">Selecione um funcionário</option>
                  <option value="all">Todos os Funcionários</option>
                  {users.filter(u => u.role === 'employee').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {reportEmployeeId === 'all' && (
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Filtrar por Setor (Opcional)</label>
                  <select value={reportSectorFilter} onChange={e => setReportSectorFilter(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                    <option value="">Todos os Setores</option>
                    {Object.values(Sector).map((sector: string) => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                </div>
              )}

              {(reportType === 'timeclock' || reportType === 'justifications' || reportType === 'timeBank') &&
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Mês de Referência</label>
                  <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                </div>
              }

              <button type="submit" className="w-full flex items-center justify-center gap-2 bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition">
                <DownloadIcon className="h-5 w-5" />
                Baixar Relatório (PDF)
              </button>
            </form>
          </div>
        );
      case 'payrollClosing':
        const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-4">Fechamento de Folha de Pagamento</h3>
            <form onSubmit={handlePreparePayroll} className="bg-primary p-4 rounded-lg space-y-4 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Funcionário</label>
                  <select
                    value={payrollEmployeeId}
                    onChange={e => {
                      setPayrollEmployeeId(e.target.value);
                      if (e.target.value !== 'all') {
                        setPayrollSectorFilter('');
                        setPayrollContractFilter('');
                      }
                    }}
                    required
                    className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"
                  >
                    <option value="">Selecione...</option>
                    <option value="all">Todos os Funcionários</option>
                    {users.filter(u => u.role === 'employee').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Mês de Referência</label>
                  <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                </div>
              </div>
              {payrollEmployeeId === 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Filtrar por Setor (Opcional)</label>
                    <select value={payrollSectorFilter} onChange={e => setPayrollSectorFilter(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                      <option value="">Todos os Setores</option>
                      {Object.values(Sector).map((sector: string) => (
                        <option key={sector} value={sector}>{sector}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Filtrar por Contrato (Opcional)</label>
                    <input
                      type="text"
                      value={payrollContractFilter}
                      onChange={e => setPayrollContractFilter(e.target.value)}
                      placeholder="Digite o contrato..."
                      className="w-full bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"
                    />
                  </div>
                </div>
              )}
              <button type="submit" className="w-full flex items-center justify-center gap-2 bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition">
                <CalculatorIcon className="h-5 w-5" />
                Preparar Lançamentos
              </button>
            </form>

            {employeesForPayrollInput && (
              <div className="bg-primary p-4 rounded-lg space-y-4 mb-8 animate-fade-in">
                <h4 className="text-lg font-bold text-accent">Lançar Descontos Variáveis (Convênio)</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {employeesForPayrollInput.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between">
                      <label className="text-text-muted">{emp.name}</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$ 0,00"
                        value={convenioValues[emp.id] || ''}
                        onChange={e => handleConvenioChange(emp.id, e.target.value)}
                        className="w-32 bg-gray-800 border-gray-700 rounded-md shadow-sm p-2 text-text-base text-right focus:ring-accent focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
                <button onClick={handleGeneratePayroll} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition">
                  <CalculatorIcon className="h-5 w-5" />
                  Calcular e Finalizar Fechamento
                </button>
              </div>
            )}


            {payrollResult && payrollResult.length > 0 && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-accent mt-8">
                    Resultados do Fechamento ({payrollResult.length} {payrollResult.length > 1 ? 'funcionários' : 'funcionário'})
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={handleDownloadPayrollReport} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-3 rounded-md hover:bg-red-700 transition">
                      <PdfIcon className="h-5 w-5" />
                      <span>Baixar PDF</span>
                    </button>
                  </div>
                </div>
                {payrollResult.map((result, index) => (
                  <div key={index} className="bg-primary p-6 rounded-lg animate-fade-in">
                    <div className="border-b-2 border-accent pb-4 mb-4">
                      <h4 className="text-2xl font-bold text-text-base">{result.employeeName}</h4>
                      <p className="text-lg text-text-muted">Resumo da Folha - {result.monthYear}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 text-center">
                      <div><p className="text-sm text-text-muted">Dias Úteis</p><p className="font-bold text-lg">{result.businessDays}</p></div>
                      <div><p className="text-sm text-text-muted">Trabalhados</p><p className="font-bold text-lg text-green-400">{result.workedDays}</p></div>
                      <div><p className="text-sm text-text-muted">Horas Trab.</p><p className="font-bold text-lg text-cyan-400">{result.workedHours.toFixed(2).replace('.', ',')}</p></div>
                      <div><p className="text-sm text-text-muted">Justificados</p><p className="font-bold text-lg text-blue-400">{result.justifiedDays}</p></div>
                      <div><p className="text-sm text-text-muted">Faltas</p><p className="font-bold text-lg text-red-400">{result.absentDays}</p></div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-6 text-center">
                      <div className="p-3 bg-gray-800 rounded-lg">
                        <p className="text-sm text-text-muted">Salário Base (Contratual)</p>
                        <p className="font-bold text-xl text-text-base">{formatCurrency(result.baseSalary)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h5 className="font-bold text-green-400 text-lg mb-2">PROVENTOS</h5>
                        <div className="space-y-1">
                          {result.earnings.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex justify-between text-text-base">
                              <span>{item.description}</span>
                              <span>{formatCurrency(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="font-bold text-red-400 text-lg mb-2">DESCONTOS</h5>
                        <div className="space-y-1">
                          {result.deductions.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex justify-between text-text-base">
                              <span>{item.description}</span>
                              <span>{formatCurrency(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-700 mt-6 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="p-2 bg-green-900 rounded">
                          <p className="text-sm text-green-300">Salário Bruto (Proventos)</p>
                          <p className="font-bold text-xl text-white">{formatCurrency(result.totalEarnings)}</p>
                        </div>
                        <div className="p-2 bg-red-900 rounded">
                          <p className="text-sm text-red-300">Total de Descontos</p>
                          <p className="font-bold text-xl text-white">{formatCurrency(result.totalDeductions)}</p>
                        </div>
                        <div className="p-2 bg-accent rounded">
                          <p className="text-sm text-text-button">Líquido a Receber</p>
                          <p className="font-bold text-2xl text-text-button">{formatCurrency(result.netPay)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-gray-700 mt-6 pt-4">
                      <h5 className="font-bold text-text-muted text-lg mb-2">Encargos do Empregador</h5>
                      {result.employerCharges.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex justify-between text-text-muted">
                          <span>{item.description}</span>
                          <span>{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'settings':
        return (
          <div>
            <h3 className="text-xl font-bold text-accent mb-6">Configurações Gerais</h3>
            <form onSubmit={handleSettingsSave} className="space-y-6">
              <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Dados da Empresa</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-text-muted mb-1">Logotipo da Empresa</label>
                    <div className="flex items-center gap-4">
                      {themeSettings.companySettings.logoUrl ? (
                        <img src={themeSettings.companySettings.logoUrl} alt="Logotipo" className="h-16 w-16 rounded-full object-cover bg-primary" />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-accent font-bold text-2xl border border-gray-600">
                          SG
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <input
                          ref={logoFileInputRef}
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                        <label htmlFor="logo-upload" className="cursor-pointer bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-blue-700 transition text-center">
                          {themeSettings.companySettings.logoUrl ? 'Alterar' : 'Adicionar Logotipo'}
                        </label>
                        {themeSettings.companySettings.logoUrl && (
                          <button type="button" onClick={handleDeleteLogo} className="bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-red-700 transition">
                            Apagar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Nome da Empresa</label>
                    <input type="text" name="companyName" value={themeSettings.companySettings.companyName} onChange={handleCompanySettingsChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">CNPJ</label>
                    <input type="text" name="cnpj" value={themeSettings.companySettings.cnpj} onChange={handleCompanySettingsChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Razão Social</label>
                    <input type="text" name="legalName" value={themeSettings.companySettings.legalName} onChange={handleCompanySettingsChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">E-mail de Contato/Suporte</label>
                    <input type="email" name="contactEmail" value={themeSettings.companySettings.contactEmail} onChange={handleCompanySettingsChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-text-muted mb-1">Endereço da Sede</label>
                    <input type="text" name="address" value={themeSettings.companySettings.address} onChange={handleCompanySettingsChange} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Horário de Trabalho Padrão (Global)</legend>
                <p className="text-xs text-text-muted mb-4">Este é o horário aplicado caso não haja um horário específico por setor ou por funcionário.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Entrada</label>
                    <TimePicker
                      value={themeSettings.companySettings.workStartTime}
                      onChange={(value) => handleCompanySettingsChange({ target: { name: 'workStartTime', value } } as React.ChangeEvent<HTMLInputElement>)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Saída Almoço</label>
                    <TimePicker
                      value={themeSettings.companySettings.lunchStartTime}
                      onChange={(value) => handleCompanySettingsChange({ target: { name: 'lunchStartTime', value } } as React.ChangeEvent<HTMLInputElement>)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Retorno Almoço</label>
                    <TimePicker
                      value={themeSettings.companySettings.lunchEndTime}
                      onChange={(value) => handleCompanySettingsChange({ target: { name: 'lunchEndTime', value } } as React.ChangeEvent<HTMLInputElement>)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Saída Final</label>
                    <TimePicker
                      value={themeSettings.companySettings.workEndTime}
                      onChange={(value) => handleCompanySettingsChange({ target: { name: 'workEndTime', value } } as React.ChangeEvent<HTMLInputElement>)}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Horário de Trabalho por Setor</legend>
                <div className="space-y-4">
                  {Object.values(Sector).map(sector => (
                    <div key={sector}>
                      <h4 className="font-semibold text-text-base">{sector}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mt-1">
                        <div>
                          <label className="block text-xs font-medium text-text-muted">Entrada</label>
                          <TimePicker
                            size="small"
                            value={themeSettings.sectorWorkHours[sector]?.workStartTime || ''}
                            onChange={value => handleSectorHoursChange(sector, 'workStartTime', value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted">Saída Almoço</label>
                          <TimePicker
                            size="small"
                            value={themeSettings.sectorWorkHours[sector]?.lunchStartTime || ''}
                            onChange={value => handleSectorHoursChange(sector, 'lunchStartTime', value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted">Retorno Almoço</label>
                          <TimePicker
                            size="small"
                            value={themeSettings.sectorWorkHours[sector]?.lunchEndTime || ''}
                            onChange={value => handleSectorHoursChange(sector, 'lunchEndTime', value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted">Saída Final</label>
                          <TimePicker
                            size="small"
                            value={themeSettings.sectorWorkHours[sector]?.workEndTime || ''}
                            onChange={value => handleSectorHoursChange(sector, 'workEndTime', value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Personalização</legend>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">Tema</label>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center">
                        <input type="radio" name="theme" value="dark" checked={themeSettings.theme === 'dark'} onChange={handleThemeSettingChange} className="form-radio h-4 w-4 text-accent bg-primary border-gray-600 focus:ring-accent" />
                        <span className="ml-2 text-text-base">Escuro</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="theme" value="light" checked={themeSettings.theme === 'light'} onChange={handleThemeSettingChange} className="form-radio h-4 w-4 text-accent bg-primary border-gray-600 focus:ring-accent" />
                        <span className="ml-2 text-text-base">Claro</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Cores do Painel (Tema Escuro)</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <input type="color" name="primary" value={themeSettings.colors.primary} onChange={handleThemeSettingChange} className="h-8 w-8 rounded border-none bg-transparent" />
                        <label className="text-sm text-text-muted">Primária</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" name="secondary" value={themeSettings.colors.secondary} onChange={handleThemeSettingChange} className="h-8 w-8 rounded border-none bg-transparent" />
                        <label className="text-sm text-text-muted">Secundária</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" name="accent" value={themeSettings.colors.accent} onChange={handleThemeSettingChange} className="h-8 w-8 rounded border-none bg-transparent" />
                        <label className="text-sm text-text-muted">Destaque</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" name="buttons" value={themeSettings.colors.buttons} onChange={handleThemeSettingChange} className="h-8 w-8 rounded border-none bg-transparent" />
                        <label className="text-sm text-text-muted">Botões</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" name="textBase" value={themeSettings.colors.textBase} onChange={handleThemeSettingChange} className="h-8 w-8 rounded border-none bg-transparent" />
                        <label className="text-sm text-text-muted">Texto Principal</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" name="textMuted" value={themeSettings.colors.textMuted} onChange={handleThemeSettingChange} className="h-8 w-8 rounded border-none bg-transparent" />
                        <label className="text-sm text-text-muted">Texto Secundário</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" name="textButton" value={themeSettings.colors.textButton} onChange={handleThemeSettingChange} className="h-8 w-8 rounded border-none bg-transparent" />
                        <label className="text-sm text-text-muted">Texto Botão</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Mensagem inicial na tela de login</label>
                    <textarea name="loginMessage" value={themeSettings.loginMessage} onChange={handleThemeSettingChange} rows={2} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent"></textarea>
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-gray-600 p-4 rounded-md">
                <legend className="px-2 text-accent font-medium">Credenciais do Administrador</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Login do Administrador</label>
                    <input type="text" name="username" value={adminCredentials.username} onChange={handleAdminCredentialsChange} required className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Nova Senha</label>
                    <input type="password" name="password" value={adminCredentials.password} onChange={handleAdminCredentialsChange} placeholder="Deixe em branco para não alterar" className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                  </div>
                </div>
              </fieldset>

              <div className="flex justify-end">
                <button type="submit" className="bg-buttons text-text-button font-bold py-2 px-6 rounded-md hover:opacity-90 transition">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="bg-secondary rounded-lg shadow-lg p-4">
              <h2 className="text-lg font-bold text-accent mb-4">Menu do Administrador</h2>
              <nav className="space-y-2">
                <button onClick={() => setActiveTab('employees')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'employees' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <UserGroupIcon className="h-6 w-6" />
                  <span>Funcionários</span>
                </button>
                <button onClick={() => setActiveTab('registerAccess')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'registerAccess' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <KeyIcon className="h-6 w-6" />
                  <span>Cadastrar Acessos</span>
                </button>
                <button onClick={() => setActiveTab('timeclock')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'timeclock' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <ClockIcon className="h-6 w-6" />
                  <span>Registros de Ponto</span>
                </button>
                <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'reports' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <DocumentReportIcon className="h-6 w-6" />
                  <span>Relatórios de Serviço</span>
                </button>
                <button onClick={() => setActiveTab('justifications')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'justifications' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <DocumentReportIcon className="h-6 w-6" />
                  <span>Justificativas</span>
                </button>
                <button onClick={() => setActiveTab('payslips')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'payslips' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <DocumentReportIcon className="h-6 w-6" />
                  <span>Contracheques</span>
                </button>
                <button onClick={() => setActiveTab('timeBank')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'timeBank' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <ClockIcon className="h-6 w-6" />
                  <span>Banco de Horas</span>
                </button>
                <button onClick={() => setActiveTab('reportsDownload')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'reportsDownload' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <DownloadIcon className="h-6 w-6" />
                  <span>Baixar Relatórios</span>
                </button>
                <button onClick={() => setActiveTab('payrollClosing')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'payrollClosing' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <CalculatorIcon className="h-6 w-6" />
                  <span>Fechamento de folha</span>
                </button>
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition ${activeTab === 'settings' ? 'bg-accent text-text-button' : 'text-text-muted hover:bg-primary'}`}>
                  <CogIcon className="h-6 w-6" />
                  <span>Configurações</span>
                </button>
              </nav>
            </div>
          </aside>
          <div className="lg:col-span-3">
            <div className="bg-secondary rounded-lg shadow-lg p-6 min-h-[600px]">
              {fetchError && (
                <div className="bg-yellow-900 border border-yellow-600 text-yellow-200 px-4 py-3 rounded relative mb-4" role="alert">
                  <strong className="font-bold">Aviso de Configuração: </strong>
                  <span className="block sm:inline">{fetchError}</span>
                </div>
              )}
              {renderContent()}
            </div>
          </div>
        </div>
      </main>
      {isModalOpen && <EmployeeFormModal employee={selectedEmployee} onClose={() => setIsModalOpen(false)} onSave={handleSaveEmployee} />}
      {confirmationModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
          <div className="bg-secondary p-6 md:p-8 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold text-accent mb-4">{confirmationModal.title}</h3>
            <p className="text-text-muted mb-6 whitespace-pre-wrap">{confirmationModal.message}</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={closeConfirmationModal}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
