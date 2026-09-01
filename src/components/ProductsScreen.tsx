import { useState } from 'react';
import { Package, Search, Plus, Edit2, Trash2, X, AlertTriangle, TrendingDown, FileSpreadsheet, Download, Upload, Check, Sparkles, AlertCircle, Printer, QrCode } from 'lucide-react';
import { AppSettings, Product, Category, Employee } from '../types';
import { downloadProductsTemplate, readExcelFile } from '../utils/excelHelper';
import { BarcodePrintModal } from './BarcodePrintModal';

export function ProductsScreen({ 
  settings, 
  products, 
  setProducts, 
  categories, 
  employees, 
  shiftData
}: { 
  settings: AppSettings;
  products: Product[]; 
  setProducts: (p: Product[]) => void;
  categories: Category[];
  employees: Employee[];
  shiftData: { isOpen: boolean; date: string; initialCash: number };
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Excel Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: categories[0]?.id || '',
    sellPrice: '',
    costPrice: '',
    reorderLimit: '',
    openingStock: '',
    commission: ''
  });

  const [dispenseData, setDispenseData] = useState({
    date: shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0],
    dispenserName: 'مدير النظام',
    items: [{ productId: '', quantity: 1, employeeId: employees[0]?.id || '' }]
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.includes(searchQuery);
    const matchesCat = categoryFilter === 'all' || p.categoryId === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleEdit = (p: Product) => {
    setEditingProductId(p.id);
    setFormData({
      name: p.name,
      categoryId: p.categoryId,
      sellPrice: p.sellPrice.toString(),
      costPrice: p.costPrice.toString(),
      reorderLimit: p.reorderLimit.toString(),
      openingStock: p.openingStock.toString(),
      commission: p.commission.toString()
    });
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleSaveProduct = () => {
    if (!formData.name.trim()) return setErrorMsg('الرجاء إدخال اسم المنتج');
    if (!formData.categoryId) return setErrorMsg('الرجاء اختيار التصنيف');
    
    const sPrice = Number(formData.sellPrice);
    const cPrice = Number(formData.costPrice);
    const rLimit = Number(formData.reorderLimit);
    const oStock = Number(formData.openingStock);
    const comm = Number(formData.commission);

    if (isNaN(sPrice) || sPrice < 0) return setErrorMsg('الرجاء إدخال سعر بيع صحيح');
    if (isNaN(cPrice) || cPrice < 0) return setErrorMsg('الرجاء إدخال سعر تكلفة صحيح');

    if (editingProductId) {
      setProducts(products.map(p => {
        if (p.id === editingProductId) {
          // If editing opening stock, adjust current stock by the difference
          const diff = oStock - p.openingStock;
          return {
            ...p,
            name: formData.name,
            categoryId: formData.categoryId,
            sellPrice: sPrice,
            costPrice: cPrice,
            reorderLimit: rLimit,
            openingStock: oStock,
            currentStock: p.currentStock + diff,
            commission: comm
          };
        }
        return p;
      }));
    } else {
      const newProduct: Product = {
        id: 'PRD-' + Math.random().toString(36).substr(2, 9),
        name: formData.name,
        categoryId: formData.categoryId,
        sellPrice: sPrice,
        costPrice: cPrice,
        reorderLimit: rLimit,
        openingStock: oStock,
        currentStock: oStock,
        commission: comm
      };
      setProducts([...products, newProduct]);
    }
    setShowAddModal(false);
    setEditingProductId(null);
  };

  const handleDispense = () => {
    // Validate
    for (let i = 0; i < dispenseData.items.length; i++) {
      const item = dispenseData.items[i];
      if (!item.productId) return setErrorMsg(`الرجاء اختيار صنف في السطر ${i + 1}`);
      if (item.quantity <= 0) return setErrorMsg(`الكمية يجب أن تكون أكبر من 0 في السطر ${i + 1}`);
      if (!item.employeeId) return setErrorMsg(`الرجاء اختيار الموظف في السطر ${i + 1}`);
      
      const prod = products.find(p => p.id === item.productId);
      if (prod && prod.currentStock < item.quantity) {
        return setErrorMsg(`الرصيد الحالي للصنف "${prod.name}" لا يكفي (المتاح: ${prod.currentStock})`);
      }
    }

    // Execute Dispense
    const updatedProducts = [...products];
    dispenseData.items.forEach(item => {
      const idx = updatedProducts.findIndex(p => p.id === item.productId);
      if (idx !== -1) {
        updatedProducts[idx] = { ...updatedProducts[idx], currentStock: updatedProducts[idx].currentStock - item.quantity };
      }
    });

    setProducts(updatedProducts);
    setShowDispenseModal(false);
    alert("تم صرف المنتجات بنجاح");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setImportError('يرجى اختيار ملف إكسل بتنسيق .xlsx حصراً');
      return;
    }

    try {
      setImportError('');
      setImportFileName(file.name);
      const data = await readExcelFile(file);
      if (!data || data.length === 0) {
        setImportError('الملف المحدد فارغ أو لا يحتوي على صفوف بيانات.');
        return;
      }
      setImportedRows(data);
    } catch (err: any) {
      setImportError('حدث خطأ أثناء قراءة ملف الإكسل: ' + (err.message || 'تأكد من صيغة الملف'));
    }
  };

  const handleExecuteImport = () => {
    if (importedRows.length === 0) return;

    const newProducts: Product[] = [];

    importedRows.forEach((row, idx) => {
      const name = String(row['اسم المنتج'] || row['المنتج'] || row['Product Name'] || row['name'] || '').trim();
      if (!name) return;

      const catName = String(row['اسم التصنيف'] || row['التصنيف'] || row['Category'] || row['category'] || '').trim();
      const category = categories.find(c => c.name.toLowerCase() === catName.toLowerCase()) || categories[0];

      const sellPrice = Number(row['سعر البيع (ر.س)'] || row['سعر البيع'] || row['Sell Price'] || row['sellPrice'] || 0);
      const costPrice = Number(row['سعر التكلفة (ر.س)'] || row['سعر التكلفة'] || row['Cost Price'] || row['costPrice'] || 0);
      const openingStock = Number(row['المخزون الافتتاحي'] || row['المخزون'] || row['Opening Stock'] || 0);
      const reorderLimit = Number(row['حد إعادة الطلب'] || row['حد الطلب'] || row['Reorder Limit'] || 5);
      const commission = Number(row['نسبة عمولة البيع (%)'] || row['العمولة'] || row['Commission'] || 0);
      const barcode = String(row['الباركود'] || row['Barcode'] || '').trim();

      newProducts.push({
        id: 'PRD-' + Math.random().toString(36).substr(2, 9) + '-' + idx,
        name,
        categoryId: category?.id || 'cat-general',
        sellPrice: isNaN(sellPrice) ? 0 : sellPrice,
        costPrice: isNaN(costPrice) ? 0 : costPrice,
        openingStock: isNaN(openingStock) ? 0 : openingStock,
        currentStock: isNaN(openingStock) ? 0 : openingStock,
        reorderLimit: isNaN(reorderLimit) ? 5 : reorderLimit,
        commission: isNaN(commission) ? 0 : commission,
        barcode: barcode || undefined
      });
    });

    if (newProducts.length === 0) {
      setImportError('لم يتم العثور على منتجات صالحة للاستيراد في الملف.');
      return;
    }

    setProducts([...products, ...newProducts]);
    setShowImportModal(false);
    setImportedRows([]);
    setImportFileName('');
    alert(`تم استيراد ${newProducts.length} منتج بنجاح!`);
  };

  return (
    <div className="p-8 w-full h-full overflow-y-auto bg-slate-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة المنتجات</h2>
          <p className="text-slate-500 text-sm mt-1">إضافة الأصناف، جرد المخزون، وصرف المنتجات</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setImportError('');
              setImportedRows([]);
              setImportFileName('');
              setShowImportModal(true);
            }} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            title="سحب واستيراد منتجات من ملف إكسل .xlsx"
          >
            <FileSpreadsheet size={18} /> سحب من Excel
          </button>
          <button onClick={() => {
            setErrorMsg('');
            setDispenseData({
              date: shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0],
              dispenserName: 'المستخدم الحالي',
              items: [{ productId: '', quantity: 1, employeeId: employees[0]?.id || '' }]
            });
            setShowDispenseModal(true);
          }} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer">
            <TrendingDown size={18} /> صرف منتجات للعاملين
          </button>
          <button onClick={() => {
            setErrorMsg('');
            setEditingProductId(null);
            setFormData({
              name: '', categoryId: categories[0]?.id || '', sellPrice: '', costPrice: '', reorderLimit: '', openingStock: '', commission: ''
            });
            setShowAddModal(true);
          }} className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer">
            <Plus size={18} /> إضافة منتج جديد
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث عن منتج..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:border-primary focus:bg-white transition-colors"
          />
        </div>
        <select 
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-48 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:bg-white font-bold text-slate-700"
        >
          <option value="all">جميع التصنيفات</option>
          {categories.filter(c => c.id !== 'all' && c.type === 'product').map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="p-4 font-bold">اسم المنتج</th>
              <th className="p-4 font-bold">التصنيف</th>
              <th className="p-4 font-bold">سعر البيع</th>
              <th className="p-4 font-bold">سعر التكلفة</th>
              <th className="p-4 font-bold">أول المدة</th>
              <th className="p-4 font-bold">الرصيد الحالي</th>
              <th className="p-4 font-bold">تكلفة الرصيد</th>
              <th className="p-4 font-bold">حد الطلب</th>
              <th className="p-4 font-bold">العمولة</th>
              <th className="p-4 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">لا توجد منتجات مسجلة</td>
              </tr>
            ) : (
              filteredProducts.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 font-bold text-slate-800">{p.name}</td>
                  <td className="p-4 text-slate-600">{categories.find(c => c.id === p.categoryId)?.name}</td>
                  <td className="p-4 font-bold text-emerald-600">{p.sellPrice.toFixed(2)}</td>
                  <td className="p-4 font-bold text-rose-600">{p.costPrice.toFixed(2)}</td>
                  <td className="p-4 text-slate-600">{p.openingStock}</td>
                  <td className="p-4 font-bold">
                    <span className={`px-2 py-1 rounded-md ${p.currentStock <= p.reorderLimit ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {p.currentStock}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 font-bold">{(p.currentStock * p.costPrice).toFixed(2)}</td>
                  <td className="p-4 text-slate-500">{p.reorderLimit}</td>
                  <td className="p-4 text-blue-600">{p.commission.toFixed(2)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setBarcodeProduct(p)} 
                        className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors cursor-pointer" 
                        title="طباعة باركود المنتج"
                      >
                        <Printer size={15} />
                      </button>
                      <button onClick={() => handleEdit(p)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="تعديل"><Edit2 size={15} /></button>
                      <button onClick={() => setProductToDelete(p.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="حذف"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Package className="text-primary" size={20} /> 
                {editingProductId ? 'تعديل بيانات بطاقة منتج' : 'بطاقة منتج جديد'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <div className="p-6">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 font-bold mb-4">
                  {errorMsg}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">اسم المنتج</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">التصنيف</label>
                  <select value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                    {categories.filter(c => c.id !== 'all' && c.type === 'product').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">رصيد أول المدة</label>
                  <input type="number" value={formData.openingStock} onChange={e => setFormData({...formData, openingStock: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">سعر البيع ({settings.currency})</label>
                  <input type="number" value={formData.sellPrice} onChange={e => setFormData({...formData, sellPrice: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">سعر التكلفة ({settings.currency})</label>
                  <input type="number" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">حد الطلب (التنبيه)</label>
                  <input type="number" value={formData.reorderLimit} onChange={e => setFormData({...formData, reorderLimit: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">عمولة البيع</label>
                  <input type="number" value={formData.commission} onChange={e => setFormData({...formData, commission: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">إلغاء</button>
                <button onClick={handleSaveProduct} className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors">حفظ المنتج</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {showDispenseModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <TrendingDown className="text-primary" size={20} /> صرف منتجات للعاملين
              </h3>
              <button onClick={() => setShowDispenseModal(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 font-bold mb-4">
                  {errorMsg}
                </div>
              )}
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">تاريخ الصرف</label>
                  <input type="date" value={dispenseData.date} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">صرف بواسطة</label>
                  <input type="text" value={dispenseData.dispenserName} onChange={e => setDispenseData({...dispenseData, dispenserName: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
              </div>

              <h4 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">تفاصيل الأصناف المنصرفة</h4>
              
              <div className="space-y-3">
                {dispenseData.items.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-end bg-white p-3 border border-slate-200 rounded-xl">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">الصنف</label>
                      <input 
                        list={`products-list`}
                        value={products.find(p => p.id === item.productId)?.name || item.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          const found = products.find(p => p.name === val);
                          const updated = [...dispenseData.items];
                          updated[idx].productId = found ? found.id : val;
                          setDispenseData({...dispenseData, items: updated});
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm"
                        placeholder="ابحث عن الصنف..."
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-bold text-slate-500 mb-1">الكمية</label>
                      <input 
                        type="number" 
                        min="1"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...dispenseData.items];
                          updated[idx].quantity = Number(e.target.value);
                          setDispenseData({...dispenseData, items: updated});
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm text-center" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">الموظف المستلم</label>
                      <select 
                        value={item.employeeId}
                        onChange={e => {
                          const updated = [...dispenseData.items];
                          updated[idx].employeeId = e.target.value;
                          setDispenseData({...dispenseData, items: updated});
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm"
                      >
                        <option value="">-- اختر الموظف --</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                    </div>
                    {dispenseData.items.length > 1 && (
                      <button onClick={() => {
                        const updated = dispenseData.items.filter((_, i) => i !== idx);
                        setDispenseData({...dispenseData, items: updated});
                      }} className="h-[38px] px-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <datalist id="products-list">
                  {products.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                
                <button onClick={() => {
                  setDispenseData({
                    ...dispenseData,
                    items: [...dispenseData.items, { productId: '', quantity: 1, employeeId: employees[0]?.id || '' }]
                  });
                }} className="text-primary font-bold text-sm flex items-center gap-1 hover:underline mt-2">
                  <Plus size={16} /> إضافة سطر جديد
                </button>
              </div>

            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50">
              <button onClick={() => setShowDispenseModal(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">إلغاء</button>
              <button onClick={handleDispense} className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors">تنفيذ عملية الصرف</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <h3 className="font-bold text-lg text-slate-800 mb-4">تأكيد الحذف</h3>
            <p className="text-slate-600 mb-6">هل أنت متأكد من حذف هذا المنتج؟</p>
            <div className="flex gap-3">
              <button onClick={() => setProductToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl transition-colors">إلغاء</button>
              <button onClick={() => {
                setProducts(products.filter(p => p.id !== productToDelete));
                setProductToDelete(null);
              }} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors">نعم، احذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Products Excel Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">سحب واستيراد المنتجات من Excel</h3>
                  <p className="text-xs text-slate-500">استيراد الأصناف، أسعار البيع والتكلفة، والمخزون بملف (.xlsx)</p>
                </div>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Download Banner */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-0.5">
                <p className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-600" />
                  تحميل ملف العينة المعتمد (.xlsx)
                </p>
                <p className="text-[11px] text-emerald-700">
                  قم بتحميل ملف إكسل فارغ معبأ بنماذج المنتجات وتعبئته ثم رفعه
                </p>
              </div>
              <button
                type="button"
                onClick={downloadProductsTemplate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
              >
                <Download size={14} />
                <span>تحميل نموذج .xlsx</span>
              </button>
            </div>

            {/* Upload Area */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">اختر ملف الإكسل (.xlsx) لرفعه:</label>
              <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-6 text-center transition-colors bg-slate-50 relative cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload size={28} className="mx-auto text-emerald-600 mb-2" />
                <p className="text-xs font-bold text-slate-700">
                  {importFileName ? `الملف المحدد: ${importFileName}` : 'اضغط لاختيار ملف .xlsx أو اسحبه هنا'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">يدعم ملفات Microsoft Excel (.xlsx)</p>
              </div>
            </div>

            {/* Error Message */}
            {importError && (
              <div className="bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{importError}</span>
              </div>
            )}

            {/* Parsed Preview */}
            {importedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>تمت قراءة البيانات بنجاح:</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {importedRows.length} منتج جاهز للاستيراد
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                      <tr>
                        <th className="p-2">المنتج</th>
                        <th className="p-2">التصنيف</th>
                        <th className="p-2">سعر البيع</th>
                        <th className="p-2">التكلفة</th>
                        <th className="p-2">المخزون</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importedRows.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold text-slate-800">{r['اسم المنتج'] || r['المنتج'] || r['name']}</td>
                          <td className="p-2 text-slate-600">{r['اسم التصنيف'] || r['التصنيف'] || r['category'] || '-'}</td>
                          <td className="p-2 font-mono text-emerald-600 font-bold">{r['سعر البيع (ر.س)'] || r['سعر البيع'] || r['sellPrice']}</td>
                          <td className="p-2 font-mono text-slate-500 font-bold">{r['سعر التكلفة (ر.س)'] || r['سعر التكلفة'] || r['costPrice']}</td>
                          <td className="p-2 font-bold text-slate-700">{r['المخزون الافتتاحي'] || r['المخزون'] || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={importedRows.length === 0}
                onClick={handleExecuteImport}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check size={15} />
                <span>تنفيذ الاستيراد إلى النظام</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      {barcodeProduct && (
        <BarcodePrintModal
          product={barcodeProduct}
          settings={settings}
          onClose={() => setBarcodeProduct(null)}
        />
      )}

    </div>
  );
}
