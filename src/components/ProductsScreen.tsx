import { useState, useMemo, useEffect } from 'react';
import { Package, Search, Plus, Edit2, Trash2, X, AlertTriangle, TrendingDown, FileSpreadsheet, Download, Upload, Check, Sparkles, AlertCircle, Printer, QrCode, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { AppSettings, Product, Category, Employee, Supplier } from '../types';
import { downloadProductsTemplate, readExcelFile } from '../utils/excelHelper';
import { BarcodePrintModal } from './BarcodePrintModal';
import { DB } from '../services/db';

export function ProductsScreen({ 
  settings, 
  products, 
  setProducts, 
  categories, 
  setCategories,
  employees, 
  suppliers = [],
  setSuppliers,
  shiftData
}: { 
  settings: AppSettings;
  products: Product[]; 
  setProducts: (p: Product[] | ((prev: Product[]) => Product[])) => void;
  categories: Category[];
  setCategories?: (c: Category[] | ((prev: Category[]) => Category[])) => void;
  employees: Employee[];
  suppliers?: Supplier[];
  setSuppliers?: (s: Supplier[]) => void;
  shiftData: { isOpen: boolean; date: string; initialCash: number };
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Excel Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    supplierId: '',
    productType: 'retail' as 'retail' | 'raw_material',
    isActive: true,
    sellPrice: '',
    costPrice: '',
    reorderLimit: '',
    openingStock: '',
    commission: '',
    barcode: ''
  });

  const generateUniqueBarcode = () => {
    let code = '';
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 100) {
      attempts++;
      const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
      code = '628' + randomDigits;
      exists = products.some(p => p.barcode === code && p.id !== editingProductId);
    }
    setFormData(prev => ({ ...prev, barcode: code }));
  };

  const [dispenseData, setDispenseData] = useState({
    date: shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0],
    dispenserName: 'مدير النظام',
    items: [{ productId: '', quantity: 1, employeeId: employees[0]?.id || '' }]
  });

  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'retail' | 'raw_material'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const normalizeText = (text: string) => {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  };

  const productCategories = useMemo(() => {
    return categories.filter(c => c.id !== 'all' && c.type === 'product');
  }, [categories]);

  const filteredProducts = products.filter(p => {
    const q = normalizeText(searchQuery);
    const matchesSearch = !q || 
      normalizeText(p.name).includes(q) || 
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    const catObj = categories.find(c => c.id === categoryFilter);
    const matchesCat = categoryFilter === 'all' || 
      p.categoryId === categoryFilter || 
      (catObj && (p.categoryId === catObj.name || (p as any).category === catObj.name || normalizeText(p.categoryId || '') === normalizeText(catObj.name)));
    const itemType = p.productType || 'retail';
    const matchesType = productTypeFilter === 'all' || itemType === productTypeFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && p.isActive !== false) || 
      (statusFilter === 'inactive' && p.isActive === false);
    return matchesSearch && matchesCat && matchesType && matchesStatus;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, productTypeFilter, statusFilter]);

  // تصحيح فوري لأي منتجات قديمة تم ربطها سابقاً بالخطأ بتصنيف خدمات (مثل الشعر الطبيعي)
  useEffect(() => {
    if (!products || products.length === 0 || !categories || categories.length === 0) return;

    const mislinked = products.filter(p => {
      if (!p.categoryId) return false;
      const cat = categories.find(c => c.id === p.categoryId);
      return cat && cat.type === 'service';
    });

    if (mislinked.length === 0) return;

    let didChange = false;
    const currentCats = [...categories];
    const updatedProds = products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      if (!cat || cat.type !== 'service') return p;

      didChange = true;
      let targetCatName = 'منتجات عامة';
      const pNameNorm = normalizeText(p.name);
      if (pNameNorm.includes('اكسجين') || p.name.toLowerCase().includes('ox')) {
        targetCatName = 'اكسجين';
      } else if (pNameNorm.includes('صبغ') || pNameNorm.includes('لون')) {
        targetCatName = 'صبغه';
      } else if (pNameNorm.includes('ماسك') || pNameNorm.includes('سكراب')) {
        targetCatName = 'ماسك';
      } else if (pNameNorm.includes('بودر') || pNameNorm.includes('تفتيح')) {
        targetCatName = 'بودرة تفتيح';
      }

      let prodCat = currentCats.find(c => c.id !== 'all' && c.type === 'product' && normalizeText(c.name) === normalizeText(targetCatName));
      if (!prodCat) {
        prodCat = {
          id: 'CAT-PRD-AUTO-' + Math.random().toString(36).substr(2, 7) + '-' + Date.now(),
          name: targetCatName,
          type: 'product',
          icon: 'Package',
          salonId: settings.salonId,
          branchId: settings.branchId
        };
        currentCats.push(prodCat);
        DB.saveCategory(prodCat, settings.salonId);
      }

      const corrected = { ...p, categoryId: prodCat.id };
      DB.saveProduct(corrected, settings.salonId);
      return corrected;
    });

    if (didChange) {
      if (setCategories && currentCats.length > categories.length) {
        setCategories(currentCats);
      }
      setProducts(updatedProds);
    }
  }, [products, categories]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, safePage, itemsPerPage]);

  const renderPagination = (position: 'top' | 'bottom') => {
    if (filteredProducts.length === 0) return null;

    const startItem = (safePage - 1) * itemsPerPage + 1;
    const endItem = Math.min(safePage * itemsPerPage, filteredProducts.length);

    const getPageNumbers = () => {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      const pages: (number | string)[] = [];
      if (safePage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (safePage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
      }
      return pages;
    };

    return (
      <div className={`p-3 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-600 ${
        position === 'top' ? 'border-b border-slate-200' : 'border-t border-slate-200'
      }`}>
        {/* Info & Items per page */}
        <div className="flex flex-wrap items-center gap-2">
          <span>عرض</span>
          <span className="text-slate-900 font-black">{startItem} - {endItem}</span>
          <span>من إجمالي</span>
          <span className="px-2 py-0.5 bg-primary/10 text-primary font-black rounded-lg">
            {filteredProducts.length}
          </span>
          <span>منتج</span>

          <span className="text-slate-300 mx-1 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">لكل صفحة:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-700 outline-none focus:border-primary cursor-pointer shadow-2xs"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="الصفحة الأولى"
          >
            <ChevronsRight size={14} />
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
            title="الصفحة السابقة"
          >
            <ChevronRight size={14} />
            <span className="hidden sm:inline">السابق</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold">
                    ...
                  </span>
                );
              }
              const isCurrent = p === safePage;
              return (
                <button
                  key={`page-${p}`}
                  onClick={() => setCurrentPage(Number(p))}
                  className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
            title="الصفحة التالية"
          >
            <span className="hidden sm:inline">التالي</span>
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="الصفحة الأخيرة"
          >
            <ChevronsLeft size={14} />
          </button>
        </div>
      </div>
    );
  };

  const handleEdit = (p: Product) => {
    setEditingProductId(p.id);
    const pType = p.productType || 'retail';
    setFormData({
      name: p.name,
      categoryId: p.categoryId,
      supplierId: p.supplierId || '',
      productType: pType,
      isActive: p.isActive !== false,
      sellPrice: (pType === 'raw_material' && !p.sellPrice) ? '0' : p.sellPrice.toString(),
      costPrice: p.costPrice.toString(),
      reorderLimit: p.reorderLimit.toString(),
      openingStock: p.openingStock.toString(),
      commission: (pType === 'raw_material' && !p.commission) ? '0' : p.commission.toString(),
      barcode: p.barcode || ''
    });
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleToggleActive = async (p: Product) => {
    const nextActive = p.isActive === false ? true : false;
    const updated = { ...p, isActive: nextActive };
    setProducts(prev => {
      const list = Array.isArray(prev) ? prev : products;
      return list.map(item => item.id === p.id ? updated : item);
    });
    try {
      await DB.saveProduct(updated, settings.salonId);
    } catch (err) {
      console.error('Error toggling active status in DB:', err);
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.name.trim()) return setErrorMsg('الرجاء إدخال اسم المنتج');
    if (!formData.categoryId || formData.categoryId === 'all') return setErrorMsg('الرجاء اختيار تصنيف محدد للمنتج');
    
    const isRaw = formData.productType === 'raw_material';
    const sPrice = isRaw ? (Number(formData.sellPrice) || 0) : Number(formData.sellPrice);
    const cPrice = Number(formData.costPrice);
    const rLimit = Number(formData.reorderLimit);
    const oStock = Number(formData.openingStock);
    const comm = isRaw ? 0 : Number(formData.commission);

    if (!isRaw && (isNaN(sPrice) || sPrice < 0)) return setErrorMsg('الرجاء إدخال سعر بيع صحيح للمنتج المعروض للبيع');
    if (isNaN(cPrice) || cPrice < 0) return setErrorMsg('الرجاء إدخال سعر تكلفة صحيح');

    const matchedSup = suppliers.find(s => s.id === formData.supplierId);
    const cleanBarcode = formData.barcode.trim() || undefined;

    setIsSavingProduct(true);
    setErrorMsg('');

    try {
      // 1. التأكد أولاً من حفظ التصنيف في قاعدة البيانات إن لم يكن مسجلاً لتفادي قيود المفاتيح الأجنبية
      const targetCategory = categories.find(c => c.id === formData.categoryId);
      if (targetCategory && targetCategory.id !== 'all') {
        await DB.saveCategory(targetCategory, settings.salonId).catch(() => {});
      }

      let productToSave: Product;

      if (editingProductId) {
        const oldProd = products.find(p => p.id === editingProductId);
        const diff = oldProd ? (oStock - (oldProd.openingStock || 0)) : 0;
        productToSave = {
          ...(oldProd || {}),
          id: editingProductId,
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          supplierId: formData.supplierId || undefined,
          supplierName: matchedSup?.name || undefined,
          productType: formData.productType,
          isActive: formData.isActive,
          sellPrice: isRaw ? 0 : sPrice,
          costPrice: cPrice,
          reorderLimit: rLimit,
          openingStock: oStock,
          currentStock: oldProd ? (oldProd.currentStock + diff) : oStock,
          commission: comm,
          barcode: cleanBarcode,
          salonId: settings.salonId,
          branchId: settings.branchId
        } as Product;
      } else {
        productToSave = {
          id: 'PRD-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now(),
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          supplierId: formData.supplierId || undefined,
          supplierName: matchedSup?.name || undefined,
          productType: formData.productType,
          isActive: formData.isActive,
          sellPrice: isRaw ? 0 : sPrice,
          costPrice: cPrice,
          reorderLimit: rLimit,
          openingStock: oStock,
          currentStock: oStock,
          commission: comm,
          barcode: cleanBarcode,
          salonId: settings.salonId,
          branchId: settings.branchId
        };
      }

      // 2. الحفظ المباشر في قاعدة البيانات Supabase مع انتظار اكتمال التسجيل
      const saved = await DB.saveProduct(productToSave, settings.salonId);
      if (!saved) {
        setErrorMsg('تعذر حفظ الصنف في قاعدة البيانات السحابية. يرجى التحقق من اتصال الإنترنت أو صحة البيانات.');
        setIsSavingProduct(false);
        return;
      }

      // 3. تحديث قائمة المنتجات في الحالة (State) والتخزين المحلي فوراً
      if (editingProductId) {
        setProducts(prev => {
          const list = Array.isArray(prev) ? prev : products;
          const updated = list.map(p => p.id === editingProductId ? productToSave : p);
          try { localStorage.setItem('smartcut_products', JSON.stringify(updated)); } catch {}
          return updated;
        });
      } else {
        setProducts(prev => {
          const list = Array.isArray(prev) ? prev : products;
          const updated = [...list.filter(p => p.id !== productToSave.id), productToSave];
          try { localStorage.setItem('smartcut_products', JSON.stringify(updated)); } catch {}
          return updated;
        });
      }

      setShowAddModal(false);
      setEditingProductId(null);
    } catch (err: any) {
      console.error('Error saving product in ProductsScreen:', err);
      setErrorMsg('حدث خطأ أثناء حفظ المنتج في قاعدة البيانات: ' + (err.message || ''));
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDispense = async () => {
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
    const changedProducts: Product[] = [];
    dispenseData.items.forEach(item => {
      const idx = updatedProducts.findIndex(p => p.id === item.productId);
      if (idx !== -1) {
        updatedProducts[idx] = { ...updatedProducts[idx], currentStock: updatedProducts[idx].currentStock - item.quantity };
        changedProducts.push(updatedProducts[idx]);
      }
    });

    // Save stock reductions in DB
    for (const cp of changedProducts) {
      await DB.saveProduct(cp, settings.salonId).catch(() => {});
    }

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

  const getRowField = (r: any, candidates: string[]): string => {
    if (!r || typeof r !== 'object') return '';
    // 1. مطابقة مباشرة لاسم الحقل
    for (const cand of candidates) {
      if (r[cand] !== undefined && r[cand] !== null && String(r[cand]).trim() !== '') {
        return String(r[cand]).trim();
      }
    }
    // 2. مطابقة مرنة متجاهلة للمسافات والأقواس وحالة الأحرف
    const keys = Object.keys(r);
    for (const cand of candidates) {
      const cleanCand = cand.trim().toLowerCase().replace(/[\s\-_()]/g, '');
      for (const k of keys) {
        const cleanK = k.trim().toLowerCase().replace(/[\s\-_()]/g, '');
        if (cleanK === cleanCand && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return String(r[k]).trim();
        }
      }
    }
    // 3. مطابقة جزئية للاشتمال
    for (const cand of candidates) {
      const cleanCand = cand.trim().toLowerCase();
      for (const k of keys) {
        const cleanK = k.trim().toLowerCase();
        if ((cleanK.includes(cleanCand) || cleanCand.includes(cleanK)) && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return String(r[k]).trim();
        }
      }
    }
    return '';
  };

  const handleExecuteImport = async () => {
    if (importedRows.length === 0 || isImporting) return;

    setIsImporting(true);
    setImportError('');
    setImportProgress({ current: 0, total: importedRows.length });

    try {
      const updatedProductsList: Product[] = [...products];
      const currentSuppliersList: Supplier[] = [...suppliers];
      const currentCategoriesList: Category[] = [...categories];
      let addedSuppliersCount = 0;
      let addedCategoriesCount = 0;
      let successCount = 0;

      for (let idx = 0; idx < importedRows.length; idx++) {
        const row = importedRows[idx];
        setImportProgress({ current: idx + 1, total: importedRows.length });

        const name = getRowField(row, ['اسم المنتج', 'المنتج', 'اسم الصنف', 'الصنف', 'Product Name', 'name', 'item_name', 'item']);
        if (!name) continue;

        // قراءة اسم التصنيف بدقة بالغة من ملف الإكسل مهما اختلفت صياغة الترويسة
        const catName = getRowField(row, [
          'اسم التصنيف', 'التصنيف', 'تصنيف', 'فئة', 'الفئة', 'اسم الفئة', 
          'القسم', 'قسم', 'اسم القسم', 'التصنيف (Category)', 'Category', 'category', 'cat'
        ]);

        let matchedCategory: Category | undefined;

        if (catName) {
          // 1. البحث حصراً في تصنيفات المنتجات (type === 'product') لضمان عدم الخلط إطلاقاً مع تصنيفات الخدمات
          matchedCategory = currentCategoriesList.find(c => 
            c.id !== 'all' && 
            c.type === 'product' && 
            normalizeText(c.name) === normalizeText(catName)
          );

          // 2. إذا لم يكن التصنيف موجوداً ضمن تصنيفات المنتجات، يتم إنشاؤه كتصنيف منتجات جديد فوراً مع الالتزام التام باسمه كما ورد في الإكسل
          if (!matchedCategory) {
            const newCatId = 'CAT-PRD-' + Math.random().toString(36).substr(2, 7) + '-' + Date.now() + '-' + (idx + 1);
            matchedCategory = {
              id: newCatId,
              name: catName, // الالتزام باسم التصنيف الوارد في الإكسل نصاً
              type: 'product', // تصنيف خاص بالمنتجات حصراً
              icon: 'Package',
              salonId: settings.salonId,
              branchId: settings.branchId
            };

            currentCategoriesList.push(matchedCategory);
            addedCategoriesCount++;

            // حفظ التصنيف في قاعدة بيانات Supabase فوراً
            await DB.saveCategory(matchedCategory, settings.salonId);
          }
        } else {
          // إذا لم يحدد ملف الإكسل أي تصنيف، نبحث عن تصنيف منتجات عام أو ننشئه (ولا نربطه أبداً بتصنيف خدمات)
          matchedCategory = currentCategoriesList.find(c => 
            c.id !== 'all' && 
            c.type === 'product' && 
            normalizeText(c.name) === normalizeText('منتجات عامة')
          );
          if (!matchedCategory) {
            const newCatId = 'CAT-PRD-GEN-' + Date.now();
            matchedCategory = {
              id: newCatId,
              name: 'منتجات عامة',
              type: 'product',
              icon: 'Package',
              salonId: settings.salonId,
              branchId: settings.branchId
            };
            currentCategoriesList.push(matchedCategory);
            addedCategoriesCount++;
            await DB.saveCategory(matchedCategory, settings.salonId);
          }
        }

        // قراءة المورد والربط به
        const supplierRawName = getRowField(row, ['اسم المورد', 'المورد', 'Supplier', 'supplier', 'الموزع', 'الشركة']);
        let matchedSupplier: Supplier | undefined;
        
        if (supplierRawName) {
          matchedSupplier = currentSuppliersList.find(s => normalizeText(s.name) === normalizeText(supplierRawName));
          if (!matchedSupplier) {
            // تسجيل المورد تلقائياً إذا لم يكن مضافاً مسبقاً
            matchedSupplier = {
              id: 'SUP-' + Math.random().toString(36).substr(2, 9) + '-' + (idx + 1),
              name: supplierRawName,
              phone: '0000000000',
              currentBalance: 0
            };
            currentSuppliersList.push(matchedSupplier);
            addedSuppliersCount++;
            await DB.saveSupplier(matchedSupplier, settings.salonId);
          }
        }

        const rawType = getRowField(row, ['نوع المنتج (للبيع / مادة خام)', 'نوع المنتج', 'النوع', 'Product Type', 'type']).toLowerCase();
        const pType: 'retail' | 'raw_material' = (rawType.includes('خام') || rawType.includes('raw')) ? 'raw_material' : 'retail';
        const isRaw = pType === 'raw_material';

        const sellPriceRaw = getRowField(row, ['سعر البيع (ر.س)', 'سعر البيع', 'سعر بيع', 'Sell Price', 'sellPrice', 'price', 'السعر']);
        const costPriceRaw = getRowField(row, ['سعر التكلفة (ر.س)', 'سعر التكلفة', 'التكلفة', 'سعر الشراء', 'Cost Price', 'costPrice', 'cost']);
        const openingStockRaw = getRowField(row, ['المخزون الافتتاحي', 'المخزون', 'الرصيد', 'الكمية', 'Opening Stock', 'stock', 'qty']);
        const reorderLimitRaw = getRowField(row, ['حد إعادة الطلب', 'حد الطلب', 'حد المخزون', 'Reorder Limit', 'reorderLimit']);
        const commissionRaw = getRowField(row, ['نسبة عمولة البيع (%)', 'العمولة', 'عمولة', 'Commission', 'commission']);
        const barcodeRaw = getRowField(row, ['الباركود', 'باركود', 'Barcode', 'barcode', 'كود الصنف (SKU)', 'كود الصنف', 'SKU']);
        const statusRaw = getRowField(row, ['الحالة (نشط/غير نشط)', 'الحالة', 'حالة الصنف', 'نشط', 'Status', 'status', 'is_active']).toLowerCase();
        const itemIsActive = statusRaw ? (!statusRaw.includes('غير') && !statusRaw.includes('معطل') && !statusRaw.includes('inact') && !statusRaw.includes('false') && !statusRaw.includes('0')) : true;

        const sellPrice = isRaw ? 0 : Number(sellPriceRaw || 0);
        const costPrice = Number(costPriceRaw || 0);
        const openingStock = Number(openingStockRaw || 0);
        const reorderLimit = Number(reorderLimitRaw || 5);
        const commission = isRaw ? 0 : Number(commissionRaw || 0);
        const cleanBarcode = barcodeRaw.trim() || undefined;

        // التحقق مما إذا كان الصنف مسجلاً مسبقاً (لتحديث تصنيفه الصحيح فوراً وتجاوز أي ربط قديم خاطئ)
        const existingIdx = updatedProductsList.findIndex(p => 
          (cleanBarcode && p.barcode && p.barcode.trim() === cleanBarcode) ||
          (normalizeText(p.name) === normalizeText(name))
        );

        let finalProductItem: Product;

        if (existingIdx !== -1) {
          const oldProd = updatedProductsList[existingIdx];
          finalProductItem = {
            ...oldProd,
            name,
            productType: pType,
            isActive: statusRaw ? itemIsActive : (oldProd.isActive !== false),
            categoryId: matchedCategory.id, // تصحيح وتثبيت التصنيف الوارد من الإكسل
            supplierId: matchedSupplier?.id || oldProd.supplierId,
            supplierName: matchedSupplier?.name || oldProd.supplierName,
            sellPrice: isNaN(sellPrice) ? oldProd.sellPrice : sellPrice,
            costPrice: isNaN(costPrice) ? oldProd.costPrice : costPrice,
            reorderLimit: isNaN(reorderLimit) ? oldProd.reorderLimit : reorderLimit,
            commission: isNaN(commission) ? oldProd.commission : commission,
            barcode: cleanBarcode || oldProd.barcode,
            ...(settings.salonId ? { salonId: settings.salonId } : {}),
            ...(settings.branchId ? { branchId: settings.branchId } : {})
          };
          updatedProductsList[existingIdx] = finalProductItem;
        } else {
          finalProductItem = {
            id: 'PRD-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now() + '-' + idx,
            name,
            productType: pType,
            isActive: itemIsActive,
            categoryId: matchedCategory.id,
            supplierId: matchedSupplier?.id,
            supplierName: matchedSupplier?.name || (supplierRawName || undefined),
            sellPrice: isNaN(sellPrice) ? 0 : sellPrice,
            costPrice: isNaN(costPrice) ? 0 : costPrice,
            openingStock: isNaN(openingStock) ? 0 : openingStock,
            currentStock: isNaN(openingStock) ? 0 : openingStock,
            reorderLimit: isNaN(reorderLimit) ? 5 : reorderLimit,
            commission: isNaN(commission) ? 0 : commission,
            barcode: cleanBarcode,
            ...(settings.salonId ? { salonId: settings.salonId } : {}),
            ...(settings.branchId ? { branchId: settings.branchId } : {})
          };
          updatedProductsList.push(finalProductItem);
        }

        const saved = await DB.saveProduct(finalProductItem, settings.salonId);
        if (saved) {
          successCount++;
        }
      }

      if (updatedProductsList.length === 0) {
        setImportError('لم يتم العثور على منتجات صالحة للاستيراد في الملف.');
        setIsImporting(false);
        return;
      }

      if (addedSuppliersCount > 0 && setSuppliers) {
        setSuppliers(currentSuppliersList);
      }

      if (addedCategoriesCount > 0 && setCategories) {
        setCategories(prev => {
          const prevList = Array.isArray(prev) ? prev : [];
          const existingIds = new Set(prevList.map(c => c.id));
          const uniqueNew = currentCategoriesList.filter(c => !existingIds.has(c.id));
          return [...prevList, ...uniqueNew];
        });
      }

      // تحديث قائمة المنتجات في الحالة وتطبيق التغييرات فوراً
      setProducts(updatedProductsList);

      setShowImportModal(false);
      setImportedRows([]);
      setImportFileName('');
      
      let alertMsg = `تم استيراد ومعالجة ${successCount} منتج بنجاح وتحديث التصنيفات في النظام!`;
      const notes: string[] = [];
      if (addedCategoriesCount > 0) notes.push(`تمت إضافة ${addedCategoriesCount} تصنيف منتجات جديد تلقائياً`);
      if (addedSuppliersCount > 0) notes.push(`تم تسجيل ${addedSuppliersCount} مورد جديد تلقائياً`);
      if (notes.length > 0) alertMsg += ` (${notes.join(' ، ')})`;
      alert(alertMsg);
    } catch (err: any) {
      console.error('Error during import execution:', err);
      setImportError('حدث خطأ أثناء رفع المنتجات لقاعدة البيانات: ' + (err.message || ''));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full h-full overflow-y-auto bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة المنتجات</h2>
          <p className="text-slate-500 text-sm mt-1">إضافة الأصناف، جرد المخزون، وصرف المنتجات</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button 
            onClick={() => {
              setImportError('');
              setImportedRows([]);
              setImportFileName('');
              setShowImportModal(true);
            }} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer text-sm"
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
          }} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer text-sm">
            <TrendingDown size={18} /> صرف منتجات للعاملين
          </button>
          <button onClick={() => {
            setErrorMsg('');
            setEditingProductId(null);
            setFormData({
              name: '', 
              categoryId: productCategories[0]?.id || '', 
              supplierId: '',
              productType: 'retail',
              isActive: true,
              sellPrice: '', 
              costPrice: '', 
              reorderLimit: '5', 
              openingStock: '0', 
              commission: '0',
              barcode: ''
            });
            setShowAddModal(true);
          }} className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer text-sm">
            <Plus size={18} /> إضافة منتج جديد
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث عن منتج بالاسم أو الباركود..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:border-primary focus:bg-white transition-colors"
          />
        </div>
        <select 
          value={productTypeFilter}
          onChange={(e) => setProductTypeFilter(e.target.value as any)}
          className="w-44 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:bg-white font-bold text-slate-700 cursor-pointer"
        >
          <option value="all">جميع الأنواع</option>
          <option value="retail">🛍️ للبيع (POS)</option>
          <option value="raw_material">🧪 مادة خام (استهلاك)</option>
        </select>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:bg-white font-bold text-slate-700 cursor-pointer"
        >
          <option value="all">جميع الحالات</option>
          <option value="active">🟢 نشط فقط</option>
          <option value="inactive">⚪ غير نشط فقط</option>
        </select>
        <select 
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-48 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:bg-white font-bold text-slate-700 cursor-pointer"
        >
          <option value="all">جميع التصنيفات</option>
          {productCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Pagination Bar */}
        {renderPagination('top')}

        <div className="overflow-x-auto w-full">
          <table className="w-full text-right min-w-[1150px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="p-4 font-bold whitespace-nowrap">اسم المنتج</th>
                <th className="p-4 font-bold whitespace-nowrap text-center">الحالة</th>
                <th className="p-4 font-bold whitespace-nowrap">النوع</th>
                <th className="p-4 font-bold whitespace-nowrap">التصنيف</th>
                <th className="p-4 font-bold whitespace-nowrap">المورد</th>
                <th className="p-4 font-bold whitespace-nowrap">سعر البيع</th>
                <th className="p-4 font-bold whitespace-nowrap">سعر التكلفة</th>
                <th className="p-4 font-bold whitespace-nowrap">أول المدة</th>
                <th className="p-4 font-bold whitespace-nowrap">الرصيد الحالي</th>
                <th className="p-4 font-bold whitespace-nowrap">تكلفة الرصيد</th>
                <th className="p-4 font-bold whitespace-nowrap">حد الطلب</th>
                <th className="p-4 font-bold whitespace-nowrap">العمولة</th>
                <th className="p-4 font-bold whitespace-nowrap text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">لا توجد منتجات مسجلة</td>
                </tr>
              ) : (
                paginatedProducts.map(p => (
                  <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 ${p.isActive === false ? 'bg-slate-50/50 opacity-75' : ''}`}>
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800">{p.name}</div>
                      {p.barcode ? (
                        <div className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 mt-1" title="باركود المنتج">
                          <QrCode size={11} className="text-slate-400 shrink-0" />
                          <span>{p.barcode}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 mt-0.5">بدون باركود</div>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black transition-all cursor-pointer shadow-2xs ${
                          p.isActive !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 ring-1 ring-emerald-500/20'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                        title="انقر لتبديل حالة الصنف (نشط / غير نشط)"
                      >
                        <span className={`w-2 h-2 rounded-full ${p.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {p.isActive !== false ? 'نشط' : 'غير نشط'}
                      </button>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {p.productType === 'raw_material' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          مادة خام
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          للبيع
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 whitespace-nowrap">{categories.find(c => c.id === p.categoryId)?.name || p.categoryId || '—'}</td>
                    <td className="p-4 text-slate-600 font-medium whitespace-nowrap">
                      {suppliers.find(s => s.id === p.supplierId)?.name || p.supplierName || '—'}
                    </td>
                    <td className="p-4 font-bold whitespace-nowrap">
                      {p.productType === 'raw_material' ? (
                        <span className="text-slate-400 font-normal text-xs bg-slate-100 px-2 py-0.5 rounded">غير متاح للبيع</span>
                      ) : (
                        <span className="text-emerald-600">{p.sellPrice.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-rose-600 whitespace-nowrap">{p.costPrice.toFixed(2)}</td>
                    <td className="p-4 text-slate-600 whitespace-nowrap">{p.openingStock}</td>
                    <td className="p-4 font-bold whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-md ${p.currentStock <= p.reorderLimit ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                        {p.currentStock}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 font-bold whitespace-nowrap">{(p.currentStock * p.costPrice).toFixed(2)}</td>
                    <td className="p-4 text-slate-500 whitespace-nowrap">{p.reorderLimit}</td>
                    <td className="p-4 text-blue-600 whitespace-nowrap">
                      {p.productType === 'raw_material' ? (
                        <span className="text-slate-400 font-normal text-xs">—</span>
                      ) : (
                        p.commission.toFixed(2)
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
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

        {/* Bottom Pagination Bar */}
        {renderPagination('bottom')}
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
                {/* اختيار نوع المنتج: للبيع أو مادة خام */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">نوع المنتج والهدف منه</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, productType: 'retail' })}
                      className={`p-3 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer text-right ${
                        formData.productType !== 'raw_material'
                          ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 shadow-sm font-bold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${formData.productType !== 'raw_material' ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}>
                        🛍️
                      </div>
                      <div>
                        <div className="font-bold text-sm">منتج للبيع (Retail)</div>
                        <div className="text-xs text-slate-500 font-normal mt-0.5">يظهر في شاشة الكاشير (POS) ويباع للعملاء</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, productType: 'raw_material', sellPrice: '0', commission: '0' })}
                      className={`p-3 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer text-right ${
                        formData.productType === 'raw_material'
                          ? 'border-amber-500 bg-amber-50/60 text-amber-900 shadow-sm font-bold ring-2 ring-amber-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${formData.productType === 'raw_material' ? 'bg-amber-500 text-white' : 'bg-slate-100'}`}>
                        🧪
                      </div>
                      <div>
                        <div className="font-bold text-sm">مادة خام (استهلاك داخلي)</div>
                        <div className="text-xs text-slate-500 font-normal mt-0.5">لا يظهر في الكاشير، مخصص للاستهلاك والصرف</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* حالة الصنف: نشط / غير نشط */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">حالة الصنف في النظام</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: true })}
                      className={`p-3 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer text-right ${
                        formData.isActive !== false
                          ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 shadow-sm font-bold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${formData.isActive !== false ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}>
                        🟢
                      </div>
                      <div>
                        <div className="font-bold text-sm">صنف نشط</div>
                        <div className="text-xs text-slate-500 font-normal mt-0.5">مفعّل في النظام وتدخل نواقصه في تقارير وتنبيهات المخزون</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: false })}
                      className={`p-3 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer text-right ${
                        formData.isActive === false
                          ? 'border-slate-600 bg-slate-100 text-slate-900 shadow-sm font-bold ring-2 ring-slate-400/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${formData.isActive === false ? 'bg-slate-700 text-white' : 'bg-slate-100'}`}>
                        ⚪
                      </div>
                      <div>
                        <div className="font-bold text-sm">صنف غير نشط (موقوف)</div>
                        <div className="text-xs text-slate-500 font-normal mt-0.5">صنف موقوف ولا يتم احتساب نواقصه في تقارير النواقص</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">اسم المنتج</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      <QrCode size={15} className="text-primary" />
                      الباركود (Barcode)
                    </label>
                    <button 
                      type="button" 
                      onClick={generateUniqueBarcode}
                      className="text-xs text-primary hover:text-primary-dark font-bold flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer"
                      title="توليد باركود تلقائي فريد للمنتج"
                    >
                      <Sparkles size={12} />
                      توليد تلقائي
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.barcode} 
                      onChange={e => setFormData({...formData, barcode: e.target.value})} 
                      placeholder="امسح الباركود أو اكتبه..." 
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary font-mono text-sm tracking-wider" 
                    />
                    {formData.barcode && (
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, barcode: ''})}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                        title="مسح"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">التصنيف</label>
                  <select value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                    <option value="">-- اختر التصنيف --</option>
                    {productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">المورد</label>
                  <select value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                    <option value="">بدون مورد (غير محدد)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">رصيد أول المدة</label>
                  <input type="number" value={formData.openingStock} onChange={e => setFormData({...formData, openingStock: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    سعر البيع ({settings.currency})
                    {formData.productType === 'raw_material' && (
                      <span className="text-amber-600 text-xs font-normal mr-1.5">(غير متاح للبيع)</span>
                    )}
                  </label>
                  <input 
                    type="number" 
                    value={formData.productType === 'raw_material' ? '0' : formData.sellPrice} 
                    disabled={formData.productType === 'raw_material'}
                    onChange={e => setFormData({...formData, sellPrice: e.target.value})} 
                    className={`w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary ${
                      formData.productType === 'raw_material' ? 'bg-slate-100 text-slate-400 cursor-not-allowed select-none' : ''
                    }`} 
                  />
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
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    عمولة البيع
                    {formData.productType === 'raw_material' && (
                      <span className="text-slate-400 text-xs font-normal mr-1.5">(لا تنطبق للمواد الخام)</span>
                    )}
                  </label>
                  <input 
                    type="number" 
                    value={formData.productType === 'raw_material' ? '0' : formData.commission} 
                    disabled={formData.productType === 'raw_material'}
                    onChange={e => setFormData({...formData, commission: e.target.value})} 
                    className={`w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary ${
                      formData.productType === 'raw_material' ? 'bg-slate-100 text-slate-400 cursor-not-allowed select-none' : ''
                    }`} 
                  />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button disabled={isSavingProduct} onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50">إلغاء</button>
                <button disabled={isSavingProduct} onClick={handleSaveProduct} className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50">
                  {isSavingProduct ? 'جاري الحفظ والتسجيل...' : 'حفظ المنتج'}
                </button>
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
              
              {/* Quick Barcode Scanner for Dispense */}
              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 mb-4 flex items-center gap-3">
                <QrCode className="text-indigo-600 shrink-0" size={22} />
                <div className="flex-1">
                  <input 
                    type="text"
                    placeholder="مسح باركود الصنف للصرف المباشر السريع (اضغط Enter بعد المسح)..."
                    className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/30 font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const inputEl = e.currentTarget;
                        const code = inputEl.value.trim().toLowerCase();
                        if (!code) return;
                        const found = products.find(p => 
                          (p.barcode && p.barcode.trim().toLowerCase() === code) || 
                          p.name.toLowerCase() === code
                        );
                        if (found) {
                          setErrorMsg('');
                          // Check if first empty row exists
                          const emptyIdx = dispenseData.items.findIndex(it => !it.productId);
                          if (emptyIdx !== -1) {
                            const updated = [...dispenseData.items];
                            updated[emptyIdx].productId = found.id;
                            setDispenseData({ ...dispenseData, items: updated });
                          } else {
                            // Check if this product is already in items list, increment quantity
                            const existIdx = dispenseData.items.findIndex(it => it.productId === found.id);
                            if (existIdx !== -1) {
                              const updated = [...dispenseData.items];
                              updated[existIdx].quantity += 1;
                              setDispenseData({ ...dispenseData, items: updated });
                            } else {
                              setDispenseData({
                                ...dispenseData,
                                items: [...dispenseData.items, { productId: found.id, quantity: 1, employeeId: employees[0]?.id || '' }]
                              });
                            }
                          }
                          inputEl.value = '';
                        } else {
                          setErrorMsg(`لم يتم العثور على أي منتج يطابق الباركود: "${code}"`);
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {dispenseData.items.map((item, idx) => {
                  const currentProd = products.find(p => p.id === item.productId);
                  return (
                    <div key={idx} className="flex gap-3 items-end bg-white p-3 border border-slate-200 rounded-xl">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">الصنف (الاسم أو الباركود)</label>
                        <input 
                          list={`products-list`}
                          value={currentProd?.name || item.productId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const qClean = val.trim().toLowerCase();
                            const found = products.find(p => 
                              p.name.toLowerCase() === qClean || 
                              (p.barcode && p.barcode.trim().toLowerCase() === qClean) ||
                              p.id === val
                            );
                            const updated = [...dispenseData.items];
                            updated[idx].productId = found ? found.id : val;
                            setDispenseData({...dispenseData, items: updated});
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value;
                              const qClean = val.trim().toLowerCase();
                              const found = products.find(p => 
                                (p.barcode && p.barcode.trim().toLowerCase() === qClean) ||
                                p.name.toLowerCase() === qClean ||
                                p.id === val
                              );
                              if (found) {
                                const updated = [...dispenseData.items];
                                updated[idx].productId = found.id;
                                setDispenseData({...dispenseData, items: updated});
                              }
                            }
                          }}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm"
                          placeholder="ابحث بالاسم أو امسح الباركود..."
                        />
                        {currentProd && (
                          <div className="flex items-center gap-2 mt-1">
                            {currentProd.barcode && (
                              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                <QrCode size={10} className="text-slate-400" />
                                {currentProd.barcode}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500">
                              (المتاح بالمخزون: {currentProd.currentStock})
                            </span>
                          </div>
                        )}
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
                  );
                })}
                <datalist id="products-list">
                  {products.map(p => (
                    <option key={p.id} value={p.name}>
                      {p.barcode ? `[باركود: ${p.barcode}] ` : ''}(المتاح: {p.currentStock})
                    </option>
                  ))}
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
              <button onClick={async () => {
                if (productToDelete) {
                  await DB.deleteProduct(productToDelete).catch(() => {});
                  setProducts(prev => {
                    const list = Array.isArray(prev) ? prev : products;
                    return list.filter(p => p.id !== productToDelete);
                  });
                  setProductToDelete(null);
                }
              }} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors cursor-pointer">نعم، احذف</button>
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
                        <th className="p-2">النوع</th>
                        <th className="p-2">التصنيف</th>
                        <th className="p-2">المورد</th>
                        <th className="p-2">سعر البيع</th>
                        <th className="p-2">التكلفة</th>
                        <th className="p-2">المخزون</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importedRows.slice(0, 10).map((r, i) => {
                        const rawType = getRowField(r, ['نوع المنتج (للبيع / مادة خام)', 'نوع المنتج', 'النوع', 'Product Type', 'type']).toLowerCase();
                        const isRaw = rawType.includes('خام') || rawType.includes('raw');
                        const pName = getRowField(r, ['اسم المنتج', 'المنتج', 'اسم الصنف', 'الصنف', 'Product Name', 'name']);
                        const pCat = getRowField(r, ['اسم التصنيف', 'التصنيف', 'تصنيف', 'فئة', 'الفئة', 'القسم', 'قسم', 'التصنيف (Category)', 'category', 'Category']) || '—';
                        const pSup = getRowField(r, ['اسم المورد', 'المورد', 'Supplier', 'supplier', 'الموزع']) || '—';
                        const pSell = isRaw ? '—' : (getRowField(r, ['سعر البيع (ر.س)', 'سعر البيع', 'سعر بيع', 'Sell Price', 'sellPrice', 'price']) || 0);
                        const pCost = getRowField(r, ['سعر التكلفة (ر.س)', 'سعر التكلفة', 'التكلفة', 'Cost Price', 'costPrice', 'cost']) || 0;
                        const pStock = getRowField(r, ['المخزون الافتتاحي', 'المخزون', 'الرصيد', 'الكمية', 'Opening Stock', 'stock']) || 0;
                        return (
                          <tr key={i}>
                            <td className="p-2 font-bold text-slate-800">{pName}</td>
                            <td className="p-2">
                              {isRaw ? (
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">مادة خام</span>
                              ) : (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">للبيع</span>
                              )}
                            </td>
                            <td className="p-2 text-slate-600 font-semibold">{pCat}</td>
                            <td className="p-2 text-indigo-600 font-medium">{pSup}</td>
                            <td className="p-2 font-mono text-emerald-600 font-bold">{pSell}</td>
                            <td className="p-2 font-mono text-slate-500 font-bold">{pCost}</td>
                            <td className="p-2 font-bold text-slate-700">{pStock}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setShowImportModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={importedRows.length === 0 || isImporting}
                onClick={handleExecuteImport}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isImporting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block ml-1"></span>
                    <span>جاري الرفع إلى قاعدة البيانات ({importProgress.current} / {importProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>تنفيذ الاستيراد والرفع للنظام</span>
                  </>
                )}
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
