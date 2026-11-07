import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Plus, Edit2, Trash2, CheckCircle2, XCircle, Search, 
  ExternalLink, Copy, Check, DollarSign, Calendar, Clock, Phone, 
  User, Shield, AlertTriangle, ArrowRight, X, Power, Layers
} from 'lucide-react';
import { AppSettings, Branch, MakeupArtist, ArtistAssignedService, Service, Booking } from '../types';
import { DB } from '../services/db';

interface MakeupArtistsScreenProps {
  settings: AppSettings;
  branches: Branch[];
  services: Service[];
  bookings: Booking[];
  activeBranchId?: string;
  currentUser?: any;
}

export function MakeupArtistsScreen({
  settings,
  branches,
  services,
  bookings,
  activeBranchId,
  currentUser
}: MakeupArtistsScreenProps) {
  const [artists, setArtists] = useState<MakeupArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals
  const [showAddArtistModal, setShowAddArtistModal] = useState(false);
  const [editingArtist, setEditingArtist] = useState<MakeupArtist | null>(null);

  // Manage Services Modal
  const [selectedArtistForServices, setSelectedArtistForServices] = useState<MakeupArtist | null>(null);
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState<string>('');
  const [customPriceInput, setCustomPriceInput] = useState<number>(0);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    username: string;
    password: string;
    notes: string;
    isActive: boolean;
  }>({
    name: '',
    phone: '',
    username: '',
    password: '',
    notes: '',
    isActive: true
  });

  const loadArtists = async () => {
    setIsLoading(true);
    try {
      const data = await DB.fetchMakeupArtists(settings.salonId);
      setArtists(data || []);
    } catch (e) {
      console.error('Error loading makeup artists:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArtists();
  }, [settings.salonId]);

  const currency = settings.currency || 'ج.م';

  // Statistics
  const stats = useMemo(() => {
    const totalArtists = artists.length;
    const activeArtists = artists.filter(a => a.isActive).length;

    // Filter artist bookings
    const artistBookings = bookings.filter(b => b.artistId);
    const totalBookingsCount = artistBookings.length;

    // Deposits in artist custody
    const pendingDepositsSum = artistBookings
      .filter(b => b.depositStatus === 'in_artist_custody' || b.depositStatus === 'transfer_pending')
      .reduce((sum, b) => {
        const advSum = (b.advancePayments || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
        return sum + (advSum || Number(b.paidDeposit || 0));
      }, 0);

    // Deposits confirmed in salon treasury
    const receivedDepositsSum = artistBookings
      .filter(b => b.depositStatus === 'salon_received')
      .reduce((sum, b) => {
        const advSum = (b.advancePayments || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
        return sum + (advSum || Number(b.paidDeposit || 0));
      }, 0);

    return {
      totalArtists,
      activeArtists,
      totalBookingsCount,
      pendingDepositsSum,
      receivedDepositsSum
    };
  }, [artists, bookings]);

  const filteredArtists = useMemo(() => {
    return artists.filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.phone.includes(searchQuery)
    );
  }, [artists, searchQuery]);

  // Handlers for Add/Edit Artist
  const handleOpenAddModal = () => {
    setEditingArtist(null);
    setFormData({
      name: '',
      phone: '',
      username: '',
      password: '',
      notes: '',
      isActive: true
    });
    setShowAddArtistModal(true);
  };

  const handleOpenEditModal = (artist: MakeupArtist) => {
    setEditingArtist(artist);
    setFormData({
      name: artist.name,
      phone: artist.phone || '',
      username: artist.username,
      password: artist.password || '',
      notes: artist.notes || '',
      isActive: artist.isActive
    });
    setShowAddArtistModal(true);
  };

  const handleSaveArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim()) {
      alert('يرجى إدخال اسم الميكب ارتست واسم المستخدم.');
      return;
    }

    // Check username uniqueness among other artists
    const cleanUsername = formData.username.trim().toLowerCase();
    const isDuplicate = artists.some(a => 
      a.username.trim().toLowerCase() === cleanUsername && 
      (!editingArtist || a.id !== editingArtist.id)
    );

    if (isDuplicate) {
      alert('اسم المستخدم هذا مستخدم بالفعل لميكب ارتست أخرى. يرجى اختيار اسم مختلف.');
      return;
    }

    const newArtist: MakeupArtist = {
      id: editingArtist ? editingArtist.id : 'MUA-' + Date.now(),
      salonId: settings.salonId || 'default-salon',
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      username: cleanUsername,
      password: formData.password.trim() || '123456',
      notes: formData.notes.trim(),
      isActive: formData.isActive,
      createdAt: editingArtist ? editingArtist.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedServices: editingArtist ? (editingArtist.assignedServices || []) : []
    };

    await DB.saveMakeupArtist(newArtist, settings.salonId);
    setShowAddArtistModal(false);
    await loadArtists();
  };

  const handleDeleteArtist = async (artist: MakeupArtist) => {
    const confirm = window.confirm(`هل أنت متأكد من حذف الميكب ارتست (${artist.name})؟ لن يتم حذف الحجوزات السابقة المرتبطة بها.`);
    if (!confirm) return;

    await DB.deleteMakeupArtist(artist.id, settings.salonId);
    await loadArtists();
  };

  const handleToggleArtistActive = async (artist: MakeupArtist) => {
    const updated: MakeupArtist = {
      ...artist,
      isActive: !artist.isActive,
      updatedAt: new Date().toISOString()
    };
    await DB.saveMakeupArtist(updated, settings.salonId);
    await loadArtists();
  };

  // Handlers for Services Management per Artist
  const handleOpenServicesModal = (artist: MakeupArtist) => {
    setSelectedArtistForServices(artist);
    setSelectedServiceToAdd('');
    setCustomPriceInput(0);
    setServiceSearchQuery('');
  };

  const handleAddServiceToArtist = async () => {
    if (!selectedArtistForServices || !selectedServiceToAdd) {
      alert('يرجى اختيار خدمة لإضافتها.');
      return;
    }

    const srv = services.find(s => s.id === selectedServiceToAdd);
    if (!srv) return;

    // Check if already assigned
    const exists = (selectedArtistForServices.assignedServices || []).some(as => as.serviceId === srv.id);
    if (exists) {
      alert('هذه الخدمة مضافة بالفعل لهذه الارتست.');
      return;
    }

    const newAssignedService: ArtistAssignedService = {
      serviceId: srv.id,
      serviceName: srv.name,
      originalPrice: Number(srv.price || 0),
      customPrice: Number(customPriceInput > 0 ? customPriceInput : srv.price || 0),
      durationMinutes: srv.duration,
      isEnabled: true
    };

    const updatedArtist: MakeupArtist = {
      ...selectedArtistForServices,
      assignedServices: [...(selectedArtistForServices.assignedServices || []), newAssignedService],
      updatedAt: new Date().toISOString()
    };

    await DB.saveMakeupArtist(updatedArtist, settings.salonId);
    setSelectedArtistForServices(updatedArtist);
    setSelectedServiceToAdd('');
    setCustomPriceInput(0);
    await loadArtists();
  };

  const handleUpdateCustomPrice = async (serviceId: string, newPrice: number) => {
    if (!selectedArtistForServices) return;

    const updatedServices = (selectedArtistForServices.assignedServices || []).map(as => {
      if (as.serviceId === serviceId) {
        return { ...as, customPrice: Math.max(0, newPrice) };
      }
      return as;
    });

    const updatedArtist: MakeupArtist = {
      ...selectedArtistForServices,
      assignedServices: updatedServices,
      updatedAt: new Date().toISOString()
    };

    await DB.saveMakeupArtist(updatedArtist, settings.salonId);
    setSelectedArtistForServices(updatedArtist);
    await loadArtists();
  };

  const handleToggleServiceEnabled = async (serviceId: string) => {
    if (!selectedArtistForServices) return;

    const updatedServices = (selectedArtistForServices.assignedServices || []).map(as => {
      if (as.serviceId === serviceId) {
        return { ...as, isEnabled: !as.isEnabled };
      }
      return as;
    });

    const updatedArtist: MakeupArtist = {
      ...selectedArtistForServices,
      assignedServices: updatedServices,
      updatedAt: new Date().toISOString()
    };

    await DB.saveMakeupArtist(updatedArtist, settings.salonId);
    setSelectedArtistForServices(updatedArtist);
    await loadArtists();
  };

  const handleRemoveServiceFromArtist = async (serviceId: string) => {
    if (!selectedArtistForServices) return;

    const confirm = window.confirm('هل ترغب في إلغاء هذه الخدمة من قائمة الميكب ارتست؟');
    if (!confirm) return;

    const updatedServices = (selectedArtistForServices.assignedServices || []).filter(as => as.serviceId !== serviceId);

    const updatedArtist: MakeupArtist = {
      ...selectedArtistForServices,
      assignedServices: updatedServices,
      updatedAt: new Date().toISOString()
    };

    await DB.saveMakeupArtist(updatedArtist, settings.salonId);
    setSelectedArtistForServices(updatedArtist);
    await loadArtists();
  };

  const copyPortalLink = () => {
    const origin = window.location.origin;
    const url = `${origin}/?portal=artist`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/10">
              <Sparkles size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>الميكب ارتست وشركاء الصالون</span>
                <span className="text-xs bg-pink-500/20 text-pink-300 border border-pink-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  {artists.length} مسجلة
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة الميكب ارتست المرتبطين بالصالون، تخصيص الخدمات والأسعار لكل ارتست، وضبط استلام وتسليم العربون بالموافقة المزدوجة
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Copy Direct Portal Link */}
          <button
            type="button"
            onClick={copyPortalLink}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="نسخ رابط دخول بوابة الميكب ارتست لمشاركته معهن"
          >
            {copiedLink ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} className="text-slate-400" />}
            <span>{copiedLink ? 'تم نسخ رابط البوابة!' : 'رابط تطبيق الارتست'}</span>
          </button>

          {/* Add Artist Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-pink-600/20 active:scale-98"
          >
            <Plus size={16} />
            <span>إضافة ميكب ارتست جديدة</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">إجمالي الميكب ارتست</span>
              <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">{stats.totalArtists}</div>
              <div className="text-[11px] text-emerald-400 mt-1 font-semibold">{stats.activeArtists} حسابات نشطة</div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">حجوزات الارتست المسجلة</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Calendar size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">{stats.totalBookingsCount}</div>
              <div className="text-[11px] text-slate-400 mt-1">حجوزات عرائس عبر البوابة</div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-amber-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between bg-gradient-to-br from-amber-500/5 to-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-300 font-bold">عربون بعهدة الارتست (معلق)</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-300 font-mono">
                {stats.pendingDepositsSum.toFixed(2)} <span className="text-xs text-amber-400">{currency}</span>
              </div>
              <div className="text-[11px] text-amber-400/80 mt-1">لم يدخل خزائن الصالون بعد</div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-emerald-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between bg-gradient-to-br from-emerald-500/5 to-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-300 font-bold">عربون معتمد بالخزينة</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {stats.receivedDepositsSum.toFixed(2)} <span className="text-xs text-emerald-500">{currency}</span>
              </div>
              <div className="text-[11px] text-emerald-400/80 mt-1">مسدد ومقيد رسمياً بالخزائن</div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 rounded-2xl p-2 px-3 shadow-inner">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، اسم المستخدم، أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-slate-100 placeholder-slate-400 text-xs sm:text-sm focus:outline-hidden"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Artists Grid */}
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold">جارٍ تحميل بيانات الميكب ارتست...</p>
          </div>
        ) : filteredArtists.length === 0 ? (
          <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
            <Sparkles size={40} className="mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-300">لا توجد ميكب ارتست مسجلة حالياً</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              يمكنك إضافة أول ميكب ارتست متعاونة مع صالونك وتحديد الخدمات المخصصة لها بأسعار خاصة لتتمكن من حجز العرائس من هاتفها مباشرة.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-4 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Plus size={15} />
              <span>إضافة ميكب ارتست الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredArtists.map((artist) => {
              const artistBookings = bookings.filter(b => b.artistId === artist.id);
              const servicesCount = (artist.assignedServices || []).length;
              const activeServicesCount = (artist.assignedServices || []).filter(s => s.isEnabled).length;

              return (
                <div 
                  key={artist.id}
                  className={`bg-slate-800/90 border ${artist.isActive ? 'border-slate-700' : 'border-rose-900/40 opacity-75'} rounded-2xl p-5 shadow-sm hover:border-pink-500/40 transition-all flex flex-col justify-between group`}
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 text-pink-400 flex items-center justify-center font-black text-sm shrink-0">
                          {artist.name.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white group-hover:text-pink-300 transition-colors flex items-center gap-2">
                            <span>{artist.name}</span>
                            {!artist.isActive && (
                              <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded">
                                موقوف
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1 font-mono text-slate-300">
                              <User size={12} className="text-slate-500" />
                              @{artist.username}
                            </span>
                            {artist.phone && (
                              <span className="flex items-center gap-1 font-mono text-slate-400" dir="ltr">
                                <Phone size={12} className="text-slate-500" />
                                {artist.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Power toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleArtistActive(artist)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          artist.isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                        title={artist.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                      >
                        <Power size={14} />
                      </button>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 my-4 pt-3 border-t border-slate-700/60 text-xs">
                      <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">الخدمات المخصصة</span>
                        <span className="font-bold text-white text-sm">
                          {activeServicesCount} <span className="text-[10px] text-slate-400">/ {servicesCount} خدمة</span>
                        </span>
                      </div>
                      <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">إجمالي الحجوزات</span>
                        <span className="font-bold text-white text-sm">{artistBookings.length} حجز</span>
                      </div>
                    </div>

                    {/* Notes if any */}
                    {artist.notes && (
                      <p className="text-xs text-slate-400 line-clamp-2 bg-slate-900/40 p-2 rounded-lg border border-slate-800/80 mb-3 italic">
                        "{artist.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                    {/* Manage Services Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenServicesModal(artist)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-pink-600/20 hover:bg-pink-600 text-pink-300 hover:text-white border border-pink-500/40 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <Layers size={14} />
                      <span>الخدمات والأسعار ({servicesCount})</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(artist)}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 cursor-pointer transition-colors"
                        title="تعديل بيانات الدخول"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteArtist(artist)}
                        className="p-2 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/30 cursor-pointer transition-colors"
                        title="حذف الارتست"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ADD / EDIT ARTIST MODAL */}
      {/* ========================================================================= */}
      {showAddArtistModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" dir="rtl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <h3 className="font-bold text-base text-white">
                  {editingArtist ? 'تعديل بيانات الميكب ارتست' : 'إضافة ميكب ارتست جديدة'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddArtistModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveArtist} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الميكب ارتست *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: سماح أو منال..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف / الواتساب</label>
                <input
                  type="tel"
                  placeholder="مثال: 01012345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم للدخول *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: samah"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور *</label>
                  <input
                    type="text"
                    required
                    placeholder="كلمة السر..."
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات داخلية / الشروط</label>
                <textarea
                  rows={2}
                  placeholder="أي ملاحظات خاصة بنسبة الارتست أو طريقة التعامل..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="artistActiveCheck"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="artistActiveCheck" className="text-xs font-bold text-slate-300 select-none cursor-pointer">
                  حساب الميكب ارتست نشط ومتاح لتسجيل الدخول
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddArtistModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-black text-white cursor-pointer shadow-md shadow-pink-600/30"
                >
                  {editingArtist ? 'حفظ التعديلات' : 'تأكيد الإضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MANAGE SERVICES & CUSTOM PRICING MODAL PER ARTIST */}
      {/* ========================================================================= */}
      {selectedArtistForServices && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" dir="rtl">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                    <span>تخصيص الخدمات والأسعار:</span>
                    <span className="text-pink-400 font-black">{selectedArtistForServices.name}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    حدد الخدمات المتاحة للارتست لحجزها من تطبيقها مع تحديد السعر المخصص لكل خدمة بكل حرية
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedArtistForServices(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Add Service Section */}
              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-black text-pink-300 flex items-center gap-1.5">
                  <Plus size={15} />
                  <span>إضافة خدمة جديدة لقائمة الارتست ({selectedArtistForServices.name})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">اختر من خدمات الصالون</label>
                    <select
                      value={selectedServiceToAdd}
                      onChange={(e) => {
                        const sId = e.target.value;
                        setSelectedServiceToAdd(sId);
                        const found = services.find(s => s.id === sId);
                        if (found) {
                          setCustomPriceInput(Number(found.price || 0));
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-pink-500 cursor-pointer"
                    >
                      <option value="">-- اضغط لاختيار الخدمة --</option>
                      {services.map(s => {
                        const isAlready = (selectedArtistForServices.assignedServices || []).some(as => as.serviceId === s.id);
                        return (
                          <option key={s.id} value={s.id} disabled={isAlready}>
                            {s.name} (سعر الصالون الأساسي: {s.price} {currency}) {isAlready ? '✓ مضافة مسبقاً' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      السعر المخصص لـ ({selectedArtistForServices.name})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="السعر الخاص..."
                        value={customPriceInput || ''}
                        onChange={(e) => setCustomPriceInput(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 pr-8 text-xs text-white font-mono font-bold focus:outline-hidden focus:border-pink-500"
                      />
                      <span className="absolute right-2.5 top-2.5 text-slate-500 text-xs">{currency}</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddServiceToArtist}
                      disabled={!selectedServiceToAdd}
                      className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus size={14} />
                      <span>إضافة</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Assigned Services List */}
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                  <h4 className="text-xs font-black text-slate-300">
                    الخدمات المتاحة حالياً ({selectedArtistForServices.assignedServices?.length || 0}):
                  </h4>
                  <div className="w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="تصفية بالاسم..."
                      value={serviceSearchQuery}
                      onChange={(e) => setServiceSearchQuery(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 px-2.5 text-xs text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                {(!selectedArtistForServices.assignedServices || selectedArtistForServices.assignedServices.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <p className="text-xs">لم يتم تخصيص أي خدمات لهذه الارتست حتى الآن.</p>
                    <p className="text-[11px] text-slate-600 mt-1">اختر خدمة من القائمة أعلاه لإتاحتها للحجز.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedArtistForServices.assignedServices
                      .filter(as => as.serviceName.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                      .map((as) => (
                        <div 
                          key={as.serviceId}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all gap-3 ${
                            as.isEnabled 
                              ? 'bg-slate-800/80 border-slate-700/80' 
                              : 'bg-slate-900/60 border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleServiceEnabled(as.serviceId)}
                              className={`p-1.5 rounded-lg border cursor-pointer ${
                                as.isEnabled 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                  : 'bg-slate-700 text-slate-400 border-slate-600'
                              }`}
                              title={as.isEnabled ? 'تعطيل الخدمة لهذه الارتست' : 'تفعيل الخدمة'}
                            >
                              <Power size={13} />
                            </button>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                <span>{as.serviceName}</span>
                                {!as.isEnabled && (
                                  <span className="text-[10px] text-slate-400 font-normal">(معطلة)</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                سعر الصالون الأصلي: <span className="font-mono">{as.originalPrice} {currency}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-between sm:justify-end">
                            {/* Inline custom price edit */}
                            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 px-2.5 py-1.5 rounded-xl">
                              <span className="text-[10px] text-pink-300 font-bold">سعرها المخصص:</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={as.customPrice}
                                onChange={(e) => handleUpdateCustomPrice(as.serviceId, Number(e.target.value))}
                                className="w-20 bg-slate-800 border border-slate-600 rounded-lg p-1 text-xs text-white font-mono font-bold text-center focus:outline-hidden focus:border-pink-500"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">{currency}</span>
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveServiceFromArtist(as.serviceId)}
                              className="p-2 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-xl border border-rose-500/30 cursor-pointer transition-colors"
                              title="إلغاء وحذف الخدمة من قائمة الارتست"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-800/40 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedArtistForServices(null)}
                className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold cursor-pointer"
              >
                تم والانتهاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
