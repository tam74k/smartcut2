import React, { useState } from 'react';
import { 
  AlertCircle, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock, 
  UserX, 
  MessageSquare, 
  FileText, 
  Calendar, 
  User, 
  Phone, 
  DollarSign, 
  ShieldAlert, 
  Image as ImageIcon, 
  Check, 
  X, 
  Scissors, 
  Send, 
  Wrench, 
  Eye, 
  ChevronDown,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ClientComplaint, Invoice, Employee, Client, AppSettings, AppUser } from '../types';
import { ComplaintsService } from '../services/complaintsService';
import { processImageFile, MAX_IMAGE_SIZE_KB } from '../utils/imageUpload';

interface ComplaintsScreenProps {
  settings: AppSettings;
  invoices: Invoice[];
  employees: Employee[];
  clients: Client[];
  currentUser: AppUser | null;
  onNavigateToPOSWithRemedy?: (clientPhone: string, clientName: string, complaintId: string, originalInvoiceId?: string) => void;
}

export function ComplaintsScreen({
  settings,
  invoices,
  employees,
  clients,
  currentUser,
  onNavigateToPOSWithRemedy
}: ComplaintsScreenProps) {
  const [complaints, setComplaints] = useState<ClientComplaint[]>(ComplaintsService.getComplaints());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'rejected'>('all');
  
  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ClientComplaint | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState<{ before?: string; after?: string; title: string } | null>(null);

  // New Action Form
  const [actionText, setActionText] = useState('');

  // Resolve Form
  const [resolutionText, setResolutionText] = useState('');
  const [offerFreeRemedy, setOfferFreeRemedy] = useState(false);

  // New Complaint Form State
  const [newForm, setNewForm] = useState({
    clientPhone: '',
    clientName: '',
    invoiceId: '',
    employeeId: '',
    category: 'service_quality' as ClientComplaint['category'],
    priority: 'medium' as ClientComplaint['priority'],
    description: '',
    initialAction: '',
    beforePhotoUrl: '',
    afterPhotoUrl: ''
  });

  const reloadComplaints = () => {
    setComplaints(ComplaintsService.getComplaints());
  };

  // Matched Invoices for selected phone
  const clientMatchedInvoices = invoices.filter(inv => {
    if (!newForm.clientPhone.trim()) return false;
    const cleanPhone = newForm.clientPhone.replace(/\D/g, '');
    const invPhone = (inv.clientPhone || '').replace(/\D/g, '');
    return invPhone.includes(cleanPhone) || cleanPhone.includes(invPhone);
  });

  // Client remedy history check
  const clientHistory = newForm.clientPhone 
    ? ComplaintsService.checkClientHistory(newForm.clientPhone, invoices)
    : null;

  const handlePhoneChange = (phone: string) => {
    const matchedClient = clients.find(c => c.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    setNewForm(prev => ({
      ...prev,
      clientPhone: phone,
      clientName: matchedClient?.name || prev.clientName
    }));
  };

  const handleSelectInvoice = (inv: Invoice) => {
    // Find primary employee from invoice items
    const primaryEmpId = inv.items?.[0]?.employeeId || '';
    setNewForm(prev => ({
      ...prev,
      invoiceId: inv.id,
      clientName: inv.clientName || prev.clientName,
      employeeId: primaryEmpId || prev.employeeId,
      beforePhotoUrl: inv.beforePhotoUrl || '',
      afterPhotoUrl: inv.afterPhotoUrl || ''
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const res = await processImageFile(file);
    if (res.error) {
      alert(res.error);
      return;
    }

    if (type === 'before') {
      setNewForm(prev => ({ ...prev, beforePhotoUrl: res.dataUrl }));
    } else {
      setNewForm(prev => ({ ...prev, afterPhotoUrl: res.dataUrl }));
    }
  };

  const handleCreateComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.clientPhone || !newForm.description) {
      alert('الرجاء إدخال رقم هاتف العميل وتفاصيل الشكوى');
      return;
    }

    const selectedInv = invoices.find(i => i.id === newForm.invoiceId);
    const selectedEmp = employees.find(emp => emp.id === newForm.employeeId);

    ComplaintsService.createComplaint({
      salonId: settings.salonId,
      salonCode: settings.salonCode,
      branchId: settings.branchId,
      branchCode: settings.branchCode,
      clientPhone: newForm.clientPhone,
      clientName: newForm.clientName || 'عميل نقدي',
      invoiceId: newForm.invoiceId || undefined,
      invoiceDate: selectedInv?.date,
      invoiceTotal: selectedInv?.total,
      employeeId: newForm.employeeId || undefined,
      employeeName: selectedEmp?.name,
      category: newForm.category,
      priority: newForm.priority,
      description: newForm.description,
      beforePhotoUrl: newForm.beforePhotoUrl || undefined,
      afterPhotoUrl: newForm.afterPhotoUrl || undefined,
      status: 'open',
      initialAction: newForm.initialAction || 'تم تسجيل الشكوى وجارٍ المتابعة مع العميل والفني',
      createdBy: currentUser?.name || 'مسؤول النظام'
    });

    setShowAddModal(false);
    setNewForm({
      clientPhone: '',
      clientName: '',
      invoiceId: '',
      employeeId: '',
      category: 'service_quality',
      priority: 'medium',
      description: '',
      initialAction: '',
      beforePhotoUrl: '',
      afterPhotoUrl: ''
    });
    reloadComplaints();
    alert('✅ تم تسجيل الشكوى بنجاح وبدء مسار المتابعة!');
  };

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !actionText.trim()) return;

    ComplaintsService.addAction(
      selectedComplaint.id,
      actionText.trim(),
      currentUser?.name || 'مدير الفرع'
    );

    setActionText('');
    setShowActionModal(false);
    reloadComplaints();
    const updated = ComplaintsService.getComplaints().find(c => c.id === selectedComplaint.id);
    if (updated) setSelectedComplaint(updated);
  };

  const handleResolveComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !resolutionText.trim()) return;

    ComplaintsService.resolveComplaint(
      selectedComplaint.id,
      resolutionText.trim(),
      currentUser?.name || 'مدير الصالون',
      offerFreeRemedy
    );

    setShowResolveModal(false);
    reloadComplaints();
    const updated = ComplaintsService.getComplaints().find(c => c.id === selectedComplaint.id);
    if (updated) setSelectedComplaint(updated);

    if (offerFreeRemedy && onNavigateToPOSWithRemedy) {
      if (confirm('✅ تم تسجيل الحل بنجاح! هل ترغب في فتح شاشة الكاشير (POS) الآن لإصدار فاتورة إصلاح مجانية (0.00 ر.س) للعميل؟')) {
        onNavigateToPOSWithRemedy(
          selectedComplaint.clientPhone,
          selectedComplaint.clientName,
          selectedComplaint.id,
          selectedComplaint.invoiceId
        );
      }
    } else {
      alert('✅ تم إغلاق وحل الشكوى بنجاح!');
    }
  };

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = 
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientPhone.includes(searchQuery) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.employeeName && c.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.invoiceId && c.invoiceId.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  const categoryLabels: Record<string, string> = {
    service_quality: '✂️ جودة الخدمة والقص',
    staff_behavior: '🤝 سلوك وتعامل الموظف',
    timing_delay: '⏰ تأخير في الموعد',
    skin_hair_damage: '⚠️ حساسية أو تلف بشرة/شعر',
    pricing: '💰 أسعار وفواتير',
    other: '📋 أخرى'
  };

  const statusBadges: Record<string, { label: string; bg: string; text: string; border: string }> = {
    open: { label: 'مفتوحة 🟡', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    in_progress: { label: 'قيد المتابعة 🔵', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    resolved: { label: 'تم الحل 🟢', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    rejected: { label: 'مرفوضة 🔴', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto bg-slate-50 font-sans" dir="rtl">
      
      {/* Header Hub */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 text-white flex items-center justify-center font-black shadow-md shadow-rose-600/20">
            <AlertCircle size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>قسم شكاوى ومتابعة العملاء وضمان الخدمة</span>
              <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Customer Care</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ربط الشكوى برقم العميل وفواتيره السابقة، صور قبل وبعد، توثيق الإجراءات، وتتبع فواتير الإصلاح المجاني (0.00 ر.س)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <Plus size={16} />
            <span>+ تسجيل شكوى جديدة</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي الشكاوى المسجلة</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{complaints.length}</p>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
            <Layers size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">شكاوى مفتوحة / قيد الإجراء</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {complaints.filter(c => c.status === 'open' || c.status === 'in_progress').length}
            </p>
          </div>
          <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">تم حلها وإغلاقها بنجاح</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {complaints.filter(c => c.status === 'resolved').length}
            </p>
          </div>
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">حالات إصلاح مجاني (ضمان)</p>
            <p className="text-2xl font-black text-purple-600 mt-1">
              {complaints.filter(c => c.isRemedyProvided).length}
            </p>
          </div>
          <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold">
            <Wrench size={22} />
          </div>
        </div>
      </div>

      {/* Main Grid: Complaints List & Details Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Complaints Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Filters & Search */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
            <div className="flex flex-wrap gap-1 bg-slate-200/70 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                الكل ({complaints.length})
              </button>
              <button
                onClick={() => setStatusFilter('open')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'open' ? 'bg-white text-amber-700 shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                مفتوحة
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'in_progress' ? 'bg-white text-blue-700 shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                قيد المتابعة
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'resolved' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                تم الحل
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <input
                type="text"
                placeholder="بحث برقم العميل، الاسم، الفاتورة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-rose-600"
              />
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px]">
            {filteredComplaints.map(c => {
              const badge = statusBadges[c.status] || statusBadges.open;
              const isSelected = selectedComplaint?.id === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedComplaint(c)}
                  className={`p-4 transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected ? 'bg-rose-50/50 border-r-4 border-rose-600' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {c.id}
                      </span>
                      <span className="font-black text-slate-900 text-sm">{c.clientName}</span>
                      <span className="text-xs font-mono text-slate-500 font-bold">({c.clientPhone})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {c.isRemedyProvided && (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-200">
                          إصلاح مجاني 🔧
                        </span>
                      )}
                      <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <span>{categoryLabels[c.category] || c.category}</span>
                      {c.employeeName && (
                        <span className="flex items-center gap-1 font-bold text-slate-700">
                          <User size={12} className="text-slate-400" />
                          {c.employeeName}
                        </span>
                      )}
                      {c.invoiceId && (
                        <span className="font-mono text-slate-600">
                          فاتورة: {c.invoiceId}
                        </span>
                      )}
                    </div>
                    <span className="font-mono">{c.createdAt.split('T')[0]}</span>
                  </div>
                </div>
              );
            })}

            {filteredComplaints.length === 0 && (
              <div className="p-8 text-center text-slate-400 font-bold">
                لا توجد شكاوى مطابقة لخيارات البحث
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Complaint Full Inspector & Action Log (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          {selectedComplaint ? (
            <div className="space-y-4">
              {/* Title & Status */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {selectedComplaint.id}
                    </span>
                    <h3 className="font-black text-slate-900 text-base">{selectedComplaint.clientName}</h3>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{selectedComplaint.clientPhone}</p>
                </div>
                <span className={`text-xs font-black px-3 py-1 rounded-full border ${statusBadges[selectedComplaint.status]?.bg} ${statusBadges[selectedComplaint.status]?.text} ${statusBadges[selectedComplaint.status]?.border}`}>
                  {statusBadges[selectedComplaint.status]?.label}
                </span>
              </div>

              {/* Linked Invoice & Employee Info */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">الفاتورة محل الشكوى:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedComplaint.invoiceId || 'غير محددة'} {selectedComplaint.invoiceTotal ? `(${selectedComplaint.invoiceTotal} ${settings.currency})` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">الموظف المشكو بحقه:</span>
                  <span className="font-bold text-slate-800">{selectedComplaint.employeeName || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">تصنيف الشكوى:</span>
                  <span className="font-bold text-rose-700">{categoryLabels[selectedComplaint.category] || selectedComplaint.category}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 mb-1">تفاصيل ووصف الشكوى:</h4>
                <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-2xl text-xs font-semibold text-slate-800 leading-relaxed">
                  {selectedComplaint.description}
                </div>
              </div>

              {/* Before & After Photos Button if available */}
              {(selectedComplaint.beforePhotoUrl || selectedComplaint.afterPhotoUrl) && (
                <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-900">
                    <ImageIcon size={16} className="text-indigo-600" />
                    <span>مرفق صور قبل وبعد للخدمة</span>
                  </div>
                  <button
                    onClick={() => setShowPhotoPreview({
                      before: selectedComplaint.beforePhotoUrl,
                      after: selectedComplaint.afterPhotoUrl,
                      title: `صور خدمة العميل: ${selectedComplaint.clientName}`
                    })}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                  >
                    <Eye size={13} />
                    <span>معاينة الصور</span>
                  </button>
                </div>
              )}

              {/* Resolution Note if resolved */}
              {selectedComplaint.resolution && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 text-xs">
                  <div className="flex items-center gap-1 font-black text-emerald-800">
                    <CheckCircle2 size={15} />
                    <span>الحل المعتمد وإغلاق الشكوى:</span>
                  </div>
                  <p className="text-emerald-950 font-semibold leading-relaxed">
                    {selectedComplaint.resolution}
                  </p>
                  {selectedComplaint.resolvedBy && (
                    <div className="text-[10px] text-emerald-700 pt-1 font-mono">
                      بواسطة: {selectedComplaint.resolvedBy} • {selectedComplaint.resolvedAt?.split('T')[0]}
                    </div>
                  )}
                </div>
              )}

              {/* Action Log Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 mb-2">سجل المتابعة والإجراءات المتخذة ({selectedComplaint.actions.length}):</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedComplaint.actions.map(act => (
                    <div key={act.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <p className="font-semibold text-slate-800 leading-relaxed">{act.actionText}</p>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-100">
                        <span>المسؤول: {act.performedBy}</span>
                        <span>{new Date(act.date).toLocaleString('ar-SA')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setShowActionModal(true)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={14} />
                  <span>+ إضافة إجراء</span>
                </button>

                {selectedComplaint.status !== 'resolved' && (
                  <button
                    onClick={() => setShowResolveModal(true)}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    <span>حل وإغلاق الشكوى</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <AlertCircle size={40} className="text-slate-300 mb-2" />
              <p className="text-sm font-bold">حدد شكوى من القائمة لعرض تفاصيلها وسجل الإجراءات</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD NEW COMPLAINT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                  <AlertCircle size={18} />
                </div>
                <h3 className="font-black text-base text-slate-900">تسجيل شكوى عميل جديدة</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Warning if Client had previous free remedy */}
            {clientHistory?.hasPreviousRemedy && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
                <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-amber-950">⚠️ تنبيه سجل العميل السابق:</p>
                  <p className="mt-0.5 text-amber-800">{clientHistory.warningMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateComplaint} className="space-y-4">
              {/* Client Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم جوال العميل (مطلوب)</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="tel"
                      required
                      placeholder="0500000000"
                      value={newForm.clientPhone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-mono font-bold outline-none focus:border-rose-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="أحمد علي"
                      value={newForm.clientName}
                      onChange={e => setNewForm({ ...newForm, clientName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold outline-none focus:border-rose-600"
                    />
                  </div>
                </div>
              </div>

              {/* Matched Invoices Picker */}
              {clientMatchedInvoices.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    اختر الفاتورة محل الشكوى من سجل العميل ({clientMatchedInvoices.length} فواتير):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {clientMatchedInvoices.map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          newForm.invoiceId === inv.id 
                            ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-black">{inv.id}</span>
                          <span className="text-slate-500">{inv.date}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 truncate">
                          {inv.items.map(i => i.serviceName).join(' + ')}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-emerald-700 font-bold mt-1">
                          <span>{inv.total} {settings.currency}</span>
                          {inv.items[0]?.technicianName && (
                            <span className="text-slate-500 font-normal">الفني: {inv.items[0].technicianName}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category, Employee, Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تصنيف الشكوى</label>
                  <select
                    value={newForm.category}
                    onChange={e => setNewForm({ ...newForm, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-rose-600"
                  >
                    <option value="service_quality">✂️ جودة الخدمة والقص</option>
                    <option value="staff_behavior">🤝 سلوك وتعامل الموظف</option>
                    <option value="timing_delay">⏰ تأخير في الموعد</option>
                    <option value="skin_hair_damage">⚠️ حساسية أو تلف بشرة/شعر</option>
                    <option value="pricing">💰 أسعار وفواتير</option>
                    <option value="other">📋 أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الموظف المشكو بحقه</label>
                  <select
                    value={newForm.employeeId}
                    onChange={e => setNewForm({ ...newForm, employeeId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-rose-600"
                  >
                    <option value="">-- اختر الفني / الموظف --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">درجة الأهمية</label>
                  <select
                    value={newForm.priority}
                    onChange={e => setNewForm({ ...newForm, priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-rose-600"
                  >
                    <option value="low">منخفضة</option>
                    <option value="medium">متوسطة</option>
                    <option value="high">عالية</option>
                    <option value="urgent">طارئة جداً 🚨</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف الشكوى والمشكلة بالتفصيل</label>
                <textarea
                  rows={3}
                  required
                  placeholder="اكتب هنا تفاصيل المشكلة التي واجهها العميل..."
                  value={newForm.description}
                  onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold outline-none focus:border-rose-600 leading-relaxed"
                />
              </div>

              {/* Before and After Photos Upload (Max 500KB) */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon size={15} className="text-indigo-600" />
                    <span>إرفاق صور قبل وبعد للخدمة (حد أقصى 500 KB للصورة)</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Before Photo */}
                  <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-white">
                    <p className="text-[11px] font-bold text-slate-700 mb-2">📷 صورة قبل (Before)</p>
                    {newForm.beforePhotoUrl ? (
                      <div className="relative w-full h-28 rounded-lg overflow-hidden border border-slate-200 mb-2">
                        <img src={newForm.beforePhotoUrl} alt="Before" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewForm({ ...newForm, beforePhotoUrl: '' })}
                          className="absolute top-1 left-1 bg-rose-600 text-white p-1 rounded-full text-xs"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold inline-block">
                        <span>اختر صورة قبل</span>
                        <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'before')} className="hidden" />
                      </label>
                    )}
                  </div>

                  {/* After Photo */}
                  <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-white">
                    <p className="text-[11px] font-bold text-slate-700 mb-2">📷 صورة بعد (After)</p>
                    {newForm.afterPhotoUrl ? (
                      <div className="relative w-full h-28 rounded-lg overflow-hidden border border-slate-200 mb-2">
                        <img src={newForm.afterPhotoUrl} alt="After" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewForm({ ...newForm, afterPhotoUrl: '' })}
                          className="absolute top-1 left-1 bg-rose-600 text-white p-1 rounded-full text-xs"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold inline-block">
                        <span>اختر صورة بعد</span>
                        <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'after')} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Initial Action Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الإجراء الأولي المتخذ</label>
                <input
                  type="text"
                  placeholder="مثال: تم التواصل هاتفياً وتحديد موعد لزيارة الصالون"
                  value={newForm.initialAction}
                  onChange={e => setNewForm({ ...newForm, initialAction: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-rose-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md shadow-rose-600/20"
                >
                  تأكيد حفظ الشكوى
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACTION NOTE */}
      {showActionModal && selectedComplaint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">إضافة إجراء متابعة للشكوى ({selectedComplaint.id})</h3>
              <button onClick={() => setShowActionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف الإجراء المتخذ</label>
                <textarea
                  rows={3}
                  required
                  placeholder="مثال: تم الاتصال بالعميل والاتفاق على تقديم جلسة علاجية للشعر مجاناً..."
                  value={actionText}
                  onChange={e => setActionText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold outline-none focus:border-indigo-600 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-600/20"
                >
                  حفظ الإجراء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESOLVE COMPLAINT & OFFER FREE REMEDY */}
      {showResolveModal && selectedComplaint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">حل وإغلاق الشكوى ({selectedComplaint.id})</h3>
              <button onClick={() => setShowResolveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolveComplaint} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الحل المتفق عليه والنتيجة النهائية</label>
                <textarea
                  rows={3}
                  required
                  placeholder="مثال: تم تصحيح القصة بالكامل ورضا العميل وشكره للإدارة..."
                  value={resolutionText}
                  onChange={e => setResolutionText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold outline-none focus:border-emerald-600 leading-relaxed"
                />
              </div>

              {/* Free Remedy Option */}
              <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offerFreeRemedy}
                    onChange={e => setOfferFreeRemedy(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-xs font-black text-purple-950 flex items-center gap-1">
                    <span>🔧 تقديم إصلاح مجاني على حساب الصالون (فاتورة 0.00 ر.س)</span>
                  </span>
                </label>
                <p className="text-[11px] text-purple-800 pr-6">
                  سيتم توثيق أن هذا العميل حصل على إصلاح مجاني لضمان عدم تكرار طلب تعويضات دون علم الإدارة.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/20"
                >
                  تأكيد حل الشكوى
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PHOTO PREVIEW (BEFORE & AFTER COMPARISON) */}
      {showPhotoPreview && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">{showPhotoPreview.title}</h3>
              <button onClick={() => setShowPhotoPreview(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-center">
                <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full border border-amber-200">
                  صورة قبل (Before)
                </span>
                <div className="h-72 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  {showPhotoPreview.before ? (
                    <img src={showPhotoPreview.before} alt="Before" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">لا توجد صورة قبل</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-center">
                <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-3 py-1 rounded-full border border-emerald-200">
                  صورة بعد (After)
                </span>
                <div className="h-72 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  {showPhotoPreview.after ? (
                    <img src={showPhotoPreview.after} alt="After" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">لا توجد صورة بعد</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowPhotoPreview(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2 rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
