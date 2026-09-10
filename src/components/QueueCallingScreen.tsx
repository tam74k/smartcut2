import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Volume2, VolumeX, Phone, CheckCircle2, Clock, 
  Scissors, Search, UserCheck, XCircle, AlertTriangle, 
  Sparkles, Plus, ExternalLink, RefreshCw, Radio, UserX, ArrowRight, Eye, Play,
  Printer
} from 'lucide-react';
import { AppSettings, Branch, Employee, QueueTicket, Client, HeldInvoice } from '../types';
import { QueueService } from '../services/queueService';
import { AuthService } from '../services/auth';
import { printQueueSlipDirect } from '../utils/printQueueSlip';
import { DB } from '../services/db';

interface QueueCallingScreenProps {
  settings: AppSettings;
  branches: Branch[];
  activeBranchId: string;
  employees: Employee[];
  clients: Client[];
  onNavigateScreen?: (screen: string) => void;
  onCompleteAndOpenPOS?: (heldInvoice: HeldInvoice | null, ticket: QueueTicket) => void;
}

export function QueueCallingScreen({
  settings,
  branches,
  activeBranchId,
  employees,
  clients,
  onNavigateScreen,
  onCompleteAndOpenPOS
}: QueueCallingScreenProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || branches[0]?.id || 'b-main');
  const [tickets, setTickets] = useState<QueueTicket[]>(() => QueueService.getTickets(settings.salonId, selectedBranchId));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'called' | 'in_service' | 'completed' | 'no_show'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Manual Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');

  // Assign Employee Modal
  const [assigningTicket, setAssigningTicket] = useState<QueueTicket | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');

  // Auto-refresh & Supabase Real-time Sync
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const list = await QueueService.fetchTicketsAsync(settings.salonId, selectedBranchId);
      if (isMounted) {
        setTickets(list);
      }
    };

    load();

    // 1. اشتراك لحظي عبر Real-time WebSockets
    const unsubscribe = QueueService.subscribe(settings.salonId, () => {
      load();
    });

    // 2. فحص متكرر (Polling) كل 2.5 ثانية كضمان استقرار إضافي
    const interval = setInterval(load, 2500);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [settings.salonId, selectedBranchId]);

  const activeBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

  // Sound Chime & Arabic Text-to-Speech
  const announceCustomer = (ticket: QueueTicket, empName?: string) => {
    if (!soundEnabled) return;

    // 1. Play synthesized chime
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      }
    } catch {}

    // 2. Arabic Voice TTS Announcement
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // clear previous
        const text = empName 
          ? `عميل رقم ${ticket.queueNumber}، يرجى التوجه إلى ${empName}`
          : `عميل رقم ${ticket.queueNumber}`;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        // Try to pick an Arabic voice if available
        const voices = window.speechSynthesis.getVoices();
        const arVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arVoice) utterance.voice = arVoice;

        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 300);
      }
    } catch (e) {
      console.warn('Speech synthesis failed:', e);
    }
  };

  // Next Waiting Customer
  const nextWaitingCustomer = useMemo(() => {
    return tickets.find(t => t.status === 'waiting');
  }, [tickets]);

  // Statistics
  const stats = useMemo(() => {
    return {
      waiting: tickets.filter(t => t.status === 'waiting').length,
      called: tickets.filter(t => t.status === 'called').length,
      inService: tickets.filter(t => t.status === 'in_service').length,
      completed: tickets.filter(t => t.status === 'completed').length,
      noShow: tickets.filter(t => t.status === 'no_show' || t.status === 'cancelled').length,
      total: tickets.length
    };
  }, [tickets]);

  // Call Next in Turn
  const handleCallNext = () => {
    if (!nextWaitingCustomer) {
      alert('لا يوجد عملاء بانتظار الدور حالياً في هذا الفرع');
      return;
    }
    handleCallSpecific(nextWaitingCustomer);
  };

  // Call Specific Customer (Manual or Out of order)
  const handleCallSpecific = async (ticket: QueueTicket) => {
    const updated = await QueueService.updateTicket(ticket.id, {
      status: 'called',
      calledAt: new Date().toISOString()
    });
    if (updated) {
      setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
      announceCustomer(updated, updated.assignedEmployeeName);
    }
  };

  // Assign to Employee & Move to In-Service
  const handleConfirmAssign = async () => {
    if (!assigningTicket) return;
    const emp = employees.find(e => e.id === selectedEmpId);
    const updated = await QueueService.updateTicket(assigningTicket.id, {
      status: 'in_service',
      assignedEmployeeId: emp?.id || undefined,
      assignedEmployeeName: emp?.name || undefined
    });
    if (updated) {
      setTickets(prev => prev.map(t => t.id === assigningTicket.id ? updated : t));
      if (emp) {
        announceCustomer(updated, emp.name);
      }
    }
    setAssigningTicket(null);
    setSelectedEmpId('');
  };

  // Save Assignment Only (Without Starting Service - Tawkset / Distribution in advance)
  const handleSaveAssignOnly = async () => {
    if (!assigningTicket) return;
    const emp = employees.find(e => e.id === selectedEmpId);
    const updated = await QueueService.updateTicket(assigningTicket.id, {
      assignedEmployeeId: emp?.id || undefined,
      assignedEmployeeName: emp?.name || undefined
    });
    if (updated) {
      setTickets(prev => prev.map(t => t.id === assigningTicket.id ? updated : t));
    }
    setAssigningTicket(null);
    setSelectedEmpId('');
  };

  // Clear / Unassign Employee
  const handleClearAssign = async () => {
    if (!assigningTicket) return;
    const updated = await QueueService.updateTicket(assigningTicket.id, {
      assignedEmployeeId: undefined,
      assignedEmployeeName: undefined
    });
    if (updated) {
      setTickets(prev => prev.map(t => t.id === assigningTicket.id ? updated : t));
    }
    setAssigningTicket(null);
    setSelectedEmpId('');
  };

  // Mark Completed
  const handleMarkCompleted = async (ticketId: string) => {
    const updated = await QueueService.updateTicket(ticketId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    if (updated) {
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
    }
  };

  // تأكيد اكتمال الخدمة للعميل المنادى عليه وفتح فاتورته المعلقة فوراً في شاشة نقطة البيع (POS)
  const handleCompleteAndOpenPOS = async (ticket: QueueTicket) => {
    // 1. تحديث حالة التذكرة إلى مكتمل
    const updated = await QueueService.updateTicket(ticket.id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    if (updated) {
      setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
    }

    // 2. العثور على الفاتورة المعلقة المقترنة بالعميل / الدور
    let matchedHeld: HeldInvoice | null = null;
    try {
      const savedInvoices = localStorage.getItem('smartcut_held_invoices');
      if (savedInvoices) {
        const heldList: HeldInvoice[] = JSON.parse(savedInvoices);
        matchedHeld = heldList.find(h => 
          (ticket.heldInvoiceId && h.id === ticket.heldInvoiceId) ||
          (h.queueTicketId && h.queueTicketId === ticket.id) ||
          (ticket.queueNumber && h.queueNumber === ticket.queueNumber) ||
          (ticket.phone && h.client?.phone === ticket.phone)
        ) || null;
      }
    } catch (e) {
      console.warn('Error reading held invoices:', e);
    }

    // إذا لم تكن في التخزين المحلي، نبحث سحابياً
    if (!matchedHeld) {
      try {
        const cloudHeld = await DB.fetchHeldInvoices(settings.salonId);
        matchedHeld = cloudHeld.find(h => 
          (ticket.heldInvoiceId && h.id === ticket.heldInvoiceId) ||
          (h.queueTicketId && h.queueTicketId === ticket.id) ||
          (ticket.queueNumber && h.queueNumber === ticket.queueNumber) ||
          (ticket.phone && h.client?.phone === ticket.phone)
        ) || null;
      } catch (e) {
        console.warn('Error fetching cloud held invoices:', e);
      }
    }

    // إذا لم تكن موجودة، ننشئ كائن فاتورة معلقة للعميل فورياً
    if (!matchedHeld) {
      const clientObj: Client = clients.find(c => c.phone === ticket.phone || c.id === ticket.clientId) || {
        id: ticket.clientId || ('C-' + Math.random().toString(36).substr(2, 6)),
        salonId: settings.salonId,
        branchId: selectedBranchId,
        name: ticket.clientName,
        phone: ticket.phone,
        totalVisits: 1,
        totalSpent: 0,
        points: 0,
        createdAt: new Date().toISOString()
      };

      matchedHeld = {
        id: ticket.heldInvoiceId || ('HOLD-' + Math.random().toString(36).substr(2, 6).toUpperCase()),
        salonId: settings.salonId,
        branchId: selectedBranchId,
        heldAt: new Date().toISOString(),
        timeStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        client: clientObj,
        clientSearch: `${clientObj.name} - ${clientObj.phone}`,
        cart: [],
        discount: { type: 'percentage', value: 0 },
        advanceDeduction: 0,
        queueNumber: ticket.queueNumber,
        queueTicketId: ticket.id
      };
    }

    // 3. التوجيه إلى شاشة الكاشير وفتح الفاتورة المعلقة تلقائياً
    if (onCompleteAndOpenPOS) {
      onCompleteAndOpenPOS(matchedHeld, ticket);
    } else if (onNavigateScreen) {
      onNavigateScreen('pos');
    }
  };

  // Mark No-Show or Cancel (Automatically cancels the held invoice in POS)
  const handleMarkNoShow = async (ticket: QueueTicket) => {
    if (!window.confirm(`هل أنت متأكد من تسجيل عدم حضور العميل رقم #${ticket.queueNumber} (${ticket.clientName}) وإلغاء الفاتورة المعلقة؟`)) {
      return;
    }
    const updated = await QueueService.updateTicket(ticket.id, {
      status: 'no_show'
    });
    if (updated) {
      setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
    }
  };

  // Manual Add Walk-in
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientPhone) return;

    let targetClient = clients.find(c => c.phone.includes(newClientPhone));
    if (!targetClient) {
      targetClient = {
        id: 'C-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        salonId: settings.salonId,
        branchId: selectedBranchId,
        name: newClientName || `عميل (${newClientPhone.slice(-4)})`,
        phone: newClientPhone,
        totalVisits: 1,
        totalSpent: 0,
        points: 0,
        createdAt: new Date().toISOString()
      };
    }

    const { ticket } = await QueueService.createTicketFromKiosk({
      salonId: settings.salonId,
      branchId: selectedBranchId,
      client: targetClient
    });

    // طباعة إيصال حراري مباشر 80x80 مم بدون شاشات إضافية
    printQueueSlipDirect({
      salonName: settings.salonName || 'منظومة الصالون',
      salonLogo: settings.logoUrl,
      branchName: activeBranch?.name,
      clientName: ticket.clientName,
      phone: ticket.phone,
      queueNumber: ticket.queueNumber
    });

    setTickets(prev => [ticket, ...prev]);
    setShowAddModal(false);
    setNewClientPhone('');
    setNewClientName('');
    alert(`✅ تم إضافة العميل بنجاح برقم دور #${ticket.queueNumber} وفُتحت له فاتورة معلقة في الكاشير!`);
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'no_show') {
          if (t.status !== 'no_show' && t.status !== 'cancelled') return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = t.clientName.toLowerCase().includes(q);
        const matchPhone = t.phone.includes(q);
        const matchNum = String(t.queueNumber).includes(q);
        if (!matchName && !matchPhone && !matchNum) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black shadow-lg shadow-amber-500/10">
            <Radio size={24} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-black text-lg sm:text-xl flex items-center gap-2">
              <span>شاشة المتابعة والمناداة (طابور الانتظار)</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                مباشر 🟢
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة أدوار العملاء، تسكين الموظفين، والمناداة الصوتية الفورية
            </p>
          </div>
        </div>

        {/* Controls & Quick Links */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch Selector */}
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
              soundEnabled 
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="تفعيل / كتم المناداة الصوتية"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'صوت المناداة مفعل' : 'صوت صامت'}</span>
          </button>

          {/* Open Kiosk in New Tab */}
          <a
            href={`/?kiosk=true&branchId=${selectedBranchId}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <ExternalLink size={14} />
            <span>فتح شاشة التابلت (الكيوسك) 📱</span>
          </a>

          {/* Manual Add Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Plus size={15} />
            <span>إضافة عميل يدوياً</span>
          </button>
        </div>
      </div>

      {/* ── BIG CALL NEXT ACTION BANNER ── */}
      <div className="bg-gradient-to-r from-amber-600/15 via-slate-900 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-right">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black">
            <Clock size={32} />
          </div>
          <div>
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
              الدور القادم في الطابور
            </span>
            {nextWaitingCustomer ? (
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-amber-400 font-black text-2xl">#{nextWaitingCustomer.queueNumber}</span>
                  <span>{nextWaitingCustomer.clientName}</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  هاتف: {nextWaitingCustomer.phone} • وصل: {new Date(nextWaitingCustomer.checkInTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-400 mt-1">
                لا يوجد عملاء بانتظار الدور حالياً (كل الأدوار تم خدمتها) ✓
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleCallNext}
          disabled={!nextWaitingCustomer}
          className={`px-6 py-4 rounded-2xl font-black text-sm sm:text-base flex items-center gap-2 shadow-xl transition-all cursor-pointer ${
            nextWaitingCustomer
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 shadow-amber-500/30 hover:brightness-110 active:scale-98 animate-pulse'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
          }`}
        >
          <Volume2 size={22} />
          <span>المناداة على العميل التالي بالدور 📣</span>
        </button>
      </div>

      {/* ── STATS COUNTER CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button 
          onClick={() => setStatusFilter('waiting')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'waiting' 
              ? 'bg-amber-950/60 border-amber-500 shadow-lg shadow-amber-950/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-amber-400 font-bold">في الانتظار ⏳</span>
          <p className="text-2xl font-black text-white font-mono mt-1">{stats.waiting}</p>
        </button>

        <button 
          onClick={() => setStatusFilter('called')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'called' 
              ? 'bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-950/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-indigo-400 font-bold">تم استدعاؤهم 📢</span>
          <p className="text-2xl font-black text-white font-mono mt-1">{stats.called}</p>
        </button>

        <button 
          onClick={() => setStatusFilter('in_service')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'in_service' 
              ? 'bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-950/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-cyan-400 font-bold">قيد الخدمة ✂️</span>
          <p className="text-2xl font-black text-white font-mono mt-1">{stats.inService}</p>
        </button>

        <button 
          onClick={() => setStatusFilter('completed')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'completed' 
              ? 'bg-emerald-950/60 border-emerald-500 shadow-lg shadow-emerald-950/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-emerald-400 font-bold">تم الإنجاز ✅</span>
          <p className="text-2xl font-black text-white font-mono mt-1">{stats.completed}</p>
        </button>

        <button 
          onClick={() => setStatusFilter('no_show')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'no_show' 
              ? 'bg-rose-950/60 border-rose-500 shadow-lg shadow-rose-950/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-rose-400 font-bold">لم يحضر / ملغي ❌</span>
          <p className="text-2xl font-black text-white font-mono mt-1">{stats.noShow}</p>
        </button>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الدور، اسم العميل، أو رقم الهاتف..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-4 py-2 text-xs text-white outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            الكل ({stats.total})
          </button>
        </div>
      </div>

      {/* ── QUEUE TICKETS TABLE ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users size={48} className="mx-auto mb-3 text-slate-600" />
            <p className="font-bold text-sm text-slate-300">لا توجد تذاكر في هذه القائمة حالياً</p>
            <p className="text-xs text-slate-500 mt-1">تأكد من فتح شاشة الكيوسك أو تسجيل العملاء الواصلين.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-black">
                  <th className="py-3.5 px-4">رقم الدور</th>
                  <th className="py-3.5 px-4">العميل والهاتف</th>
                  <th className="py-3.5 px-4">وقت الوصول</th>
                  <th className="py-3.5 px-4">المصدر</th>
                  <th className="py-3.5 px-4">الموظف المسكن معه</th>
                  <th className="py-3.5 px-4">الحالة الحالية</th>
                  <th className="py-3.5 px-4 text-center">إجراءات المتابعة والمناداة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTickets.map(ticket => {
                  const isWaiting = ticket.status === 'waiting';
                  const isCalled = ticket.status === 'called';
                  const isInService = ticket.status === 'in_service';
                  const isDone = ticket.status === 'completed';
                  const isNoShow = ticket.status === 'no_show' || ticket.status === 'cancelled';

                  return (
                    <tr key={ticket.id} className="hover:bg-slate-800/40 transition-colors">
                      
                      {/* Queue Number */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-lg font-black text-amber-400 px-2.5 py-1 bg-amber-950/60 border border-amber-800/80 rounded-xl inline-block shadow-sm">
                          #{ticket.queueNumber}
                        </span>
                      </td>

                      {/* Client Info */}
                      <td className="py-3.5 px-4">
                        <p className="font-black text-white text-xs">{ticket.clientName}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Phone size={10} />
                          <span>{ticket.phone}</span>
                        </p>
                      </td>

                      {/* Arrival Time */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-300 text-[11px]">
                          {new Date(ticket.checkInTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {ticket.calledAt && (
                          <p className="text-[10px] text-indigo-400 font-mono">
                            نودي: {new Date(ticket.calledAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {ticket.source === 'kiosk' ? '📱 كيوسك تابلت' : ticket.source === 'booking' ? '📅 حجز مسبق' : '🛒 كاشير'}
                        </span>
                      </td>

                      {/* Assigned Employee */}
                      <td className="py-3.5 px-4">
                        {ticket.assignedEmployeeName ? (
                          <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                            <Scissors size={12} />
                            <span>{ticket.assignedEmployeeName}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">
                            غير مسكن بعد
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border inline-flex items-center gap-1 ${
                          isWaiting
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : isCalled
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-800 animate-pulse'
                            : isInService
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                            : isDone
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}>
                          {isWaiting && 'في الانتظار ⏳'}
                          {isCalled && 'تم النداء عليه 📢'}
                          {isInService && 'قيد الخدمة ✂️'}
                          {isDone && 'مكتمل ✅'}
                          {isNoShow && 'لم يحضر ❌'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          
                          {/* Call / Re-call Button */}
                          {!isDone && !isNoShow && (
                            <button
                              onClick={() => handleCallSpecific(ticket)}
                              title="المناداة الصوتية على هذا العميل"
                              className="p-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-lg transition-all border border-amber-500/40 cursor-pointer"
                            >
                              <Volume2 size={13} />
                            </button>
                          )}

                          {/* Assign to Employee / Start Service */}
                          {!isDone && !isNoShow && (
                            <button
                              onClick={() => {
                                setAssigningTicket(ticket);
                                setSelectedEmpId(ticket.assignedEmployeeId || employees[0]?.id || '');
                              }}
                              title="تسكين العميل مع موظف / بدء الخدمة"
                              className="p-1.5 bg-cyan-950 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg transition-all border border-cyan-800 cursor-pointer"
                            >
                              <Scissors size={13} />
                            </button>
                          )}

                          {/* تأكيد اكتمال الخدمة للعملاء الذين تم النداء عليهم فقط (أو قيد الخدمة) وفتح الفاتورة تلقائياً في POS */}
                          {(isCalled || isInService) && (
                            <button
                              onClick={() => handleCompleteAndOpenPOS(ticket)}
                              title="تأكيد اكتمال الخدمة وفتح الفاتورة المعلقة تلقائياً في شاشة نقطة البيع (POS)"
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm border border-emerald-400 flex items-center gap-1.5 font-black text-[11px] cursor-pointer active:scale-95 animate-pulse hover:animate-none"
                            >
                              <CheckCircle2 size={13} className="text-white shrink-0" />
                              <span>تأكيد الاكتمال وفتح الفاتورة</span>
                            </button>
                          )}

                          {/* Print Thermal Slip (80x80 mm) */}
                          <button
                            onClick={() => {
                              printQueueSlipDirect({
                                salonName: settings.salonName || 'منظومة الصالون',
                                salonLogo: settings.logoUrl,
                                branchName: activeBranch?.name,
                                clientName: ticket.clientName,
                                phone: ticket.phone,
                                queueNumber: ticket.queueNumber
                              });
                            }}
                            title="طباعة إيصال حراري مباشر (80x80 مم)"
                            className="p-1.5 bg-slate-800 hover:bg-amber-500 text-slate-300 hover:text-slate-950 rounded-lg transition-all border border-slate-700 hover:border-amber-400 cursor-pointer"
                          >
                            <Printer size={13} />
                          </button>

                          {/* Open in POS */}
                          {onNavigateScreen && !isDone && (
                            <button
                              onClick={() => onNavigateScreen('pos')}
                              title="فتح الفاتورة المعلقة في الكاشير"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}

                          {/* Mark No-Show */}
                          {!isDone && !isNoShow && (
                            <button
                              onClick={() => handleMarkNoShow(ticket)}
                              title="تسجيل عدم الحضور وإلغاء الفاتورة المعلقة"
                              className="p-1.5 bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg transition-all border border-rose-900/60 cursor-pointer"
                            >
                              <UserX size={13} />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ASSIGN EMPLOYEE MODAL ── */}
      {assigningTicket && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-100">
            <h3 className="font-black text-sm text-white mb-2 flex items-center gap-2">
              <Scissors size={16} className="text-amber-400" />
              <span>تسكين العميل مع الموظف / بدء الخدمة</span>
            </h3>
            <div className="text-xs text-slate-300 mb-4 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 space-y-1">
              <div className="flex justify-between items-center">
                <span>العميل: <strong className="text-white text-sm">#{assigningTicket.queueNumber} - {assigningTicket.clientName}</strong></span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  assigningTicket.status === 'in_service' ? 'bg-cyan-900 text-cyan-200' : 'bg-amber-900/80 text-amber-200'
                }`}>
                  {assigningTicket.status === 'in_service' ? 'قيد الخدمة ✂️' : 'في الانتظار ⏳'}
                </span>
              </div>
              {assigningTicket.assignedEmployeeName && (
                <p className="text-cyan-400 font-bold text-[11px] flex items-center gap-1.5 pt-1 border-t border-slate-700/50">
                  <UserCheck size={13} />
                  <span>مسكن مسبقاً مع: <strong>{assigningTicket.assignedEmployeeName}</strong></span>
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">اختر الموظف / الفني للتسكين:</label>
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-bold"
              >
                <option value="">-- اختر الموظف للتسكين --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role || 'فني'})</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                • <strong>حفظ التسكين فقط:</strong> يوزع العميل على الموظف مسبقاً مع إبقائه في قائمة الانتظار دون بدء الخدمة ودون إطلاق نداء صوتي.
                <br />
                • <strong>تسكين وبدء الخدمة:</strong> ينقل العميل إلى حالة "قيد الخدمة" فوراً ويطلق النداء الصوتي.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {/* حفظ التسكين فقط (توزيع مسبق بدون بدء الخدمة) */}
                <button
                  type="button"
                  onClick={handleSaveAssignOnly}
                  disabled={!selectedEmpId}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold text-cyan-200 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/80 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                  title="حفظ تسكين العميل مسبقاً مع إبقائه في الانتظار"
                >
                  <UserCheck size={14} className="text-cyan-400 shrink-0" />
                  <span>حفظ التسكين فقط</span>
                </button>

                {/* تسكين وبدء الخدمة فوراً مع المناداة الصوتية */}
                <button
                  type="button"
                  onClick={handleConfirmAssign}
                  disabled={!selectedEmpId}
                  className="py-2.5 px-3 rounded-xl text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  title="تسكين العميل ونقله لقيد الخدمة وإطلاق النداء الصوتي"
                >
                  <Scissors size={14} className="text-slate-950 shrink-0" />
                  <span>تسكين وبدء الخدمة</span>
                </button>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                {assigningTicket.assignedEmployeeId && (
                  <button
                    type="button"
                    onClick={handleClearAssign}
                    className="py-2 px-3 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-200 hover:bg-rose-950/60 border border-rose-900/60 cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    <XCircle size={13} />
                    <span>إلغاء التسكين</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAssigningTicket(null);
                    setSelectedEmpId('');
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer transition-all text-center"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL ADD WALK-IN MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-slate-100">
            <h3 className="font-black text-sm text-white mb-2 flex items-center gap-2">
              <Plus size={16} className="text-amber-400" />
              <span>إضافة عميل يدوياً في طابور الانتظار</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              يصدر تذكرة دور فورية ويفتح فاتورة معلقة في الكاشير
            </p>

            <form onSubmit={handleManualAdd} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">رقم جوال العميل *</label>
                <input
                  type="tel"
                  required
                  value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">اسم العميل (اختياري)</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="محمد العتيبي"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 cursor-pointer shadow"
                >
                  تأكيد واستلام الدور
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
