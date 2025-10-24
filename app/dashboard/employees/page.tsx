'use client';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { User, ClockType, TimeClockEntry, ServiceReport, Justification, Payslip, LocationData, Role } from '../../../typings';
import { CameraIcon, LocationMarkerIcon, ClockIcon } from '../../../components/icons';
import { useGeolocation } from '../../../hooks/useGeolocation';
import * as api from '../../../services/api';
import { AuthContext } from '../../providers';

const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isToday = (someDate: Date) => {
  const today = new Date();
  return someDate.getDate() === today.getDate() &&
    someDate.getMonth() === today.getMonth() &&
    someDate.getFullYear() === today.getFullYear();
};

const EmployeeDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [lastClock, setLastClock] = useState<ClockType | null>(null);
  const [isClockedOutForDay, setIsClockedOutForDay] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentClockType, setCurrentClockType] = useState<ClockType | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ponto');
  
  const [timeEntries, setTimeEntries] = useState<TimeClockEntry[]>([]);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);


  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: location, error: locationError, loading: locationLoading, getLocation } = useGeolocation();
  
  const [serviceClient, setServiceClient] = useState('');
  const [servicePhoto, setServicePhoto] = useState<File | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isSignatureEmpty, setIsSignatureEmpty] = useState(true);

  // State for the justification form
  const [justificationOccurrenceDate, setJustificationOccurrenceDate] = useState('');
  const [justificationHour, setJustificationHour] = useState('');
  const [justificationMinute, setJustificationMinute] = useState('');
  const [justificationReason, setJustificationReason] = useState('Esquecimento');
  const [justificationDetails, setJustificationDetails] = useState('');
  const [justificationAttachment, setJustificationAttachment] = useState<File | null>(null);


  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [timeEntriesData, serviceReportsData, justificationsData, payslipsData] = await Promise.all([
                api.getTimeEntries(user.id),
                api.getServiceReports(user.id),
                api.getJustifications(user.id),
                api.getPayslips(user.id),
            ]);

            setTimeEntries(timeEntriesData);
            setServiceReports(serviceReportsData);
            setJustifications(justificationsData);
            setPayslips(payslipsData);
            
            const lastEntryToday = timeEntriesData
                .filter(e => isToday(new Date(e.timestamp)))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            
            if (lastEntryToday) {
                setLastClock(lastEntryToday.type);
                 if (lastEntryToday.type === ClockType.SAIDA) {
                    setIsClockedOutForDay(true);
                }
            } else {
                 setIsClockedOutForDay(false);
                 setLastClock(null);
            }

        } catch (err) {
            console.error("Erro ao buscar dados:", err);
            setError("Não foi possível carregar seus dados.");
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [user.id]);
  
    useEffect(() => {
    if (activeTab === 'servicos' && signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      let drawing = false;

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        drawing = true;
        ctx.beginPath();
        const pos = getMousePos(canvas, e);
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!drawing) return;
        e.preventDefault();
        const pos = getMousePos(canvas, e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        setIsSignatureEmpty(false);
      };

      const stopDrawing = () => {
        drawing = false;
      };
      
      const getMousePos = (canvasDom: HTMLCanvasElement, event: MouseEvent | TouchEvent) => {
        const rect = canvasDom.getBoundingClientRect();
        if (event instanceof MouseEvent) {
          return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          };
        }
        if (event.touches[0]) {
           return {
            x: event.touches[0].clientX - rect.left,
            y: event.touches[0].clientY - rect.top
          };
        }
        return { x: 0, y: 0 };
      };

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);
      canvas.addEventListener('mouseout', stopDrawing);
      
      canvas.addEventListener('touchstart', startDrawing);
      canvas.addEventListener('touchmove', draw);
      canvas.addEventListener('touchend', stopDrawing);

      return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('mouseout', stopDrawing);
        
        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
      };
    }
  }, [activeTab]);

  const clearSignature = () => {
    if (signatureCanvasRef.current) {
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        setIsSignatureEmpty(true);
    }
  };


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsCapturing(false);
    }
  };
  
  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
  };

  const handleClockButtonClick = (type: ClockType) => {
    setError('');
    setCurrentClockType(type);
    setIsCapturing(true);
    getLocation();
    startCamera();
  };

  const takePhoto = (): Promise<File> => {
    return new Promise((resolve, reject) => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(new File([blob], `ponto_${Date.now()}.jpg`, { type: 'image/jpeg' }));
                } else {
                    reject(new Error('Falha ao criar blob da imagem.'));
                }
            }, 'image/jpeg');
        } else {
            reject(new Error('Referências de vídeo ou canvas não encontradas.'));
        }
    });
};

  const confirmClockIn = async () => {
    if (!currentClockType) return;
    setSubmitting(true);
    setError('');

    if (locationError || !location) {
        setError('Não foi possível obter a localização. Verifique as permissões e tente novamente.');
        setSubmitting(false);
        return;
    }

    try {
        const photoFile = await takePhoto();
        const photoUrl = await api.uploadFile(photoFile, `points/${user.id}/${photoFile.name}`);

        const plainLocation: LocationData | null = location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            altitude: location.altitude,
            altitudeAccuracy: location.altitudeAccuracy,
            heading: location.heading,
            speed: location.speed,
        } : null;

        const newEntry: Omit<TimeClockEntry, 'id' | 'criado_em'> = {
            user_id: user.id,
            user_name: user.name,
            type: currentClockType,
            timestamp: new Date(),
            location: plainLocation,
            photo: photoUrl,
        };

        const savedEntry = await api.addTimeEntry(newEntry);
        setTimeEntries(prev => [savedEntry, ...prev]);
        setLastClock(currentClockType);

        if (currentClockType === ClockType.SAIDA) {
            setIsClockedOutForDay(true);
        }
        cancelCapture();
    } catch (err) {
        // This is a more robust error handler to extract a clear message
        let errorMessage = 'Ocorreu um erro desconhecido.';
        if (typeof err === 'object' && err !== null) {
            // Supabase errors have a 'message' property
            if ('message' in err) {
                errorMessage = (err as { message: string }).message;
            }
        } else if (typeof err === 'string') {
            errorMessage = err;
        }

        console.error("Erro completo ao registrar ponto:", err);
        setError(`Erro ao registrar ponto: ${errorMessage}`);
    } finally {
        setSubmitting(false);
    }
  };
  
  const cancelCapture = () => {
    stopCamera();
    setIsCapturing(false);
    setCurrentClockType(null);
  };
  
  const clockButtons: { type: ClockType; label: string; color: string; next?: ClockType[] }[] = [
    { type: ClockType.ENTRADA, label: 'Entrada', color: 'bg-green-600', next: [ClockType.SAIDA_ALMOCO, ClockType.SAIDA] },
    { type: ClockType.SAIDA_ALMOCO, label: 'Saída Almoço', color: 'bg-blue-600', next: [ClockType.RETORNO_ALMOCO] },
    { type: ClockType.RETORNO_ALMOCO, label: 'Retorno Almoço', color: 'bg-blue-600', next: [ClockType.SAIDA] },
    { type: ClockType.SAIDA, label: 'Saída Final', color: 'bg-red-600' },
  ];

  const getIsButtonDisabled = (type: ClockType) => {
    if (isClockedOutForDay) return true;
    if (lastClock === null) return type !== ClockType.ENTRADA;
    const lastClockConfig = clockButtons.find(b => b.type === lastClock);
    return !lastClockConfig?.next?.includes(type);
  };
  
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid data URL');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  const handleServiceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; // Store form reference before async operations
    if (!serviceClient || !servicePhoto || isSignatureEmpty || !signatureCanvasRef.current) {
        alert('Por favor, preencha todos os campos, incluindo a foto e a assinatura.');
        return;
    }
    setSubmitting(true);
    try {
        const signatureDataUrl = signatureCanvasRef.current.toDataURL('image/png');
        const signatureFile = dataURLtoFile(signatureDataUrl, `signature_${Date.now()}.png`);

        const [photoUrl, signatureUrl] = await Promise.all([
            api.uploadFile(servicePhoto, `reports/photos/${user.id}/${servicePhoto.name}`),
            api.uploadFile(signatureFile, `reports/signatures/${user.id}/${signatureFile.name}`)
        ]);

        const newReport: Omit<ServiceReport, 'id' | 'criado_em'> = {
            user_id: user.id,
            user_name: user.name,
            timestamp: new Date(),
            client: serviceClient,
            photo: photoUrl,
            signature: signatureUrl,
        };
        
        const savedReport = await api.addServiceReport(newReport);
        setServiceReports(prev => [savedReport, ...prev]);
        
        alert('Relatório de serviço enviado com sucesso!');
        setServiceClient('');
        setServicePhoto(null);
        clearSignature();
        form.reset();
    } catch (err: any) {
        let errorMessage = 'Ocorreu um erro desconhecido. Tente novamente.';
        if (typeof err === 'object' && err !== null && err.message) {
            errorMessage = err.message;
        } else if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        }

        console.error("Erro completo ao enviar relatório:", errorMessage);
        alert(`Erro ao enviar relatório: ${errorMessage}`);
    } finally {
        setSubmitting(false);
    }
  };
  
  const handleJustificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      // Validação usando os estados de controle direto (hora e minuto)
      if (!justificationOccurrenceDate || !justificationHour || !justificationMinute || !justificationDetails) {
          alert('Por favor, preencha a data, a hora e os detalhes da justificativa.');
          return;
      }
      setSubmitting(true);
      try {
        let attachmentUrl: string | undefined = undefined;
        if (justificationAttachment) {
            attachmentUrl = await api.uploadFile(justificationAttachment, `justifications/${user.id}/${justificationAttachment.name}`);
        }
        
        // Construção dos valores de data/hora dentro do handler para evitar "stale state"
        const occurrenceTime = `${justificationHour}:${justificationMinute}`;
        const combinedDateTime = `${justificationOccurrenceDate}T${occurrenceTime}`;

        const newJustification: Partial<Justification> = {
            user_id: user.id,
            user_name: user.name,
            timestamp: new Date(),
            date: combinedDateTime,
            start_date: justificationOccurrenceDate,
            time: occurrenceTime,
            reason: justificationReason,
            details: justificationDetails,
            attachment: attachmentUrl,
            status: 'pending',
        };
      
        const savedJustification = await api.saveJustification(newJustification);
        setJustifications(prev => [savedJustification, ...prev]);
        
        alert('Justificativa enviada para análise.');
        setJustificationOccurrenceDate('');
        setJustificationHour('');
        setJustificationMinute('');
        setJustificationReason('Esquecimento');
        setJustificationDetails('');
        setJustificationAttachment(null);
        form.reset();
      } catch (err: any) {
          let errorMessage = 'Ocorreu um erro desconhecido. Tente novamente.';
          if (typeof err === 'object' && err !== null && err.message) {
              errorMessage = err.message;
          } else if (err instanceof Error) {
              errorMessage = err.message;
          } else if (typeof err === 'string') {
              errorMessage = err;
          }
          console.error("Erro ao enviar justificativa:", errorMessage);
          alert(`Erro ao enviar justificativa: ${errorMessage}`);
      } finally {
        setSubmitting(false);
      }
  };

  // Options for the time dropdowns
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')); // 00, 05, 10, ... 55

  return (
    <div className="min-h-screen flex flex-col">
      {isCapturing && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-secondary p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h3 className="text-xl font-bold text-accent mb-4">Registrar Ponto: {currentClockType}</h3>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-md bg-black"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            {error && <p className="text-red-500 my-2 text-center">{error}</p>}
            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-text-muted">
                    {locationLoading && <p>Obtendo localização...</p>}
                    {locationError && <p className="text-red-400">Erro de localização: {locationError.message}</p>}
                    {location && <p className="text-green-400">Localização obtida com sucesso.</p>}
                </div>
                <div className="flex gap-4">
                    <button onClick={cancelCapture} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-600 transition" disabled={submitting}>Cancelar</button>
                    <button onClick={confirmClockIn} className="bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={locationLoading || !!locationError || submitting}>
                        <CameraIcon className="w-5 h-5 inline-block mr-2" />
                        {submitting ? 'Salvando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex-grow p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-accent">Painel do Colaborador</h2>
            <p className="text-text-muted">Bem-vindo(a), {user.name}!</p>
          </div>

          <div className="mb-6 border-b border-gray-700">
            <nav className="flex space-x-4">
              {['ponto', 'servicos', 'justificativas', 'contracheques'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition capitalize rounded-t-lg ${activeTab === tab ? 'bg-secondary text-accent border-b-2 border-accent' : 'text-text-muted hover:bg-primary'}`}
                >
                  {tab === 'ponto' ? 'Registro de Ponto' : tab === 'servicos' ? 'Relatório de Serviço' : tab === 'contracheques' ? 'Contracheques' : 'Justificativas'}
                </button>
              ))}
            </nav>
          </div>
          
          {loading ? (
             <div className="text-center p-8 text-text-muted">Carregando seus dados...</div>
          ) : error && activeTab !== 'ponto' ? ( // Only show global error on other tabs
             <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Erro: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
          ) : (
            <div>
              {activeTab === 'ponto' && (
                <div className="bg-secondary shadow-lg rounded-lg p-6">
                    {error && !isCapturing && (
                        <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded relative mb-4" role="alert">
                           <strong className="font-bold">Erro: </strong>
                           <span className="block sm:inline">{error}</span>
                       </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {clockButtons.map(({ type, label, color }) => (
                            <button
                                key={type}
                                onClick={() => handleClockButtonClick(type)}
                                disabled={getIsButtonDisabled(type)}
                                className={`w-full font-bold py-3 px-2 rounded-lg text-white transition flex flex-col items-center justify-center gap-2 ${color} ${getIsButtonDisabled(type) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                            >
                                <ClockIcon className="h-6 w-6" />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                    {isClockedOutForDay && <p className="text-center text-yellow-400 mb-4">Você já realizou a saída final por hoje. Volte amanhã!</p>}

                    <h3 className="text-lg font-bold text-accent mb-4">Seus registros de hoje:</h3>
                    <div className="space-y-3">
                        {timeEntries
                            .filter(e => isToday(new Date(e.timestamp)))
                            .map(entry => (
                                <div key={entry.id} className="bg-primary p-3 rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-text-base">{entry.type}</p>
                                        <p className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</p>

                                    </div>
                                    <div className="flex items-center gap-4">
                                        <LocationMarkerIcon className="h-5 w-5 text-blue-400" title={`Lat: ${entry.location?.latitude.toFixed(4)}, Lon: ${entry.location?.longitude.toFixed(4)}`}/>
                                        <a href={entry.photo} target="_blank" rel="noopener noreferrer">
                                            <CameraIcon className="h-5 w-5 text-green-400" title="Ver foto"/>
                                        </a>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
              )}
              
              {activeTab === 'servicos' && (
                 <div className="bg-secondary shadow-lg rounded-lg p-6">
                    <h3 className="text-lg font-bold text-accent mb-4">Enviar Novo Relatório de Serviço</h3>
                     <form onSubmit={handleServiceSubmit} className="space-y-4">
                         <div>
                             <label className="block text-sm font-medium text-text-muted mb-1">Cliente/Obra</label>
                             <input type="text" value={serviceClient} onChange={e => setServiceClient(e.target.value)} required className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                         </div>
                          <div>
                             <label className="block text-sm font-medium text-text-muted mb-1">Foto do Serviço</label>
                             <input type="file" accept="image/*" onChange={e => setServicePhoto(e.target.files ? e.target.files[0] : null)} required className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-buttons file:text-text-button hover:file:opacity-90"/>
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Assinatura do Responsável</label>
                             <canvas ref={signatureCanvasRef} width="400" height="200" className="bg-white rounded-md w-full"></canvas>
                             <button type="button" onClick={clearSignature} className="text-xs text-text-muted hover:text-accent mt-1">Limpar Assinatura</button>
                         </div>
                         <button type="submit" disabled={submitting} className="w-full bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50">{submitting ? 'Enviando...' : 'Enviar Relatório'}</button>
                     </form>
                      <h3 className="text-lg font-bold text-accent my-4">Seus Relatórios Enviados</h3>
                       <div className="space-y-3">
                        {serviceReports.map(report => (
                           <div key={report.id} className="bg-primary p-3 rounded-md">
                               <p className="font-semibold text-text-base">{report.client}</p>
                               <p className="text-xs text-text-muted">{new Date(report.timestamp).toLocaleString('pt-BR')}</p>
                           </div>
                        ))}
                       </div>
                 </div>
              )}

              {activeTab === 'justificativas' && (
                  <div className="bg-secondary shadow-lg rounded-lg p-6">
                    <h3 className="text-lg font-bold text-accent mb-4">Enviar Nova Justificativa</h3>
                     <form onSubmit={handleJustificationSubmit} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Data da Ocorrência</label>
                                <input type="date" value={justificationOccurrenceDate} onChange={e => setJustificationOccurrenceDate(e.target.value)} required className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Hora da Ocorrência</label>
                                <div className="flex gap-2">
                                    <select value={justificationHour} onChange={e => setJustificationHour(e.target.value)} required className="w-1/2 bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                                        <option value="">Hora</option>
                                        {hours.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <select value={justificationMinute} onChange={e => setJustificationMinute(e.target.value)} required className="w-1/2 bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                                        <option value="">Min</option>
                                        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                         </div>
                          <div>
                             <label className="block text-sm font-medium text-text-muted mb-1">Motivo</label>
                             <select value={justificationReason} onChange={e => setJustificationReason(e.target.value)} className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent">
                                 <option>Esquecimento</option>
                                 <option>Problemas técnicos</option>
                                 <option>Atestado médico</option>
                                 <option>Outros</option>
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-text-muted mb-1">Detalhes</label>
                             <textarea rows={3} value={justificationDetails} onChange={e => setJustificationDetails(e.target.value)} required className="w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent" placeholder="Descreva o que aconteceu."></textarea>
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-text-muted mb-1">Anexo (Opcional)</label>
                             <input type="file" onChange={e => setJustificationAttachment(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-buttons file:text-text-button hover:file:opacity-90"/>
                         </div>
                         <button type="submit" disabled={submitting} className="w-full bg-buttons text-text-button font-bold py-2 px-4 rounded-md hover:opacity-90 transition disabled:opacity-50">{submitting ? 'Enviando...' : 'Enviar para Análise'}</button>
                     </form>
                     <h3 className="text-lg font-bold text-accent my-4">Suas Justificativas</h3>
                       <div className="space-y-3">
                        {justifications.map(j => (
                           <div key={j.id} className="bg-primary p-3 rounded-md flex justify-between items-center">
                               <div>
                                   <p className="font-semibold text-text-base">{j.reason}</p>
                                   <p className="text-xs text-text-muted">{new Date(j.timestamp).toLocaleDateString('pt-BR')}</p>
                               </div>
                               <span className={`px-2 py-1 text-xs font-bold rounded-full ${j.status === 'approved' ? 'bg-green-600' : j.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-500'} text-white`}>{j.status}</span>
                           </div>
                        ))}
                       </div>
                  </div>
              )}
              
              {activeTab === 'contracheques' && (
                  <div className="bg-secondary shadow-lg rounded-lg p-6">
                      <h3 className="text-lg font-bold text-accent mb-4">Seus Contracheques</h3>
                       <div className="space-y-3">
                           {payslips.length > 0 ? payslips.map(p => (
                               <div key={p.id} className="bg-primary p-3 rounded-md flex justify-between items-center">
                                   <div>
                                       <p className="font-semibold text-text-base">{p.month} de {p.year}</p>
                                   </div>
                                   <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="bg-buttons text-text-button text-sm font-bold py-1 px-3 rounded-md hover:opacity-90 transition">
                                       Visualizar
                                   </a>
                               </div>
                           )) : <p className="text-text-muted">Nenhum contracheque encontrado.</p>}
                       </div>
                  </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};


// Page component that handles auth state
export default function EmployeeDashboardPage() {
    const { user, loadingSession } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (!loadingSession && (!user || user.role !== Role.EMPLOYEE)) {
            router.replace('/auth');
        }
    }, [user, loadingSession, router]);

    if (loadingSession || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-primary text-text-muted">
                Verificando acesso...
            </div>
        );
    }
    
    return <EmployeeDashboard user={user} />;
}