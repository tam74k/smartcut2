import React, { useState } from 'react';
import { Employee, EmployeeCustody, AppSettings } from '../types';
import { Package, Plus, CheckCircle2, AlertTriangle, Trash2, Printer, X, ShieldAlert } from 'lucide-react';

interface EmployeeCustodyModalProps {
  employee: Employee;
  settings: AppSettings;
  custodies: EmployeeCustody[];
  setCustodies: (updater: EmployeeCustody[] | ((prev: EmployeeCustody[]) => EmployeeCustody[])) => void;
  onClose: () => void;
  currentUser?: any;
}

export function EmployeeCustodyModal({
  employee,
  settings,
  custodies = [],
  setCustodies,
  onClose,
  currentUser
}: EmployeeCustodyModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [givenDate, setGivenDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const employeeCustodies = custodies.filter(c => c.employeeId === employee.id);
  const inCustodyItems = employeeCustodies.filter(c => c.status === 'in_custody');

  const handleSaveCustody = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      alert('يرجى كتابة اسم العهدة المسلمة');
      return;
    }

    const newCustody: EmployeeCustody = {
      id: 'CUST-' + Math.random().toString(36).substring(2, 9),
      salonId: settings.salonId,
      branchId: employee.branchId,
      employeeId: employee.id,
      employeeName: employee.name,
      itemName: itemName.trim(),
      serialNumber: serialNumber.trim() || undefined,
      quantity: Number(quantity) || 1,
      givenDate: givenDate,
      status: 'in_custody',
      notes: notes.trim() || undefined,
      createdBy: currentUser?.name || 'المدير'
    };

    setCustodies([...custodies, newCustody]);
    setItemName('');
    setSerialNumber('');
    setQuantity(1);
    setNotes('');
    setShowAddForm(false);
  };

  const handleUpdateStatus = (id: string, newStatus: 'returned' | 'damaged' | 'lost') => {
    const reason = prompt('هل ترغب في إضافة ملاحظات أو سبب التغيير؟') || '';
    const now = new Date().toISOString().split('T')[0];
    setCustodies(custodies.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: newStatus,
          returnedDate: newStatus === 'returned' ? now : undefined,
          notes: reason ? `${c.notes ? c.notes + ' | ' : ''}${reason}` : c.notes
        };
      }
      return c;
    }));
  };

  // Print Handover Form
  const handlePrintHandover = (c: EmployeeCustody) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>نموذج تسليم واستلام عهدة - ${employee.name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 22px; font-weight: 900; margin: 5px 0; }
            .salon-name { font-size: 16px; color: #64748b; font-weight: bold; }
            .table { width: 100%; border-collapse: collapse; margin: 25px 0; }
            .table th, .table td { border: 1px solid #cbd5e1; padding: 12px; text-align: right; }
            .table th { background: #f8fafc; font-weight: bold; }
            .declaration { background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 13px; line-height: 1.6; margin-top: 25px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .sig-block { text-align: center; width: 220px; }
            .sig-line { border-bottom: 1px dashed #000; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="salon-name">${settings.salonName || 'Smart Cut Salon'}</div>
            <div class="title">نموذج تسليم واستلام عهدة عينية</div>
            <div style="font-size: 12px; color: #94a3b8;">رقم السند: ${c.id} - التاريخ: ${c.givenDate}</div>
          </div>

          <p><strong>اسم الموظف المستلم:</strong> ${employee.name} (الوظيفة: ${employee.role})</p>
          
          <table class="table">
            <thead>
              <tr>
                <th>بيان الصنف / الأداة</th>
                <th>الرقم التسلسلي / الموديل</th>
                <th>الكمية</th>
                <th>تاريخ التسليم</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${c.itemName}</strong></td>
                <td>${c.serialNumber || 'لا يوجد'}</td>
                <td>${c.quantity}</td>
                <td>${c.givenDate}</td>
                <td>بحالة ممتازة وجديدة</td>
              </tr>
            </tbody>
          </table>

          ${c.notes ? `<p><strong>ملاحظات وشروط خاصة:</strong> ${c.notes}</p>` : ''}

          <div class="declaration">
            <strong>إقرار واستلام:</strong><br/>
            أقر أنا الموظف الموضح اسمي أعلاه بأنني استلمت العهدة الموضحة بالجدول بحالة جيدة وسليمة للاستخدام في أعمال الصالون، وأتعهد بالمحافظة عليها وإعادتها فور طلب الإدارة أو عند انتهاء علاقة العمل، وأتحمل المسؤولية الكاملة في حال الإهمال أو الفقد.
          </div>

          <div class="signatures">
            <div class="sig-block">
              <div><strong>توقيع الموظف المستلم</strong></div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-block">
              <div><strong>مسؤول العهد / المدير</strong></div>
              <div>${c.createdBy || 'الإدارة'}</div>
              <div class="sig-line"></div>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-800">سجل عهد الموظف: {employee.name}</h3>
              <p className="text-xs text-slate-400">إدارة الأدوات والأجهزة والمعدات المسلمة للموظف</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 font-bold text-lg p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4 flex-1">
          {/* Summary Warning */}
          {inCustodyItems.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-3">
              <ShieldAlert className="text-amber-600 shrink-0" size={22} />
              <div className="text-xs text-amber-800">
                <span className="font-bold">توجد {inCustodyItems.length} عهدة قيد حوزة الموظف حالياً.</span> لا يمكن إنهاء خدمة الموظف إلا بعد تسليم كافة العهد أو إقرار الإدارة.
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-600 shrink-0" size={22} />
              <div className="text-xs text-emerald-800 font-bold">
                ذمة الموظف خالية من أي عهد عينية حالياً.
              </div>
            </div>
          )}

          {/* Add Custody Button / Form */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <Plus size={16} />
              <span>تسليم عهدة جديدة للموظف</span>
            </button>
          ) : (
            <form onSubmit={handleSaveCustody} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
              <div className="font-bold text-xs text-slate-700">تسجيل نموذج تسليم عهدة:</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم الأداة / العهدة *</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    placeholder="مثال: ماكينة واهل اللاسلكية، مقص فيلكس"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">الرقم التسلسلي / الموديل</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="اختياري"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">الكمية</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">تاريخ التسليم</label>
                  <input
                    type="date"
                    value={givenDate}
                    onChange={e => setGivenDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">ملاحظات العهدة</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="الحالة عند الاستلام، كود الفرع..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-xs"
                >
                  حفظ وتسليم العهدة
                </button>
              </div>
            </form>
          )}

          {/* Custody List */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            {employeeCustodies.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                لا توجد أي عهد مسجلة للموظف
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="p-3">اسم العهدة</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3">تاريخ التسليم</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeCustodies.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-800">
                        <div>{c.itemName}</div>
                        {c.serialNumber && <div className="text-[10px] text-slate-400 font-mono">سيريال: {c.serialNumber}</div>}
                        {c.notes && <div className="text-[10px] text-slate-500">{c.notes}</div>}
                      </td>
                      <td className="p-3 font-mono font-bold">{c.quantity}</td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{c.givenDate}</td>
                      <td className="p-3 text-center">
                        {c.status === 'in_custody' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-100">
                            بحوزة الموظف
                          </span>
                        ) : c.status === 'returned' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-100">
                            تم الاسترجاع ({c.returnedDate || 'نعم'})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold text-[10px] border border-red-100">
                            {c.status === 'damaged' ? 'تالفة' : 'مفقودة'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handlePrintHandover(c)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                            title="طباعة نموذج التسليم"
                          >
                            <Printer size={14} />
                          </button>
                          {c.status === 'in_custody' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(c.id, 'returned')}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold"
                              >
                                استرجاع
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(c.id, 'damaged')}
                                className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold"
                              >
                                تلف/فقد
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
