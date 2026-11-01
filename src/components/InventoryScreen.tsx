import React, { useState, useMemo } from 'react';
import { 
  AppSettings, 
  Product, 
  InventoryCount, 
  ItemMovement, 
  InventoryCountItem, 
  Branch, 
  getProductStock, 
  Category, 
  AppUser 
} from '../types';
import { 
  Search, 
  CheckCircle, 
  Save, 
  X, 
  ArrowRightLeft, 
  ClipboardList, 
  Printer, 
  Filter, 
  Tag, 
  Check, 
  Eye, 
  Layers, 
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { getEffectiveDateTime } from '../utils/shiftDate';
import { handlePrintReceipt } from '../utils/print';
import { formatInvoiceDateTimeDisplay } from '../utils/timezone';

export function InventoryScreen({
  settings,
  products,
  setProducts,
  categories = [],
  inventoryCounts,
  setInventoryCounts,
  itemMovements,
  setItemMovements,
  shiftData,
  activeBranchId,
  branches = [],
  currentUser
}: {
  settings: AppSettings;
  products: Product[];
  setProducts: (p: Product[]) => void;
  categories?: Category[];
  inventoryCounts: InventoryCount[];
  setInventoryCounts: (ic: InventoryCount[]) => void;
  itemMovements: ItemMovement[];
  setItemMovements: (im: ItemMovement[]) => void;
  activeBranchId?: string;
  branches?: Branch[];
  shiftData?: { isOpen: boolean; date: string; initialCash?: number };
  currentUser?: AppUser | null;
}) {
  const [activeTab, setActiveTab] = useState<'counts' | 'movements'>('counts');
  
  // Inventory Count State
  const [showAddCount, setShowAddCount] = useState(false);
  const [countItems, setCountItems] = useState<InventoryCountItem[]>([]);
  const [countNotes, setCountNotes] = useState('');
  
  // Filter States inside Modal
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [qtyFilter, setQtyFilter] = useState<'all' | 'zero' | 'positive' | 'negative' | 'has_diff'>('all');

  // Past Count View Modal
  const [viewingCount, setViewingCount] = useState<InventoryCount | null>(null);

  // Item Movement State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementFrom, setMovementFrom] = useState('');
  const [movementTo, setMovementTo] = useState('');

  // Resolved branch and salon metadata
  const currentBranch = branches?.find(b => b.id === activeBranchId);
  const branchName = currentBranch?.name || 'الفرع الرئيسي';
  const salonName = settings?.salonName || settings?.companyName || 'Smart Cut';
  
  // Map of category names
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Available categories with products
  const availableCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    categories.forEach(c => map.set(c.id, { id: c.id, name: c.name }));
    products.forEach(p => {
      const cId = p.categoryId || (p as any).category_id;
      if (cId && !map.has(cId)) {
        map.set(cId, { id: cId, name: cId });
      }
    });
    return Array.from(map.values());
  }, [categories, products]);

  const startNewCount = () => {
    const initial: InventoryCountItem[] = products.map(p => {
      const stock = getProductStock(p, activeBranchId);
      return {
        productId: p.id,
        expectedQuantity: stock,
        actualQuantity: stock,
        difference: 0,
        notes: ''
      };
    });
    setCountItems(initial);
    setCountNotes('');
    setSearchQuery('');
    setSelectedCategory('all');
    setQtyFilter('all');
    setShowAddCount(true);
  };
  
  const handleActualQtyChange = (productId: string, qtyStr: string) => {
    const num = qtyStr === '' ? 0 : Number(qtyStr);
    setCountItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          actualQuantity: num,
          difference: num - item.expectedQuantity
        };
      }
      return item;
    }));
  };

  // Bulk actions for currently filtered items
  const handleMatchAllDisplayed = (displayed: InventoryCountItem[]) => {
    const displayedIds = new Set(displayed.map(i => i.productId));
    setCountItems(prev => prev.map(item => {
      if (displayedIds.has(item.productId)) {
        return {
          ...item,
          actualQuantity: item.expectedQuantity,
          difference: 0
        };
      }
      return item;
    }));
  };

  const handleZeroAllDisplayed = (displayed: InventoryCountItem[]) => {
    const displayedIds = new Set(displayed.map(i => i.productId));
    setCountItems(prev => prev.map(item => {
      if (displayedIds.has(item.productId)) {
        return {
          ...item,
          actualQuantity: 0,
          difference: 0 - item.expectedQuantity
        };
      }
      return item;
    }));
  };

  const handleSaveCount = () => {
    const countId = 'CNT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const effectiveNow = getEffectiveDateTime(shiftData);
    
    const newCount: InventoryCount = {
      id: countId,
      date: effectiveNow,
      notes: countNotes,
      items: countItems
    };
    
    setInventoryCounts([...inventoryCounts, newCount]);
    
    let updatedProducts = [...products];
    const newMovements: ItemMovement[] = [];
    
    countItems.forEach(item => {
      if (item.difference !== 0) {
        const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
        if (pIdx >= 0) {
          const curProd = updatedProducts[pIdx];
          const curBranchStocks = { ...(curProd.branchStocks || {}) };
          if (activeBranchId) {
            curBranchStocks[activeBranchId] = item.actualQuantity;
          }
          updatedProducts[pIdx] = { 
            ...curProd, 
            currentStock: item.actualQuantity,
            branchStocks: curBranchStocks
          };
          
          newMovements.push({
            id: 'MOV-' + Math.random().toString(36).substr(2, 9),
            productId: item.productId,
            date: effectiveNow,
            type: 'inventory_count',
            referenceId: countId,
            quantityIn: item.difference > 0 ? item.difference : 0,
            quantityOut: item.difference < 0 ? Math.abs(item.difference) : 0,
            balanceAfter: item.actualQuantity,
            branchId: activeBranchId,
            notes: item.notes || countNotes
          });
        }
      }
    });
    
    if (newMovements.length > 0) {
      setItemMovements([...itemMovements, ...newMovements]);
    }
    setProducts(updatedProducts);
    setShowAddCount(false);
  };

  // Quantity statistics across all countItems
  const qtyStats = useMemo(() => {
    let all = countItems.length;
    let zero = 0;
    let positive = 0;
    let negative = 0;
    let hasDiff = 0;

    countItems.forEach(item => {
      if (item.expectedQuantity === 0) zero++;
      else if (item.expectedQuantity > 0) positive++;
      else if (item.expectedQuantity < 0) negative++;

      if (item.difference !== 0) hasDiff++;
    });

    return { all, zero, positive, negative, hasDiff };
  }, [countItems]);

  // Category counts
  const categoryCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    countItems.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const cId = prod?.categoryId || (prod as any)?.category_id || 'uncategorized';
      counts[cId] = (counts[cId] || 0) + 1;
    });
    return counts;
  }, [countItems, products]);

  // Filtered Count Items for display and thermal print
  const filteredCountItems = useMemo(() => {
    return countItems.filter(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return false;

      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = prod.name.toLowerCase().includes(q);
        const matchBarcode = prod.barcode ? prod.barcode.toLowerCase().includes(q) : false;
        if (!matchName && !matchBarcode) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        const cId = prod.categoryId || (prod as any)?.category_id;
        if (selectedCategory === 'uncategorized') {
          if (cId) return false;
        } else {
          if (cId !== selectedCategory) return false;
        }
      }

      // 3. Quantity Filter
      if (qtyFilter === 'zero' && item.expectedQuantity !== 0) return false;
      if (qtyFilter === 'positive' && item.expectedQuantity <= 0) return false;
      if (qtyFilter === 'negative' && item.expectedQuantity >= 0) return false;
      if (qtyFilter === 'has_diff' && item.difference === 0) return false;

      return true;
    });
  }, [countItems, products, searchQuery, selectedCategory, qtyFilter]);

  // Displayed summary stats
  const displayedSummary = useMemo(() => {
    let totalExpected = 0;
    let totalActual = 0;
    let totalDiff = 0;
    let itemsWithDiff = 0;
    let positiveDiffCount = 0;
    let negativeDiffCount = 0;
    let matchedCount = 0;

    filteredCountItems.forEach(item => {
      totalExpected += item.expectedQuantity;
      totalActual += item.actualQuantity;
      totalDiff += item.difference;
      if (item.difference !== 0) {
        itemsWithDiff++;
        if (item.difference > 0) positiveDiffCount++;
        else negativeDiffCount++;
      } else {
        matchedCount++;
      }
    });

    return {
      count: filteredCountItems.length,
      totalExpected,
      totalActual,
      totalDiff,
      itemsWithDiff,
      positiveDiffCount,
      negativeDiffCount,
      matchedCount
    };
  }, [filteredCountItems]);

  // Filter label for receipt
  const getFilterSummaryText = () => {
    const parts: string[] = [];
    if (selectedCategory === 'all') {
      parts.push('كل التصنيفات');
    } else if (selectedCategory === 'uncategorized') {
      parts.push('بدون تصنيف');
    } else {
      parts.push(`تصنيف: ${categoryMap.get(selectedCategory) || selectedCategory}`);
    }

    if (qtyFilter === 'zero') parts.push('رصيد دفتري صفر');
    else if (qtyFilter === 'positive') parts.push('رصيد أكبر من صفر');
    else if (qtyFilter === 'negative') parts.push('كميات سالبة');
    else if (qtyFilter === 'has_diff') parts.push('أصناف بها فروقات');
    else parts.push('كل الكميات');

    if (searchQuery.trim()) {
      parts.push(`بحث: "${searchQuery.trim()}"`);
    }

    return parts.join(' | ');
  };

  const handlePrintFilteredCount = () => {
    handlePrintReceipt('inventory-count-thermal-receipt', false, (settings?.paperSize as any) || '80mm');
  };

  const handlePrintPastCount = () => {
    handlePrintReceipt('past-inventory-count-thermal-receipt', false, (settings?.paperSize as any) || '80mm');
  };

  // Movement calculation
  let filteredMovements = itemMovements;
  if (selectedProductId) {
    filteredMovements = filteredMovements.filter(m => m.productId === selectedProductId);
  }
  if (movementFrom) {
    filteredMovements = filteredMovements.filter(m => m.date >= movementFrom);
  }
  if (movementTo) {
    filteredMovements = filteredMovements.filter(m => m.date <= movementTo + 'T23:59:59');
  }
  
  // Sort by date desc
  filteredMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-3 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="text-primary" size={26} /> إدارة المخزون والجرد
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل وإجراء جرد الأصناف، متابعة الفروقات الدفترية والفعلية، وطباعة كشوف الجرد
          </p>
        </div>
        {activeTab === 'counts' && (
          <button 
            onClick={startNewCount} 
            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer"
          >
            <CheckCircle size={18} /> بدء جرد جديد
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setActiveTab('counts')} 
          className={`px-4 py-2 font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'counts' ? 'bg-white shadow text-primary border border-slate-100' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList size={18} /> سجل الجرد ({inventoryCounts.length})
        </button>
        <button 
          onClick={() => setActiveTab('movements')} 
          className={`px-4 py-2 font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'movements' ? 'bg-white shadow text-primary border border-slate-100' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowRightLeft size={18} /> كارت حركة الصنف
        </button>
      </div>

      {/* TAB 1: Inventory Counts Log */}
      {activeTab === 'counts' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold text-slate-700 whitespace-nowrap">التاريخ والوقت</th>
                  <th className="p-4 font-bold text-slate-700 whitespace-nowrap">رقم الجرد</th>
                  <th className="p-4 font-bold text-slate-700 whitespace-nowrap">ملاحظات</th>
                  <th className="p-4 font-bold text-slate-700 text-center whitespace-nowrap">عدد الأصناف</th>
                  <th className="p-4 font-bold text-slate-700 text-center whitespace-nowrap">أصناف بها فروقات</th>
                  <th className="p-4 font-bold text-slate-700 text-center whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {inventoryCounts.map(cnt => {
                  const itemsWithDiff = cnt.items?.filter(i => i.difference !== 0)?.length || 0;
                  return (
                    <tr key={cnt.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-slate-600 whitespace-nowrap font-medium">
                        {formatInvoiceDateTimeDisplay(cnt.date)}
                      </td>
                      <td className="p-4 font-bold text-slate-800 whitespace-nowrap font-mono">
                        {cnt.id}
                      </td>
                      <td className="p-4 text-slate-600 whitespace-nowrap max-w-[200px] truncate">
                        {cnt.notes || '-'}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-800 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs font-bold text-slate-700">
                          {cnt.items?.length || 0}
                        </span>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {itemsWithDiff > 0 ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-xs font-bold">
                            {itemsWithDiff} صنف
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-xs font-bold">
                            مطابق بالكامل
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setViewingCount(cnt)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="عرض تفاصيل وطباعة الجرد"
                        >
                          <Eye size={14} /> تفاصيل وطباعة
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {inventoryCounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      لا يوجد سجلات جرد حتى الآن. اضغط على زر "بدء جرد جديد" لتسجيل عملية جرد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Item Movement */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-bold text-slate-700 mb-1">المنتج</label>
              <select 
                value={selectedProductId} 
                onChange={e => setSelectedProductId(e.target.value)} 
                className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm font-medium"
              >
                <option value="">جميع المنتجات ({products.length})</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-1/4 min-w-[140px]">
              <label className="block text-sm font-bold text-slate-700 mb-1">من تاريخ</label>
              <input 
                type="date" 
                value={movementFrom} 
                onChange={e => setMovementFrom(e.target.value)} 
                className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm font-medium" 
              />
            </div>
            <div className="w-full sm:w-1/4 min-w-[140px]">
              <label className="block text-sm font-bold text-slate-700 mb-1">إلى تاريخ</label>
              <input 
                type="date" 
                value={movementTo} 
                onChange={e => setMovementTo(e.target.value)} 
                className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm font-medium" 
              />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-sm min-w-[750px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-700 whitespace-nowrap">التاريخ والوقت</th>
                    <th className="p-4 font-bold text-slate-700 whitespace-nowrap">المنتج</th>
                    <th className="p-4 font-bold text-slate-700 whitespace-nowrap">نوع الحركة</th>
                    <th className="p-4 font-bold text-emerald-600 text-center whitespace-nowrap">وارد (+)</th>
                    <th className="p-4 font-bold text-red-600 text-center whitespace-nowrap">منصرف (-)</th>
                    <th className="p-4 font-bold text-blue-600 text-center whitespace-nowrap">الرصيد بعد</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-slate-600 whitespace-nowrap font-medium">
                        {formatInvoiceDateTimeDisplay(m.date)}
                      </td>
                      <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                        {products.find(p => p.id === m.productId)?.name || 'منتج غير معروف'}
                      </td>
                      <td className="p-4 text-slate-600 whitespace-nowrap">
                        {m.type === 'purchase' ? 'مشتريات' :
                         m.type === 'sale' ? 'مبيعات' :
                         m.type === 'inventory_count' ? 'تسوية جرد' :
                         m.type === 'manual_adjustment' ? 'تعديل يدوي' :
                         m.type === 'internal_use' ? 'صرف داخلي' : m.type}
                      </td>
                      <td className="p-4 text-center font-bold text-emerald-600 whitespace-nowrap">
                        {m.quantityIn > 0 ? `+${m.quantityIn}` : '-'}
                      </td>
                      <td className="p-4 text-center font-bold text-red-600 whitespace-nowrap">
                        {m.quantityOut > 0 ? `-${m.quantityOut}` : '-'}
                      </td>
                      <td className="p-4 text-center font-bold text-blue-600 whitespace-nowrap">
                        {m.balanceAfter}
                      </td>
                    </tr>
                  ))}
                  {filteredMovements.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا يوجد حركات مسجلة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD INVENTORY COUNT MODAL (WITH CATEGORY & QUANTITY FILTERS & PRINTING)   */}
      {/* ========================================================================= */}
      {showAddCount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 leading-none">جرد المخزون الفعلي</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    الفرع: <span className="font-bold text-slate-700">{branchName}</span>
                    {currentUser?.name && <> | القائم بالجرد: <span className="font-bold text-slate-700">{currentUser.name}</span></>}
                  </p>
                </div>
              </div>

              {/* Action buttons in header */}
              <div className="flex items-center gap-2">
                {/* Thermal Print Button for Filtered Items */}
                <button
                  onClick={handlePrintFilteredCount}
                  disabled={filteredCountItems.length === 0}
                  className="bg-black hover:bg-slate-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="طباعة الأصناف المحددة / المعروضة على طابعة الفواتير الورق الحراري"
                >
                  <Printer size={16} />
                  <span>طباعة حرارية ({filteredCountItems.length})</span>
                </button>

                <button 
                  onClick={() => setShowAddCount(false)} 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* FILTERS TOOLBAR */}
              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                {/* Row 1: Search & Category Filter Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Search Input */}
                  <div className="sm:col-span-6 relative">
                    <Search size={16} className="absolute right-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث باسم الصنف أو الباركود..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-primary transition-all shadow-2xs"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Select */}
                  <div className="sm:col-span-6 relative">
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-slate-500 shrink-0" />
                      <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary transition-all shadow-2xs"
                      >
                        <option value="all">جميع التصنيفات ({countItems.length})</option>
                        {availableCategories.map(cat => {
                          const count = categoryCountMap[cat.id] || 0;
                          return (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} ({count})
                            </option>
                          );
                        })}
                        {categoryCountMap['uncategorized'] > 0 && (
                          <option value="uncategorized">
                            بدون تصنيف ({categoryCountMap['uncategorized']})
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 2: Quantity Filter Pills (User Requirement: فلاتر بالأعداد مثل صفر، أكبر من صفر، سالبة) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                    <Filter size={14} className="text-primary" />
                    <span>تصفية بالرصيد:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* All */}
                    <button
                      type="button"
                      onClick={() => setQtyFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        qtyFilter === 'all'
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      الكل ({qtyStats.all})
                    </button>

                    {/* Positive (> 0) */}
                    <button
                      type="button"
                      onClick={() => setQtyFilter('positive')}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        qtyFilter === 'positive'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      أكبر من صفر (&gt; 0) ({qtyStats.positive})
                    </button>

                    {/* Zero (= 0) */}
                    <button
                      type="button"
                      onClick={() => setQtyFilter('zero')}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        qtyFilter === 'zero'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      رصيد صفر (0) ({qtyStats.zero})
                    </button>

                    {/* Negative (< 0) */}
                    <button
                      type="button"
                      onClick={() => setQtyFilter('negative')}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        qtyFilter === 'negative'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                      }`}
                    >
                      كميات سالبة (&lt; 0) ({qtyStats.negative})
                    </button>

                    {/* Has Discrepancy */}
                    <button
                      type="button"
                      onClick={() => setQtyFilter('has_diff')}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        qtyFilter === 'has_diff'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      يوجد فرق جرد ({qtyStats.hasDiff})
                    </button>
                  </div>
                </div>

                {/* Row 3: Quick Discrepancy Overview & Bulk Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                  <div className="flex items-center gap-3 text-slate-700 font-medium">
                    <span>المعروض: <b className="text-slate-900">{displayedSummary.count}</b> صنف</span>
                    <span>•</span>
                    <span>إجمالي الدفتري: <b className="text-slate-900">{displayedSummary.totalExpected}</b></span>
                    <span>•</span>
                    <span>إجمالي الفعلي: <b className="text-slate-900">{displayedSummary.totalActual}</b></span>
                    <span>•</span>
                    <span>
                      صافي الفرق:{' '}
                      <b className={`font-black ${
                        displayedSummary.totalDiff > 0 ? 'text-emerald-600' :
                        displayedSummary.totalDiff < 0 ? 'text-red-600' : 'text-slate-600'
                      }`}>
                        {displayedSummary.totalDiff > 0 ? `+${displayedSummary.totalDiff}` : displayedSummary.totalDiff}
                      </b>
                    </span>
                  </div>

                  {/* Bulk Quick Fill Helpers for displayed items */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMatchAllDisplayed(filteredCountItems)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      title="جعل الرصيد الفعلي يساوي الدفتري لجميع الأصناف المعروضة حالياً"
                    >
                      <Check size={12} className="text-emerald-600" /> مطابقة المعروض
                    </button>
                    <button
                      type="button"
                      onClick={() => handleZeroAllDisplayed(filteredCountItems)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      title="تصفير الرصيد الفعلي لجميع الأصناف المعروضة حالياً"
                    >
                      <RotateCcw size={12} className="text-amber-600" /> تصفير فعلي المعروض
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات أو سبب الجرد (اختياري)
                </label>
                <input 
                  type="text" 
                  placeholder="مثال: جرد نهاية الشهر، تسوية عجز مستودع، جرد دوري..."
                  value={countNotes} 
                  onChange={e => setCountNotes(e.target.value)} 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-primary shadow-2xs" 
                />
              </div>
              
              {/* Products Count Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto w-full max-h-[48vh]">
                  <table className="w-full text-right text-xs min-w-[650px] relative">
                    <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 z-10 backdrop-blur-xs">
                      <tr>
                        <th className="p-2.5 font-extrabold text-slate-700 w-12 text-center">#</th>
                        <th className="p-2.5 font-extrabold text-slate-700">الصنف / التصنيف</th>
                        <th className="p-2.5 font-extrabold text-slate-700 text-center whitespace-nowrap w-28">الرصيد الدفتري</th>
                        <th className="p-2.5 font-extrabold text-slate-700 text-center whitespace-nowrap w-36">الرصيد الفعلي</th>
                        <th className="p-2.5 font-extrabold text-slate-700 text-center whitespace-nowrap w-28">العجز / الزيادة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCountItems.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        const catId = prod?.categoryId || (prod as any)?.category_id;
                        const catName = catId ? categoryMap.get(catId) || catId : 'بدون تصنيف';

                        return (
                          <tr 
                            key={item.productId} 
                            className={`hover:bg-slate-50/80 transition-colors ${
                              item.difference !== 0 ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-800 text-xs">
                                {prod?.name || 'منتج غير معروف'}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                  {catName}
                                </span>
                                {prod?.barcode && (
                                  <span className="font-mono">باركون: {prod.barcode}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-center text-slate-700 font-extrabold font-mono text-xs whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded ${
                                item.expectedQuantity < 0 ? 'bg-red-50 text-red-700 font-black' :
                                item.expectedQuantity === 0 ? 'text-slate-400' : 'text-slate-800'
                              }`}>
                                {item.expectedQuantity}
                              </span>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <input 
                                type="number" 
                                value={item.actualQuantity} 
                                onChange={e => handleActualQtyChange(item.productId, e.target.value)} 
                                className="w-24 text-center border border-slate-300 rounded-lg p-1.5 font-black text-xs text-primary bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs font-mono" 
                              />
                            </td>
                            <td className={`p-2.5 text-center font-black font-mono text-xs whitespace-nowrap ${
                              item.difference > 0 ? 'text-emerald-600' :
                              item.difference < 0 ? 'text-red-600' : 'text-slate-400'
                            }`}>
                              {item.difference > 0 ? `+${item.difference}` : item.difference}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredCountItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            لا توجد أصناف مطابقة للفلاتر المحددة حالياً. حاول تعديل البحث أو التصنيف.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-slate-600 font-medium">
                {displayedSummary.itemsWithDiff > 0 ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <AlertCircle size={15} /> يوجد {displayedSummary.itemsWithDiff} صنف به فرق سيتم إنشاء حركات تسوية مخزنية له.
                  </span>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle size={15} /> جميع الأصناف المعروضة متطابقة بدون فروقات.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Print button duplicate in footer for convenience */}
                <button
                  type="button"
                  onClick={handlePrintFilteredCount}
                  disabled={filteredCountItems.length === 0}
                  className="flex-1 sm:flex-none bg-black hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="طباعة الأصناف المحددة"
                >
                  <Printer size={16} /> طباعة حرارية للكشف ({filteredCountItems.length})
                </button>

                <button 
                  onClick={handleSaveCount} 
                  className="flex-1 sm:flex-none bg-primary hover:bg-primary-dark text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-md transition-all flex justify-center items-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <Save size={16} /> حفظ واعتماد الجرد
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW PAST INVENTORY COUNT DETAILS & REPRINT MODAL                         */}
      {/* ========================================================================= */}
      {viewingCount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-primary" size={20} />
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    تفاصيل الجرد رقم: <span className="font-mono text-primary">{viewingCount.id}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    التاريخ: {formatInvoiceDateTimeDisplay(viewingCount.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPastCount}
                  className="bg-black hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={15} /> طباعة حرارية
                </button>
                <button 
                  onClick={() => setViewingCount(null)} 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {viewingCount.notes && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700">ملاحظات الجرد: </span>
                  <span className="text-slate-600">{viewingCount.notes}</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-right text-xs min-w-[550px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-700">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">الصنف</th>
                        <th className="p-3 text-center">الرصيد الدفتري</th>
                        <th className="p-3 text-center">الرصيد الفعلي</th>
                        <th className="p-3 text-center">العجز / الزيادة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingCount.items?.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <tr key={item.productId || idx} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-800">
                              {prod?.name || item.productId}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">{item.expectedQuantity}</td>
                            <td className="p-3 text-center font-mono font-bold text-primary">{item.actualQuantity}</td>
                            <td className={`p-3 text-center font-mono font-extrabold ${
                              item.difference > 0 ? 'text-emerald-600' :
                              item.difference < 0 ? 'text-red-600' : 'text-slate-400'
                            }`}>
                              {item.difference > 0 ? `+${item.difference}` : item.difference}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewingCount(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIDDEN THERMAL RECEIPT CONTAINER: NEW COUNT (FILTERED ITEMS)              */}
      {/* Target for handlePrintReceipt('inventory-count-thermal-receipt')         */}
      {/* ========================================================================= */}
      <div 
        id="inventory-count-thermal-receipt" 
        className="hidden print:block font-mono text-[11px] text-black bg-white leading-tight"
        style={{ direction: 'rtl', textAlign: 'right' }}
      >
        {/* Salon / Branch Header */}
        <div style={{ textAlign: 'center', paddingBottom: '6px', borderBottom: '1px dashed #000' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{salonName}</div>
          <div style={{ fontSize: '11px', color: '#333' }}>{branchName}</div>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '900', 
            margin: '4px auto', 
            border: '1px solid #000', 
            padding: '2px 8px', 
            display: 'inline-block' 
          }}>
            كشف جرد المخزون الفعلي
          </div>
          <div style={{ fontSize: '10px', marginTop: '2px' }}>
            التاريخ: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {currentUser?.name && (
            <div style={{ fontSize: '10px', color: '#222' }}>
              المسؤول: {currentUser.name}
            </div>
          )}

          {/* Active Filters Display */}
          <div style={{ fontSize: '9px', marginTop: '4px', paddingTop: '4px', borderTop: '1px dotted #888', color: '#444' }}>
            الفلتر: {getFilterSummaryText()}
          </div>
        </div>

        {/* Items Table */}
        <div style={{ padding: '6px 0', borderBottom: '1px dashed #000' }}>
          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '3px 0', textAlign: 'right' }}>الصنف</th>
                <th style={{ padding: '3px 2px', textAlign: 'center', width: '38px' }}>دفتري</th>
                <th style={{ padding: '3px 2px', textAlign: 'center', width: '38px' }}>فعلي</th>
                <th style={{ padding: '3px 0', textAlign: 'center', width: '38px' }}>الفرق</th>
              </tr>
            </thead>
            <tbody>
              {filteredCountItems.map((item, idx) => {
                const p = products.find(prod => prod.id === item.productId);
                return (
                  <tr key={item.productId || idx} style={{ borderBottom: '1px dotted #ccc' }}>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                      {idx + 1}. {p?.name || 'صنف غير معروف'}
                    </td>
                    <td style={{ padding: '3px 2px', textAlign: 'center', fontWeight: 'bold' }}>
                      {item.expectedQuantity}
                    </td>
                    <td style={{ padding: '3px 2px', textAlign: 'center', fontWeight: 'bold' }}>
                      {item.actualQuantity}
                    </td>
                    <td style={{ 
                      padding: '3px 0', 
                      textAlign: 'center', 
                      fontWeight: '900',
                      color: item.difference < 0 ? '#b91c1c' : item.difference > 0 ? '#15803d' : '#444'
                    }}>
                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
            <span>عدد الأصناف المجرودة:</span>
            <span>{displayedSummary.count} صنف</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>إجمالي الرصيد الدفتري:</span>
            <span style={{ fontWeight: 'bold' }}>{displayedSummary.totalExpected}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>إجمالي الرصيد الفعلي:</span>
            <span style={{ fontWeight: 'bold' }}>{displayedSummary.totalActual}</span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            paddingTop: '3px', 
            borderTop: '1px dotted #999', 
            fontWeight: '900',
            fontSize: '11px' 
          }}>
            <span>صافي الفروقات (عجز/زيادة):</span>
            <span style={{ color: displayedSummary.totalDiff < 0 ? '#b91c1c' : displayedSummary.totalDiff > 0 ? '#15803d' : '#000' }}>
              {displayedSummary.totalDiff > 0 ? `+${displayedSummary.totalDiff}` : displayedSummary.totalDiff}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '9px', color: '#555' }}>
            <span>مطابق: {displayedSummary.matchedCount}</span>
            <span>عجز: {displayedSummary.negativeDiffCount}</span>
            <span>زيادة: {displayedSummary.positiveDiffCount}</span>
          </div>
        </div>

        {/* Notes */}
        {countNotes && (
          <div style={{ padding: '4px 0', borderBottom: '1px dashed #000', fontSize: '9px' }}>
            <b>ملاحظات: </b> {countNotes}
          </div>
        )}

        {/* Signatures */}
        <div style={{ paddingTop: '8px', paddingBottom: '4px', fontSize: '9px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>مسؤول الجرد: ....................</div>
            <div>مدير الفرع: ....................</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '8px', color: '#777', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
            Smart Cut System • {new Date().toLocaleString('ar-EG')}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HIDDEN THERMAL RECEIPT CONTAINER: PAST COUNT                              */}
      {/* Target for handlePrintReceipt('past-inventory-count-thermal-receipt')     */}
      {/* ========================================================================= */}
      {viewingCount && (
        <div 
          id="past-inventory-count-thermal-receipt" 
          className="hidden print:block font-mono text-[11px] text-black bg-white leading-tight"
          style={{ direction: 'rtl', textAlign: 'right' }}
        >
          <div style={{ textAlign: 'center', paddingBottom: '6px', borderBottom: '1px dashed #000' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{salonName}</div>
            <div style={{ fontSize: '11px', color: '#333' }}>{branchName}</div>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: '900', 
              margin: '4px auto', 
              border: '1px solid #000', 
              padding: '2px 8px', 
              display: 'inline-block' 
            }}>
              كشف جرد مخزون سابق ({viewingCount.id})
            </div>
            <div style={{ fontSize: '10px', marginTop: '2px' }}>
              تاريخ الجرد: {formatInvoiceDateTimeDisplay(viewingCount.date)}
            </div>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '1px dashed #000' }}>
            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ padding: '3px 0', textAlign: 'right' }}>الصنف</th>
                  <th style={{ padding: '3px 2px', textAlign: 'center', width: '38px' }}>دفتري</th>
                  <th style={{ padding: '3px 2px', textAlign: 'center', width: '38px' }}>فعلي</th>
                  <th style={{ padding: '3px 0', textAlign: 'center', width: '38px' }}>الفرق</th>
                </tr>
              </thead>
              <tbody>
                {viewingCount.items?.map((item, idx) => {
                  const p = products.find(prod => prod.id === item.productId);
                  return (
                    <tr key={item.productId || idx} style={{ borderBottom: '1px dotted #ccc' }}>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                        {idx + 1}. {p?.name || item.productId}
                      </td>
                      <td style={{ padding: '3px 2px', textAlign: 'center', fontWeight: 'bold' }}>
                        {item.expectedQuantity}
                      </td>
                      <td style={{ padding: '3px 2px', textAlign: 'center', fontWeight: 'bold' }}>
                        {item.actualQuantity}
                      </td>
                      <td style={{ 
                        padding: '3px 0', 
                        textAlign: 'center', 
                        fontWeight: '900',
                        color: item.difference < 0 ? '#b91c1c' : item.difference > 0 ? '#15803d' : '#444'
                      }}>
                        {item.difference > 0 ? `+${item.difference}` : item.difference}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
              <span>عدد الأصناف:</span>
              <span>{viewingCount.items?.length || 0} صنف</span>
            </div>
            {viewingCount.notes && (
              <div style={{ marginTop: '3px', fontSize: '9px' }}>
                <b>ملاحظات: </b> {viewingCount.notes}
              </div>
            )}
          </div>

          <div style={{ paddingTop: '8px', paddingBottom: '4px', fontSize: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>مسؤول الجرد: ....................</div>
              <div>مدير الفرع: ....................</div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '8px', color: '#777', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
              Smart Cut System • {new Date().toLocaleString('ar-EG')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
