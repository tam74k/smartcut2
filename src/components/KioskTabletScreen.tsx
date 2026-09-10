import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Scissors, Phone, CheckCircle2, User, UserPlus, Sparkles, 
  RotateCcw, Clock, Volume2, ArrowRight, Printer, AlertCircle, Maximize, Minimize, Lock
} from 'lucide-react';
import { AppSettings, Branch, Client, QueueTicket } from '../types';
import { QueueService } from '../services/queueService';
import { DB } from '../services/db';
import { printQueueSlipDirect } from '../utils/printQueueSlip';

interface KioskTabletScreenProps {
  settings: AppSettings;
  branches: Branch[];
  clients: Client[];
  onSaveClient: (newClient: Client) => void;
  onSwitchToMainApp?: () => void;
}

// Synthesis audio chime using Web Audio API (works 100% offline on any tablet/iPad)
function playKioskChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First pleasant tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.6);

    // Second chime harmonic
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.2); // C6
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.8);
      } catch {}
    }, 150);
  } catch (e) {
    console.warn('Audio chime failed:', e);
  }
}

export function KioskTabletScreen({
  settings,
  branches,
  clients,
  onSaveClient,
  onSwitchToMainApp
}: KioskTabletScreenProps) {
  // Active Branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const bFromUrl = urlParams.get('branchId') || urlParams.get('branch');
      if (bFromUrl) return bFromUrl;
      const saved = localStorage.getItem('smartcut_kiosk_branch_id');
      if (saved) return saved;
    } catch {}
    return branches[0]?.id || 'b-main';
  });

  const activeBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

  // Keypad & Input State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [detectedClient, setDetectedClient] = useState<Client | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [activeTicket, setActiveTicket] = useState<QueueTicket | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Time display
  const [currentTime, setCurrentTime] = useState(new Date());

  // Staff Settings / Exit Modal
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPin, setExitPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Save selected branch
  useEffect(() => {
    try {
      localStorage.setItem('smartcut_kiosk_branch_id', selectedBranchId);
    } catch {}
  }, [selectedBranchId]);

  // Client Detection Effect when phone number changes
  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    // إذا كان الرقم يبدأ بـ 01 يتم الفحص عند اكتمال الـ 11 رقماً، وخلاف ذلك يتم الفحص عند 7 أرقام فأكثر
    const isReadyForLookup = cleanPhone.startsWith('01') ? cleanPhone.length === 11 : cleanPhone.length >= 7;
    
    if (isReadyForLookup) {
      // Find matching client
      const found = clients.find(c => {
        const cPhone = c.phone.replace(/[^0-9]/g, '');
        return cPhone === cleanPhone || cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone);
      });

      if (found) {
        setDetectedClient(found);
        setClientName(found.name);
        setIsNewClient(false);
      } else {
        setDetectedClient(null);
        setIsNewClient(true);
      }
    } else {
      setDetectedClient(null);
      setIsNewClient(false);
    }
  }, [phoneNumber, clients]);

  // Countdown timer for auto-reset after ticket issuance
  useEffect(() => {
    if (!activeTicket) return;

    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleResetAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTicket]);

  // التحقق من جاهزية الرقم للتأكيد وفق القواعد المطلوبة:
  // - إذا بدأ بـ 01 فيكون مطلوباً 11 رقماً بالضبط
  // - خلاف ذلك يبقى مفتوحاً لحين ضغط العميل على زر الاعتماد
  const isReadyToConfirm = useMemo(() => {
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    if (!clean) return false;
    if (clean.startsWith('01')) {
      return clean.length === 11;
    }
    return clean.length >= 4;
  }, [phoneNumber]);

  // Keypad click handler
  const handleKeyPress = (val: string) => {
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    // لو الرقم يبدأ بـ 01 فيكون عدد الأرقام 11 رقماً كحد أقصى
    if (clean.startsWith('01') && clean.length >= 11) {
      return;
    }
    // خلاف ذلك نترك عدد الأرقام مفتوحاً مع حد أمان تقني (25 رقماً)
    if (!clean.startsWith('01') && clean.length >= 25) {
      return;
    }
    setPhoneNumber(prev => prev + val);
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
    setClientName('');
    setDetectedClient(null);
    setIsNewClient(false);
  };

  const handleResetAll = () => {
    setPhoneNumber('');
    setClientName('');
    setDetectedClient(null);
    setIsNewClient(false);
    setActiveTicket(null);
  };

  // Submit and Issue Queue Ticket
  const handleConfirmCheckIn = async () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('01')) {
      if (cleanPhone.length !== 11) {
        alert('أرقام الموبايل التي تبدأ بـ 01 يجب أن تتكون من 11 رقماً بالضبط');
        return;
      }
    } else {
      if (cleanPhone.length < 4) {
        alert('الرجاء إدخال رقم هاتف صحيح');
        return;
      }
    }

    let targetClient = detectedClient;

    // Create client if new
    if (!targetClient) {
      const finalName = clientName.trim() || `عميل (${cleanPhone.slice(-4)})`;
      const newC: Client = {
        id: 'C-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        salonId: settings.salonId,
        branchId: activeBranch?.id,
        name: finalName,
        phone: cleanPhone,
        notes: 'تم التسجيل تلقائياً من جهاز التابلت (الكيوسك)',
        points: 0,
        totalVisits: 1,
        totalSpent: 0,
        createdAt: new Date().toISOString()
      };

      onSaveClient(newC);
      try {
        await DB.saveClient(newC);
      } catch {}

      targetClient = newC;
    }

    // Issue Queue Ticket & Create Held Invoice in POS
    const { ticket } = QueueService.createTicketFromKiosk({
      salonId: settings.salonId,
      branchId: activeBranch?.id || 'b-main',
      client: targetClient
    });

    playKioskChime();
    setActiveTicket(ticket);

    // طباعة إيصال حراري مباشرة (80mm x 80mm) مع باركود العميل بدون أي شاشات إضافية
    printQueueSlipDirect({
      salonName: settings.salonName || 'منظومة الصالون',
      salonLogo: settings.logoUrl,
      branchName: activeBranch?.name,
      clientName: targetClient.name,
      phone: targetClient.phone,
      queueNumber: ticket.queueNumber
    });
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Verify PIN for Exit or Admin
  const handleVerifyExit = () => {
    if (exitPin === '1234' || exitPin === '0000' || exitPin === (settings.taxNumber?.slice(-4) || '')) {
      setShowExitModal(false);
      setExitPin('');
      setPinError(false);
      if (onSwitchToMainApp) {
        onSwitchToMainApp();
      } else {
        window.location.href = '/';
      }
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black font-sans relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-2xl p-1 bg-white/5 border border-slate-700" />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Scissors size={28} />
            </div>
          )}
          <div>
            <h1 className="font-black text-base sm:text-xl text-white tracking-wide">
              {settings.salonName || 'منظومة الصالون الحديث'}
            </h1>
            <p className="text-xs sm:text-sm text-amber-400/90 font-bold flex items-center gap-1.5 mt-0.5">
              <span>{activeBranch ? activeBranch.name : 'الفرع الرئيسي'}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">جهاز تسجيل الحضور واستلام الدور</span>
            </p>
          </div>
        </div>

        {/* Live Clock & Fullscreen Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-left hidden sm:block">
            <div className="font-mono text-base sm:text-lg font-black text-white">
              {currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {currentTime.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>

          <button
            onClick={handleToggleFullscreen}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700/60"
            title="ملء الشاشة"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          <button
            onClick={() => setShowExitModal(true)}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors border border-slate-700/60"
            title="خروج الموظفين / الإعدادات"
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      {/* MAIN KIOSK BODY */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-2xl w-full mx-auto relative z-10">
        
        {/* Welcome Text */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-2">
            <Sparkles size={14} />
            <span>أهلاً وسهلاً بك في صالونك المميز</span>
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-white">
            الرجاء كتابة رقم الجوال لاستلام رقم دورك
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            سيتم استدعاؤك بالاسم والرقم فور جهوزية المقعد
          </p>
        </div>

        {/* PHONE DISPLAY SCREEN */}
        <div className="w-full bg-slate-900/90 border-2 border-slate-700 rounded-3xl p-5 shadow-2xl mb-6 relative overflow-hidden backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
            <span className="flex items-center gap-2">
              <Phone size={14} className="text-amber-400" />
              <span>رقم الجوال:</span>
              {phoneNumber && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  phoneNumber.startsWith('01')
                    ? (phoneNumber.length === 11 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30')
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {phoneNumber.startsWith('01') ? `${phoneNumber.length} / 11 رقم` : `${phoneNumber.length} رقم`}
                </span>
              )}
            </span>
            {phoneNumber && (
              <button 
                onClick={handleClear}
                className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>مسح الكل</span>
              </button>
            )}
          </div>

          <div className="h-16 flex items-center justify-center font-mono text-2xl sm:text-4xl font-black tracking-widest text-amber-300" dir="ltr">
            {phoneNumber ? (
              phoneNumber
            ) : (
              <span className="text-slate-600 font-sans text-sm sm:text-lg tracking-normal">
                أدخل رقم الجوال (اضغط الأرقام أدناه)
              </span>
            )}
          </div>

          {/* Client Detection Feedback Banner */}
          {detectedClient && (
            <div className="mt-3 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <p className="font-black text-sm text-white flex items-center gap-1.5">
                    <span>مرحباً بك مجدداً: {detectedClient.name}</span>
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </p>
                  <p className="text-[11px] text-emerald-300/80">
                    عميل مسجل • زيارات سابقة ({detectedClient.totalVisits || 1})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* New Client Name Input */}
          {isNewClient && (
            <div className="mt-3 p-3.5 bg-indigo-950/60 border border-indigo-500/40 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold text-xs">
                <UserPlus size={16} />
                <span>أهلاً بعميلنا الجديد! الرجاء كتابة اسمك الكريم:</span>
              </div>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="الاسم الأول / اللقب..."
                className="w-full bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-indigo-400"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* CUSTOM PHONE DIAL-PAD (KEYPAD) */}
        {/*
          توزيع لوحة الأرقام المطلوب بدقة:
          الصف الأول: [ 3 ] [ 2 ] [ 1 ]
          الصف الثاني: [ 6 ] [ 5 ] [ 4 ]
          الصف الثالث: [ 9 ] [ 8 ] [ 7 ]
          الصف الرابع: [ 0 ] على الجانب الأيسر (تحت 7 و 4 و 1)، وبجانبه زر التراجع [ ⌫ ]، وزر تأكيد الدور [ ⏎ ]
        */}
        <div className="w-full max-w-md grid grid-cols-3 gap-3 sm:gap-4 mb-6 select-none" dir="rtl">
          
          {/* Row 1: [ 3 ] [ 2 ] [ 1 ] */}
          <button
            type="button"
            onClick={() => handleKeyPress('3')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>3</span>
            <span className="text-[9px] text-slate-400 tracking-wider">DEF</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('2')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>2</span>
            <span className="text-[9px] text-slate-400 tracking-wider">ABC</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('1')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>1</span>
            <span className="text-[10px] text-slate-500 font-normal">.</span>
          </button>

          {/* Row 2: [ 6 ] [ 5 ] [ 4 ] */}
          <button
            type="button"
            onClick={() => handleKeyPress('6')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>6</span>
            <span className="text-[9px] text-slate-400 tracking-wider">MNO</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('5')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>5</span>
            <span className="text-[9px] text-slate-400 tracking-wider">JKL</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('4')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>4</span>
            <span className="text-[9px] text-slate-400 tracking-wider">GHI</span>
          </button>

          {/* Row 3: [ 9 ] [ 8 ] [ 7 ] */}
          <button
            type="button"
            onClick={() => handleKeyPress('9')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>9</span>
            <span className="text-[9px] text-slate-400 tracking-wider">WXYZ</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('8')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>8</span>
            <span className="text-[9px] text-slate-400 tracking-wider">TUV</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('7')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span>7</span>
            <span className="text-[9px] text-slate-400 tracking-wider">PQRS</span>
          </button>

          {/* Row 4:
              الجانب الأيمن (تحت 9 و 6 و 3): زر تأكيد الدور [ ⏎ ]
              الوسط (تحت 8 و 5 و 2): زر التراجع [ ⌫ ]
              الجانب الأيسر (تحت 7 و 4 و 1): رقم [ 0 ]
          */}
          <button
            type="button"
            disabled={!isReadyToConfirm}
            onClick={handleConfirmCheckIn}
            className={`h-16 sm:h-20 rounded-2xl font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition-all shadow-lg cursor-pointer ${
              isReadyToConfirm
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/30 scale-100'
                : 'bg-slate-800/60 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
            }`}
            title="تأكيد واستلام الدور [ ⏎ ]"
          >
            <div className="flex items-center gap-1 text-base sm:text-lg font-black">
              <span>⏎</span>
              <CheckCircle2 size={16} />
            </div>
            <span>تأكيد الدور</span>
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-16 sm:h-20 bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-rose-300 font-bold rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
            title="مسح رقم واحد [ ⌫ ]"
          >
            <span className="text-xl sm:text-2xl font-mono font-black">⌫</span>
            <span className="text-[10px] text-rose-300/80 font-normal">تراجع</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-16 sm:h-20 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white font-black text-2xl sm:text-3xl rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer"
            title="رقم 0"
          >
            <span>0</span>
            <span className="text-[10px] text-slate-500 font-normal">+</span>
          </button>
        </div>

        {/* Primary Action Button (Big Confirmation Bar) */}
        {isReadyToConfirm && (
          <button
            type="button"
            onClick={handleConfirmCheckIn}
            className="w-full max-w-md py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black text-lg sm:text-xl rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-98 animate-in fade-in"
          >
            <span>استلام رقم الدور الآن 🎟️</span>
          </button>
        )}

      </main>

      {/* FOOTER */}
      <footer className="p-4 text-center text-xs text-slate-500 border-t border-slate-800/80 bg-slate-900/40 relative z-10">
        <p>
          نظام سمارت كت لإدارة الصالونات • الخدمة الذاتية لتسجيل الحضور وطوابير الانتظار الذكية
        </p>
      </footer>

      {/* ── DIGITAL TICKET ISSUANCE MODAL (BOARDING PASS) ── */}
      {activeTicket && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden text-slate-100">
            
            {/* Ribbon glow */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
            
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4 border border-amber-500/40 shadow-lg shadow-amber-500/20">
              <CheckCircle2 size={36} />
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-300 border border-amber-500/30">
              تم تسجيل حضورك بنجاح
            </span>

            <p className="text-slate-400 text-xs mt-3">رقم الدور الخاص بك:</p>

            {/* Giant Queue Number */}
            <div className="my-3 py-4 px-6 bg-slate-950/80 border border-amber-500/40 rounded-3xl shadow-inner inline-block min-w-[180px]">
              <span className="font-mono text-6xl sm:text-7xl font-black text-amber-400 tracking-tighter drop-shadow-md">
                #{activeTicket.queueNumber}
              </span>
            </div>

            <h3 className="font-black text-lg sm:text-xl text-white mt-1">
              {activeTicket.clientName}
            </h3>
            
            <p className="text-xs text-slate-400 mt-0.5">
              الوقت: {new Date(activeTicket.checkInTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} • {activeBranch?.name}
            </p>

            <div className="mt-4 p-3 bg-slate-800/60 rounded-2xl border border-slate-700 text-xs text-slate-300 leading-relaxed">
              يرجى التفضل بأخذ مقعدك في صالة الانتظار، سيتم النداء على رقمك واسمك عبر شاشات المناداة ومكبرات الصوت فوراً.
            </div>

            {/* Auto-Reset Countdown Bar */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>تفريغ الشاشة للعميل التالي تلقائياً:</span>
                <span className="font-bold text-amber-400 font-mono">{countdown} ثوانٍ</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 5) * 100}%` }}
                />
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    printQueueSlipDirect({
                      salonName: settings.salonName || 'منظومة الصالون',
                      salonLogo: settings.logoUrl,
                      branchName: activeBranch?.name,
                      clientName: activeTicket.clientName,
                      phone: activeTicket.phone,
                      queueNumber: activeTicket.queueNumber
                    });
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                >
                  <Printer size={14} />
                  <span>طباعة الإيصال الحراري 🖨️</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow"
                >
                  عميل جديد (تفريغ)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── STAFF EXIT & SETTINGS MODAL ── */}
      {showExitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-slate-100">
            <h3 className="font-black text-sm text-white mb-2 flex items-center gap-2">
              <Lock size={16} className="text-amber-400" />
              <span>إغلاق شاشة الكيوسك / إعدادات الفرع</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              الرجاء إدخال الرقم السري للكادر (الافتراضي 1234 أو آخر 4 أرقام من الرقم الضريبي):
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">الفرع المربوط به الكيوسك</label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">الرقم السري للموظفين</label>
                <input
                  type="password"
                  value={exitPin}
                  onChange={e => {
                    setExitPin(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="1234"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono text-center outline-none focus:border-amber-400"
                  autoFocus
                />
                {pinError && (
                  <p className="text-[11px] text-rose-400 mt-1 font-bold">الرمز السري غير صحيح</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  setExitPin('');
                  setPinError(false);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleVerifyExit}
                className="flex-1 py-2 rounded-xl text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 cursor-pointer shadow"
              >
                الخروج للنظام
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
