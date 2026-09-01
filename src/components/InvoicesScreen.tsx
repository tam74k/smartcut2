import { useState, useMemo } from 'react';
import { AppSettings, Invoice, Transaction, Client, Branch } from '../types';
import { 
  Search, Filter, Printer, XCircle, Edit, CheckCircle, ChevronDown, 
  ChevronUp, Image as ImageIcon, Wrench, Eye, X, Trash2 
} from 'lucide-react';
import { DB } from '../services/db';

export function InvoicesScreen({ 
  settings, 
  invoices, 
  setInvoices, 
  transactions, 
  setTransactions,
  clients,
  setClients,
  activeBranchId,
  branches = [],
  currentUser
}: { 
  settings: AppSettings;
  invoices: Invoice[];
  setInvoices: (i: Invoice[]) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  clients: Client[];
  setClients: (c: Client[]) => void;
  activeBranchId?: string;
  branches?: Branch[];
  currentUser?: any;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled' | 'unpaid'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState<{ before?: string; after?: string; title: string } | null>(null);
  
  const [showPayModal, setShowPayModal] = useState<Invoice | null>(null);
  const [payTreasury, setPayTreasury] = useState(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || '');
  const [cashbackToUse, setCashbackToUse] = useState<number>(0);
  
  const [showEditModal, setShowEditModal] = useState<Invoice | null>(null);

  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<Invoice | null>(null);
  const [adminPasswordTarget, setAdminPasswordTarget] = useState<Invoice | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);

  // 🗑️ حذف الفاتورة نهائياً لحساب الأدمن والمالك حتى لو كانت قديمة
  const handleDeleteInvoice = async (inv: Invoice) => {
    const isAuthorized = !currentUser || currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer' || currentUser.actions?.includes('manage_invoices_delete') || currentUser.actions?.includes('*');
    if (!isAuthorized) {
      alert('⛔ عذراً، حذف الفواتير يتطلب صلاحية الإدارة (الأدمن أو المالك).');
      return;
    }

    if (window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف الفاتورة رقم (${inv.id}) نهائياً من النظام وقاعدة البيانات؟ سيتم عكس وتعديل رصيد الخزائن المرتبطة بها.`)) {
      // 1. Delete from DB
      await DB.deleteInvoice(inv.id);
      
      // 2. Remove from state
      setInvoices(invoices.filter(i => i.id !== inv.id));

      // 3. Reverse any financial transactions for this invoice
      setTransactions(transactions.filter(t => (t as any).invoiceId !== inv.id && !t.description?.includes(inv.id)));
      
      alert(`✅ تم حذف الفاتورة ${inv.id} بنجاح.`);
    }
  };
  
  const handleConfirmCancel = () => {
    if (!cancelInvoiceTarget) return;
    const invoice = cancelInvoiceTarget;
    // Update invoice status
    setInvoices(invoices.map(inv => inv.id === invoice.id ? { ...inv, status: 'cancelled' } : inv));
    // Remove financial effect (delete related transactions)
    setTransactions(transactions.filter(t => !t.description.includes(invoice.id)));

    // Revert cashback if it was used
    if (invoice.cashbackUsed && invoice.clientId) {
      setClients(clients.map(c => c.id === invoice.clientId ? { ...c, loyaltyPoints: c.loyaltyPoints + invoice.cashbackUsed! } : c));
    }

    setCancelInvoiceTarget(null);
  };

  const handleAdminPasswordSubmit = () => {
    if (adminPasswordInput === 'admin') {
      setShowEditModal(adminPasswordTarget);
      setAdminPasswordTarget(null);
      setAdminPasswordInput('');
      setAdminPasswordError(false);
    } else {
      setAdminPasswordError(true);
    }
  };
  
  const handlePayInvoice = () => {
    if (!showPayModal) return;
    
    const invoice = showPayModal;
    const client = invoice.clientId ? clients.find(c => c.id === invoice.clientId) : null;
    const maxCashback = client ? client.loyaltyPoints : 0;
    
    const finalCashbackUsed = Math.min(cashbackToUse, maxCashback, invoice.total);
    const remainingToPay = invoice.total - finalCashbackUsed;

    if (remainingToPay > 0 && !payTreasury) {
      alert('الرجاء اختيار خزينة لسداد باقي المبلغ');
      return;
    }
    
    const paymentMethods = [];
    
    if (finalCashbackUsed > 0) {
      paymentMethods.push({ amount: finalCashbackUsed, treasuryId: 'cashback' });
      if (client) {
        setClients(clients.map(c => c.id === client.id ? { ...c, loyaltyPoints: c.loyaltyPoints - finalCashbackUsed } : c));
      }
    }

    if (remainingToPay > 0) {
      // Create transaction
      const newTrx: Transaction = {
        id: 'TRX-' + Math.random().toString(36).substr(2,9),
        date: new Date().toISOString(),
        type: 'in',
        amount: remainingToPay,
        category: 'sales',
        description: `مبيعات - فاتورة ${invoice.id}`,
        treasury: payTreasury
      };
      setTransactions([...transactions, newTrx]);
      paymentMethods.push({ amount: remainingToPay, treasuryId: payTreasury });
    }
    
    setInvoices(invoices.map(inv => inv.id === invoice.id ? { 
      ...inv, 
      status: 'completed', 
      cashbackUsed: finalCashbackUsed,
      paymentMethods: paymentMethods 
    } : inv));
    
    setShowPayModal(null);
    setCashbackToUse(0);
  };
  
  const handlePrint = (invoice: Invoice) => {
    // Generate simple print view
    const printContent = document.getElementById(`invoice-print-${invoice.id}`)?.outerHTML;
    if (printContent) {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write('<html><head><title>طباعة الفاتورة</title>');
        printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">');
        printWindow.document.write('<style>');
        printWindow.document.write('body { margin: 0; display: flex; justify-content: center; background-color: #fff; direction: rtl; }');
        printWindow.document.write('@media print { body { padding: 0; margin: 0; } @page { margin: 0; } }');
        printWindow.document.write('</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent);
        printWindow.document.write('</body></html>');
        
        printWindow.setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
  };

  const mainBranch = (branches && branches[0]) || { id: 'b-main', name: 'الفرع الرئيسي' };
  const mainBranchId = mainBranch.id;
  const isMainBranch = !activeBranchId || activeBranchId === mainBranchId || activeBranchId === 'b-main';

  const matchesActiveBranch = (itemBranchId?: string) => {
    if (itemBranchId) {
      return itemBranchId === activeBranchId;
    }
    return isMainBranch;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Branch filter
      if (!matchesActiveBranch(inv.branchId)) return false;

      // Date filter
      const invDateStr = inv.date.split('T')[0];
      if (dateFrom && invDateStr < dateFrom) return false;
      if (dateTo && invDateStr > dateTo) return false;
      
      // Status filter
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      
      // Payment filter
      if (paymentFilter !== 'all') {
        if (!inv.paymentMethods || !inv.paymentMethods.some(pm => pm.treasuryId === paymentFilter)) return false;
      }
      
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return inv.id.toLowerCase().includes(q) || 
               inv.clientName.toLowerCase().includes(q) || 
               (inv.clientPhone && inv.clientPhone.includes(q));
      }
      
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, dateFrom, dateTo, statusFilter, paymentFilter, searchQuery, activeBranchId, isMainBranch]);

  return (
    <div className="p-8 w-full h-full flex flex-col bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة الفواتير</h2>
          <p className="text-slate-500 text-sm mt-1">استعراض وتصفية فواتير النظام</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث بالرقم، الاسم، الجوال..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:border-primary w-64 shadow-sm" 
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors ${showFilters ? 'text-primary border-primary/50' : 'text-slate-700'}`}
          >
            <Filter size={16} /> تصفية
            {showFilters ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">من تاريخ</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">حالة الفاتورة</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="all">الكل</option>
              <option value="completed">مكتملة ومسددة</option>
              <option value="unpaid">غير مسددة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع</label>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="all">الكل</option>
              {settings.treasuries.filter(t => !t.isMain).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">رقم الفاتورة</th>
                <th className="px-6 py-4">التاريخ والوقت</th>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">الخدمات والموظف</th>
                <th className="px-6 py-4 text-center">طريقة الدفع</th>
                <th className="px-6 py-4 text-center">الخصم</th>
                <th className="px-6 py-4 text-center">المسدد كاش باك</th>
                <th className="px-6 py-4">الإجمالي</th>
                <th className="px-6 py-4 text-center">الحالة</th>
                <th className="px-6 py-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className={`transition-colors ${inv.status === 'cancelled' ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-6 py-4 font-bold text-slate-800">{inv.id}</td>
                  <td className="px-6 py-4 text-slate-600">{new Date(inv.date).toLocaleString('ar-EG')}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-primary">{inv.clientName}</div>
                    {inv.clientPhone && <div className="text-xs text-slate-500">{inv.clientPhone}</div>}
                    {inv.isRemedyInvoice && (
                      <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 border border-purple-200">
                        <Wrench size={10} />
                        <span>إصلاح مجاني (ضمان الصالون)</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {inv.items.map((item, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-bold text-slate-700">{item.serviceName}</span>
                          <span className="text-slate-400 mx-1">بواسطة</span>
                          <span className="text-emerald-600 font-bold">{item.technicianName}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">
                    {inv.paymentMethods?.map(pm => {
                      const treasury = settings.treasuries.find(t => t.id === pm.treasuryId);
                      return treasury ? <div key={pm.treasuryId}>{treasury.name} ({pm.amount})</div> : null;
                    }) || '-'}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-red-500">{inv.discount > 0 ? inv.discount.toFixed(2) : '-'}</td>
                  <td className="px-6 py-4 text-center font-bold text-blue-600">{inv.cashbackUsed > 0 ? inv.cashbackUsed.toFixed(2) : '-'}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    <div>{inv.total.toFixed(2)} {settings.currency}</div>
                    {inv.isRemedyInvoice && <div className="text-[10px] text-purple-700 font-bold">(0.00 إصلاح)</div>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      inv.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                      inv.status === 'unpaid' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {inv.status === 'completed' ? 'مسددة' : inv.status === 'unpaid' ? 'غير مسددة' : 'ملغاة'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Before / After Photo Preview Button */}
                      {(inv.beforePhotoUrl || inv.afterPhotoUrl) && (
                        <button
                          onClick={() => setShowPhotoPreview({
                            before: inv.beforePhotoUrl,
                            after: inv.afterPhotoUrl,
                            title: `صور جلسة العميل (${inv.clientName}) - فاتورة #${inv.id}`
                          })}
                          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                          title="عرض صور قبل وبعد"
                        >
                          <ImageIcon size={16} />
                        </button>
                      )}

                      {inv.status === 'unpaid' && (
                        <button onClick={() => setShowPayModal(inv)} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors" title="سداد الفاتورة">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      
                      <button onClick={() => {
                        setAdminPasswordTarget(inv);
                        setAdminPasswordInput('');
                        setAdminPasswordError(false);
                      }} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors" title="تعديل الفاتورة (إدارة)">
                        <Edit size={16} />
                      </button>

                      <button onClick={() => handlePrint(inv)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors" title="طباعة">
                        <Printer size={16} />
                      </button>
                      
                      {inv.status === 'completed' && (
                        <button onClick={() => setCancelInvoiceTarget(inv)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors" title="إلغاء الفاتورة">
                          <XCircle size={16} />
                        </button>
                      )}

                      {/* زر حذف الفاتورة نهائياً للإدارة */}
                      <button 
                        onClick={() => handleDeleteInvoice(inv)} 
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors" 
                        title="حذف الفاتورة نهائياً (إدارة)"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    
                    {/* Hidden printable receipt */}
                    <div className="hidden">
                      <div id={`invoice-print-${inv.id}`} className="bg-white shadow-sm" style={{ width: '100%', maxWidth: '72mm', padding: '5mm', fontFamily: '"Cairo", sans-serif', color: '#000', margin: '0 auto', boxSizing: 'border-box' }}>
                        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                          {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="Logo" style={{ maxWidth: '80px', maxHeight: '80px', margin: '0 auto 10px auto', display: 'block' }} />
                          )}
                          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 5px 0' }}>{settings.salonName || 'صالون العناية'}</h2>
                          
                          <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>
                          
                          <p style={{ fontSize: '13px', margin: '0' }}>رقم الفاتورة: {inv.id}</p>
                          <p style={{ fontSize: '13px', margin: '0' }}>التاريخ: {new Date(inv.date).toLocaleString('ar-SA')}</p>
                          {inv.clientName && (
                            <p style={{ fontSize: '13px', margin: '5px 0 0 0' }}>العميل: {inv.clientName}</p>
                          )}
                        </div>
                        
                        <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>
                        
                        <table style={{ width: '100%', fontSize: '13px', textAlign: 'right', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #000' }}>
                              <th style={{ padding: '8px 0', width: '50%' }}>الصنف</th>
                              <th style={{ padding: '8px 0', textAlign: 'center', width: '20%' }}>الكمية</th>
                              <th style={{ padding: '8px 0', textAlign: 'left', width: '30%' }}>السعر</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.items.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                                <td style={{ padding: '8px 0' }}>
                                  <div style={{ fontWeight: 'bold' }}>{item.serviceName}</div>
                                  <div style={{ fontSize: '11px', color: '#555' }}>بواسطة: {item.technicianName || '-'}</div>
                                </td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}>{item.quantity || 1}</td>
                                <td style={{ padding: '8px 0', textAlign: 'left' }}>{item.price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>
                        
                        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>المجموع:</span>
                            <span>{inv.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0).toFixed(2)}</span>
                          </div>
                          {inv.discount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>الخصم:</span>
                              <span>- {inv.discount.toFixed(2)}</span>
                            </div>
                          )}
                          {settings.vatEnabled && (() => {
                            const invoiceSubtotal = inv.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                            const totalInclusive = Math.max(0, invoiceSubtotal - inv.discount);
                            const baseTotal = totalInclusive / (1 + settings.vatRate / 100);
                            const vatAmt = totalInclusive - baseTotal;
                            return (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                  <span>المبلغ قبل الضريبة:</span>
                                  <span>{baseTotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                  <span>الضريبة ({settings.vatRate}%):</span>
                                  <span>{vatAmt.toFixed(2)} شامل</span>
                                </div>
                              </>
                            );
                          })()}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #000' }}>
                            <span>الصافي المدفوع:</span>
                            <span>{inv.total.toFixed(2)} {settings.currency}</span>
                          </div>
                          {inv.paymentMethods && inv.paymentMethods.length > 0 && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ccc', fontSize: '12px' }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>طرق الدفع:</div>
                              {inv.paymentMethods.map((pm, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{pm.treasuryId === 'cashback' ? 'كاش باك' : (settings.treasuries.find(t => t.id === pm.treasuryId)?.name || 'غير محدد')}</span>
                                  <span>{pm.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {inv.status === 'cancelled' && (
                            <div style={{ textAlign: 'center', margin: '10px 0', padding: '5px', border: '2px solid red', color: 'red', fontWeight: 'bold' }}>
                              فاتورة ملغاة
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '13px', fontWeight: 'bold' }}>
                          <p style={{ margin: '0 0 10px 0' }}>شكراً لزيارتكم!</p>
                          {settings.phone && <p style={{ fontSize: '12px', fontWeight: 'normal', margin: '2px 0' }}>جوال: {settings.phone}</p>}
                          {settings.address && <p style={{ fontSize: '12px', fontWeight: 'normal', margin: '2px 0' }}>العنوان: {settings.address}</p>}
                        </div>
                      </div>
                    </div>

                  </td>
                </tr>
              ))}
              
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">لا توجد فواتير تطابق شروط التصفية</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">سداد فاتورة</h3>
              <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-red-500"><XCircle size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="text-center mb-6">
                <p className="text-slate-500 text-sm mb-1">المبلغ المطلوب</p>
                <p className="text-3xl font-extrabold text-primary">{showPayModal.total.toFixed(2)} <span className="text-sm">{settings.currency}</span></p>
              </div>

              {(() => {
                const client = showPayModal.clientId ? clients.find(c => c.id === showPayModal.clientId) : null;
                const maxCashback = client ? client.loyaltyPoints : 0;
                const remainingToPay = showPayModal.total - (cashbackToUse || 0);

                return (
                  <>
                    {client && maxCashback > 0 && (
                      <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-blue-800">رصيد الكاش باك المتوفر:</span>
                          <span className="text-sm font-bold text-blue-600">{maxCashback.toFixed(2)} {settings.currency}</span>
                        </div>
                        <label className="block text-xs font-bold text-blue-700 mb-1">المبلغ المستخدم من الكاش باك:</label>
                        <input 
                          type="number" 
                          max={Math.min(maxCashback, showPayModal.total)}
                          min={0}
                          value={cashbackToUse}
                          onChange={(e) => {
                            let val = Number(e.target.value);
                            if (val > maxCashback) val = maxCashback;
                            if (val > showPayModal.total) val = showPayModal.total;
                            if (val < 0) val = 0;
                            setCashbackToUse(val);
                          }}
                          className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    {remainingToPay > 0 && (
                      <>
                        <div className="mb-4 text-center">
                          <span className="text-sm font-bold text-slate-600">المبلغ المتبقي للدفع: </span>
                          <span className="text-lg font-bold text-primary">{remainingToPay.toFixed(2)} {settings.currency}</span>
                        </div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">طريقة الدفع (الخزينة)</label>
                        <div className="space-y-2">
                          {settings.treasuries.filter(t => !t.isMain).map(t => (
                            <label key={t.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${payTreasury === t.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-200'}`}>
                              <input type="radio" name="payTreasury" value={t.id} checked={payTreasury === t.id} onChange={() => setPayTreasury(t.id)} className="text-primary" />
                              <span className="font-bold text-slate-700">{t.name}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button onClick={handlePayInvoice} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors">تأكيد السداد</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (Admin) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">تعديل الفاتورة {showEditModal.id} (صلاحية إدارة)</h3>
              <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-red-500"><XCircle size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم العميل</label>
                <input 
                  type="text" 
                  value={showEditModal.clientName}
                  onChange={e => setShowEditModal({...showEditModal, clientName: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ الإجمالي</label>
                <input 
                  type="number" 
                  value={showEditModal.total}
                  onChange={e => setShowEditModal({...showEditModal, total: Number(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الخصم</label>
                <input 
                  type="number" 
                  value={showEditModal.discount}
                  onChange={e => setShowEditModal({...showEditModal, discount: Number(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                />
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 font-bold mb-1">ملاحظة هامة:</p>
                <p className="text-xs text-amber-600">التعديل المباشر على قيمة الفاتورة لن يقوم بتعديل المعاملات المالية (القيود) المرتبطة بها تلقائياً. يُفضل إلغاء الفاتورة وإصدار فاتورة جديدة لضمان صحة التقارير المالية.</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowEditModal(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">إلغاء</button>
              <button onClick={() => {
                setInvoices(invoices.map(i => i.id === showEditModal.id ? showEditModal : i));
                setShowEditModal(null);
              }} className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {cancelInvoiceTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} />
              </div>
              <h3 className="font-bold text-xl text-slate-800 mb-2">إلغاء الفاتورة</h3>
              <p className="text-slate-500 text-sm">هل أنت متأكد من إلغاء هذه الفاتورة؟ سيزول أثرها المالي بالكامل ولن يمكنك التراجع عن هذا الإجراء.</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setCancelInvoiceTarget(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">تراجع</button>
              <button onClick={handleConfirmCancel} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors">تأكيد الإلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Modal */}
      {adminPasswordTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <h3 className="font-bold text-xl text-slate-800 mb-2">صلاحية إدارة</h3>
              <p className="text-slate-500 text-sm mb-4">الرجاء إدخال كلمة مرور الإدارة لتعديل الفاتورة.</p>
              <input 
                type="password" 
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                placeholder="كلمة المرور (admin)"
                onKeyDown={(e) => e.key === 'Enter' && handleAdminPasswordSubmit()}
                className={`w-full bg-slate-50 border ${adminPasswordError ? 'border-red-500' : 'border-slate-200'} rounded-lg px-4 py-3 text-center outline-none focus:border-primary`} 
              />
              {adminPasswordError && <p className="text-red-500 text-xs mt-2">كلمة المرور غير صحيحة</p>}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => {
                setAdminPasswordTarget(null);
                setAdminPasswordInput('');
                setAdminPasswordError(false);
              }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">إلغاء</button>
              <button onClick={handleAdminPasswordSubmit} className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors">دخول</button>
            </div>
          </div>
        </div>
      )}

      {/* Before / After Photo Comparison Modal */}
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

