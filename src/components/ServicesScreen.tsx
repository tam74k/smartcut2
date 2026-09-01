import { useState, useMemo } from 'react';
import { Category, ServiceItem } from '../types';
import { Plus, Edit, Trash2, X, Check, Search, FileSpreadsheet, Download, Upload, AlertCircle, Sparkles } from 'lucide-react';
import { downloadServicesTemplate, readExcelFile } from '../utils/excelHelper';

export function ServicesScreen({ 
  settings, 
  services, 
  setServices, 
  categories, 
  setCategories 
}: { 
  settings: any;
  services: ServiceItem[]; 
  setServices: (s: ServiceItem[]) => void; 
  categories: Category[]; 
  setCategories: (c: Category[]) => void; 
}) {
  
  const calculateVatDetails = (price: number) => {
    if (!settings.vatEnabled) return { base: price, tax: 0 };
    const base = price / (1 + settings.vatRate / 100);
    const tax = price - base;
    return { base, tax };
  };

  const [activeTab, setActiveTab] = useState<'services' | 'categories'>('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Excel Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');

  // Service Form State
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [showAddCategoryInline, setShowAddCategoryInline] = useState(false);
  const [newCategoryInlineName, setNewCategoryInlineName] = useState('');
  
  const [serviceFormData, setServiceFormData] = useState<Partial<ServiceItem>>({
    name: '', price: 0, categoryId: '', isActive: true, type: 'service'
  });

  // Category Form State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<Partial<Category>>({ name: '' });

  // Get valid service categories (excluding the global 'all' filter tab)
  const validServiceCategories = useMemo(() => {
    return categories.filter(c => c.id !== 'all' && (!c.type || c.type === 'service'));
  }, [categories]);

  // Helper to open Add Service modal with a valid default category
  const handleOpenAddService = () => {
    setEditingService(null);
    let defaultCatId = validServiceCategories[0]?.id || '';
    if (!defaultCatId) {
      // If no category exists yet, create default one
      const defaultCat: Category = {
        id: 'C-' + Math.random().toString(36).substr(2, 9),
        name: 'خدمات عامة',
        type: 'service'
      };
      setCategories([...categories, defaultCat]);
      defaultCatId = defaultCat.id;
    }
    setServiceFormData({ 
      name: '', 
      price: 0, 
      categoryId: defaultCatId, 
      isActive: true, 
      type: 'service',
      durationMinutes: 30,
      cashbackPercentage: 0
    });
    setShowAddCategoryInline(false);
    setNewCategoryInlineName('');
    setShowServiceModal(true);
  };

  // Helper to open Edit Service modal with resolved category
  const handleOpenEditService = (service: ServiceItem) => {
    setEditingService(service);
    // Find matching category by ID or Name
    const matchedCat = categories.find(c => c.id === service.categoryId || c.name === service.categoryId);
    const resolvedCatId = matchedCat?.id || service.categoryId || validServiceCategories[0]?.id || '';
    setServiceFormData({
      ...service,
      categoryId: resolvedCatId
    });
    setShowAddCategoryInline(false);
    setNewCategoryInlineName('');
    setShowServiceModal(true);
  };

  // Inline Category Creator inside Service Modal
  const handleCreateCategoryInline = () => {
    const trimmed = newCategoryInlineName.trim();
    if (!trimmed) {
      alert('يرجى كتابة اسم التصنيف أولاً.');
      return;
    }
    const existing = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setServiceFormData(prev => ({ ...prev, categoryId: existing.id }));
      setShowAddCategoryInline(false);
      setNewCategoryInlineName('');
      return;
    }
    const newCat: Category = {
      id: 'C-' + Math.random().toString(36).substr(2, 9),
      name: trimmed,
      type: 'service'
    };
    setCategories([...categories, newCat]);
    setServiceFormData(prev => ({ ...prev, categoryId: newCat.id }));
    setShowAddCategoryInline(false);
    setNewCategoryInlineName('');
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

    let updatedCategories = [...categories];
    const newServices: ServiceItem[] = [];

    importedRows.forEach((row, idx) => {
      const name = String(row['اسم الخدمة'] || row['الخدمة'] || row['Service Name'] || row['name'] || '').trim();
      if (!name) return;

      const catName = String(row['اسم التصنيف'] || row['التصنيف'] || row['Category'] || row['category'] || 'خدمات عامة').trim();
      let category = updatedCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());

      if (!category) {
        category = {
          id: 'C-' + Math.random().toString(36).substr(2, 9),
          name: catName,
          type: 'service'
        };
        updatedCategories.push(category);
      }

      const price = Number(row['السعر (ر.س)'] || row['السعر'] || row['Price'] || row['price'] || 0);
      const duration = Number(row['مدة التنفيذ (بالدقائق)'] || row['المدة'] || row['Duration'] || row['duration'] || 30);
      const cashback = Number(row['نسبة الكاش باك (%)'] || row['الكاش باك'] || row['Cashback'] || 0);
      const activeStr = String(row['الحالة (نشط/غير نشط)'] || row['الحالة'] || row['Status'] || 'نشط').trim();
      const isActive = activeStr !== 'غير نشط' && activeStr !== 'معطل' && activeStr !== 'false';

      newServices.push({
        id: 'S-' + Math.random().toString(36).substr(2, 9) + '-' + idx,
        name,
        categoryId: category.id,
        price: isNaN(price) ? 0 : price,
        duration: isNaN(duration) ? 30 : duration,
        cashbackPercent: isNaN(cashback) ? 0 : cashback,
        isActive,
        type: 'service'
      });
    });

    if (newServices.length === 0) {
      setImportError('لم يتم العثور على خدمات صالحة للاستيراد في الملف.');
      return;
    }

    setCategories(updatedCategories);
    setServices([...services, ...newServices]);
    setShowImportModal(false);
    setImportedRows([]);
    setImportFileName('');
    alert(`تم استيراد ${newServices.length} خدمة بنجاح!`);
  };

  const handleSaveService = () => {
    if (!serviceFormData.name || serviceFormData.price === undefined || serviceFormData.price < 0) {
      alert('الرجاء إدخال اسم الخدمة وسعرها بشكل صحيح.');
      return;
    }

    let targetCatId = serviceFormData.categoryId;
    if (!targetCatId || targetCatId === 'all') {
      const firstValid = validServiceCategories[0];
      if (firstValid) {
        targetCatId = firstValid.id;
      } else {
        const newCat: Category = {
          id: 'C-' + Math.random().toString(36).substr(2, 9),
          name: 'خدمات عامة',
          type: 'service'
        };
        setCategories([...categories, newCat]);
        targetCatId = newCat.id;
      }
    }

    if (editingService) {
      setServices(services.map(s => s.id === editingService.id ? { 
        ...editingService, 
        ...serviceFormData, 
        categoryId: targetCatId 
      } as ServiceItem : s));
    } else {
      const newService: ServiceItem = {
        ...serviceFormData as ServiceItem,
        categoryId: targetCatId,
        id: 'S-' + Math.random().toString(36).substr(2, 9),
      };
      setServices([...services, newService]);
    }
    setShowServiceModal(false);
    setEditingService(null);
  };


  const handleSaveCategory = () => {
    if (!categoryFormData.name) {
      alert('الرجاء إدخال اسم التصنيف.');
      return;
    }

    if (editingCategory) {
      setCategories(categories.map(c => c.id === editingCategory.id ? { ...editingCategory, ...categoryFormData } as Category : c));
    } else {
      const newCategory: Category = {
        name: categoryFormData.name,
        id: 'C-' + Math.random().toString(36).substr(2, 9),
        type: 'service'
      };
      setCategories([...categories, newCategory]);
    }
    setShowCategoryModal(false);
    setEditingCategory(null);
  };

  const handleDeleteService = (id: string) => {
    if (true) {
      setServices(services.filter(s => s.id !== id));
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (true) {
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  return (
    <div className="p-8 w-full h-full flex flex-col bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة الخدمات</h2>
          <p className="text-slate-500 text-sm mt-1">الخدمات، المنتجات، والتصنيفات ونسبة الكاش باك</p>
        </div>
        <div className="flex gap-2 bg-slate-200/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('services')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'services' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            الخدمات
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'categories' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            التصنيفات
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {activeTab === 'services' && (
          <>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-700">قائمة الخدمات</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="بحث عن خدمة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
                <button 
                  onClick={() => {
                    setImportError('');
                    setImportedRows([]);
                    setImportFileName('');
                    setShowImportModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="استيراد خدمات من ملف إكسل .xlsx"
                >
                  <FileSpreadsheet size={16} />
                  <span>سحب من Excel</span>
                </button>
                <button 
                  onClick={handleOpenAddService}
                  className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus size={16} /> إضافة خدمة
                </button>
              </div>
            </div>

            {/* Category Filter Pills in Services Tab */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">تصفية بالتصنيف:</span>
              <button
                onClick={() => setSelectedCategoryFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                الكل ({services.length})
              </button>
              {validServiceCategories.map(cat => {
                const count = services.filter(s => s.categoryId === cat.id || s.categoryId === cat.name).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategoryFilter === cat.id
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto flex-1 p-4">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">الاسم</th>
                    <th className="px-4 py-3">التصنيف</th>
                    <th className="px-4 py-3">السعر الشامل</th>
                    {settings.vatEnabled && <th className="px-4 py-3 text-slate-500">بدون ضريبة</th>}
                    {settings.vatEnabled && <th className="px-4 py-3 text-slate-500">قيمة الضريبة</th>}
                    <th className="px-4 py-3">سعر الخصم</th>
                    <th className="px-4 py-3 text-center">كاش باك الخدمة</th>
                    <th className="px-4 py-3 text-center">إحالة العميل (كاش باك)</th>
                    <th className="px-4 py-3 text-center">عمولات الموظف</th>
                    <th className="px-4 py-3 text-center">الحالة</th>
                    <th className="px-4 py-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {services
                    .filter(service => {
                      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
                      if (!matchesSearch) return false;
                      if (selectedCategoryFilter === 'all') return true;
                      const catObj = categories.find(c => c.id === selectedCategoryFilter);
                      return service.categoryId === selectedCategoryFilter || (catObj && service.categoryId === catObj.name);
                    })
                    .map(service => (
                    <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-800">{service.name}</td>
                      <td className="px-4 py-4">
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-indigo-100 inline-block">
                          {categories.find(c => c.id === service.categoryId || c.name === service.categoryId)?.name || service.categoryId || 'خدمات عامة'}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-bold">{service.price}</td>
                      {settings.vatEnabled && (
                        <>
                          <td className="px-4 py-4 text-slate-500">{calculateVatDetails(service.price).base.toFixed(2)}</td>
                          <td className="px-4 py-4 text-slate-500">{calculateVatDetails(service.price).tax.toFixed(2)}</td>
                        </>
                      )}
                      <td className="px-4 py-4 font-bold text-emerald-600">
                        {service.discountPrice ? service.discountPrice : '-'}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-blue-600">
                        {service.cashbackPercentage ? `${service.cashbackPercentage}%` : '-'}
                      </td>
                      <td className="px-4 py-4 text-center text-xs">
                        {service.clientReferralCashbackAmount ? (
                          <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            {service.clientReferralCashbackType === 'fixed' ? `${service.clientReferralCashbackAmount} ${settings.currency}` : `${service.clientReferralCashbackAmount}%`}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-slate-700">
                        <div>
                          <span className="font-semibold">تنفيذ: </span>
                          {service.employeeCommissionPercentage ? `${service.employeeCommissionPercentage}%` : service.employeeCommissionAmount ? `${service.employeeCommissionAmount} ${settings.currency}` : '-'}
                        </div>
                        {service.referralCommissionAmount ? (
                          <div className="text-[11px] text-amber-700 font-bold mt-0.5">
                            إحالة: {service.referralCommissionType === 'fixed' ? `${service.referralCommissionAmount} ${settings.currency}` : `${service.referralCommissionAmount}%`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => {
                            setServices(services.map(s => s.id === service.id ? { ...s, isActive: !s.isActive } : s));
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${service.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {service.isActive ? 'مفعل' : 'معطل'}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleOpenEditService(service)}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteService(service.id)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'categories' && (
          <>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-700">قائمة التصنيفات</h3>
              <button 
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryFormData({ name: '' });
                  setShowCategoryModal(true);
                }}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Plus size={16} /> إضافة تصنيف
              </button>
            </div>
            <div className="overflow-x-auto flex-1 p-4">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">اسم التصنيف</th>
                    <th className="px-4 py-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.filter(c => c.id !== 'all' && (!c.type || c.type === 'service')).map(category => (
                    <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-800">{category.name}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingCategory(category);
                              setCategoryFormData(category);
                              setShowCategoryModal(true);
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(category.id)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</h3>
              <button onClick={() => setShowServiceModal(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم الخدمة *</label>
                <input 
                  type="text" 
                  value={serviceFormData.name || ''}
                  onChange={e => setServiceFormData({...serviceFormData, name: e.target.value})}
                  placeholder="مثال: قص شعر كلاسيك"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary font-bold text-slate-800" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-slate-700">التصنيف *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryInline(!showAddCategoryInline)}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>{showAddCategoryInline ? 'إلغاء' : '+ تصنيف جديد سريعاً'}</span>
                  </button>
                </div>

                {showAddCategoryInline ? (
                  <div className="flex gap-2 mb-2 p-2 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                    <input
                      type="text"
                      placeholder="اكتب اسم التصنيف الجديد..."
                      value={newCategoryInlineName}
                      onChange={e => setNewCategoryInlineName(e.target.value)}
                      className="flex-1 bg-white border border-indigo-300 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-600"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategoryInline}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      حفظ واختيار
                    </button>
                  </div>
                ) : null}

                <select 
                  value={serviceFormData.categoryId || ''}
                  onChange={e => setServiceFormData({...serviceFormData, categoryId: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary font-bold text-slate-800"
                >
                  <option value="" disabled>اختر التصنيف</option>
                  {validServiceCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">السعر الأساسي</label>
                  <input 
                    type="number" 
                    value={serviceFormData.price || ''}
                    onChange={e => setServiceFormData({...serviceFormData, price: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">سعر الخصم (اختياري)</label>
                  <input 
                    type="number" 
                    value={serviceFormData.discountPrice || ''}
                    onChange={e => setServiceFormData({...serviceFormData, discountPrice: e.target.value ? Number(e.target.value) : undefined})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">كاش باك للعميل (%)</label>
                <input 
                  type="number" 
                  value={serviceFormData.cashbackPercentage || ''}
                  onChange={e => setServiceFormData({...serviceFormData, cashbackPercentage: e.target.value ? Number(e.target.value) : undefined})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary" 
                />
              </div>

              {/* Execution Commission */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">عمولة المنفذ (نسبة %)</label>
                  <input 
                    type="number" 
                    value={serviceFormData.employeeCommissionPercentage || ''}
                    onChange={e => setServiceFormData({...serviceFormData, employeeCommissionPercentage: e.target.value ? Number(e.target.value) : undefined, employeeCommissionAmount: undefined})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary" 
                    placeholder="مثال: 15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">أو عمولة المنفذ (مبلغ ثابت)</label>
                  <input 
                    type="number" 
                    value={serviceFormData.employeeCommissionAmount || ''}
                    onChange={e => setServiceFormData({...serviceFormData, employeeCommissionAmount: e.target.value ? Number(e.target.value) : undefined, employeeCommissionPercentage: undefined})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary" 
                    placeholder="مثال: 20"
                  />
                </div>
              </div>

              {/* 1. Employee Referral Commission (فتح شغل للموظف) */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1">
                    <span>⚡</span>
                    <span>عمولة إحالة الموظف / فتح شغل (Employee Referral):</span>
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold">للموظف الذي يقنع العميل بالخدمة</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع العمولة</label>
                    <select
                      value={serviceFormData.referralCommissionType || 'percentage'}
                      onChange={e => setServiceFormData({...serviceFormData, referralCommissionType: e.target.value as any})}
                      className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-amber-600"
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت ({settings.currency})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {serviceFormData.referralCommissionType === 'fixed' ? `المبلغ (${settings.currency})` : 'النسبة (%)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={serviceFormData.referralCommissionAmount || ''}
                      onChange={e => setServiceFormData({...serviceFormData, referralCommissionAmount: e.target.value ? Number(e.target.value) : undefined})}
                      placeholder={serviceFormData.referralCommissionType === 'fixed' ? 'مثال: 10' : 'مثال: 5'}
                      className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-black font-mono outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Client Referral Cashback (كاش باك إحالة وترشيح العميل) */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-900 flex items-center gap-1">
                    <span>🎁</span>
                    <span>كاش باك إحالة وترشيح العميل (Client Referral Cashback):</span>
                  </span>
                  <span className="text-[10px] text-purple-700 font-bold">تُمنح للمرشِح على أول فاتورة فقط</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع الكاش باك</label>
                    <select
                      value={serviceFormData.clientReferralCashbackType || 'percentage'}
                      onChange={e => setServiceFormData({...serviceFormData, clientReferralCashbackType: e.target.value as any})}
                      className="w-full bg-white border border-purple-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-purple-600"
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت ({settings.currency})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {serviceFormData.clientReferralCashbackType === 'fixed' ? `المبلغ (${settings.currency})` : 'النسبة (%)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={serviceFormData.clientReferralCashbackAmount || ''}
                      onChange={e => setServiceFormData({...serviceFormData, clientReferralCashbackAmount: e.target.value ? Number(e.target.value) : undefined})}
                      placeholder={serviceFormData.clientReferralCashbackType === 'fixed' ? 'مثال: 15' : 'مثال: 10'}
                      className="w-full bg-white border border-purple-300 rounded-lg px-3 py-2 text-xs font-black font-mono outline-none focus:border-purple-600"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input 
                  type="checkbox" 
                  checked={serviceFormData.isActive !== false}
                  onChange={e => setServiceFormData({...serviceFormData, isActive: e.target.checked})}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <span className="font-bold text-slate-700">الخدمة مفعلة</span>
              </label>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowServiceModal(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">إلغاء</button>
              <button onClick={handleSaveService} className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Check size={18} /> حفظ الخدمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم التصنيف</label>
                <input 
                  type="text" 
                  value={categoryFormData.name || ''}
                  onChange={e => setCategoryFormData({...categoryFormData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-primary" 
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowCategoryModal(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">إلغاء</button>
              <button onClick={handleSaveCategory} className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Services Excel Import Modal */}
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
                  <h3 className="font-extrabold text-base text-slate-900">سحب واستيراد الخدمات من Excel</h3>
                  <p className="text-xs text-slate-500">استيراد قائمة الخدمات والأسعار والتصنيفات بملف (.xlsx)</p>
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
                  قم بتحميل ملف إكسل فارغ معبأ بنماذج الخدمات الجاهزة وتعبئته ثم رفعه
                </p>
              </div>
              <button
                type="button"
                onClick={downloadServicesTemplate}
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
                    {importedRows.length} خدمة جاهزة للاستيراد
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                      <tr>
                        <th className="p-2">الخدمة</th>
                        <th className="p-2">التصنيف</th>
                        <th className="p-2">السعر</th>
                        <th className="p-2">المدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importedRows.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold text-slate-800">{r['اسم الخدمة'] || r['الخدمة'] || r['name']}</td>
                          <td className="p-2 text-slate-600">{r['اسم التصنيف'] || r['التصنيف'] || r['category'] || '-'}</td>
                          <td className="p-2 font-mono text-emerald-600 font-bold">{r['السعر (ر.س)'] || r['السعر'] || r['price']}</td>
                          <td className="p-2 text-slate-500">{r['مدة التنفيذ (بالدقائق)'] || r['المدة'] || 30} دقيقة</td>
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
    </div>
  );
}
