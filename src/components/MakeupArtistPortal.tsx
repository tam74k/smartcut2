import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Calendar, Clock, Phone, User, CheckCircle2, AlertCircle, 
  Send, Plus, LogOut, Search, MapPin, DollarSign, 
  ArrowLeft, X, Check, Lock, KeyRound, Eye, EyeOff, ShieldCheck, ShieldAlert,
  Edit2, RotateCcw
} from 'lucide-react';
import { AppSettings, Branch, Booking, MakeupArtist, BookingService, Service, AppUser } from '../types';
import { DB } from '../services/db';
import { AuthService } from '../services/auth';
import { EvolutionApiService } from '../services/evolutionApiService';
import { calculateBookingTotals } from './BookingsScreen';

interface MakeupArtistPortalProps {
  settings: AppSettings;
  branches: Branch[];
  services: Service[];
  bookings: Booking[];
  currentUser?: AppUser | null;
  onSaveBooking?: (booking: Booking) => void;
  onCancelBooking?: (bookingId: string) => void;
  onSwitchToMainApp?: () => void;
  onLogout?: () => void;
}

export function MakeupArtistPortal({
  settings,
  branches,
  services,
  bookings,
  currentUser,
  onSaveBooking,
  onCancelBooking,
  onSwitchToMainApp,
  onLogout
}: MakeupArtistPortalProps) {
  // Authentication State
  const [currentArtist, setCurrentArtist] = useState<MakeupArtist | null>(null);
  const [isLoadingArtist, setIsLoadingArtist] = useState(true);
  const [allArtists, setAllArtists] = useState<MakeupArtist[]>([]);

  // App Navigation / Views
  const [activeTab, setActiveTab] = useState<'bookings' | 'new_booking' | 'change_password'>('bookings');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'today' | 'completed' | 'cancelled'>('all');

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Booking Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('14:00');
  const [bookingLocation, setBookingLocation] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<{ [serviceId: string]: number }>({});
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositHandoverNow, setDepositHandoverNow] = useState(false);
  const [depositMethod, setDepositMethod] = useState('انستاباي');
  const [depositNotes, setDepositNotes] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Booking State
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  // Handover Deposit Modal on Existing Booking
  const [handoverBooking, setHandoverBooking] = useState<Booking | null>(null);
  const [handoverMethod, setHandoverMethod] = useState('انستاباي');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  // WhatsApp Sending State
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<string | null>(null);

  const currency = settings.currency || 'ج.م';
  const salonName = settings.salonName || 'صالون التجميل';

  // Load and match current artist from DB
  useEffect(() => {
    let isMounted = true;
    const fetchAndMatch = async () => {
      setIsLoadingArtist(true);
      try {
        const artists = await DB.fetchMakeupArtists(settings.salonId);
        if (!isMounted) return;
        setAllArtists(artists || []);

        if (currentUser) {
          // Match by userId or username
          const matched = artists.find(a => 
            (a.userId && a.userId === currentUser.id) ||
            (a.username && currentUser.username && a.username.trim().toLowerCase() === currentUser.username.trim().toLowerCase())
          );

          if (matched) {
            setCurrentArtist(matched);
            setIsLoadingArtist(false);
            return;
          }

          // If current user is owner/admin and accessing portal, allow previewing first artist
          if (currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer') {
            if (artists.length > 0) {
              setCurrentArtist(artists[0]);
            }
          }
        } else {
          // Check localStorage legacy session if present
          const saved = localStorage.getItem('smartcut_artist_session');
          if (saved) {
            const parsed = JSON.parse(saved);
            const fresh = artists.find(a => a.id === parsed.id);
            if (fresh && fresh.isActive) {
              setCurrentArtist(fresh);
            }
          }
        }
      } catch (e) {
        console.error('Error fetching makeup artists in portal:', e);
      } finally {
        if (isMounted) setIsLoadingArtist(false);
      }
    };

    fetchAndMatch();
    return () => { isMounted = false; };
  }, [settings.salonId, currentUser]);

  // Set default booking location to the makeup artist's name
  useEffect(() => {
    if (currentArtist?.name && !bookingLocation) {
      setBookingLocation(currentArtist.name);
    }
  }, [currentArtist?.name, bookingLocation]);

  const handleLogoutClick = () => {
    localStorage.removeItem('smartcut_artist_session');
    setCurrentArtist(null);
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/';
    }
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

  // Start Editing an existing booking (Only open/non-executed bookings)
  const handleStartEditBooking = (b: Booking) => {
    if (b.status === 'completed' || b.status === 'cancelled') {
      alert('عذراً، لا يمكن تعديل هذا الحجز لأنه تم تنفيذه أو إلغاؤه بالفعل.');
      return;
    }

    setEditingBooking(b);
    setClientName(b.clientName || '');
    setClientPhone(b.phone || '');
    setBookingDate(b.date || new Date().toISOString().split('T')[0]);
    setBookingTime(b.time || '14:00');
    setBookingLocation(b.location || currentArtist?.name || '');
    setClientNotes(b.notes || '');

    // Map existing services to selected quantities
    const selected: { [serviceId: string]: number } = {};
    if (Array.isArray(b.services)) {
      b.services.forEach((s: any) => {
        const sId = s.id || s.serviceId;
        if (sId) {
          selected[sId] = (selected[sId] || 0) + (Number(s.quantity) || 1);
        }
      });
    }
    setSelectedServiceIds(selected);

    // Extract deposit
    const totalDep = b.paidDeposit || (b.advancePayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0);
    setDepositAmount(totalDep);
    setDepositHandoverNow(b.depositStatus === 'transfer_pending' || b.depositStatus === 'salon_received');
    setDepositMethod(b.depositTransferMethod || 'انستاباي');
    setDepositNotes(b.depositTransferNotes || '');

    setActiveTab('new_booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingBooking(null);
    setClientName('');
    setClientPhone('');
    setBookingDate(new Date().toISOString().split('T')[0]);
    setBookingTime('14:00');
    setBookingLocation(currentArtist?.name || '');
    setSelectedServiceIds({});
    setDepositAmount(0);
    setDepositHandoverNow(false);
    setDepositMethod('انستاباي');
    setDepositNotes('');
    setClientNotes('');
    setActiveTab('bookings');
  };

  // Submit New Booking or Save Booking Edits
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentArtist) return;
    if (!clientName.trim()) {
      alert('يرجى إدخال اسم العروسة / العميلة.');
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

      if (editingBooking) {
        // Updating existing booking
        const existingAdv = editingBooking.advancePayments || [];
        const advancePaymentsList = newBookingTotals.advances > 0 ? [{
          id: existingAdv[0]?.id || ('ADV-' + Date.now()),
          amount: newBookingTotals.advances,
          date: bookingDate + 'T' + bookingTime + ':00',
          paymentMethod: depositHandoverNow ? depositMethod : (existingAdv[0]?.paymentMethod || 'cash_with_artist'),
          notes: depositHandoverNow 
            ? `عربون حجز عروسة تم تحويله للصالون (${depositMethod}) - بانتظار الاعتماد` 
            : (existingAdv[0]?.notes || 'العربون في عهدة الميكب ارتست')
        }, ...existingAdv.slice(1)] : [];

        const updatedBooking: Booking = {
          ...editingBooking,
          clientName: clientName.trim(),
          phone: clientPhone.trim(),
          date: bookingDate,
          time: bookingTime,
          location: bookingLocation || currentArtist.name,
          services: newBookingTotals.selectedList,
          advancePayments: advancePaymentsList,
          totalAmount: newBookingTotals.netTotal,
          paidDeposit: newBookingTotals.advances,
          depositStatus: newBookingTotals.advances <= 0 
            ? 'none' 
            : (depositHandoverNow ? 'transfer_pending' : (editingBooking.depositStatus === 'salon_received' ? 'salon_received' : 'in_artist_custody')),
          depositTransferMethod: depositHandoverNow ? depositMethod : editingBooking.depositTransferMethod,
          depositTransferNotes: depositHandoverNow ? depositNotes.trim() : editingBooking.depositTransferNotes,
          depositTransferRequestedAt: depositHandoverNow ? (editingBooking.depositTransferRequestedAt || nowIso) : undefined,
          notes: clientNotes.trim() || undefined,
          internalNotes: `[حجز ميكب ارتست: ${currentArtist.name}] (معدل) ${clientNotes.trim()}`,
          updatedAt: nowIso,
          updated_at: nowIso as any,
          updatedBy: currentArtist.name,
          isModified: true
        };

        // 1. Save in DB / Supabase
        await DB.saveBooking(updatedBooking, settings.salonId);

        // 2. Notify parent if callback provided
        if (onSaveBooking) {
          onSaveBooking(updatedBooking);
        }

        alert(`تم حفظ وتحديث بيانات حجز العروسة (${clientName}) برقم #${editingBooking.bookingCode || editingBooking.id.slice(-6)} بنجاح!`);

        // Reset form
        setEditingBooking(null);
        setClientName('');
        setClientPhone('');
        setSelectedServiceIds({});
        setDepositAmount(0);
        setDepositHandoverNow(false);
        setDepositNotes('');
        setClientNotes('');
        setBookingLocation(currentArtist?.name || '');
        setActiveTab('bookings');
        return;
      }

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
        location: bookingLocation || currentArtist.name,
        status: 'pending',
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

      alert(`تم تسجيل حجز العروسة (${clientName}) برقم #${bookingCode} بنجاح!`);

      // Reset form
      setClientName('');
      setClientPhone('');
      setSelectedServiceIds({});
      setDepositAmount(0);
      setDepositHandoverNow(false);
      setDepositNotes('');
      setClientNotes('');
      setBookingLocation(currentArtist?.name || '');
      setActiveTab('bookings');
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ الحجز: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Standard Password Rules Validation
  const pwdMinLength = newPassword.length >= 6;
  const pwdHasLetters = /[a-zA-Z\u0621-\u064A]/.test(newPassword);
  const pwdHasNumbers = /[0-9]/.test(newPassword);
  const pwdDifferentFromOld = Boolean(newPassword && oldPassword && newPassword !== oldPassword);
  const pwdMatchesConfirm = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);
  const isPasswordReadyToSubmit = pwdMinLength && pwdHasLetters && pwdHasNumbers && pwdMatchesConfirm && Boolean(oldPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatusMsg(null);

    if (!currentArtist) {
      setPasswordStatusMsg({ type: 'error', text: 'لم يتم العثور على بيانات الميكب ارتست الحالية.' });
      return;
    }

    if (!oldPassword) {
      setPasswordStatusMsg({ type: 'error', text: 'يرجى إدخال كلمة المرور الحالية.' });
      return;
    }

    if (!pwdMinLength) {
      setPasswordStatusMsg({ type: 'error', text: 'كلمة المرور الجديدة يجب ألا تقل عن 6 خانات.' });
      return;
    }

    if (!pwdHasLetters || !pwdHasNumbers) {
      setPasswordStatusMsg({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تحتوي على أحرف وأرقام معاً.' });
      return;
    }

    if (newPassword === oldPassword) {
      setPasswordStatusMsg({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatusMsg({ type: 'error', text: 'كلمة المرور الجديدة غير متطابقة مع تأكيدها.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      // 1. Verify old password against current artist and current user
      const artistOldPass = String(currentArtist.password || '').trim();
      const userOldPass = String(currentUser?.password || (currentUser as any)?.passwordHash || (currentUser as any)?.password_hash || '').trim();

      const matchesArtist = artistOldPass ? (artistOldPass === oldPassword.trim()) : true;
      const matchesUser = userOldPass ? (userOldPass === oldPassword.trim()) : true;

      if (!matchesArtist && !matchesUser) {
        setPasswordStatusMsg({ type: 'error', text: 'كلمة المرور الحالية غير صحيحة.' });
        setIsChangingPassword(false);
        return;
      }

      // 2. Update user in AuthService & DB users table
      if (currentUser) {
        const userRes = await AuthService.changePasswordAsync(currentUser, oldPassword, newPassword);
        if (!userRes.success && userRes.message && !userRes.message.includes('لم يتم العثور')) {
          setPasswordStatusMsg({ type: 'error', text: userRes.message });
          setIsChangingPassword(false);
          return;
        }
      }

      // 3. Update currentArtist in DB (makeup_artists)
      const updatedArtist: MakeupArtist = {
        ...currentArtist,
        password: newPassword.trim(),
        updatedAt: new Date().toISOString()
      };
      await DB.saveMakeupArtist(updatedArtist, settings.salonId);

      // 4. Update local state & session storage
      setCurrentArtist(updatedArtist);
      try {
        localStorage.setItem('smartcut_artist_session', JSON.stringify(updatedArtist));
      } catch (err) {}

      setPasswordStatusMsg({ 
        type: 'success', 
        text: 'تم تعديل كلمة المرور بنجاح! يمكنكِ الآن استخدام كلمة المرور الجديدة لتسجيل الدخول.' 
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error changing makeup artist password:', err);
      setPasswordStatusMsg({ type: 'error', text: 'حدث خطأ أثناء تغيير كلمة المرور: ' + (err?.message || err) });
    } finally {
      setIsChangingPassword(false);
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

  // Loading state
  if (isLoadingArtist) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 font-sans" dir="rtl">
        <div className="w-10 h-10 border-3 border-pink-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-600">جارٍ تهيئة بوابة الميكب ارتست...</p>
      </div>
    );
  }

  // If user is not matched to an artist
  if (!currentArtist) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 font-sans" dir="rtl">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-pink-50 border border-pink-200 text-pink-600 flex items-center justify-center mx-auto">
            <Sparkles size={28} />
          </div>
          <h2 className="text-lg font-black text-slate-900">{salonName}</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            لم يتم العثور على حساب ميكب ارتست مرتبط بالمستخدم الحالي أو الحساب موقوف. يرجى التواصل مع إدارة الصالون لتفعيل حسابك وتخصيص الخدمات.
          </p>

          {/* Admin selector if admin/owner */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'owner') && allArtists.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 text-right">معاينة كأحد الميكب ارتست:</label>
              <select 
                onChange={(e) => {
                  const a = allArtists.find(art => art.id === e.target.value);
                  if (a) setCurrentArtist(a);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
              >
                <option value="">-- اختر ميكب ارتست --</option>
                {allArtists.map(a => (
                  <option key={a.id} value={a.id}>{a.name} (@{a.username})</option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-3 flex gap-2">
            {onSwitchToMainApp && currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer') && (
              <button
                type="button"
                onClick={onSwitchToMainApp}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                العودة للرئيسية
              </button>
            )}
            <button
              type="button"
              onClick={handleLogoutClick}
              className="flex-1 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold cursor-pointer shadow-xs"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Portal View
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-white/95 border-b border-slate-200/80 sticky top-0 z-20 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={salonName} className="w-9 h-9 rounded-xl object-contain bg-slate-50 p-1 border border-slate-200" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 border border-pink-200 flex items-center justify-center font-bold">
                <Sparkles size={18} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900">{salonName}</h1>
                <span className="text-[10px] bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full font-bold">
                  {currentArtist.name}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">بوابة حجز العرائس المخصصة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToMainApp && currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer') && (
              <button
                type="button"
                onClick={onSwitchToMainApp}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span className="hidden sm:inline">النظام العام</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPasswordStatusMsg(null);
                setActiveTab('change_password');
              }}
              className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'change_password'
                  ? 'bg-pink-100 text-pink-800 border-pink-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="تعديل كلمة المرور"
            >
              <KeyRound size={13} />
              <span className="hidden sm:inline">كلمة المرور</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
        <div className="flex rounded-2xl bg-slate-200/70 p-1.5 border border-slate-200 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'bookings'
                ? 'bg-white text-pink-700 shadow-xs border border-pink-200/80'
                : 'text-slate-600 hover:text-slate-900'
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
                ? 'bg-white text-pink-700 shadow-xs border border-pink-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {editingBooking ? <Edit2 size={15} /> : <Plus size={16} />}
            <span>{editingBooking ? `تعديل حجز #${editingBooking.bookingCode || editingBooking.id.slice(-6)}` : 'تسجيل حجز عروسة جديد'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPasswordStatusMsg(null);
              setActiveTab('change_password');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'change_password'
                ? 'bg-white text-pink-700 shadow-xs border border-pink-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound size={15} />
            <span>تعديل كلمة المرور</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: NEW BOOKING / EDIT BOOKING FOR BRIDE */}
        {/* ========================================================================= */}
        {activeTab === 'new_booking' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-6 animate-in fade-in">
            {editingBooking && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                <div className="flex items-center gap-2 font-bold">
                  <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[11px] font-black">
                    وضع التعديل
                  </span>
                  <span>
                    أنتِ تقومين بتعديل الحجز رقم #{editingBooking.bookingCode || editingBooking.id.slice(-6)} للعروسة ({editingBooking.clientName})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-auto flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>إلغاء التعديل والعودة</span>
                </button>
              </div>
            )}

            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                {editingBooking ? (
                  <>
                    <Edit2 size={18} className="text-amber-600" />
                    <span>تعديل بيانات حجز العروسة</span>
                    <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-lg font-mono">
                      #{editingBooking.bookingCode || editingBooking.id.slice(-6)}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="text-pink-600" />
                    <span>حجز موعد عروسة جديد</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {editingBooking
                  ? 'يمكنك تعديل بيانات العروسة، موعد الحضور، الخدمات، والعربون بالأسعار المعتمدة لكِ'
                  : 'الخدمات المتاحة أدناه مخصصة لكِ حصرياً بالأسعار المعتمدة لكِ من إدارة الصالون'}
              </p>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-5">
              {/* Client Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم العروسة / العميلة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ياسمين ممدوح..."
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الجوال *</label>
                  <input
                    type="tel"
                    required
                    placeholder="مثال: 01012345678"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-pink-500 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Date, Time, Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ الموعد *</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-pink-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">وقت الحضور *</label>
                  <input
                    type="time"
                    required
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-pink-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">مكان الحجز / التخصيص</label>
                  <select
                    value={bookingLocation}
                    onChange={(e) => setBookingLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-pink-500 cursor-pointer font-bold"
                  >
                    {currentArtist?.name && (
                      <option value={currentArtist.name}>{currentArtist.name}</option>
                    )}
                    <option value="داخل الصالون">داخل الصالون</option>
                    <option value="خارجي (فندق / قاعة)">خارجي (فندق / قاعة)</option>
                    <option value="خارجي (منزل العميلة)">خارجي (منزل العميلة)</option>
                  </select>
                </div>
              </div>

              {/* Customized Services Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>الخدمات المخصصة لكِ (حددي الخدمات المطلوبة) *</span>
                  <span className="text-[11px] text-pink-700 font-normal">
                    {availableServices.length} خدمات مخصصة
                  </span>
                </label>

                {availableServices.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center text-xs text-amber-800">
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
                              ? 'bg-pink-50 border-pink-300 text-pink-950 shadow-xs'
                              : 'bg-slate-50 border-slate-200/80 hover:border-pink-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'bg-pink-600 border-pink-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check size={13} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block truncate">{as.serviceName}</span>
                              <span className="text-[11px] text-pink-700 font-mono font-bold">
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
                                className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-mono font-bold w-5 text-center text-slate-900">{qty}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceIds(prev => ({
                                    ...prev,
                                    [as.serviceId]: qty + 1
                                  }));
                                }}
                                className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center cursor-pointer"
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
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs">
                  <span className="text-slate-600">إجمالي الخدمات المختارة:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {newBookingTotals.gross.toFixed(2)} {currency}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      العربون المحصل من العروسة ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={depositAmount || ''}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-mono font-bold focus:outline-hidden focus:border-pink-500"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-600">المتبقي عند الحضور:</span>
                    <span className="text-sm font-black text-pink-700 font-mono">
                      {newBookingTotals.remaining.toFixed(2)} {currency}
                    </span>
                  </div>
                </div>

                {/* Handover toggle if deposit > 0 */}
                {depositAmount > 0 && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={depositHandoverNow}
                        onChange={(e) => setDepositHandoverNow(e.target.checked)}
                        className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-emerald-700">
                        تم تحويل هذا العربون لحساب الصالون الآن (إرسال طلب تسليم العربون للصالون)
                      </span>
                    </label>

                    {depositHandoverNow && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200 animate-in fade-in">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">طريقة التحويل</label>
                          <select
                            value={depositMethod}
                            onChange={(e) => setDepositMethod(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                          >
                            <option value="انستاباي">انستاباي (Instapay)</option>
                            <option value="فودافون كاش">فودافون كاش / محفظة</option>
                            <option value="تحويل بنكي">تحويل بنكي</option>
                            <option value="كاش يدوي">كاش يدوي بالصالون</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم الحوالة / اسم المحول</label>
                          <input
                            type="text"
                            placeholder="اختياري (مثل: باسم سماح أو رقم العملية)..."
                            value={depositNotes}
                            onChange={(e) => setDepositNotes(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 placeholder-slate-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات خاصة بالحجز (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل تخص الفستان أو الموعد أو رغبات العروسة..."
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || newBookingTotals.selectedList.length === 0}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{editingBooking ? 'جارٍ حفظ التعديلات...' : 'جارٍ تسجيل الحجز...'}</span>
                  </>
                ) : (
                  <>
                    {editingBooking ? <Check size={16} /> : <Sparkles size={16} />}
                    <span>{editingBooking ? 'حفظ وتأكيد تعديلات الحجز' : 'تأكيد تسجيل حجز العروسة'}</span>
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
              <div className="flex-1 flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl p-2 px-3 shadow-xs">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث باسم العروسة أو الجوال أو رقم الحجز..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
                />
                {searchFilter && (
                  <button type="button" onClick={() => setSearchFilter('')} className="text-slate-400 hover:text-slate-600">
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
                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookings Cards */}
            {artistBookings.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center">
                <Calendar size={36} className="mx-auto text-slate-400 mb-3" />
                <h3 className="text-sm font-bold text-slate-700">لا توجد حجوزات عرائس مطابقة</h3>
                <p className="text-xs text-slate-500 mt-1">
                  اضغطي على "تسجيل حجز عروسة جديد" لإضافة حجز وتحديد العربون وإرسال إيصال رسمي للعميلة
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('new_booking')}
                  className="mt-4 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                  const isModified = Boolean(
                    b.isModified || 
                    (b as any).is_modified || 
                    (b.updatedAt && b.createdAt && b.updatedAt !== b.createdAt) || 
                    ((b as any).updated_at && (b as any).created_at && (b as any).updated_at !== (b as any).created_at)
                  );
                  const canEdit = b.status !== 'completed' && b.status !== 'cancelled';

                  return (
                    <div 
                      key={b.id}
                      className="bg-white border border-slate-200/90 hover:border-pink-300 rounded-2xl p-4 shadow-xs transition-all space-y-3"
                    >
                      {/* Top Info Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          {isModified && (
                            <span className="text-[11px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-md shadow-2xs">
                              (معدل)
                            </span>
                          )}
                          <span className="text-xs font-mono font-bold bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-lg">
                            #{b.bookingCode || b.id.slice(-6)}
                          </span>
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Calendar size={13} className="text-pink-600" />
                            <span>{b.date}</span>
                            <span className="text-slate-400">|</span>
                            <Clock size={13} className="text-pink-600" />
                            <span>{b.time}</span>
                          </span>
                        </div>

                        {/* Booking Status Badge */}
                        <div className="flex items-center gap-1.5">
                          {b.status === 'confirmed' && (
                            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-bold">
                              مؤكد
                            </span>
                          )}
                          {b.status === 'completed' && (
                            <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg font-bold">
                              منفذ بالصالون
                            </span>
                          )}
                          {b.status === 'cancelled' && (
                            <span className="text-[11px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg font-bold">
                              ملغي
                            </span>
                          )}
                          {b.status === 'postponed' && (
                            <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">
                              مؤجل
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bride Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span>{b.clientName}</span>
                            {b.location && (
                              <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <MapPin size={10} className="text-pink-600" />
                                {b.location}
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="font-mono text-slate-700" dir="ltr">{b.phone}</span>
                            {b.notes && <span className="text-slate-500 truncate max-w-xs">"{b.notes}"</span>}
                          </div>
                        </div>

                        {/* Financial Totals */}
                        <div className="flex items-center gap-3 bg-slate-50 p-2 px-3 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">الإجمالي:</span>
                            <span className="font-bold text-slate-900 font-mono">{totals.netTotal.toFixed(2)} {currency}</span>
                          </div>
                          <div className="h-6 w-px bg-slate-200" />
                          <div>
                            <span className="text-[10px] text-emerald-700 block">العربون:</span>
                            <span className="font-bold text-emerald-700 font-mono">{totals.advances.toFixed(2)} {currency}</span>
                          </div>
                          <div className="h-6 w-px bg-slate-200" />
                          <div>
                            <span className="text-[10px] text-pink-700 block">المتبقي:</span>
                            <span className="font-bold text-pink-700 font-mono">{totals.remaining.toFixed(2)} {currency}</span>
                          </div>
                        </div>
                      </div>

                      {/* Services Pills */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(b.services || []).map((s, idx) => (
                          <span key={idx} className="text-[11px] bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg">
                            {s.serviceName || (s as any).name} ({(s.price || 0)} {currency})
                          </span>
                        ))}
                      </div>

                      {/* Deposit Handover Bar (Dual Handshake Area) */}
                      {totals.advances > 0 && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            {isInArtistCustody && (
                              <span className="flex items-center gap-1.5 text-amber-800 font-bold bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg">
                                <AlertCircle size={14} className="text-amber-700" />
                                <span>العربون في عهدتكِ ({totals.advances} {currency})</span>
                              </span>
                            )}
                            {isPendingHandover && (
                              <span className="flex items-center gap-1.5 text-sky-800 font-bold bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg">
                                <Clock size={14} className="animate-spin text-sky-700" />
                                <span>طلب التسليم معلق (بانتظار تأكيد استلام الصالون)</span>
                              </span>
                            )}
                            {isSalonReceived && (
                              <span className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 size={14} className="text-emerald-700" />
                                <span>تم استلام العربون واعتماده في خزينة الصالون رسمياً</span>
                              </span>
                            )}
                          </div>

                          {/* Handover Action button */}
                          {isInArtistCustody && (
                            <div>
                              <button
                                type="button"
                                onClick={() => handleOpenHandoverModal(b)}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                              >
                                <DollarSign size={13} />
                                <span>تسليم العربون للصالون</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Booking Card Footer Actions */}
                      <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => handleStartEditBooking(b)}
                              className="bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-98"
                              title="تعديل بيانات الحجز والخدمات والعربون"
                            >
                              <Edit2 size={13} className="text-pink-600" />
                              <span>تعديل الحجز</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-200/70 px-2.5 py-1 rounded-lg">
                              {b.status === 'completed' ? 'الحجز منفذ بالصالون (لا يمكن التعديل)' : 'الحجز ملغي (لا يمكن التعديل)'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendBookingWhatsApp(b)}
                            disabled={isSendingWhatsApp === b.id}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            title="إرسال إيصال الحجز كملف PDF للعروسة بالواتساب"
                          >
                            <Send size={12} />
                            <span>{isSendingWhatsApp === b.id ? 'جارٍ الإرسال...' : 'إرسال PDF واتساب'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CHANGE PASSWORD SCREEN */}
        {/* ========================================================================= */}
        {activeTab === 'change_password' && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 animate-in fade-in max-w-xl mx-auto">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-pink-50 border border-pink-200 text-pink-600 flex items-center justify-center font-bold shadow-2xs">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">تعديل كلمة المرور</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تغيير كلمة المرور الخاصة بحساب الميكب ارتست ({currentArtist.name})
                  </p>
                </div>
              </div>
            </div>

            {/* Status Alert Message */}
            {passwordStatusMsg && (
              <div className={`p-4 rounded-2xl border text-xs flex items-start gap-2.5 shadow-2xs ${
                passwordStatusMsg.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                {passwordStatusMsg.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="font-bold flex-1 leading-relaxed">
                  {passwordStatusMsg.text}
                </div>
                <button 
                  type="button" 
                  onClick={() => setPasswordStatusMsg(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Old Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>كلمة المرور الحالية (القديمة) *</span>
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="أدخلي كلمة المرور الحالية..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-pink-500 font-mono pr-3 pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showOldPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور الجديدة *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="أدخلي كلمة المرور الجديدة..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-pink-500 font-mono pr-3 pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showNewPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تأكيد كلمة المرور الجديدة (إعادة كتابتها) *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعيدي كتابة كلمة المرور الجديدة للتأكيد..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-pink-500 font-mono pr-3 pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showConfirmPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist (الشروط المتعارف عليها) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2.5 text-xs">
                <span className="font-black text-slate-800 block text-[11px] mb-1">
                  شروط تغيير كلمة المرور:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdMinLength ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${pwdMinLength ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-200 text-slate-600'}`}>
                      {pwdMinLength ? '✓' : '•'}
                    </div>
                    <span>6 خانات أو أحرف على الأقل</span>
                  </div>

                  <div className={`flex items-center gap-1.5 transition-colors ${(pwdHasLetters && pwdHasNumbers) ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${(pwdHasLetters && pwdHasNumbers) ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-200 text-slate-600'}`}>
                      {(pwdHasLetters && pwdHasNumbers) ? '✓' : '•'}
                    </div>
                    <span>تتضمن أحرفاً وأرقاماً معاً</span>
                  </div>

                  <div className={`flex items-center gap-1.5 transition-colors ${pwdDifferentFromOld ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${pwdDifferentFromOld ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-200 text-slate-600'}`}>
                      {pwdDifferentFromOld ? '✓' : '•'}
                    </div>
                    <span>مختلفة عن كلمة المرور القديمة</span>
                  </div>

                  <div className={`flex items-center gap-1.5 transition-colors ${pwdMatchesConfirm ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${pwdMatchesConfirm ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-200 text-slate-600'}`}>
                      {pwdMatchesConfirm ? '✓' : '•'}
                    </div>
                    <span>تطابق تأكيد كلمة المرور الجديدة</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isChangingPassword || !isPasswordReadyToSubmit}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 active:scale-98"
              >
                {isChangingPassword ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ تحديث كلمة المرور...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>حفظ وتحديث كلمة المرور</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* HANDOVER DEPOSIT MODAL */}
      {/* ========================================================================= */}
      {handoverBooking && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <DollarSign size={16} className="text-amber-600" />
                <span>تسليم عربون الحجز للصالون</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setHandoverBooking(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <div className="font-bold flex justify-between mb-1">
                  <span>العروسة: {handoverBooking.clientName}</span>
                  <span className="font-mono">{handoverBooking.paidDeposit} {currency}</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  عند إرسال طلب التسليم، ستقوم إدارة الصالون بالتحقق وتأكيد استلام المبلغ في الخزينة رسمياً.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة التحويل / السداد *</label>
                <select
                  value={handoverMethod}
                  onChange={(e) => setHandoverMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900"
                >
                  <option value="انستاباي">انستاباي (Instapay)</option>
                  <option value="فودافون كاش">فودافون كاش / محفظة إلكترونية</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                  <option value="كاش يدوي">كاش يدوي بالصالون</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم العملية أو اسم صاحب الحساب المحول</label>
                <input
                  type="text"
                  placeholder="مثال: رقم العملية 847291 أو باسم سماح..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-pink-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHandoverBooking(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSubmitHandover}
                  disabled={isSubmittingHandover}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer shadow-xs disabled:opacity-50"
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
