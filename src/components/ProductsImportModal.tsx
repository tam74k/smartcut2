import React, { useState, useMemo } from 'react';
import { AppSettings, Product, Category } from '../types';
import { 
  X, UploadCloud, Download, CheckCircle2, AlertTriangle, 
  FileSpreadsheet, Loader2, Package, RefreshCw, Plus, Sparkles 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DB } from '../services/db';
import { 
  safeParseNumber, cleanHeaderKey, downloadExcelTemplate, 
  getRowValueByKeywords 
} from '../utils/excelImportHelpers';

interface ProductsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  products: Product[];
  setProducts: (products: Product[]) => void;
  categories: Category[];
  setCategories?: (categories: Category[]) => void;
  activeBranchId?: string;
}

export function ProductsImportModal({
  isOpen,
  onClose,
  settings,
  products,
  setProducts,
  categories,
  setCategories,
  activeBranchId
}: ProductsImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);

  // خيارات الاستيراد والتحديث
  const [importMode, setImportMode] = useState<'upsert' | 'add_only' | 'stock_only'>('upsert');
  const [stockUpdateMode, setStockUpdateMode] = useState<'add' | 'replace'>('replace'); // إضافة للرصيد الحالي أو استبداله بالكامل

  const [rawRows, setRawRows] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const resetState = () => {
    setFile(null);
    setIsProcessing(false);
    setIsSaving(false);
    setSaveProgress(null);
    setRawRows([]);
    setParseError(null);
    setSaveSuccessMsg(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // تنزيل نموذج المنتجات المعتمد
  const handleDownloadSample = () => {
    const sampleRows = [
      ['628100100101', 'شامبو لوريال المعالج 500 مل', 'العناية بالشعر', 85, 55, 30, 5, 'للبيع'],
      ['628100100102', 'واكس تثبيت شعر كينسو 150 جم', 'مستحضرات التصفيف', 45, 25, 50, 10, 'للبيع'],
      ['628100100103', 'زيت اللحية المغربي بالارجان 50 مل', 'العناية باللحية', 60, 35, 20, 3, 'للبيع'],
      ['628100100104', 'شفرات حلاقة دوركو تيتانيوم 100 حبة', 'مستلزمات الحلاقة', 35, 20, 100, 15, 'مادة خام']
    ];

    downloadExcelTemplate('نموذج_استيراد_المنتجات_SmartCut', [
      {
        name: 'Products',
        headers: [
          'الباركود', 'اسم المنتج', 'القسم / التصنيف', 'سعر البيع', 
          'سعر الشراء / التكلفة', 'الكمية / المخزون', 'الحد الأدنى للمخزون',
          'نوع المنتج (للبيع / مادة خام)'
        ],
        sampleRows
      }
    ]);
  };

  // معالجة اختيار الملف
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsProcessing(true);
    setParseError(null);
    setSaveSuccessMsg(null);

    try {
      const data = await selected.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('ملف الإكسل لا يحتوي على أي ورقة عمل صالحة.');
      }

      const sheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

      if (!jsonRows || jsonRows.length === 0) {
        throw new Error('ورقة العمل فارغة ولا تحتوي على صفوف بيانات.');
      }

      setRawRows(jsonRows);
    } catch (err: any) {
      console.error('Error reading products excel:', err);
      setParseError(err.message || 'حدث خطأ أثناء قراءة ملف الإكسل.');
    } finally {
      setIsProcessing(false);
    }
  };

  // خرائط المنتجات المسجلة مسبقاً (بالباركود والاسم)
  const existingProductsByBarcode = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.barcode && String(p.barcode).trim()) {
        map.set(String(p.barcode).trim().toLowerCase(), p);
      }
    });
    return map;
  }, [products]);

  const existingProductsByName = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.name && String(p.name).trim()) {
        map.set(cleanHeaderKey(p.name), p);
      }
    });
    return map;
  }, [products]);

  // تحليل صفوف الإكسل وتحويلها لمنتجات
  const analyzedProducts = useMemo(() => {
    return rawRows.map((row, idx) => {
      const name = String(getRowValueByKeywords(row, [
        'اسم المنتج', 'المنتج', 'اسم الصنف', 'الصنف', 'name', 'product_name', 'item_name'
      ])).trim();

      const barcode = String(getRowValueByKeywords(row, [
        'الباركود', 'باركود', 'كود الصنف', 'كود المنتج', 'كود', 'barcode', 'code', 'sku'
      ])).trim();

      const categoryName = String(getRowValueByKeywords(row, [
        'التصنيف', 'القسم', 'المجموعة', 'الفئة', 'category', 'category_name'
      ])).trim() || 'منتجات عامة';

      const salePrice = safeParseNumber(getRowValueByKeywords(row, [
        'سعر البيع', 'السعر', 'سعر', 'سعر القطعة', 'price', 'sale_price'
      ]));

      const costPrice = safeParseNumber(getRowValueByKeywords(row, [
        'سعر الشراء', 'سعر التكلفة', 'التكلفة', 'سعر التوريد', 'cost', 'cost_price', 'purchase_price'
      ]));

      const stock = safeParseNumber(getRowValueByKeywords(row, [
        'الكمية', 'المخزون', 'الرصيد', 'الكمية الحالية', 'الرصيد الافتتاحي', 'stock', 'qty', 'quantity'
      ]));

      const minStock = safeParseNumber(getRowValueByKeywords(row, [
        'الحد الأدنى', 'حد الطلب', 'الحد الادنى للمخزون', 'min_stock', 'minStock'
      ]));

      // فحص وجود المنتج مسبقاً
      let existing: Product | undefined;
      if (barcode) {
        existing = existingProductsByBarcode.get(barcode.toLowerCase());
      }
      if (!existing && name) {
        existing = existingProductsByName.get(cleanHeaderKey(name));
      }

      const isExisting = !!existing;

      // حساب المخزون النهائي بعد التحديث
      let finalStock = stock;
      if (isExisting && existing) {
        if (stockUpdateMode === 'add') {
          finalStock = Number(existing.stock || 0) + stock;
        } else {
          finalStock = stock;
        }
      }

      // تحديد الإجراء المناسب للمنتج
      let action: 'create' | 'update' | 'skip' = 'create';
      if (isExisting) {
        if (importMode === 'add_only') {
          action = 'skip';
        } else {
          action = 'update';
        }
      }

      const rawType = String(getRowValueByKeywords(row, [
        'نوع المنتج', 'النوع', 'طبيعة الصنف', 'طبيعة المنتج', 'الاستخدام', 'product_type', 'type'
      ])).trim().toLowerCase();
      const isRaw = rawType.includes('خام') || rawType.includes('raw');
      const productType: 'for_sale' | 'raw_material' = isRaw ? 'raw_material' : (existing?.productType || 'for_sale');

      return {
        rowIdx: idx + 1,
        name: name || `منتج مستورد ${idx + 1}`,
        barcode: barcode || (existing?.barcode || ''),
        categoryName,
        salePrice: salePrice > 0 ? salePrice : (existing?.price || 0),
        costPrice: costPrice > 0 ? costPrice : (existing?.costPrice || existing?.cost || 0),
        importedStock: stock,
        finalStock,
        minStock: minStock > 0 ? minStock : (existing?.minStock || 5),
        productType,
        isExisting,
        existingProduct: existing,
        action,
        isValid: !!name || !!barcode
      };
    }).filter(item => item.isValid);
  }, [rawRows, existingProductsByBarcode, existingProductsByName, importMode, stockUpdateMode]);

  // إحصائيات الاستيراد
  const stats = useMemo(() => {
    const toCreate = analyzedProducts.filter(p => p.action === 'create').length;
    const toUpdate = analyzedProducts.filter(p => p.action === 'update').length;
    const toSkip = analyzedProducts.filter(p => p.action === 'skip').length;
    const totalInventoryValue = analyzedProducts.reduce((sum, p) => sum + (p.finalStock * p.salePrice), 0);

    return {
      total: analyzedProducts.length,
      toCreate,
      toUpdate,
      toSkip,
      totalInventoryValue
    };
  }, [analyzedProducts]);

  // تنفيذ الحفظ في قاعدة البيانات المحلية
  const handleExecuteImport = async () => {
    const productsToProcess = analyzedProducts.filter(p => p.action !== 'skip');
    if (productsToProcess.length === 0) {
      alert('لا توجد منتجات محددة للحفظ أو التحديث وفق الخيارات الحالية.');
      return;
    }

    setIsSaving(true);
    setParseError(null);

    try {
      // 1. مزامنة الأقسام والتصنيفات الجديدة
      const currentCategories = [...categories];
      const categoriesMap = new Map<string, Category>();
      currentCategories.forEach(c => categoriesMap.set(cleanHeaderKey(c.name), c));

      const newCategoriesToCreate: Category[] = [];
      productsToProcess.forEach(p => {
        const cKey = cleanHeaderKey(p.categoryName);
        if (cKey && !categoriesMap.has(cKey)) {
          const newCat: Category = {
            id: 'CAT-' + Math.random().toString(36).substr(2, 9),
            name: p.categoryName,
            icon: 'Package',
            salonId: settings.salonId
          };
          categoriesMap.set(cKey, newCat);
          newCategoriesToCreate.push(newCat);
          currentCategories.push(newCat);
        }
      });

      if (newCategoriesToCreate.length > 0) {
        for (const cat of newCategoriesToCreate) {
          await DB.saveCategory(cat, settings.salonId);
        }
        if (setCategories) {
          setCategories(currentCategories);
        }
      }

      // 2. معالجة وحفظ المنتجات على دفعات (Chunks)
      const CHUNK_SIZE = 25;
      const totalToSave = productsToProcess.length;
      const savedProductsMap = new Map<string, Product>();

      // نبدأ بالمنتجات الحالية في النظام
      products.forEach(p => savedProductsMap.set(p.id, p));

      for (let i = 0; i < totalToSave; i += CHUNK_SIZE) {
        const chunk = productsToProcess.slice(i, i + CHUNK_SIZE);
        setSaveProgress({ current: Math.min(i + chunk.length, totalToSave), total: totalToSave });

        await Promise.all(
          chunk.map(async (item) => {
            const matchedCat = categoriesMap.get(cleanHeaderKey(item.categoryName));
            let productToSave: Product;

            if (item.isExisting && item.existingProduct) {
              // تحديث منتج موجود
              productToSave = {
                ...item.existingProduct,
                name: item.name || item.existingProduct.name,
                barcode: item.barcode || item.existingProduct.barcode,
                category: matchedCat ? matchedCat.name : item.categoryName,
                price: item.salePrice,
                costPrice: item.costPrice,
                cost: item.costPrice,
                stock: item.finalStock,
                minStock: item.minStock,
                productType: item.productType || item.existingProduct.productType || 'for_sale',
                branchId: activeBranchId || item.existingProduct.branchId
              };
            } else {
              // إنشاء منتج جديد
              const newId = 'PRD-' + Math.random().toString(36).substr(2, 9);
              productToSave = {
                id: newId,
                name: item.name,
                barcode: item.barcode || `AUTO-${Math.floor(100000 + Math.random() * 900000)}`,
                category: matchedCat ? matchedCat.name : item.categoryName,
                price: item.salePrice,
                costPrice: item.costPrice,
                cost: item.costPrice,
                stock: item.finalStock,
                minStock: item.minStock,
                productType: item.productType || 'for_sale',
                salonId: settings.salonId,
                branchId: activeBranchId
              };
            }

            const saved = await DB.saveProduct(productToSave, settings.salonId);
            if (saved) {
              savedProductsMap.set(productToSave.id, productToSave);
            } else {
              console.error('فشل حفظ المنتج في قاعدة البيانات:', productToSave.name);
            }
          })
        );
      }

      const updatedProductsList = Array.from(savedProductsMap.values());
      setProducts(updatedProductsList);

      setSaveSuccessMsg(`🎉 تم بنجاح استيراد وتحديث (${productsToProcess.length}) منتج في قاعدة البيانات والمخزون.`);
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err: any) {
      console.error('Error importing products:', err);
      setParseError('فشل حفظ المنتجات: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* رأس النافذة */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-indigo-50/60 via-white to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 font-black">
              <Package size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-800">
                  استيراد وتحديث المنتجات والمخزون (.xlsx)
                </h3>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  Upsert + جرد آلي
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                إضافة منتجات جديدة أو تحديث أرصدة المخزون والأسعار بالباركود والاسم من ملف إكسل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download size={15} />
              <span>تحميل النموذج المعتمد</span>
            </button>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* محتوى النافذة */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* رسائل التنبيه أو النجاح */}
          {saveSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3 animate-in fade-in">
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* منطقة رفع الملف */}
          {!file && (
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-3xl p-10 flex flex-col items-center justify-center transition-all group">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                id="excel-products-file-input"
              />
              <label
                htmlFor="excel-products-file-input"
                className="flex flex-col items-center cursor-pointer text-center w-full"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xs">
                  <UploadCloud size={32} />
                </div>
                <h4 className="text-sm font-bold text-slate-700">
                  اضغط هنا لاختيار ملف الإكسل أو قم بسحبه وإفلاته
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  يدعم أعمدة الباركود، اسم المنتج، التصنيف، سعر البيع، سعر التكلفة، والكمية
                </p>
                <span className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all">
                  اختيار ملف .xlsx
                </span>
              </label>
            </div>
          )}

          {isProcessing && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={36} className="animate-spin text-indigo-600" />
              <p className="text-xs font-bold text-slate-600">جارٍ قراءة وفحص المنتجات من ملف الإكسل...</p>
            </div>
          )}

          {/* شريط الإعدادات والتحكم عند رفع الملف */}
          {file && !isProcessing && (
            <div className="space-y-4">
              
              {/* ملخص الإحصائيات */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100">
                  <span className="text-[11px] font-bold text-indigo-600">إجمالي في الملف</span>
                  <p className="text-xl font-black text-indigo-950 mt-0.5">{stats.total} منتج</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100">
                  <span className="text-[11px] font-bold text-emerald-600">منتجات جديدة للإضافة</span>
                  <p className="text-xl font-black text-emerald-950 mt-0.5">{stats.toCreate}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-100">
                  <span className="text-[11px] font-bold text-amber-600">منتجات مسجلة للتحديث</span>
                  <p className="text-xl font-black text-amber-950 mt-0.5">{stats.toUpdate}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500">القيمة الإجمالية المقدرة</span>
                  <p className="text-base font-black text-slate-800 mt-0.5 font-mono">
                    {stats.totalInventoryValue.toLocaleString()} {settings.currency}
                  </p>
                </div>
              </div>

              {/* خيارات المعالجة ووضع التحديث (Upsert) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      طريقة معالجة المنتجات المسجلة مسبقاً:
                    </label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1">
                      <button
                        type="button"
                        onClick={() => setImportMode('upsert')}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          importMode === 'upsert' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ⚡ إضافة وتحديث الموجود (Upsert)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('add_only')}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          importMode === 'add_only' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ➕ إضافة الجديد فقط
                      </button>
                    </div>
                  </div>

                  {importMode === 'upsert' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        تحديث كميات المخزون للمنتجات المتطابقة:
                      </label>
                      <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1">
                        <button
                          type="button"
                          onClick={() => setStockUpdateMode('replace')}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            stockUpdateMode === 'replace' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🔄 استبدال الرصيد بالكمية الجديدة
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockUpdateMode('add')}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            stockUpdateMode === 'add' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ➕ إضافة للرصيد الحالي
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-500">
                  <span>الملف المحدد: <span className="font-mono font-bold text-slate-800">{file.name}</span></span>
                  <button
                    onClick={() => { setFile(null); setRawRows([]); }}
                    className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                  >
                    تغيير الملف
                  </button>
                </div>
              </div>

              {/* جدول المعاينة */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">الباركود</th>
                        <th className="p-3">اسم المنتج</th>
                        <th className="p-3">التصنيف</th>
                        <th className="p-3 text-left">سعر البيع</th>
                        <th className="p-3 text-left">التكلفة</th>
                        <th className="p-3 text-center">المخزون النهائي</th>
                        <th className="p-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analyzedProducts.slice(0, 50).map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">
                            {p.barcode || <span className="text-slate-300 font-normal">توليد آلي</span>}
                          </td>
                          <td className="p-3 font-bold text-slate-900">{p.name}</td>
                          <td className="p-3 text-slate-600">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
                              {p.categoryName}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800 text-left">
                            {Number(p.salePrice).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-slate-500 text-left">
                            {Number(p.costPrice).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-black text-indigo-700 text-center">
                            {p.finalStock}
                            {p.isExisting && stockUpdateMode === 'add' && (
                              <span className="text-[10px] text-emerald-600 font-normal block">
                                (+{p.importedStock})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {p.action === 'create' ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                جديد
                              </span>
                            ) : p.action === 'update' ? (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                تحديث
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                تخطي
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* شريط الإجراءات السفلي */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-black transition-colors cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>

          {analyzedProducts.length > 0 && (
            <button
              onClick={handleExecuteImport}
              disabled={isSaving || stats.toCreate + stats.toUpdate === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>
                    {saveProgress
                      ? `جارٍ الحفظ والمزامنة (${saveProgress.current} / ${saveProgress.total})...`
                      : 'جارٍ الحفظ في قاعدة البيانات المحلية...'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>تنفيذ الاستيراد والتحديث ({stats.toCreate + stats.toUpdate}) الآن 🚀</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
