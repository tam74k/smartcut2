import { useState, useMemo } from 'react';
import { AppSettings, PurchaseInvoice, Supplier, Product, Transaction, ItemMovement, PurchaseInvoiceItem } from '../types';
import { Plus, Trash2, Search, Printer, X, ShoppingCart } from 'lucide-react';

export function PurchasesScreen({
  settings,
  purchaseInvoices,
  setPurchaseInvoices,
  suppliers,
  setSuppliers,
  products,
  setProducts,
  itemMovements,
  setItemMovements,
  transactions,
  setTransactions,
  shiftData
}: {
  settings: AppSettings;
  purchaseInvoices: PurchaseInvoice[];
  setPurchaseInvoices: (p: PurchaseInvoice[]) => void;
  suppliers: Supplier[];
  setSuppliers: (s: Supplier[]) => void;
  products: Product[];
  setProducts: (p: Product[]) => void;
  itemMovements: ItemMovement[];
  setItemMovements: (im: ItemMovement[]) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  shiftData: { isOpen: boolean; date: string };
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Invoice Form State
  const [supplierId, setSupplierId] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [treasuryId, setTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [notes, setNotes] = useState('');
  
  // Product Search State
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [addCost, setAddCost] = useState(0);

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;
  const remaining = total - paidAmount;

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setAddCost(p.costPrice);
    setAddQty(1);
  };

  const handleAddItem = () => {
    if (!selectedProduct || addQty <= 0) return;
    const itemTotal = addQty * addCost;
    
    // Check if item exists in invoice
    const existingIdx = invoiceItems.findIndex(i => i.productId === selectedProduct.id);
    if (existingIdx >= 0) {
      const newItems = [...invoiceItems];
      newItems[existingIdx].quantity += addQty;
      newItems[existingIdx].costPrice = addCost;
      newItems[existingIdx].total = newItems[existingIdx].quantity * addCost;
      setInvoiceItems(newItems);
    } else {
      setInvoiceItems([...invoiceItems, { productId: selectedProduct.id, quantity: addQty, costPrice: addCost, total: itemTotal }]);
    }
    
    setSelectedProduct(null);
    setProductSearch('');
  };

  const handleRemoveItem = (idx: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== idx));
  };

  const handleSaveInvoice = () => {
    if (!supplierId || invoiceItems.length === 0) return;
    if (!shiftData.isOpen) {
      alert('الرجاء فتح الوردية لتسجيل المشتريات');
      return;
    }
    
    const invoiceId = 'PUR-' + Math.random().toString(36).substr(2, 9);
    
    const newInvoice: PurchaseInvoice = {
      id: invoiceId,
      supplierId,
      date: shiftData.date,
      items: invoiceItems,
      subtotal,
      discount,
      total,
      paid: paidAmount,
      remaining,
      treasuryId,
      notes
    };
    
    setPurchaseInvoices([...purchaseInvoices, newInvoice]);
    
    // Update supplier balance
    if (remaining > 0) {
      setSuppliers(suppliers.map(s => s.id === supplierId ? { ...s, currentBalance: s.currentBalance + remaining } : s));
    }
    
    // Update stock and item movements
    let updatedProducts = [...products];
    const newMovements: ItemMovement[] = [];
    
    invoiceItems.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (pIdx >= 0) {
        const prod = updatedProducts[pIdx];
        const newStock = prod.currentStock + item.quantity;
        // update cost price if you want to use latest or average. Here we just use latest
        updatedProducts[pIdx] = { ...prod, currentStock: newStock, costPrice: item.costPrice };
        
        newMovements.push({
          id: 'MOV-' + Math.random().toString(36).substr(2, 9),
          productId: item.productId,
          date: new Date().toISOString(),
          type: 'purchase',
          referenceId: invoiceId,
          quantityIn: item.quantity,
          quantityOut: 0,
          balanceAfter: newStock
        });
      }
    });
    
    setProducts(updatedProducts);
    setItemMovements([...itemMovements, ...newMovements]);
    
    // Create transaction if paid > 0
    if (paidAmount > 0) {
      setTransactions([...transactions, {
        id: 'TRX-' + Math.random().toString(36).substring(2,9),
        date: new Date().toISOString(),
        type: 'out',
        amount: paidAmount,
        category: 'purchase',
        treasury: treasuryId || settings.treasuries[0]?.id,
        description: `دفعة فاتورة مشتريات رقم ${invoiceId} ${notes ? '- ' + notes : ''}`
      }]);
    }

    setShowAddModal(false);
    setSupplierId('');
    setInvoiceItems([]);
    setDiscount(0);
    setPaidAmount(0);
    setNotes('');
  };

  const handleDeleteInvoice = (inv: PurchaseInvoice) => {
    
    
    setPurchaseInvoices(purchaseInvoices.filter(i => i.id !== inv.id));
    
    // Reverse supplier balance
    if (inv.remaining > 0) {
      setSuppliers(suppliers.map(s => s.id === inv.supplierId ? { ...s, currentBalance: s.currentBalance - inv.remaining } : s));
    }
    
    // Reverse stock
    let updatedProducts = [...products];
    inv.items.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (pIdx >= 0) {
        updatedProducts[pIdx] = { ...updatedProducts[pIdx], currentStock: updatedProducts[pIdx].currentStock - item.quantity };
      }
    });
    setProducts(updatedProducts);
    
    // Remove transaction if any
    const trxDesc = `دفعة فاتورة مشتريات رقم ${inv.id}`;
    setTransactions(transactions.filter(t => !t.description.includes(trxDesc)));
    
    // Remove item movements
    setItemMovements(itemMovements.filter(m => m.referenceId !== inv.id));
  };

  const filteredInvoices = purchaseInvoices.filter(i => i.id.includes(searchQuery) || suppliers.find(s => s.id === i.supplierId)?.name.includes(searchQuery));
  
  const productSearchResults = products.filter(p => p.name.includes(productSearch) || (p as any).barcode === productSearch);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">المشتريات</h1>
        <button onClick={() => setShowAddModal(true)} className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
          <ShoppingCart size={18} /> فاتورة مشتريات جديدة
        </button>
      </div>

      <div className="relative mb-6">
        <input type="text" placeholder="بحث برقم الفاتورة أو المورد..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary" />
        <Search className="absolute left-3 top-3 text-slate-400" size={20} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-700">رقم الفاتورة</th>
              <th className="p-4 font-bold text-slate-700">التاريخ</th>
              <th className="p-4 font-bold text-slate-700">المورد</th>
              <th className="p-4 font-bold text-slate-700 text-center">الإجمالي</th>
              <th className="p-4 font-bold text-slate-700 text-center">المدفوع</th>
              <th className="p-4 font-bold text-slate-700 text-center">المتبقي</th>
              <th className="p-4 font-bold text-slate-700 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(inv => (
              <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 text-slate-600">{inv.id}</td>
                <td className="p-4 text-slate-600">{inv.date}</td>
                <td className="p-4 font-bold text-slate-800">{suppliers.find(s => s.id === inv.supplierId)?.name}</td>
                <td className="p-4 text-center font-bold text-slate-800">{inv.total.toFixed(2)}</td>
                <td className="p-4 text-center font-bold text-emerald-600">{inv.paid.toFixed(2)}</td>
                <td className="p-4 text-center font-bold text-red-600">{inv.remaining.toFixed(2)}</td>
                <td className="p-4">
                  <div className="flex justify-center">
                    <button onClick={() => handleDeleteInvoice(inv)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">لا توجد فواتير مشتريات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg">فاتورة مشتريات جديدة</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex gap-6">
              {/* Items Section */}
              <div className="w-2/3 border-l border-slate-100 pl-6">
                <div className="mb-4 relative">
                  <label className="block text-sm font-bold text-slate-700 mb-1">البحث عن منتج (اسم أو باركود)</label>
                  <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="بحث..." className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                  
                  {productSearch && productSearchResults.length > 0 && !selectedProduct && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 shadow-lg rounded-lg mt-1 z-10 max-h-40 overflow-y-auto">
                      {productSearchResults.map(p => (
                        <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 flex justify-between">
                          <span className="font-bold text-sm">{p.name}</span>
                          <span className="text-xs text-slate-500">مخزون: {p.currentStock}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedProduct && (
                  <div className="bg-slate-50 p-3 rounded-lg mb-4 flex gap-3 items-end">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-primary">{selectedProduct.name}</p>
                    </div>
                    <div className="w-20">
                      <label className="block text-xs font-bold text-slate-600 mb-1">الكمية</label>
                      <input type="number" min="1" value={addQty} onChange={e => setAddQty(Number(e.target.value))} className="w-full border border-slate-200 rounded p-1 text-center outline-none" />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-bold text-slate-600 mb-1">سعر الشراء</label>
                      <input type="number" min="0" value={addCost} onChange={e => setAddCost(Number(e.target.value))} className="w-full border border-slate-200 rounded p-1 text-center outline-none" />
                    </div>
                    <button onClick={handleAddItem} className="bg-primary text-white p-2 rounded hover:bg-primary-dark"><Plus size={16}/></button>
                  </div>
                )}
                
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2">المنتج</th>
                      <th className="p-2">الكمية</th>
                      <th className="p-2">السعر</th>
                      <th className="p-2">الإجمالي</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="p-2">{products.find(p => p.id === item.productId)?.name}</td>
                        <td className="p-2">{item.quantity}</td>
                        <td className="p-2">{item.costPrice.toFixed(2)}</td>
                        <td className="p-2 font-bold">{item.total.toFixed(2)}</td>
                        <td className="p-2 text-left">
                          <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Payment Section */}
              <div className="w-1/3 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">المورد</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                    <option value="">اختر المورد...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">الإجمالي قبل الخصم:</span>
                    <span className="font-bold">{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-slate-600">الخصم:</span>
                    <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-20 border border-slate-200 rounded p-1 text-center" />
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2 text-primary">
                    <span>الصافي:</span>
                    <span>{total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">المدفوع الان</label>
                  <input type="number" min="0" max={total} value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                
                <div className="flex justify-between text-sm font-bold text-red-600 bg-red-50 p-2 rounded">
                  <span>المتبقي (آجل):</span>
                  <span>{remaining.toFixed(2)}</span>
                </div>
                
                {paidAmount > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">خزينة الدفع</label>
                    <select value={treasuryId} onChange={e => setTreasuryId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                      {settings.treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
                
                <button onClick={handleSaveInvoice} disabled={!supplierId || invoiceItems.length === 0} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50">
                  حفظ الفاتورة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
