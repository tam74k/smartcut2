import React, { useState, useMemo } from 'react';
import { 
  AppSettings, Product, Category, Employee, Supplier, SupplierPayment, 
  PurchaseInvoice, Transaction, ItemMovement, InventoryCount 
} from '../types';
import { 
  Package, Truck, ShoppingCart, ClipboardList, AlertTriangle, 
  Search, Plus, TrendingDown, ArrowRightLeft, DollarSign, 
  Boxes, ShieldCheck, Sparkles, Filter, ExternalLink 
} from 'lucide-react';
import { ProductsScreen } from './ProductsScreen';
import { SuppliersScreen } from './SuppliersScreen';
import { PurchasesScreen } from './PurchasesScreen';
import { InventoryScreen } from './InventoryScreen';

export function WarehouseScreen({
  settings,
  products,
  setProducts,
  categories,
  employees,
  suppliers,
  setSuppliers,
  supplierPayments,
  setSupplierPayments,
  purchaseInvoices,
  setPurchaseInvoices,
  inventoryCounts,
  setInventoryCounts,
  itemMovements,
  setItemMovements,
  transactions,
  setTransactions,
  shiftData,
  initialSubTab = 'products',
  currentUser
}: {
  settings: AppSettings;
  products: Product[];
  setProducts: (p: Product[]) => void;
  categories: Category[];
  employees: Employee[];
  suppliers: Supplier[];
  setSuppliers: (s: Supplier[]) => void;
  supplierPayments: SupplierPayment[];
  setSupplierPayments: (sp: SupplierPayment[]) => void;
  purchaseInvoices: PurchaseInvoice[];
  setPurchaseInvoices: (pi: PurchaseInvoice[]) => void;
  inventoryCounts: InventoryCount[];
  setInventoryCounts: (ic: InventoryCount[]) => void;
  itemMovements: ItemMovement[];
  setItemMovements: (im: ItemMovement[]) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  shiftData: { isOpen: boolean; date: string; initialCash?: number };
  initialSubTab?: 'products' | 'suppliers' | 'purchases' | 'inventory' | 'shortages';
  currentUser?: any;
}) {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'suppliers' | 'purchases' | 'inventory' | 'shortages'>(initialSubTab);
  const [shortageSearch, setShortageSearch] = useState('');

  // Warehouse KPI Calculations
  const stats = useMemo(() => {
    const totalItemsCount = products.length;
    const lowStockItems = products.filter(p => (p.currentStock || 0) <= (p.reorderLimit || 5));
    const outOfStockItems = products.filter(p => (p.currentStock || 0) <= 0);
    const totalCostValue = products.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.costPrice || 0)), 0);
    const totalSellValue = products.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.sellPrice || 0)), 0);
    const totalSuppliersBalance = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);

    return {
      totalItemsCount,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      lowStockItems,
      totalCostValue,
      totalSellValue,
      totalSuppliersCount: suppliers.length,
      totalSuppliersBalance
    };
  }, [products, suppliers]);

  // Filtered Shortages List
  const filteredShortages = useMemo(() => {
    return stats.lowStockItems.filter(p => 
      p.name.toLowerCase().includes(shortageSearch.toLowerCase()) ||
      (p.barcode && p.barcode.includes(shortageSearch))
    );
  }, [stats.lowStockItems, shortageSearch]);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto bg-slate-50 font-sans" dir="rtl">
      
      {/* Main Warehouse Hub Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-black shadow-md shadow-amber-600/20">
              <Boxes size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">إدارة المخزن والمستودع الشاملة</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                المنتجات والأصناف، الموردين، فواتير المشتريات، الجرد الدوري، وسجل حركة المواد
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Nav Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('products')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'products' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package size={15} />
            <span>المنتجات والأصناف</span>
          </button>

          <button
            onClick={() => setActiveSubTab('suppliers')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'suppliers' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck size={15} />
            <span>الموردين والحسابات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('purchases')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'purchases' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart size={15} />
            <span>فواتير المشتريات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'inventory' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList size={15} />
            <span>الجرد وحركة الأصناف</span>
          </button>

          <button
            onClick={() => setActiveSubTab('shortages')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer relative ${
              activeSubTab === 'shortages' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle size={15} className={stats.lowStockCount > 0 ? 'text-rose-600' : ''} />
            <span>نواقص البضاعة</span>
            {stats.lowStockCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {stats.lowStockCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Package size={13} className="text-indigo-600" />
            <span>إجمالي الأصناف</span>
          </p>
          <h4 className="text-lg font-black text-slate-900 font-mono">{stats.totalItemsCount} صنف</h4>
        </div>

        <div className={`p-4 rounded-2xl border shadow-xs ${
          stats.lowStockCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <p className="text-[11px] font-bold text-rose-700 mb-1 flex items-center gap-1">
            <AlertTriangle size={13} className="text-rose-600" />
            <span>النواقص وحد الطلب</span>
          </p>
          <h4 className="text-lg font-black text-rose-700 font-mono">{stats.lowStockCount} صنف</h4>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Truck size={13} className="text-amber-600" />
            <span>الموردين المسجلين</span>
          </p>
          <h4 className="text-lg font-black text-slate-900 font-mono">{stats.totalSuppliersCount} مورد</h4>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <DollarSign size={13} className="text-emerald-600" />
            <span>قيمة المخزون (بالتكلفة)</span>
          </p>
          <h4 className="text-lg font-black text-emerald-700 font-mono">
            {stats.totalCostValue.toFixed(0)} {settings.currency}
          </h4>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Sparkles size={13} className="text-purple-600" />
            <span>القيمة البيعية المتوقعة</span>
          </p>
          <h4 className="text-lg font-black text-purple-700 font-mono">
            {stats.totalSellValue.toFixed(0)} {settings.currency}
          </h4>
        </div>
      </div>

      {/* SUB-TAB 1: PRODUCTS & ITEMS */}
      {activeSubTab === 'products' && (
        <ProductsScreen
          settings={settings}
          products={products}
          setProducts={setProducts}
          categories={categories}
          employees={employees}
          shiftData={{
            isOpen: shiftData.isOpen,
            date: shiftData.date,
            initialCash: shiftData.initialCash || 0
          }}
        />
      )}

      {/* SUB-TAB 2: SUPPLIERS & ACCOUNTS */}
      {activeSubTab === 'suppliers' && (
        <SuppliersScreen
          settings={settings}
          suppliers={suppliers}
          setSuppliers={setSuppliers}
          supplierPayments={supplierPayments}
          setSupplierPayments={setSupplierPayments}
          purchaseInvoices={purchaseInvoices}
          transactions={transactions}
          setTransactions={setTransactions}
          shiftData={{
            isOpen: shiftData.isOpen,
            date: shiftData.date
          }}
        />
      )}

      {/* SUB-TAB 3: PURCHASES INVOICES */}
      {activeSubTab === 'purchases' && (
        <PurchasesScreen
          settings={settings}
          purchaseInvoices={purchaseInvoices}
          setPurchaseInvoices={setPurchaseInvoices}
          suppliers={suppliers}
          setSuppliers={setSuppliers}
          products={products}
          setProducts={setProducts}
          itemMovements={itemMovements}
          setItemMovements={setItemMovements}
          transactions={transactions}
          setTransactions={setTransactions}
          shiftData={{
            isOpen: shiftData.isOpen,
            date: shiftData.date
          }}
        />
      )}

      {/* SUB-TAB 4: INVENTORY COUNTS & MOVEMENTS */}
      {activeSubTab === 'inventory' && (
        <InventoryScreen
          settings={settings}
          products={products}
          setProducts={setProducts}
          inventoryCounts={inventoryCounts}
          setInventoryCounts={setInventoryCounts}
          itemMovements={itemMovements}
          setItemMovements={setItemMovements}
        />
      )}

      {/* SUB-TAB 5: SHORTAGES & LOW STOCK ALERTS */}
      {activeSubTab === 'shortages' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-rose-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                <span>قائمة نواقص البضاعة وتنبيهات حد الطلب</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                الأصناف التي وصلت كمياتها إلى حد إعادة الطلب أو نفدت تماماً من المستودع
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={shortageSearch}
                  onChange={e => setShortageSearch(e.target.value)}
                  placeholder="بحث في النواقص..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold focus:border-rose-600 outline-none"
                />
              </div>

              <button
                onClick={() => setActiveSubTab('purchases')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <ShoppingCart size={15} />
                <span>+ إنشاء فاتورة مشتريات</span>
              </button>
            </div>
          </div>

          {filteredShortages.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Boxes size={40} className="mx-auto text-emerald-500 mb-2 opacity-60" />
              <h4 className="text-sm font-bold text-slate-800">المخزون في حالة ممتازة ومكتمل!</h4>
              <p className="text-xs text-slate-500 mt-1">لا توجد أي أصناف وصلت لحد إعادة الطلب حالياً</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">المنتج / الصنف</th>
                    <th className="p-3">الباركود</th>
                    <th className="p-3">الكمية المتوفرة حالياً</th>
                    <th className="p-3">حد إعادة الطلب</th>
                    <th className="p-3">العجز المطلوب توفيره</th>
                    <th className="p-3">سعر التكلفة التقديري</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراء سريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShortages.map(p => {
                    const isZero = (p.currentStock || 0) <= 0;
                    const shortageUnits = Math.max(0, (p.reorderLimit || 5) - (p.currentStock || 0));

                    return (
                      <tr key={p.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{p.name}</td>
                        <td className="p-3 font-mono text-slate-500">#{p.barcode || '-'}</td>
                        <td className="p-3 font-mono font-black text-rose-700 text-sm">
                          {p.currentStock || 0}
                        </td>
                        <td className="p-3 font-mono text-slate-600">{p.reorderLimit || 5}</td>
                        <td className="p-3 font-mono font-bold text-amber-700">
                          {shortageUnits > 0 ? `+${shortageUnits} حبة` : 'مكتمل'}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          {p.costPrice?.toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-3">
                          {isZero ? (
                            <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded text-[10px] font-black border border-rose-200">
                              نفد من المخزن ⛔
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-black border border-amber-200">
                              قارب على النفاد ⚠️
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setActiveSubTab('purchases')}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <ShoppingCart size={13} />
                            <span>طلب شراء</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
