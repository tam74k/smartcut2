import { useState, useMemo } from 'react';
import { AppSettings, Client, Invoice, ClientPreferences, getClientTier, calculateClientTotalSpend, ClientTierConfig } from '../types';
import { 
  Search, UserPlus, Gift, MessageSquare, Receipt, Eye, X, 
  Calendar, Phone, DollarSign, FileText, Printer, CheckCircle2, 
  Clock, Sparkles, User, Scissors, Coffee, Crown, ShieldCheck, 
  HeartHandshake, Sliders, ChevronLeft, Save, Droplets, Zap,
  TrendingUp, Award, HelpCircle
} from 'lucide-react';
import { handlePrintReceipt } from '../utils/print';
import { DB } from '../services/db';

export function ClientsScreen({ 
  settings, 
  clients, 
  setClients, 
  invoices = [] 
}: { 
  settings: AppSettings; 
  clients: Client[]; 
  setClients: (c: Client[]) => void; 
  invoices?: Invoice[]; 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [selectedClientForProfile, setSelectedClientForProfile] = useState<Client | null>(null);
  const [profileActiveTab, setProfileActiveTab] = useState<'overview' | 'preferences' | 'invoices'>('overview');
  const [viewInvoiceDetails, setViewInvoiceDetails] = useState<Invoice | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Temporary Preferences state while editing in modal
  const [prefForm, setPrefForm] = useState<ClientPreferences>({});
  const [savePrefSuccess, setSavePrefSuccess] = useState(false);

  // Add Client Form
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    dob: '',
    notes: '',
    loyaltyPoints: 0,
    isVip: false
  });

  // Filtered Clients List
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase().trim();
    return clients.filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.phone && c.phone.includes(term)) ||
      (c.notes && c.notes.toLowerCase().includes(term))
    );
  }, [clients, searchTerm]);

  // Helper to get client's invoices across all branches
  const getClientInvoices = (client: Client) => {
    return invoices.filter(inv => 
      inv.clientId === client.id || 
      (client.phone && inv.clientPhone === client.phone) || 
      (inv.clientName && inv.clientName.trim().toLowerCase() === client.name.trim().toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Helper to get client total spending across all salon branches
  const getClientTotalSpend = (client: Client) => {
    const clientInvs = getClientInvoices(client);
    return clientInvs.filter(i => i.status !== 'cancelled').reduce((sum, inv) => sum + inv.total, 0);
  };

  // Invoices for currently selected client in profile modal
  const activeProfileClientInvoices = useMemo(() => {
    if (!selectedClientForProfile) return [];
    return getClientInvoices(selectedClientForProfile);
  }, [selectedClientForProfile, invoices]);

  // Open Client Profile & Card
  const openClientProfile = (client: Client, tab: 'overview' | 'preferences' | 'invoices' = 'overview') => {
    setSelectedClientForProfile(client);
    setProfileActiveTab(tab);
    setPrefForm(client.preferences || {
      shavingMethod: 'machine',
      sugarLevel: 'one_spoon',
      waterTemperature: 'cold'
    });
    setSavePrefSuccess(false);
  };

  // Save Preferences to Client Object
  const handleSavePreferences = () => {
    if (!selectedClientForProfile) return;

    const updatedClient: Client = {
      ...selectedClientForProfile,
      preferences: prefForm
    };

    const updatedClients = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
    setClients(updatedClients);
    DB.saveClient(updatedClient);
    setSelectedClientForProfile(updatedClient);
    try {
      localStorage.setItem('smartcut_clients', JSON.stringify(updatedClients));
    } catch(e){}

    setSavePrefSuccess(true);
    setTimeout(() => setSavePrefSuccess(false), 3000);
  };

  // Toggle VIP status for client
  const handleToggleVip = (client: Client) => {
    const newVipStatus = !client.isVip;
    const updatedClient: Client = {
      ...client,
      isVip: newVipStatus,
      vipSince: newVipStatus ? new Date().toISOString().split('T')[0] : undefined
    };

    const updatedClients = clients.map(c => c.id === client.id ? updatedClient : c);
    setClients(updatedClients);
    DB.saveClient(updatedClient);
    if (selectedClientForProfile?.id === client.id) {
      setSelectedClientForProfile(updatedClient);
    }
    try {
      localStorage.setItem('smartcut_clients', JSON.stringify(updatedClients));
    } catch(e){}
  };

  // Save new client
  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim() || !clientForm.phone.trim()) return;

    const newClient: Client = {
      id: 'cli-' + Math.random().toString(36).substring(2, 9),
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim(),
      dob: clientForm.dob || undefined,
      notes: clientForm.notes || undefined,
      loyaltyPoints: Number(clientForm.loyaltyPoints) || 0,
      cashback: 0,
      isVip: clientForm.isVip,
      vipSince: clientForm.isVip ? new Date().toISOString().split('T')[0] : undefined,
      lastVisit: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    setClients([...clients, newClient]);
    DB.saveClient(newClient);
    setShowAddModal(false);
    setClientForm({ name: '', phone: '', dob: '', notes: '', loyaltyPoints: 0, isVip: false });
  };

  const vipThreshold = settings.vipSettings?.spendingThreshold || 1000;
  const isVipConfigEnabled = settings.vipSettings?.enabled !== false;

  return (
    <div className="p-4 sm:p-8 w-full h-full overflow-y-auto bg-slate-50 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">سجل العملاء والزيارات وتفضيلات الضيافة (CRM)</h2>
            <span className="bg-amber-500/10 text-amber-700 border border-amber-500/30 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Crown size={13} className="text-amber-600" />
              <span>نظام VIP وتفضيلات الحلاقة</span>
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            إدارة بطاقات العملاء، تفضيلات الحلاقة والمشروبات، معدل الإنفاق بالفروع، والترقية إلى VIP
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="بحث باسم العميل أو رقم الجوال..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-600 w-full shadow-2xs" 
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <UserPlus size={16} />
            <span>عميل جديد</span>
          </button>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-extrabold border-b border-slate-200">
                <th className="py-3.5 px-4">اسم العميل ورتبته</th>
                <th className="py-3.5 px-4">رقم الجوال</th>
                <th className="py-3.5 px-4 text-center">تفضيلات الحلاقة والضيافة</th>
                <th className="py-3.5 px-4 text-center">إجمالي الإنفاق (جميع الفروع)</th>
                <th className="py-3.5 px-4 text-center">الولاء والكاش باك</th>
                <th className="py-3.5 px-4">آخر زيارة</th>
                <th className="py-3.5 px-4 text-center">بطاقة العميل والإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client) => {
                const clientInvs = getClientInvoices(client);
                const totalSpend = getClientTotalSpend(client);
                const clientTier = getClientTier(client, invoices, settings.tierSettings);
                const isVipOrHigher = clientTier.id === 'vip' || clientTier.id === 'royal';

                return (
                  <tr key={client.id} className={`hover:bg-slate-50/80 transition-colors ${isVipOrHigher ? 'bg-amber-50/30' : ''}`}>
                    {/* Name & Tier Badge */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shadow-xs ${
                          clientTier.id === 'royal' 
                            ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white ring-2 ring-purple-400/30' 
                            : clientTier.id === 'vip'
                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black ring-2 ring-amber-400/30'
                            : clientTier.id === 'distinguished'
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                            : 'bg-slate-900 text-white'
                        }`}>
                          {clientTier.id !== 'standard' ? clientTier.icon : client.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-xs">{client.name}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs flex items-center gap-0.5 ${clientTier.badgeBg} ${clientTier.badgeText} ${clientTier.badgeBorder}`}>
                              <span>{clientTier.icon}</span>
                              <span>{clientTier.name}</span>
                              {clientTier.discountPercentage > 0 && <span>({clientTier.discountPercentage}%)</span>}
                            </span>
                          </div>
                          {client.notes && (
                            <p className="text-[10px] text-slate-400 truncate max-w-xs">{client.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700" dir="ltr">{client.phone}</td>
                    
                    {/* Preferences Quick Indicator */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => openClientProfile(client, 'preferences')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                          client.preferences 
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                        }`}
                        title="عرض وتعديل تفضيلات الحلاقة والقهوة"
                      >
                        <Coffee size={13} className={client.preferences?.favoriteBeverage ? 'text-amber-700' : 'text-slate-400'} />
                        <Scissors size={13} className={client.preferences?.hairStyleNotes ? 'text-indigo-600' : 'text-slate-400'} />
                        <span>{client.preferences ? 'تفضيلات مسجلة ✓' : '+ إضافة تفضيلات'}</span>
                      </button>
                    </td>

                    {/* Total Spend */}
                    <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900">
                      <span className="text-emerald-700 text-sm font-black">{totalSpend.toFixed(2)}</span>{' '}
                      <span className="text-[10px] font-normal text-slate-400">{settings.currency}</span>
                      <p className="text-[10px] text-slate-400 font-medium">({clientInvs.length} فواتير)</p>
                    </td>

                    {/* Loyalty & Cashback */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg font-bold text-[11px] inline-flex items-center gap-1">
                          <Gift size={11} /> {client.loyaltyPoints || 0} نقطة
                        </span>
                        {(client.cashback || 0) > 0 && (
                          <span className="text-[10px] font-mono font-bold text-emerald-600">
                            كاش باك: {client.cashback} {settings.currency}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-semibold">{client.lastVisit || 'غير متوفر'}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Open Full Profile Card */}
                        <button 
                          onClick={() => openClientProfile(client, 'overview')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          title="فتح بطاقة العميل الكاملة"
                        >
                          <User size={13} />
                          <span>بطاقة العميل 🪪</span>
                        </button>

                        {/* WhatsApp Message */}
                        {client.phone && (
                          <a 
                            href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors border border-green-200" 
                            title="مراسلة عبر واتساب"
                          >
                            <MessageSquare size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    لا يوجد عملاء مطابقين للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPREHENSIVE CLIENT PROFILE & PREFERENCES CARD MODAL */}
      {/* ========================================================================= */}
      {selectedClientForProfile && (() => {
        const client = selectedClientForProfile;
        const clientInvs = getClientInvoices(client);
        const totalSpend = getClientTotalSpend(client);
        const avgSpend = clientInvs.length > 0 ? totalSpend / clientInvs.length : 0;
        const clientTier = getClientTier(client, invoices, settings.tierSettings);
        const isVipOrHigher = clientTier.id === 'vip' || clientTier.id === 'royal';
        const isVip = client.isVip || isVipOrHigher;
        const vipProgress = Math.min(100, Math.round((totalSpend / (settings.vipSettings?.spendingThreshold || 1000)) * 100));

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200 my-auto">
              
              {/* 1. Modal Header Banner */}
              <div className="p-6 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-xl ${
                    clientTier.id === 'royal' 
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-700 ring-4 ring-purple-400/30 text-white' 
                      : clientTier.id === 'vip'
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 ring-4 ring-amber-400/30'
                      : clientTier.id === 'distinguished'
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}>
                    {clientTier.id !== 'standard' ? clientTier.icon : client.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-black text-lg sm:text-xl text-white">{client.name}</h3>
                      <span className={`text-xs font-black px-3 py-0.5 rounded-full shadow-md flex items-center gap-1 border ${clientTier.badgeBg} ${clientTier.badgeText} ${clientTier.badgeBorder}`}>
                        <span>{clientTier.icon}</span>
                        <span>مستوى {clientTier.name}</span>
                        {clientTier.discountPercentage > 0 && <span>({clientTier.discountPercentage}% خصم)</span>}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-300">
                      <span className="font-mono" dir="ltr">📱 {client.phone}</span>
                      {client.email && <span>✉️ {client.email}</span>}
                      {client.createdAt && <span>📅 مسجل منذ: {client.createdAt.split('T')[0]}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle VIP Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleVip(client)}
                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                      isVip
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                    }`}
                  >
                    <Crown size={14} />
                    <span>{isVip ? 'إلغاء صفة VIP' : 'ترقية فورية إلى VIP 👑'}</span>
                  </button>

                  <button 
                    onClick={() => setSelectedClientForProfile(null)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 2. Sub-Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-2 overflow-x-auto">
                {[
                  { id: 'overview', label: 'ملخص ومعدل الإنفاق بالفروع 📊' },
                  { id: 'preferences', label: 'تفضيلات الحلاقة والضيافة ✂️☕' },
                  { id: 'invoices', label: `سجل الفواتير السابقة (${clientInvs.length}) 🧾` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setProfileActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                      profileActiveTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* 3. Modal Body Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">

                {/* ================= TAB 1: OVERVIEW & SPENDING ================= */}
                {profileActiveTab === 'overview' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* VIP Progress Banner */}
                    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 rounded-3xl border border-amber-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Crown size={20} className="text-amber-600" />
                          <div>
                            <h4 className="font-black text-sm text-slate-900">
                              {isVip ? 'العميل حاصل على عضوية VIP الممتازة 👑' : 'التقدم نحو الترقية إلى عضوية VIP'}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {isVip 
                                ? `مستفيد من خصم عملاء VIP (${settings.vipSettings?.discountPercentage || 10}%) والمعاملة المميزة` 
                                : `الحد المطلوب للترقية: ${vipThreshold} ${settings.currency} عبر جميع فروع الصالون`}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono font-black text-amber-700 text-sm">
                          {totalSpend.toFixed(2)} / {vipThreshold} {settings.currency}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-amber-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${vipProgress}%` }}
                        />
                      </div>
                      {!isVip && (
                        <p className="text-[11px] text-amber-800 font-bold">
                          💡 متبقي للعميل إنفاق <span className="font-mono font-black">{Math.max(0, vipThreshold - totalSpend).toFixed(2)} {settings.currency}</span> ليتم ترقيته تلقائياً إلى عميل VIP.
                        </p>
                      )}
                    </div>

                    {/* Financial Statistics Cards (Across ALL branches) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                          <TrendingUp size={13} className="text-emerald-600" />
                          <span>إجمالي الإنفاق (كل الفروع)</span>
                        </p>
                        <h4 className="text-lg font-black text-emerald-700 font-mono">
                          {totalSpend.toFixed(2)} <span className="text-xs font-normal">{settings.currency}</span>
                        </h4>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                          <DollarSign size={13} className="text-indigo-600" />
                          <span>معدل الإنفاق / الزيارة</span>
                        </p>
                        <h4 className="text-lg font-black text-indigo-700 font-mono">
                          {avgSpend.toFixed(2)} <span className="text-xs font-normal">{settings.currency}</span>
                        </h4>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                          <Receipt size={13} className="text-slate-600" />
                          <span>عدد الزيارات والفواتير</span>
                        </p>
                        <h4 className="text-lg font-black text-slate-900 font-mono">
                          {clientInvs.length} <span className="text-xs font-normal">زيارة</span>
                        </h4>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                          <Gift size={13} className="text-purple-600" />
                          <span>نقاط الولاء والكاش باك</span>
                        </p>
                        <h4 className="text-sm font-black text-purple-700 font-mono">
                          {client.loyaltyPoints || 0} نقطة
                        </h4>
                        <p className="text-[10px] text-emerald-600 font-bold font-mono mt-0.5">
                          رصيد كاش باك: {client.cashback || 0} {settings.currency}
                        </p>
                      </div>
                    </div>

                    {/* Quick Preferences Snippet */}
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                          <Sparkles size={16} className="text-indigo-600" />
                          <span>تفضيلات سريعة مثبتة في بطاقة العميل:</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setProfileActiveTab('preferences')}
                          className="text-indigo-600 hover:text-indigo-800 font-black text-xs underline cursor-pointer"
                        >
                          تعديل التفضيلات الكاملة ✏️
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-2xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">طريقة الحلاقة:</span>
                          <span className="font-bold text-slate-800">
                            {client.preferences?.shavingMethod === 'blade' ? 'موس كلاسيكي 🪒' :
                             client.preferences?.shavingMethod === 'scissors_only' ? 'مقص فقط ✂️' :
                             client.preferences?.shavingMethod === 'both' ? 'ماكينة وموس ✨' : 'ماكينة كهربائية ⚡'}
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-2xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">المشروب والضيافة:</span>
                          <span className="font-bold text-slate-800">
                            {client.preferences?.favoriteBeverage || 'قهوة تركي ☕'}
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-2xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">كمية السكر:</span>
                          <span className="font-bold text-slate-800">
                            {client.preferences?.sugarLevel === 'none' ? 'بدون سكر 🚫' :
                             client.preferences?.sugarLevel === 'half' ? 'نصف ملعقة (خفيف) 🥄' :
                             client.preferences?.sugarLevel === 'two_spoons' ? 'ملعقتين 🥄🥄' :
                             client.preferences?.sugarLevel === 'extra' ? 'زيادة 🍯' : 'ملعقة واحدة 🥄'}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* ================= TAB 2: PREFERENCES & STYLE ================= */}
                {profileActiveTab === 'preferences' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {savePrefSuccess && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 p-3 rounded-2xl text-xs font-black flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <span>تم حفظ وتحديث تفضيلات العميل بنجاح في قاعدة البيانات وتظهر لجميع الفنيين ✓</span>
                      </div>
                    )}

                    {/* 1. Shaving & Hair Preferences */}
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Scissors size={18} className="text-indigo-600" />
                        <span>تفضيلات الحلاقة وقصة الشعر واللحية ✂️</span>
                      </h4>

                      {/* Shaving Method Radio Cards */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2">أداة وطريقة الحلاقة المفضلة للعميل:</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {[
                            { id: 'machine', label: 'ماكينة كهربائية ⚡', desc: 'تجنب الموس الحاد' },
                            { id: 'blade', label: 'موس كلاسيكي 🪒', desc: 'تنعيم وحلاقة بالموس' },
                            { id: 'scissors_only', label: 'مقص فقط ✂️', desc: 'قص هادئ بالمقص' },
                            { id: 'both', label: 'ماكينة + موس ✨', desc: 'حلاقة مدمجة كاملة' }
                          ].map(opt => (
                            <label
                              key={opt.id}
                              onClick={() => setPrefForm({ ...prefForm, shavingMethod: opt.id as any })}
                              className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col ${
                                (prefForm.shavingMethod || 'machine') === opt.id
                                  ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="shavingMethod"
                                  checked={(prefForm.shavingMethod || 'machine') === opt.id}
                                  onChange={() => setPrefForm({ ...prefForm, shavingMethod: opt.id as any })}
                                  className="text-indigo-600"
                                />
                                <span className="font-black text-xs text-slate-900">{opt.label}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 mr-5">{opt.desc}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Hair Style & Beard Style Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            ستايل وقصة الشعر المفضلة:
                          </label>
                          <textarea
                            rows={2}
                            value={prefForm.hairStyleNotes || ''}
                            onChange={e => setPrefForm({ ...prefForm, hairStyleNotes: e.target.value })}
                            placeholder="مثال: تدريج منخفض Fade من الجوانب، تخفيف بسيط من الأعلى، تجنب الجل القوي..."
                            className="w-full bg-white border border-slate-300 rounded-2xl p-3 text-xs outline-none focus:border-indigo-600 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            ستايل وتحديد اللحية والشارب:
                          </label>
                          <textarea
                            rows={2}
                            value={prefForm.beardStyleNotes || ''}
                            onChange={e => setPrefForm({ ...prefForm, beardStyleNotes: e.target.value })}
                            placeholder="مثال: تحديد دقيق للخطوط، تخفيف نمرة 2، ترك السكسوكة، سنفرة خفيفة..."
                            className="w-full bg-white border border-slate-300 rounded-2xl p-3 text-xs outline-none focus:border-indigo-600 font-medium"
                          />
                        </div>
                      </div>

                      {/* Skin sensitivities */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          حساسية البشرة / مواد يتجنبها:
                        </label>
                        <input
                          type="text"
                          value={prefForm.skinSensitivities || ''}
                          onChange={e => setPrefForm({ ...prefForm, skinSensitivities: e.target.value })}
                          placeholder="مثال: حساسية من الكحول بعد الحلاقة (يفضل مرطب بارد فقط)، بشرة حساسة للحرارة..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-600 font-medium"
                        />
                      </div>
                    </div>

                    {/* 2. Hospitality & Beverage Preferences */}
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Coffee size={18} className="text-amber-700" />
                        <span>تفضيلات الضيافة والمشروبات ☕</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* Beverage */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">المشروب المفضل للعميل:</label>
                          <select
                            value={prefForm.favoriteBeverage || 'قهوة تركي'}
                            onChange={e => setPrefForm({ ...prefForm, favoriteBeverage: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600"
                          >
                            <option value="قهوة تركي">☕ قهوة تركي</option>
                            <option value="إسبريسو">☕ إسبريسو</option>
                            <option value="قهوة عربية">☕ قهوة عربية</option>
                            <option value="شاي كرك">🫖 شاي كرك</option>
                            <option value="شاي أحمر">🫖 شاي أحمر كلاسيكي</option>
                            <option value="شاي أخضر">🍵 شاي أخضر بالنعناع</option>
                            <option value="ماء فقط">💧 ماء فقط</option>
                            <option value="عصير برتقال">🍊 عصير طازج</option>
                          </select>
                        </div>

                        {/* Sugar Level */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">كمية السكر المفضلة:</label>
                          <select
                            value={prefForm.sugarLevel || 'one_spoon'}
                            onChange={e => setPrefForm({ ...prefForm, sugarLevel: e.target.value as any })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600"
                          >
                            <option value="none">🚫 بدون سكر (سادة)</option>
                            <option value="half">🥄 نصف ملعقة (سكر خفيف)</option>
                            <option value="one_spoon">🥄 ملعقة واحدة (مضبوط)</option>
                            <option value="two_spoons">🥄🥄 ملعقتين</option>
                            <option value="extra">🍯 زيادة سكر (حلو)</option>
                          </select>
                        </div>

                        {/* Water Temp */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">درجة برودة الماء:</label>
                          <select
                            value={prefForm.waterTemperature || 'cold'}
                            onChange={e => setPrefForm({ ...prefForm, waterTemperature: e.target.value as any })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600"
                          >
                            <option value="cold">❄️ ماء بارد</option>
                            <option value="room">💧 ماء عادي (حرارة الغرفة)</option>
                            <option value="none">لا يطلب ماء</option>
                          </select>
                        </div>
                      </div>

                      {/* General Hospitality Notes */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ملاحظات عامة لطاقم العمل والاستقبال:
                        </label>
                        <input
                          type="text"
                          value={prefForm.generalNotes || ''}
                          onChange={e => setPrefForm({ ...prefForm, generalNotes: e.target.value })}
                          placeholder="مثال: يفضل الجلوس بجانب الشباك، يفضل عدم الحديث الكثير أثناء الجلسة، عميل دائم..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-600 font-medium"
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      type="button"
                      onClick={handleSavePreferences}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <Save size={16} />
                      <span>حفظ تفضيلات العميل وتطبيقها فوراً ✓</span>
                    </button>
                  </div>
                )}

                {/* ================= TAB 3: PREVIOUS INVOICES ================= */}
                {profileActiveTab === 'invoices' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                            <th className="py-3 px-3">رقم الفاتورة</th>
                            <th className="py-3 px-3">التاريخ والوقت</th>
                            <th className="py-3 px-3">الخدمات والمنتجات</th>
                            <th className="py-3 px-3">الخصم</th>
                            <th className="py-3 px-3">الإجمالي الصافي</th>
                            <th className="py-3 px-3">الحالة</th>
                            <th className="py-3 px-3 text-center">تفاصيل الفاتورة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {clientInvs.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3 font-mono font-bold text-slate-800">{inv.id}</td>
                              <td className="py-3 px-3 text-slate-500 font-semibold">{new Date(inv.date).toLocaleString('ar-SA')}</td>
                              <td className="py-3 px-3">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                  {inv.items?.length || 0} عناصر
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-rose-500 font-bold">
                                {inv.discount > 0 ? `-${inv.discount}` : '0.00'}
                              </td>
                              <td className="py-3 px-3 font-mono font-black text-emerald-600 text-sm">
                                {inv.total.toFixed(2)} {settings.currency}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  inv.status === 'completed'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : inv.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {inv.status === 'completed' ? 'مكتملة' : inv.status === 'cancelled' ? 'ملغاة' : 'مسترجعة'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => setViewInvoiceDetails(inv)}
                                  className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 mx-auto shadow-2xs transition-colors cursor-pointer"
                                >
                                  <Eye size={12} />
                                  <span>عرض البنود</span>
                                </button>
                              </td>
                            </tr>
                          ))}

                          {clientInvs.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-slate-400 font-bold">
                                لا توجد فواتير سابقة مسجلة لهذا العميل في أي فرع
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {/* 4. Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">
                  بيانات وتفضيلات هذا العميل موحدة وتظهر في شاشة الحجز وشاشة الكاشير لجميع فروع الصالون 🌐
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedClientForProfile(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2 rounded-xl text-xs cursor-pointer"
                >
                  إغلاق
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL 2: INVOICE ITEMS FULL BREAKDOWN & PRINT */}
      {viewInvoiceDetails && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Receipt size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">تفاصيل الفاتورة: {viewInvoiceDetails.id}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">{new Date(viewInvoiceDetails.date).toLocaleString('ar-SA')}</p>
                </div>
              </div>
              <button onClick={() => setViewInvoiceDetails(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Client Info */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-semibold flex justify-between items-center">
              <div>
                <p className="text-slate-400 text-[10px]">العميل</p>
                <p className="font-extrabold text-slate-800">{viewInvoiceDetails.clientName}</p>
              </div>
              <div className="text-left">
                <p className="text-slate-400 text-[10px]">الهاتف</p>
                <p className="font-mono font-bold text-slate-700" dir="ltr">{viewInvoiceDetails.clientPhone || '-'}</p>
              </div>
            </div>

            {/* Items List */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-extrabold border-b">
                  <tr>
                    <th className="py-2.5 px-3">الخدمة / المنتج</th>
                    <th className="py-2.5 px-3">الفني</th>
                    <th className="py-2.5 px-3 text-center">الكمية</th>
                    <th className="py-2.5 px-3 text-left">السعر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewInvoiceDetails.items?.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{it.serviceName}</td>
                      <td className="py-2.5 px-3 text-slate-500">{it.technicianName || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">{it.quantity || 1}</td>
                      <td className="py-2.5 px-3 text-left font-mono font-extrabold text-slate-900">
                        {((it.price || 0) * (it.quantity || 1)).toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs font-bold">
              <div className="flex justify-between text-slate-600">
                <span>الإجمالي قبل الخصم:</span>
                <span className="font-mono">{(viewInvoiceDetails.total + (viewInvoiceDetails.discount || 0)).toFixed(2)} {settings.currency}</span>
              </div>
              {viewInvoiceDetails.discount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono">-{viewInvoiceDetails.discount.toFixed(2)} {settings.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>الصافي النهائي:</span>
                <span className="font-mono text-emerald-600">{viewInvoiceDetails.total.toFixed(2)} {settings.currency}</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setViewInvoiceDetails(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW CLIENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleSaveClient}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserPlus size={16} />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">إضافة عميل جديد</h3>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العميل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عبد العزيز المنصور"
                  value={clientForm.name}
                  onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-600 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الجوال *</label>
                <input
                  type="text"
                  required
                  placeholder="05xxxxxxxx"
                  value={clientForm.phone}
                  onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-600 font-bold"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الميلاد</label>
                  <input
                    type="date"
                    value={clientForm.dob}
                    onChange={e => setClientForm({ ...clientForm, dob: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-600 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نقاط الولاء الافتتاحية</label>
                  <input
                    type="number"
                    value={clientForm.loyaltyPoints}
                    onChange={e => setClientForm({ ...clientForm, loyaltyPoints: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-600 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات العميل</label>
                <input
                  type="text"
                  placeholder="تفضيلات، ملاحظات خاصة بالحلاقة أو العناية..."
                  value={clientForm.notes}
                  onChange={e => setClientForm({ ...clientForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-600 font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                حفظ بيانات العميل
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
