import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Calendar, Clock, Phone, User, CheckCircle2, AlertCircle, 
  Send, Plus, LogOut, ChevronRight, Search, MapPin, DollarSign, 
  Wallet, FileText, ArrowLeft, RefreshCw, X, ShieldAlert, Check
} from 'lucide-react';
import { AppSettings, Branch, Booking, MakeupArtist, ArtistAssignedService, BookingService, Service } from '../types';
import { DB } from '../services/db';
import { EvolutionApiService } from '../services/evolutionApiService';
import { calculateBookingTotals } from './BookingsScreen';

interface MakeupArtistPortalProps {
  settings: AppSettings;
  branches: Branch[];
  services: Service[];
  bookings: Booking[];
  onSaveBooking?: (booking: Booking) => void;
  onCancelBooking?: (bookingId: string) => void;
  onSwitchToMainApp?: () => void;
}

export function MakeupArtistPortal({
  settings,
  branches,
  services,
  bookings,
  onSaveBooking,
  onCancelBooking,
  onSwitchToMainApp
}: MakeupArtistPortalProps) {
  // Authentication State
  const [currentArtist, setCurrentArtist] = useState<MakeupArtist | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App Navigation / Views
  const [activeTab, setActiveTab] = useState<'bookings' | 'new_booking'>('bookings');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'today' | 'completed' | 'cancelled'>('all');

  // Booking Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('14:00');
  const [bookingLocation, setBookingLocation] = useState('داخل الصالون');
  const [selectedServiceIds, setSelectedServiceIds] = useState<{ [serviceId: string]: number }>({});
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositHandoverNow, setDepositHandoverNow] = useState(false);
  const [depositMethod, setDepositMethod] = useState('انستاباي');
  const [depositNotes, setDepositNotes] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handover Deposit Modal on Existing Booking
  const [handoverBooking, setHandoverBooking] = useState<Booking | null>(null);
  const [handoverMethod, setHandoverMethod] = useState('انستاباي');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  // WhatsApp Sending State
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<string | null>(null);

  const currency = settings.currency || 'ج.م';
  const salonName = settings.salonName || 'صالون التجميل';

  // Check saved session on load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartcut_artist_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          // Verify with latest data from DB
          DB.fetchMakeupArtists(settings.salonId).then(artists => {
            const fresh = artists.find(a => a.id === parsed.id);
            if (fresh && fresh.isActive) {
              setCurrentArtist(fresh);
            } else if (fresh && !fresh.isActive) {
              localStorage.removeItem('smartcut_artist_session');
              setLoginError('تم إيقاف حسابك من قبل إدارة الصالون. يرجى مراجعة الإدارة.');
            } else {
              setCurrentArtist(parsed);
            }
          });
        }
      }
    } catch (e) {}
  }, [settings.salonId]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const artists = await DB.fetchMakeupArtists(settings.salonId);
      const cleanUser = usernameInput.trim().toLowerCase();
      const cleanPass = passwordInput.trim();

      const matched = artists.find(a => 
        a.username.trim().toLowerCase() === cleanUser && 
        (a.password || '123456') === cleanPass
      );

      if (!matched) {
        setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة.');
        setIsLoggingIn(false);
        return;
      }

      if (!matched.isActive) {
        setLoginError('هذا الحساب موقوف حالياً من قبل إدارة الصالون.');
        setIsLoggingIn(false);
        return;
      }

      setCurrentArtist(matched);
      localStorage.setItem('smartcut_artist_session', JSON.stringify(matched));
    } catch (err: any) {
      setLoginError('حدث خطأ أثناء تسجيل الدخول: ' + (err?.message || err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('smartcut_artist_session');
    setCurrentArtist(null);
    setUsernameInput('');
    setPasswordInput('');
  };

  // Filter artist's assigned services
  const availableServices = useMemo(() => {
    if (!currentArtist || !currentArtist.assignedServices) return [];
    return currentArtist.assignedServices.filter(as => as.isEnabled);
  }, [currentArtist]);

  // Calculation for new booking
  const newBookingTotals = useMemo(() => {
    let gross = 0;
    const selectedList: BookingService[] = [];

    availableServices.forEach(as => {
      const qty = selectedServiceIds[as.serviceId] || 0;
      if (qty > 0) {
        const itemPrice = Number(as.customPrice || as.originalPrice || 0);
        gross += itemPrice * qty;
        selectedList.push({
          serviceId: as.serviceId,
          serviceName: as.serviceName,
          price: itemPrice,
          quantity: qty,
          totalPrice: itemPrice * qty,
          duration: as.durationMinutes || 30
        });
      }
    });

    const netTotal = gross;
    const adv = Math.min(netTotal, Math.max(0, Number(depositAmount || 0)));
    const remaining = Math.max(0, netTotal - adv);

    return {
      gross,
      netTotal,
      advances: adv,
      remaining,
      selectedList
    };
  }, [availableServices, selectedServiceIds, depositAmount]);

  // Submit New Booking
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentArtist) return;
    if (!clientName.trim()) {
      alert('يرجى إدخال اسم العروسة / العميل.');
      return;
    }
    if (!clientPhone.trim() || clientPhone.replace(/\D/g, '').length < 7) {
      alert('يرجى إدخال رقم هاتف صحيح للتواصل وإرسال تأكيد الحجز عبر الواتساب.');
      return;
    }
    if (newBookingTotals.selectedList.length === 0) {
      alert('يرجى اختيار خدمة واحدة على الأقل من الخدمات المخصصة لك.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const bookingCode = 'MUA-' + Math.floor(1000 + Math.random() * 9000);
      const bId = 'B-MUA-' + Date.now();

      const advancePaymentsList = newBookingTotals.advances > 0 ? [{
        id: 'ADV-' + Date.now(),
        amount: newBookingTotals.advances,
        date: bookingDate + 'T' + bookingTime + ':00',
        paymentMethod: depositHandoverNow ? depositMethod : 'cash_with_artist',
        notes: depositHandoverNow 
          ? `عربون حجز عروسة تم تحويله للصالون (${depositMethod}) - بانتظار الاعتماد` 
          : 'العربون في عهدة الميكب ارتست'
      }] : [];

      const newBooking: Booking = {
        id: bId,
        salonId: settings.salonId,
        branchId: currentArtist.branchId || branches[0]?.id,
        bookingCode,
        clientName: clientName.trim(),
        phone: clientPhone.trim(),
        date: bookingDate,
        time: bookingTime,
        location: bookingLocation,
        status: 'confirmed',
        source: 'online',
        services: newBookingTotals.selectedList,
        advancePayments: advancePaymentsList,
        totalAmount: newBookingTotals.netTotal,
        paidDeposit: newBookingTotals.advances,
        artistId: currentArtist.id,
        artistName: currentArtist.name,
        depositStatus: newBookingTotals.advances <= 0 
          ? 'none' 
          : (depositHandoverNow ? 'transfer_pending' : 'in_artist_custody'),
        depositTransferMethod: depositHandoverNow ? depositMethod : undefined,
        depositTransferNotes: depositHandoverNow ? depositNotes.trim() : undefined,
        depositTransferRequestedAt: depositHandoverNow ? nowIso : undefined,
        notes: clientNotes.trim() || undefined,
        internalNotes: `[حجز ميكب ارتست: ${currentArtist.name}] ${clientNotes.trim()}`,
        createdAt: nowIso,
        createdBy: currentArtist.name,
        createdByName: currentArtist.name
      };

      // 1. Save in DB / Supabase
      await DB.saveBooking(newBooking, settings.salonId);

      // 2. Notify parent if callback provided
      if (onSaveBooking) {
        onSaveBooking(newBooking);
      }

      // 3. Auto send WhatsApp PDF Confirmation if enabled
      if (settings.whatsappEnabled !== false && settings.whatsappSettings?.sendBookingToClient) {
        EvolutionApiService.sendBookingConfirmationWhatsApp(settings, newBooking, newBooking.branchId)
          .catch(err => console.error('Error sending WhatsApp confirmation for artist booking:', err));
      }

      alert(`تم تسجيل حجز العروسة (${clientName}) برقم #${bookingCode} بنجاح!`);

      // Reset form
      setClientName('');
      setClientPhone('');
      setSelectedServiceIds({});
      setDepositAmount(0);
      setDepositHandoverNow(false);
      setDepositNotes('');
      setClientNotes('');
      setActiveTab('bookings');
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ الحجز: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter bookings for this artist
  const artistBookings = useMemo(() => {
    if (!currentArtist) return [];
    const todayStr = new Date().toISOString().split('T')[0];

    return bookings
      .filter(b => b.artistId === currentArtist.id)
      .filter(b => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return (
          b.clientName.toLowerCase().includes(q) ||
          b.phone.includes(q) ||
          (b.bookingCode && b.bookingCode.toLowerCase().includes(q))
        );
      })
      .filter(b => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'today') return b.date === todayStr && b.status !== 'cancelled';
        if (statusFilter === 'upcoming') return b.date >= todayStr && b.status !== 'cancelled' && b.status !== 'completed';
        if (statusFilter === 'completed') return b.status === 'completed';
        if (statusFilter === 'cancelled') return b.status === 'cancelled';
        return true;
      })
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [bookings, currentArtist, searchFilter, statusFilter]);

  // Handover Deposit to Salon
  const handleOpenHandoverModal = (booking: Booking) => {
    setHandoverBooking(booking);
    setHandoverMethod('انستاباي');
    setHandoverNotes('');
  };

  const handleSubmitHandover = async () => {
    if (!handoverBooking || !currentArtist) return;

    setIsSubmittingHandover(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedBooking: Booking = {
        ...handoverBooking,
        depositStatus: 'transfer_pending',
        depositTransferMethod: handoverMethod,
        depositTransferNotes: handoverNotes.trim(),
        depositTransferRequestedAt: nowIso,
        updatedAt: nowIso,
        updatedByName: currentArtist.name
      };

      await DB.saveBooking(updatedBooking, settings.salonId);
      if (onSaveBooking) onSaveBooking(updatedBooking);

      alert(`تم إرسال طلب تسليم العربون للصالون بنجاح.\nسيتم اعتماد المبلغ وتقييده في الخزائن فور تأكيد إدارة الصالون للاستلام.`);
      setHandoverBooking(null);
    } catch (err: any) {
      alert('حدث خطأ: ' + (err?.message || err));
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  // Resend WhatsApp Confirmation
  const handleSendBookingWhatsApp = async (booking: Booking) => {
    setIsSendingWhatsApp(booking.id);
    try {
      const res = await EvolutionApiService.sendBookingConfirmationWhatsApp(
        settings,
        booking,
        booking.branchId
      );
      if (res.success) {
        alert(`تم إرسال إيصال وتأكيد الحجز للعميلة (${booking.clientName}) كملف PDF عبر الواتساب بنجاح.`);
      } else {
        alert(`فشل الإرسال: ${res.error || 'خطأ غير معروف'}`);
      }
    } catch (e: any) {
      alert('حدث خطأ أثناء الإرسال: ' + (e?.message || e));
    } finally {
      setIsSendingWhatsApp(null);
    }
  };

  // =========================================================================
  // VIEW 1: LOGIN SCREEN (إذا لم تكن مسجلة دخول)
  // =========================================================================
  if (!currentArtist) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden" dir="rtl">
        {/* Background ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-6">
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt={salonName} 
                className="w-20 h-20 mx-auto rounded-2xl object-contain bg-slate-900 border border-slate-800 p-2 shadow-xl mb-3"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/40 text-pink-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-pink-500/10">
                <Sparkles size={32} />
              </div>
            )}
            <h1 className="text-xl font-black text-white">{salonName}</h1>
            <p className="text-xs text-pink-400 font-bold mt-1">بوابة الميكب ارتست وشركاء الصالون</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
            <h2 className="text-sm font-bold text-slate-200 mb-4 text-center">
              تسجيل دخول الميكب ارتست
            </h2>

            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المستخدم (Username)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="اسم المستخدم الممنوح لك..."
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500 font-mono transition-colors"
                  />
                  <User size={16} className="absolute right-3 top-3.5 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500 font-mono transition-colors"
                  />
                  <ShieldAlert size={16} className="absolute right-3 top-3.5 text-slate-500" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white py-3 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2 mt-2 active:scale-98"
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ التحقق...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>تسجيل الدخول لبوابتي</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
              بيانات الدخول يتم تحديدها وتخصيص خدماتها من خلال إدارة الصالون
            </div>
          </div>

          {onSwitchToMainApp && (
            <button
              type="button"
              onClick={onSwitchToMainApp}
              className="mt-6 mx-auto flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>العودة للنظام الرئيسي</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED ARTIST PORTAL
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={salonName} className="w-9 h-9 rounded-xl object-contain bg-slate-800 p-1 border border-slate-700" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                <Sparkles size={18} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-white">{salonName}</h1>
                <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-bold">
                  {currentArtist.name}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">بوابة الميكب ارتست</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex rounded-2xl bg-slate-900 p-1.5 border border-slate-800 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'bookings'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar size={15} />
            <span>حجوزاتي والعرائس ({artistBookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('new_booking')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'new_booking'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Plus size={16} />
            <span>تسجيل حجز عروسة جديد</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: NEW BOOKING FOR BRIDE */}
        {/* ========================================================================= */}
        {activeTab === 'new_booking' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles size={18} className="text-pink-400" />
                <span>حجز موعد عروسة جديد</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                الخدمات المتاحة أدناه مخصصة لكِ حصرياً بالأسعار المعتمدة لكِ من إدارة الصالون
              </p>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-5">
              {/* Client Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم العروسة / العميلة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ياسمين ممدوح..."
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">رقم الجوال (لإرسال إيصال PDF بالواتساب) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="مثال: 01012345678"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Date, Time, Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">تاريخ الموعد *</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-pink-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">وقت الحضور *</label>
                  <input
                    type="time"
                    required
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-pink-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">مكان التنفيذ</label>
                  <select
                    value={bookingLocation}
                    onChange={(e) => setBookingLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-pink-500 cursor-pointer"
                  >
                    <option value="داخل الصالون">داخل الصالون</option>
                    <option value="خارجي (فندق / قاعة)">خارجي (فندق / قاعة)</option>
                    <option value="خارجي (منزل العميلة)">خارجي (منزل العميلة)</option>
                  </select>
                </div>
              </div>

              {/* Customized Services Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
                  <span>الخدمات المخصصة لكِ (حددي الخدمات المطلوبة) *</span>
                  <span className="text-[11px] text-pink-400 font-normal">
                    {availableServices.length} خدمات مخصصة
                  </span>
                </label>

                {availableServices.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-2xl text-center text-xs text-amber-300">
                    لم يقم الصالون بتخصيص أي خدمات لكِ بعد. يرجى التواصل مع إدارة الصالون لإتاحة باقات وخدمات الميكب لكِ.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableServices.map((as) => {
                      const qty = selectedServiceIds[as.serviceId] || 0;
                      const isSelected = qty > 0;

                      return (
                        <div
                          key={as.serviceId}
                          onClick={() => {
                            setSelectedServiceIds(prev => ({
                              ...prev,
                              [as.serviceId]: isSelected ? 0 : 1
                            }));
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                            isSelected
                              ? 'bg-pink-600/15 border-pink-500/80 shadow-md shadow-pink-500/10'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'bg-pink-600 border-pink-500 text-white' : 'border-slate-700 bg-slate-900'
                            }`}>
                              {isSelected && <Check size={13} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">{as.serviceName}</span>
                              <span className="text-[11px] text-pink-400 font-mono font-bold">
                                {as.customPrice} {currency}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceIds(prev => ({
                                    ...prev,
                                    [as.serviceId]: Math.max(0, qty - 1)
                                  }));
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center"
                              >
                                -
                              </button>
                              <span className="text-xs font-mono font-bold w-5 text-center">{qty}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceIds(prev => ({
                                    ...prev,
                                    [as.serviceId]: qty + 1
                                  }));
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Financial Totals & Deposit Section */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
                  <span className="text-slate-400">إجمالي الخدمات المختارة:</span>
                  <span className="text-sm font-black text-white font-mono">
                    {newBookingTotals.gross.toFixed(2)} {currency}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      العربون المحصل من العروسة ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={depositAmount || ''}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono font-bold focus:outline-hidden focus:border-pink-500"
                    />
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400">المتبقي عند الحضور:</span>
                    <span className="text-sm font-black text-pink-400 font-mono">
                      {newBookingTotals.remaining.toFixed(2)} {currency}
                    </span>
                  </div>
                </div>

                {/* Handover toggle if deposit > 0 */}
                {depositAmount > 0 && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={depositHandoverNow}
                        onChange={(e) => setDepositHandoverNow(e.target.checked)}
                        className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-emerald-400">
                        تم تحويل هذا العربون لحساب الصالون الآن (إرسال طلب تسليم العربون للصالون)
                      </span>
                    </label>

                    {depositHandoverNow && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 animate-in fade-in">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">طريقة التحويل</label>
                          <select
                            value={depositMethod}
                            onChange={(e) => setDepositMethod(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          >
                            <option value="انستاباي">انستاباي (Instapay)</option>
                            <option value="فودافون كاش">فودافون كاش / محفظة</option>
                            <option value="تحويل بنكي">تحويل بنكي</option>
                            <option value="كاش يدوي">كاش يدوي بالصالون</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">رقم الحوالة / اسم المحول</label>
                          <input
                            type="text"
                            placeholder="اختياري (مثل: باسم سماح أو رقم العملية)..."
                            value={depositNotes}
                            onChange={(e) => setDepositNotes(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات خاصة بالحجز (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل تخص الفستان أو الموعد أو رغبات العروسة..."
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || newBookingTotals.selectedList.length === 0}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2 active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ تأكيد الحجز وإرسال الواتساب...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>تأكيد حجز العروسة وإرسال إيصال PDF بالواتساب</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY BOOKINGS LIST */}
        {/* ========================================================================= */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1 flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-2xl p-2 px-3">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث باسم العروسة أو الجوال أو رقم الحجز..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-white placeholder-slate-400 focus:outline-hidden"
                />
                {searchFilter && (
                  <button type="button" onClick={() => setSearchFilter('')} className="text-slate-400 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'upcoming', label: 'القادمة' },
                  { id: 'today', label: 'اليوم' },
                  { id: 'completed', label: 'المنفذة' },
                  { id: 'cancelled', label: 'الملغاة' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      statusFilter === f.id
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookings Cards */}
            {artistBookings.length === 0 ? (
              <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-12 text-center">
                <Calendar size={36} className="mx-auto text-slate-600 mb-3" />
                <h3 className="text-sm font-bold text-slate-300">لا توجد حجوزات عرائس مطابقة</h3>
                <p className="text-xs text-slate-500 mt-1">
                  اضغطي على "تسجيل حجز عروسة جديد" لإضافة حجز وتحديد العربون وإرسال إيصال رسمي للعميلة
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('new_booking')}
                  className="mt-4 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus size={15} />
                  <span>تسجيل حجز جديد الآن</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {artistBookings.map((b) => {
                  const totals = calculateBookingTotals(b);
                  const isPendingHandover = b.depositStatus === 'transfer_pending';
                  const isInArtistCustody = b.depositStatus === 'in_artist_custody';
                  const isSalonReceived = b.depositStatus === 'salon_received';

                  return (
                    <div 
                      key={b.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-sm transition-all space-y-3"
                    >
                      {/* Top Info Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold bg-slate-800 text-pink-300 border border-slate-700 px-2 py-0.5 rounded-lg">
                            #{b.bookingCode || b.id.slice(-6)}
                          </span>
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Calendar size={13} className="text-pink-400" />
                            <span>{b.date}</span>
                            <span className="text-slate-500">|</span>
                            <Clock size={13} className="text-pink-400" />
                            <span>{b.time}</span>
                          </span>
                        </div>

                        {/* Booking Status Badge */}
                        <div className="flex items-center gap-1.5">
                          {b.status === 'confirmed' && (
                            <span className="text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-bold">
                              مؤكد
                            </span>
                          )}
                          {b.status === 'completed' && (
                            <span className="text-[11px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-lg font-bold">
                              منفذ بالصالون
                            </span>
                          )}
                          {b.status === 'cancelled' && (
                            <span className="text-[11px] bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-lg font-bold">
                              ملغي
                            </span>
                          )}
                          {b.status === 'postponed' && (
                            <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-lg font-bold">
                              مؤجل
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bride Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{b.clientName}</span>
                            {b.location && (
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <MapPin size={10} className="text-pink-400" />
                                {b.location}
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="font-mono text-slate-300" dir="ltr">{b.phone}</span>
                            {b.notes && <span className="text-slate-500 truncate max-w-xs">"{b.notes}"</span>}
                          </div>
                        </div>

                        {/* Financial Totals */}
                        <div className="flex items-center gap-3 bg-slate-950 p-2 px-3 rounded-xl border border-slate-800/80 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">الإجمالي:</span>
                            <span className="font-bold text-white font-mono">{totals.netTotal.toFixed(2)} {currency}</span>
                          </div>
                          <div className="h-6 w-px bg-slate-800" />
                          <div>
                            <span className="text-[10px] text-emerald-400 block">العربون:</span>
                            <span className="font-bold text-emerald-400 font-mono">{totals.advances.toFixed(2)} {currency}</span>
                          </div>
                          <div className="h-6 w-px bg-slate-800" />
                          <div>
                            <span className="text-[10px] text-pink-400 block">المتبقي:</span>
                            <span className="font-bold text-pink-400 font-mono">{totals.remaining.toFixed(2)} {currency}</span>
                          </div>
                        </div>
                      </div>

                      {/* Services Pills */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(b.services || []).map((s, idx) => (
                          <span key={idx} className="text-[11px] bg-slate-800/70 text-slate-300 border border-slate-700/60 px-2.5 py-1 rounded-lg">
                            {s.serviceName || (s as any).name} ({(s.price || 0)} {currency})
                          </span>
                        ))}
                      </div>

                      {/* Deposit Handover Bar (Dual Handshake Area) */}
                      {totals.advances > 0 && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            {isInArtistCustody && (
                              <span className="flex items-center gap-1.5 text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                                <AlertCircle size={14} />
                                <span>العربون في عهدتكِ ({totals.advances} {currency})</span>
                              </span>
                            )}
                            {isPendingHandover && (
                              <span className="flex items-center gap-1.5 text-sky-300 font-bold bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 rounded-lg">
                                <Clock size={14} className="animate-spin" />
                                <span>طلب التسليم معلق (بانتظار تأكيد استلام الصالون)</span>
                              </span>
                            )}
                            {isSalonReceived && (
                              <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 size={14} />
                                <span>تم استلام العربون واعتماده في خزينة الصالون رسمياً</span>
                              </span>
                            )}
                          </div>

                          {/* Handover Action button */}
                          <div className="flex items-center gap-2">
                            {isInArtistCustody && (
                              <button
                                type="button"
                                onClick={() => handleOpenHandoverModal(b)}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                              >
                                <DollarSign size={13} />
                                <span>تسليم العربون للصالون</span>
                              </button>
                            )}

                            {/* Resend WhatsApp button */}
                            <button
                              type="button"
                              onClick={() => handleSendBookingWhatsApp(b)}
                              disabled={isSendingWhatsApp === b.id}
                              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="إرسال إيصال الحجز كملف PDF للعروسة بالواتساب"
                            >
                              <Send size={12} />
                              <span>{isSendingWhatsApp === b.id ? 'جارٍ الإرسال...' : 'إرسال PDF واتساب'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* HANDOVER DEPOSIT MODAL */}
      {/* ========================================================================= */}
      {handoverBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in" dir="rtl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <DollarSign size={16} className="text-amber-400" />
                <span>تسليم عربون الحجز للصالون</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setHandoverBooking(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-400">حجز العروسة: <b className="text-white">{handoverBooking.clientName}</b></div>
                <div className="text-slate-400 mt-1">
                  قيمة العربون: <b className="text-emerald-400 font-mono text-sm">{handoverBooking.paidDeposit || handoverBooking.advancePayments?.[0]?.amount || 0} {currency}</b>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">طريقة التسليم / التحويل *</label>
                <select
                  value={handoverMethod}
                  onChange={(e) => setHandoverMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="انستاباي">انستاباي (Instapay)</option>
                  <option value="فودافون كاش">فودافون كاش / محفظة إلكترونية</option>
                  <option value="تحويل بنكي">تحويل بنكي مباشر</option>
                  <option value="كاش يدوي">كاش يدوي لإدارة الصالون</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">رقم الحوالة / تفاصيل التحويل</label>
                <input
                  type="text"
                  placeholder="مثال: تم التحويل من حساب سماح رقم العملية #12345..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px] leading-relaxed">
                ℹ️ بعد الضغط على تأكيد التسليم، سيصل طلب فوري لإدارة الصالون لمطابقة الحوالة، وعندما يضغط المدير "تأكيد الاستلام" سيدخل المبلغ رسمياً في خزائن الصالون وتتغير الحالة لـ (معتمد).
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setHandoverBooking(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSubmitHandover}
                  disabled={isSubmittingHandover}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black shadow-md flex items-center justify-center gap-1.5"
                >
                  {isSubmittingHandover ? 'جارٍ الإرسال...' : 'تأكيد إرسال الطلب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
