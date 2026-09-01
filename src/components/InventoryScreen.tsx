import { useState } from 'react';
import { AppSettings, Product, InventoryCount, ItemMovement, InventoryCountItem } from '../types';
import { Plus, Search, FileText, CheckCircle, Save, X, Calendar, ArrowRightLeft, ClipboardList } from 'lucide-react';

export function InventoryScreen({
  settings,
  products,
  setProducts,
  inventoryCounts,
  setInventoryCounts,
  itemMovements,
  setItemMovements
}: {
  settings: AppSettings;
  products: Product[];
  setProducts: (p: Product[]) => void;
  inventoryCounts: InventoryCount[];
  setInventoryCounts: (ic: InventoryCount[]) => void;
  itemMovements: ItemMovement[];
  setItemMovements: (im: ItemMovement[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<'counts' | 'movements'>('counts');
  
  // Inventory Count State
  const [showAddCount, setShowAddCount] = useState(false);
  const [countItems, setCountItems] = useState<InventoryCountItem[]>([]);
  const [countNotes, setCountNotes] = useState('');
  
  // Item Movement State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementFrom, setMovementFrom] = useState('');
  const [movementTo, setMovementTo] = useState('');
  
  const startNewCount = () => {
    // initialize count items with current products
    const initial = products.map(p => ({
      productId: p.id,
      expectedQuantity: p.currentStock,
      actualQuantity: p.currentStock,
      difference: 0,
      notes: ''
    }));
    setCountItems(initial);
    setCountNotes('');
    setShowAddCount(true);
  };
  
  const handleActualQtyChange = (idx: number, qty: string) => {
    const num = Number(qty);
    const newItems = [...countItems];
    newItems[idx].actualQuantity = num;
    newItems[idx].difference = num - newItems[idx].expectedQuantity;
    setCountItems(newItems);
  };

  const handleSaveCount = () => {
    
    
    const countId = 'CNT-' + Math.random().toString(36).substr(2, 9);
    
    const newCount: InventoryCount = {
      id: countId,
      date: new Date().toISOString(),
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
          updatedProducts[pIdx] = { ...updatedProducts[pIdx], currentStock: item.actualQuantity };
          
          newMovements.push({
            id: 'MOV-' + Math.random().toString(36).substr(2, 9),
            productId: item.productId,
            date: new Date().toISOString(),
            type: 'inventory_count',
            referenceId: countId,
            quantityIn: item.difference > 0 ? item.difference : 0,
            quantityOut: item.difference < 0 ? Math.abs(item.difference) : 0,
            balanceAfter: item.actualQuantity,
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">إدارة المخزون</h1>
        {activeTab === 'counts' && (
          <button onClick={startNewCount} className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            <CheckCircle size={18} /> بدء جرد جديد
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
        <button onClick={() => setActiveTab('counts')} className={`px-4 py-2 font-bold rounded-lg flex items-center gap-2 ${activeTab === 'counts' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>
          <ClipboardList size={18} /> سجل الجرد
        </button>
        <button onClick={() => setActiveTab('movements')} className={`px-4 py-2 font-bold rounded-lg flex items-center gap-2 ${activeTab === 'movements' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>
          <ArrowRightLeft size={18} /> كارت حركة الصنف
        </button>
      </div>

      {activeTab === 'counts' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold text-slate-700">التاريخ</th>
                <th className="p-4 font-bold text-slate-700">رقم الجرد</th>
                <th className="p-4 font-bold text-slate-700">ملاحظات</th>
                <th className="p-4 font-bold text-slate-700 text-center">عدد الأصناف</th>
              </tr>
            </thead>
            <tbody>
              {inventoryCounts.map(cnt => (
                <tr key={cnt.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-600">{new Date(cnt.date).toLocaleString('ar-EG')}</td>
                  <td className="p-4 font-bold text-slate-800">{cnt.id}</td>
                  <td className="p-4 text-slate-600">{cnt.notes || '-'}</td>
                  <td className="p-4 text-center font-bold text-slate-800">{cnt.items.length}</td>
                </tr>
              ))}
              {inventoryCounts.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-500">لا يوجد سجلات جرد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 mb-1">المنتج</label>
              <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                <option value="">جميع المنتجات</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="w-1/4">
              <label className="block text-sm font-bold text-slate-700 mb-1">من تاريخ</label>
              <input type="date" value={movementFrom} onChange={e => setMovementFrom(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
            </div>
            <div className="w-1/4">
              <label className="block text-sm font-bold text-slate-700 mb-1">إلى تاريخ</label>
              <input type="date" value={movementTo} onChange={e => setMovementTo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold text-slate-700">التاريخ</th>
                  <th className="p-4 font-bold text-slate-700">المنتج</th>
                  <th className="p-4 font-bold text-slate-700">نوع الحركة</th>
                  <th className="p-4 font-bold text-emerald-600 text-center">وارد</th>
                  <th className="p-4 font-bold text-red-600 text-center">منصرف</th>
                  <th className="p-4 font-bold text-blue-600 text-center">الرصيد بعد</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(m => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-slate-600">{new Date(m.date).toLocaleString('ar-EG')}</td>
                    <td className="p-4 font-bold text-slate-800">{products.find(p => p.id === m.productId)?.name}</td>
                    <td className="p-4 text-slate-600">
                      {m.type === 'purchase' ? 'مشتريات' :
                       m.type === 'sale' ? 'مبيعات' :
                       m.type === 'inventory_count' ? 'تسوية جرد' :
                       m.type === 'manual_adjustment' ? 'تعديل يدوي' :
                       m.type === 'internal_use' ? 'صرف داخلي' : m.type}
                    </td>
                    <td className="p-4 text-center font-bold text-emerald-600">{m.quantityIn > 0 ? m.quantityIn : ''}</td>
                    <td className="p-4 text-center font-bold text-red-600">{m.quantityOut > 0 ? m.quantityOut : ''}</td>
                    <td className="p-4 text-center font-bold text-blue-600">{m.balanceAfter}</td>
                  </tr>
                ))}
                {filteredMovements.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-500">لا يوجد حركات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Inventory Count Modal */}
      {showAddCount && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg flex items-center gap-2"><CheckCircle size={20} className="text-primary"/> جرد المخزون</h3>
              <button onClick={() => setShowAddCount(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات الجرد</label>
                <input type="text" value={countNotes} onChange={e => setCountNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>
              
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-2">المنتج</th>
                    <th className="p-2 text-center">الرصيد الدفتري</th>
                    <th className="p-2 text-center">الرصيد الفعلي</th>
                    <th className="p-2 text-center">العجز / الزيادة</th>
                  </tr>
                </thead>
                <tbody>
                  {countItems.map((item, idx) => (
                    <tr key={item.productId} className="border-b border-slate-100">
                      <td className="p-2">{products.find(p => p.id === item.productId)?.name}</td>
                      <td className="p-2 text-center text-slate-600 font-bold">{item.expectedQuantity}</td>
                      <td className="p-2">
                        <input type="number" min="0" value={item.actualQuantity} onChange={e => handleActualQtyChange(idx, e.target.value)} className="w-24 mx-auto border border-slate-200 rounded p-1 text-center font-bold text-primary outline-none focus:border-primary" />
                      </td>
                      <td className={`p-2 text-center font-bold ${item.difference > 0 ? 'text-emerald-600' : item.difference < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button onClick={handleSaveCount} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary-dark transition-colors flex justify-center items-center gap-2">
                <Save size={18} /> حفظ واعتماد الجرد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
