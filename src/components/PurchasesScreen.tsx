import { DB } from '../services/db';
import { AuthService } from '../services/auth';
import { useState, useMemo } from 'react';
import { AppSettings, PurchaseInvoice, Supplier, Product, Transaction, ItemMovement, PurchaseInvoiceItem } from '../types';
import { 
  Plus, 
  Trash2, 
  Search, 
  Printer, 
  X, 
  ShoppingCart, 
  QrCode, 
  Eye, 
  Edit3, 
  Bookmark, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText
} from 'lucide-react';
import { getEffectiveDateTime } from '../utils/shiftDate';
import { printHtml } from '../utils/print';

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
  shiftData,
  activeBranchId,
  branches = [],
  currentUser
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
  shiftData: { isOpen: boolean; date: string; id?: string; shiftCode?: string; code?: string };
  activeBranchId?: string;
  branches?: any[];
  currentUser?: any;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'draft'>('all');
  
  // Invoice Form State
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | string>('cash');
  const [treasuryId, setTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [notes, setNotes] = useState('');

  // Modals state
  const [previewInvoice, setPreviewInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteModalInvoice, setDeleteModalInvoice] = useState<PurchaseInvoice | null>(null);

  const resetForm = () => {
    setEditingInvoiceId(null);
    setSupplierId('');
    setInvoiceItems([]);
    setDiscount(0);
    setPaidAmount(0);
    setPaymentMethod('cash');
    setTreasuryId(settings.treasuries[0]?.id || '');
    setNotes('');
    setSelectedProduct(null);
    setProductSearch('');
    setAddQty(1);
    setAddCost(0);
  };

  const handleTreasuryChange = (tId: string) => {
    setTreasuryId(tId);
    const t = settings.treasuries.find(x => x.id === tId);
    const tName = (t?.name || '').toLowerCase();
    if (tId === 'cash' || tName.includes('كاش') || tName.includes('درج')) {
      setPaymentMethod('cash');
    } else if (tId === 'card' || tName.includes('فيزا') || tName.includes('شبكة') || tName.includes('مدى')) {
      setPaymentMethod('card');
    } else if (tId === 'transfer' || tId === 'instapay' || tId === 'vodafone_cash' || tName.includes('تحويل') || tName.includes('انستا') || tName.includes('كاش')) {
      setPaymentMethod('transfer');
    }
  };
  
  // Product Search State
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [addCost, setAddCost] = useState(0);

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - discount);
  const remaining = Math.max(0, total - paidAmount);

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
    const item = invoiceItems[idx];
    const pName = products.find(p => p.id === item?.productId)?.name || 'هذا الصنف';
    if (!window.confirm(`هل أنت متأكد من إزالة (${pName}) من الفاتورة؟`)) return;
    setInvoiceItems(invoiceItems.filter((_, i) => i !== idx));
  };

  // 1. SAVE AS DRAFT / HOLD (بدون أي أثر مالي أو مخزني)
  const handleSaveDraftInvoice = () => {
    if (!supplierId) {
      alert('الرجاء اختيار المورد لتعليق الفاتورة كمسودة.');
      return;
    }
    if (invoiceItems.length === 0) {
      alert('الرجاء إضافة صنف واحد على الأقل للفاتورة.');
      return;
    }

    const invoiceId = editingInvoiceId || ('PUR-' + Math.random().toString(36).substr(2, 9));
    const selectedTreasuryObj = settings.treasuries.find(t => t.id === treasuryId) || settings.treasuries[0];
    const targetTreasuryId = selectedTreasuryObj?.id || treasuryId || 'main';

    const draftInvoice: PurchaseInvoice = {
      id: invoiceId,
      salonId: settings.salonId,
      branchId: activeBranchId,
      supplierId,
      date: shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0],
      items: invoiceItems,
      subtotal,
      discount,
      total,
      paid: paidAmount,
      remaining,
      treasuryId: targetTreasuryId,
      paymentMethod: paymentMethod || 'cash',
      notes,
      status: 'draft',
      isDraft: true
    };

    if (editingInvoiceId) {
      setPurchaseInvoices(purchaseInvoices.map(p => p.id === editingInvoiceId ? draftInvoice : p));
    } else {
      setPurchaseInvoices([...purchaseInvoices, draftInvoice]);
    }
    DB.savePurchaseInvoice(draftInvoice, settings.salonId);

    setShowAddModal(false);
    resetForm();
  };

  // 2. SAVE AND FINALIZE (مع تطبيق الأثر المالي والمخزني الكامل)
  const handleFinalizeInvoice = () => {
    if (!supplierId || invoiceItems.length === 0) return;
    if (!shiftData.isOpen) {
      alert('الرجاء فتح الوردية لتسجيل واعتماد فاتورة المشتريات.');
      return;
    }
    
    const invoiceId = editingInvoiceId || ('PUR-' + Math.random().toString(36).substr(2, 9));
    const selectedTreasuryObj = settings.treasuries.find(t => t.id === treasuryId) || settings.treasuries[0];
    const targetTreasuryId = selectedTreasuryObj?.id || treasuryId || 'main';
    const targetTreasuryName = selectedTreasuryObj?.name || 'الخزينة';
    const supplierObj = suppliers.find(s => s.id === supplierId);
    const supplierName = supplierObj?.name || 'مورد';
    const activeBranch = (branches || []).find(b => b.id === activeBranchId);

    const completedInvoice: PurchaseInvoice = {
      id: invoiceId,
      salonId: settings.salonId,
      branchId: activeBranchId,
      supplierId,
      date: shiftData.date,
      items: invoiceItems,
      subtotal,
      discount,
      total,
      paid: paidAmount,
      remaining,
      treasuryId: targetTreasuryId,
      paymentMethod: paymentMethod || 'cash',
      notes,
      status: 'completed',
      isDraft: false
    };
    
    if (editingInvoiceId) {
      setPurchaseInvoices(purchaseInvoices.map(p => p.id === editingInvoiceId ? completedInvoice : p));
    } else {
      setPurchaseInvoices([...purchaseInvoices, completedInvoice]);
    }
    DB.savePurchaseInvoice(completedInvoice, settings.salonId);
    
    // Update supplier balance
    if (remaining > 0) {
      setSuppliers(suppliers.map(s => s.id === supplierId ? { ...s, currentBalance: (s.currentBalance || 0) + remaining } : s));
    }
    
    // Update stock and item movements
    let updatedProducts = [...products];
    const newMovements: ItemMovement[] = [];
    
    invoiceItems.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (pIdx >= 0) {
        const prod = updatedProducts[pIdx];
        const newStock = prod.currentStock + item.quantity;
        const curBranchStocks = { ...(prod.branchStocks || {}) };
        const branchCurStock = (activeBranchId && curBranchStocks[activeBranchId] !== undefined)
          ? curBranchStocks[activeBranchId]
          : prod.currentStock;
        const newBranchStock = branchCurStock + item.quantity;
        if (activeBranchId) {
          curBranchStocks[activeBranchId] = newBranchStock;
        }

        updatedProducts[pIdx] = { 
          ...prod, 
          currentStock: newStock, 
          branchStocks: curBranchStocks,
          costPrice: item.costPrice 
        };
        
        newMovements.push({
          id: 'MOV-' + Math.random().toString(36).substr(2, 9),
          productId: item.productId,
          date: getEffectiveDateTime(shiftData),
          type: 'purchase',
          referenceId: invoiceId,
          quantityIn: item.quantity,
          quantityOut: 0,
          balanceAfter: newBranchStock,
          branchId: activeBranchId
        });
      }
    });
    
    setProducts(updatedProducts);
    setItemMovements([...itemMovements, ...newMovements]);
    
    // Create transaction if paid > 0 (خصم المبلغ المسدد مباشرة من الخزينة المختارة وتسجيل حركة الصرف)
    if (paidAmount > 0) {
      const activeUser = currentUser || AuthService.getCurrentUser();
      const actorName = activeUser?.name || activeUser?.username || 'المسؤول';
      const purTrx: Transaction = {
        id: 'TRX-' + Math.random().toString(36).substring(2,9),
        salonId: settings.salonId,
        branchId: activeBranchId,
        branchCode: activeBranch?.code,
        date: getEffectiveDateTime(shiftData),
        shiftDate: shiftData.isOpen ? shiftData.date : undefined,
        shiftId: shiftData.isOpen ? shiftData.id : undefined,
        shiftCode: shiftData.isOpen ? (shiftData.shiftCode || shiftData.code) : undefined,
        type: 'out',
        amount: paidAmount,
        category: 'purchase',
        expenseCategory: 'مشتريات',
        treasury: targetTreasuryId,
        treasuryId: targetTreasuryId,
        treasuryName: targetTreasuryName,
        paymentMethod: paymentMethod || 'cash',
        payment_method: paymentMethod || 'cash',
        description: `سداد فاتورة مشتريات رقم ${invoiceId} (${supplierName}) ${notes ? '- ' + notes : ''}`.trim(),
        createdBy: actorName,
        userName: actorName,
        userId: activeUser?.id
      };
      setTransactions([...transactions, purTrx]);
      DB.saveTransaction(purTrx, settings.salonId);
    }

    setShowAddModal(false);
    resetForm();
  };

  // 3. EDIT DRAFT INVOICE
  const handleEditDraft = (inv: PurchaseInvoice) => {
    setEditingInvoiceId(inv.id);
    setSupplierId(inv.supplierId);
    setInvoiceItems(inv.items || []);
    setDiscount(inv.discount || 0);
    setPaidAmount(inv.paid || 0);
    setPaymentMethod(inv.paymentMethod || 'cash');
    setTreasuryId(inv.treasuryId || settings.treasuries[0]?.id || '');
    setNotes(inv.notes || '');
    setShowAddModal(true);
  };

  // 4. CONFIRM DELETE INVOICE
  const handleConfirmDelete = async () => {
    if (!deleteModalInvoice) return;
    const inv = deleteModalInvoice;
    const isDraft = inv.status === 'draft' || inv.status === 'held' || inv.isDraft;

    // 1. Remove from purchase invoices state & DB
    setPurchaseInvoices(purchaseInvoices.filter(i => i.id !== inv.id));
    await DB.deletePurchaseInvoice(inv.id);
    
    // 2. Only if the invoice was COMPLETED do we reverse stock, balance, and transactions!
    if (!isDraft) {
      // Reverse supplier balance
      if (inv.remaining > 0) {
        setSuppliers(suppliers.map(s => s.id === inv.supplierId ? { ...s, currentBalance: Math.max(0, s.currentBalance - inv.remaining) } : s));
      }
      
      // Reverse stock
      let updatedProducts = [...products];
      inv.items.forEach(item => {
        const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
        if (pIdx >= 0) {
          const prod = updatedProducts[pIdx];
          const newStock = Math.max(0, prod.currentStock - item.quantity);
          const curBranchStocks = { ...(prod.branchStocks || {}) };
          if (inv.branchId && curBranchStocks[inv.branchId] !== undefined) {
            curBranchStocks[inv.branchId] = Math.max(0, curBranchStocks[inv.branchId] - item.quantity);
          }
          updatedProducts[pIdx] = { 
            ...prod, 
            currentStock: newStock, 
            branchStocks: curBranchStocks
          };
        }
      });
      setProducts(updatedProducts);
      
      // Remove transaction if any
      const trxDesc = `فاتورة مشتريات رقم ${inv.id}`;
      const toRemoveTrx = transactions.filter(t => (t.description || '').includes(trxDesc) || (t as any).referenceId === inv.id);
      toRemoveTrx.forEach(t => DB.remove('transactions', t.id));
      setTransactions(transactions.filter(t => !(t.description || '').includes(trxDesc) && (t as any).referenceId !== inv.id));
      
      // Remove item movements
      setItemMovements(itemMovements.filter(m => m.referenceId !== inv.id));
    }

    setDeleteModalInvoice(null);
  };

  // 5. REPRINT PURCHASE INVOICE
  const handlePrintInvoice = (inv: PurchaseInvoice) => {
    const isDraft = inv.status === 'draft' || inv.status === 'held' || inv.isDraft;
    const supplierObj = suppliers.find(s => s.id === inv.supplierId);
    const supplierName = supplierObj?.name || 'مورد عام';
    const supplierPhone = supplierObj?.phone || '';
    const activeBranch = branches.find(b => b.id === (inv.branchId || activeBranchId));
    const branchName = activeBranch?.name || settings.salonName || 'الفرع الرئيسي';
    const treasuryObj = settings.treasuries.find(t => t.id === inv.treasuryId);
    const treasuryName = treasuryObj?.name || (inv.treasuryId === 'main' ? 'الخزينة الرئيسية' : (inv.treasuryId === 'cash' ? 'كاش الدرج' : inv.treasuryId));
    const currency = settings.currency || 'ر.س';

    const itemsRows = (inv.items || []).map((item) => {
      const prod = products.find(p => p.id === item.productId);
      const pName = prod?.name || item.productId;
      const barcode = prod?.barcode ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">${prod.barcode}</div>` : '';
      return `
        <tr style="border-bottom: 1px dashed #cbd5e1;">
          <td style="padding: 6px 4px; text-align: right;">
            <div style="font-weight: bold; font-size: 12px; color: #0f172a;">${pName}</div>
            ${barcode}
          </td>
          <td style="padding: 6px 4px; text-align: center; font-weight: bold; font-size: 12px;">${item.quantity}</td>
          <td style="padding: 6px 4px; text-align: center; font-size: 12px;">${item.costPrice.toFixed(2)}</td>
          <td style="padding: 6px 4px; text-align: left; font-weight: bold; font-size: 12px;">${item.total.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; color: #0f172a; padding: 10px; max-width: 80mm; margin: 0 auto; font-size: 12px; line-height: 1.4;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 10px;">
          ${settings.logo ? `<img src="${settings.logo}" style="max-height: 48px; margin-bottom: 6px; object-fit: contain;" alt="Logo" />` : ''}
          <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">${settings.salonName || 'SmartCut'}</h2>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">${branchName}</div>
          ${settings.phone ? `<div style="font-size: 10px; color: #64748b;">هاتف: ${settings.phone}</div>` : ''}
          
          <div style="margin-top: 8px; display: inline-block; padding: 3px 12px; border-radius: 6px; font-weight: 800; font-size: 13px; ${isDraft ? 'background: #fef3c7; color: #92400e; border: 1px dashed #d97706;' : 'background: #0f172a; color: #ffffff;'}">
            ${isDraft ? '⚠️ مسودة فاتورة مشتريات (معلقة)' : 'سند استلام / فاتورة مشتريات'}
          </div>
        </div>

        <!-- Meta -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">رقم الفاتورة:</span>
            <span style="font-weight: bold; font-family: monospace;">${inv.id}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">التاريخ:</span>
            <span style="font-weight: bold;">${inv.date}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">المورد:</span>
            <span style="font-weight: bold;">${supplierName}</span>
          </div>
          ${supplierPhone ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">هاتف المورد:</span>
            <span>${supplierPhone}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">حالة الفاتورة:</span>
            <span style="font-weight: bold; ${isDraft ? 'color: #d97706;' : 'color: #059669;'}">${isDraft ? 'مسودة غير معتمدة' : 'معتمدة ومدرجة بالمخزون'}</span>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1.5px solid #0f172a; background: #f1f5f9;">
              <th style="padding: 5px 4px; text-align: right;">الصنف</th>
              <th style="padding: 5px 4px; text-align: center;">الكمية</th>
              <th style="padding: 5px 4px; text-align: center;">السعر</th>
              <th style="padding: 5px 4px; text-align: left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; margin-bottom: 10px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: #475569;">المجموع قبل الخصم:</span>
            <span style="font-weight: bold;">${inv.subtotal.toFixed(2)} ${currency}</span>
          </div>
          ${inv.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #dc2626;">
            <span>الخصم:</span>
            <span style="font-weight: bold;">- ${inv.discount.toFixed(2)} ${currency}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 5px 0; margin: 4px 0;">
            <span>الصافي المطلوب:</span>
            <span>${inv.total.toFixed(2)} ${currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #059669;">
            <span>المدفوع:</span>
            <span style="font-weight: bold;">${inv.paid.toFixed(2)} ${currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: ${inv.remaining > 0 ? '#dc2626' : '#475569'};">
            <span>المتبقي (آجل للمورد):</span>
            <span style="font-weight: bold;">${inv.remaining.toFixed(2)} ${currency}</span>
          </div>
          ${inv.paid > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 4px;">
            <span>الخزينة المخصوم منها:</span>
            <span>${treasuryName}</span>
          </div>` : ''}
        </div>

        ${inv.notes ? `
        <div style="background: #f8fafc; border-right: 3px solid #64748b; padding: 6px 8px; font-size: 10px; color: #334155; margin-bottom: 10px;">
          <strong>ملاحظات:</strong> ${inv.notes}
        </div>` : ''}

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 14px; font-size: 10px; color: #475569; text-align: center;">
          <div style="width: 45%;">
            <div style="border-top: 1px dashed #94a3b8; padding-top: 4px;">توقيع مسؤول المشتريات</div>
          </div>
          <div style="width: 45%;">
            <div style="border-top: 1px dashed #94a3b8; padding-top: 4px;">توقيع واستلام المورد</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 12px; border-top: 1px dotted #cbd5e1; padding-top: 6px;">
          طُبع بواسطة المنظومة في ${new Date().toLocaleString('ar-EG')}
        </div>
      </div>
    `;

    printHtml(html, `فاتورة مشتريات ${inv.id}`, '80mm');
  };

  const normalizeText = (text: string) => {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  };

  const productSearchResults = useMemo(() => {
    const q = normalizeText(productSearch);
    if (!q) return [];
    return products.filter(p => 
      normalizeText(p.name).includes(q) || 
      (p.barcode && p.barcode.toLowerCase().trim().includes(productSearch.toLowerCase().trim()))
    );
  }, [products, productSearch]);

  const draftCount = useMemo(() => {
    return purchaseInvoices.filter(i => i.status === 'draft' || i.status === 'held' || i.isDraft).length;
  }, [purchaseInvoices]);

  const completedCount = useMemo(() => {
    return purchaseInvoices.filter(i => i.status !== 'draft' && i.status !== 'held' && !i.isDraft).length;
  }, [purchaseInvoices]);

  const filteredInvoices = useMemo(() => {
    return purchaseInvoices.filter(i => {
      // 1. Status Filter
      const isDraft = i.status === 'draft' || i.status === 'held' || i.isDraft;
      if (statusFilter === 'draft' && !isDraft) return false;
      if (statusFilter === 'completed' && isDraft) return false;

      // 2. Search Filter
      if (searchQuery.trim()) {
        const q = normalizeText(searchQuery);
        const matchesId = i.id.toLowerCase().includes(q);
        const supName = suppliers.find(s => s.id === i.supplierId)?.name || '';
        const matchesSupplier = normalizeText(supName).includes(q);
        const matchesNotes = i.notes ? normalizeText(i.notes).includes(q) : false;
        return matchesId || matchesSupplier || matchesNotes;
      }

      return true;
    });
  }, [purchaseInvoices, statusFilter, searchQuery, suppliers]);

  return (
    <div className="p-3 sm:p-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ShoppingCart className="text-primary" size={26} />
            <span>فواتير المشتريات والتوريد</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            إدارة فواتير شراء وتوريد البضائع والمستلزمات، تعليق المسودات، واعتماد المخزون
          </p>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }} 
          className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md shadow-primary/20 transition-all transform active:scale-98 text-sm"
        >
          <Plus size={18} />
          <span>فاتورة مشتريات جديدة</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="بحث برقم الفاتورة، اسم المورد، أو الملاحظات..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm shadow-xs bg-white" 
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold self-start md:self-auto shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              statusFilter === 'all' 
                ? 'bg-white text-slate-800 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({purchaseInvoices.length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              statusFilter === 'completed' 
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>المعتمدة ({completedCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              statusFilter === 'draft' 
                ? 'bg-white text-amber-800 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={13} className="text-amber-600" />
            <span>المسودات والمعلقة ({draftCount})</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-right min-w-[850px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3.5 font-bold text-slate-700 whitespace-nowrap text-xs">رقم الفاتورة</th>
                <th className="p-3.5 font-bold text-slate-700 whitespace-nowrap text-xs">التاريخ</th>
                <th className="p-3.5 font-bold text-slate-700 whitespace-nowrap text-xs">المورد</th>
                <th className="p-3.5 font-bold text-slate-700 text-center whitespace-nowrap text-xs">الحالة</th>
                <th className="p-3.5 font-bold text-slate-700 text-center whitespace-nowrap text-xs">الإجمالي</th>
                <th className="p-3.5 font-bold text-slate-700 text-center whitespace-nowrap text-xs">المدفوع</th>
                <th className="p-3.5 font-bold text-slate-700 text-center whitespace-nowrap text-xs">الخزينة المخصوم منها</th>
                <th className="p-3.5 font-bold text-slate-700 text-center whitespace-nowrap text-xs">المتبقي (آجل)</th>
                <th className="p-3.5 font-bold text-slate-700 text-center whitespace-nowrap text-xs">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredInvoices.map(inv => {
                const isDraft = inv.status === 'draft' || inv.status === 'held' || inv.isDraft;
                const treasuryObj = settings.treasuries.find(t => t.id === inv.treasuryId);
                const treasuryDisplay = treasuryObj?.name || (inv.treasuryId === 'main' ? 'الخزينة الرئيسية' : (inv.treasuryId === 'cash' ? 'كاش الدرج' : inv.treasuryId));
                const supplierName = suppliers.find(s => s.id === inv.supplierId)?.name || 'مورد غير محدد';

                return (
                  <tr 
                    key={inv.id} 
                    className={`transition-colors ${
                      isDraft 
                        ? 'bg-amber-50/40 hover:bg-amber-50/70' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-3.5 text-slate-700 whitespace-nowrap font-mono font-bold">
                      {inv.id}
                    </td>
                    <td className="p-3.5 text-slate-600 whitespace-nowrap text-xs">
                      {inv.date}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800 whitespace-nowrap">
                      {supplierName}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {isDraft ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock size={11} />
                          <span>مسودة / معلقة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 size={11} />
                          <span>معتمدة</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-800 whitespace-nowrap">
                      {inv.total.toFixed(2)} {settings.currency}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="font-bold text-emerald-600">{inv.paid.toFixed(2)}</div>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {inv.paid > 0 ? (
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {treasuryDisplay}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-bold text-red-600 whitespace-nowrap">
                      {inv.remaining > 0 ? `${inv.remaining.toFixed(2)} ${settings.currency}` : '0.00'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* معاينة محتويات الفاتورة */}
                        <button 
                          onClick={() => setPreviewInvoice(inv)} 
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="معاينة محتويات الفاتورة"
                        >
                          <Eye size={17} />
                        </button>

                        {/* إعادة طباعة الفاتورة */}
                        <button 
                          onClick={() => handlePrintInvoice(inv)} 
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                          title="إعادة طباعة الفاتورة"
                        >
                          <Printer size={17} />
                        </button>

                        {/* استئناف وتعديل (إذا كانت مسودة) */}
                        {isDraft && (
                          <button 
                            onClick={() => handleEditDraft(inv)} 
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition-colors"
                            title="استئناف وتعديل المسودة"
                          >
                            <Edit3 size={17} />
                          </button>
                        )}

                        {/* حذف الفاتورة مع نافذة تأكيد */}
                        <button 
                          onClick={() => setDeleteModalInvoice(inv)} 
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          title="حذف الفاتورة"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 text-sm">
                    {searchQuery ? 'لا توجد فواتير تطابق معايير البحث' : 'لا توجد فواتير مشتريات مسجلة في هذا القسم'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. ADD / EDIT INVOICE MODAL (With Draft/Hold Support) */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-800">
                    {editingInvoiceId ? 'استئناف وتعديل مسودة فاتورة مشتريات' : 'فاتورة مشتريات وتوريد جديدة'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingInvoiceId ? `رقم المسودة: ${editingInvoiceId}` : 'إدخال أصناف البضاعة وحساب المورد والمخزون'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }} 
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6">
              {/* Items Section (Left in RTL, Right in LTR) */}
              <div className="md:w-3/5 border-b md:border-b-0 md:border-l border-slate-200 pb-4 md:pb-0 md:pl-6">
                <div className="mb-4 relative">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <QrCode size={15} className="text-primary" />
                    <span>البحث عن منتج (بالاسم أو مسح الباركود)</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={productSearch} 
                      onChange={e => {
                        const val = e.target.value;
                        setProductSearch(val);
                        const code = val.trim().toLowerCase();
                        if (code) {
                          const exact = products.find(p => p.barcode && p.barcode.trim().toLowerCase() === code);
                          if (exact) {
                            handleSelectProduct(exact);
                            setProductSearch('');
                          }
                        }
                      }} 
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const code = productSearch.trim().toLowerCase();
                          if (!code) return;
                          const exact = products.find(p => 
                            (p.barcode && p.barcode.trim().toLowerCase() === code) || 
                            normalizeText(p.name) === normalizeText(code)
                          ) || (productSearchResults.length === 1 ? productSearchResults[0] : null);
                          if (exact) {
                            handleSelectProduct(exact);
                            setProductSearch('');
                          }
                        }
                      }}
                      placeholder="ابحث باسم المنتج أو امسح الباركود..." 
                      className="w-full border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:border-primary text-xs sm:text-sm bg-slate-50 focus:bg-white transition-all" 
                    />
                    <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  
                  {/* Search Dropdown */}
                  {productSearch && productSearchResults.length > 0 && !selectedProduct && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 shadow-2xl rounded-2xl mt-1 z-30 max-h-56 overflow-y-auto">
                      {productSearchResults.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => {
                            handleSelectProduct(p);
                            setProductSearch('');
                          }} 
                          className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-bold text-xs sm:text-sm text-slate-800">{p.name}</span>
                            {p.barcode && (
                              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 mt-0.5">
                                <QrCode size={11} className="text-slate-400" />
                                <span>{p.barcode}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">مخزون: {p.currentStock}</span>
                            <span className="font-bold text-primary">{p.costPrice.toFixed(2)} {settings.currency}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Selected Product Adding Box */}
                {selectedProduct && (
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl mb-4 flex flex-wrap gap-3 items-end animate-in fade-in">
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-bold text-xs sm:text-sm text-primary truncate">{selectedProduct.name}</p>
                      {selectedProduct.barcode && (
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                          <QrCode size={10} className="text-slate-400" />
                          {selectedProduct.barcode}
                        </span>
                      )}
                    </div>
                    <div className="w-20">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">الكمية</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={addQty} 
                        onChange={e => setAddQty(Math.max(1, Number(e.target.value)))} 
                        className="w-full border border-slate-300 rounded-lg p-1.5 text-center text-xs font-bold outline-none focus:border-primary" 
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">سعر الشراء</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={addCost} 
                        onChange={e => setAddCost(Number(e.target.value))} 
                        className="w-full border border-slate-300 rounded-lg p-1.5 text-center text-xs font-bold outline-none focus:border-primary font-mono" 
                      />
                    </div>
                    <button 
                      onClick={handleAddItem} 
                      className="bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1 text-xs shadow-xs transition-all"
                    >
                      <Plus size={15}/>
                      <span>إضافة</span>
                    </button>
                  </div>
                )}
                
                {/* Invoice Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2.5">المنتج</th>
                        <th className="p-2.5 text-center">الكمية</th>
                        <th className="p-2.5 text-center">سعر الوحدة</th>
                        <th className="p-2.5 text-center">الإجمالي</th>
                        <th className="p-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceItems.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5">
                              <div className="font-bold text-slate-800">{prod?.name || item.productId}</div>
                              {prod?.barcode && (
                                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                  <QrCode size={9} className="text-slate-400" />
                                  <span>{prod.barcode}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-700">{item.quantity}</td>
                            <td className="p-2.5 text-center font-mono">{item.costPrice.toFixed(2)}</td>
                            <td className="p-2.5 text-center font-bold font-mono text-slate-900">{item.total.toFixed(2)}</td>
                            <td className="p-2.5 text-left">
                              <button 
                                onClick={() => handleRemoveItem(idx)} 
                                className="w-6 h-6 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                              >
                                <X size={14}/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {invoiceItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            لم يتم إضافة أي أصناف بعد. ابحث عن منتج أعلاه وأضفه للفاتورة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Payment & Summary Section */}
              <div className="md:w-2/5 space-y-4">
                {/* Supplier Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">المورد *</label>
                  <select 
                    value={supplierId} 
                    onChange={e => setSupplierId(e.target.value)} 
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-primary bg-slate-50 focus:bg-white transition-all"
                  >
                    <option value="">اختر المورد...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                
                {/* Financial Summary Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">الإجمالي قبل الخصم:</span>
                    <span className="font-bold font-mono">{subtotal.toFixed(2)} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-slate-600">الخصم:</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.01"
                      value={discount} 
                      onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} 
                      className="w-24 border border-slate-300 rounded-lg p-1 text-center font-bold text-xs outline-none focus:border-primary font-mono" 
                    />
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-black border-t border-slate-200 pt-2 text-primary">
                    <span>الصافي المطلوب:</span>
                    <span className="font-mono">{total.toFixed(2)} {settings.currency}</span>
                  </div>
                </div>
                
                {/* Paid Now */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">المدفوع الآن</label>
                  <input 
                    type="number" 
                    min="0" 
                    max={total} 
                    step="0.01"
                    value={paidAmount} 
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value));
                      setPaidAmount(val);
                      if (val > 0 && !treasuryId) {
                        setTreasuryId(settings.treasuries[0]?.id || 'main');
                      }
                    }} 
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary font-mono font-bold text-xs sm:text-sm bg-slate-50 focus:bg-white" 
                  />
                </div>
                
                {/* Remaining Amount */}
                <div className="flex justify-between text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                  <span>المتبقي (آجل على الحساب):</span>
                  <span className="font-mono">{remaining.toFixed(2)} {settings.currency}</span>
                </div>
                
                {/* Treasury Selection if Paid > 0 */}
                {paidAmount > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700">خزينة السحب والخصم</label>
                    <select 
                      value={treasuryId} 
                      onChange={e => handleTreasuryChange(e.target.value)} 
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-primary"
                    >
                      {settings.treasuries.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.isMain ? '(الرئيسية)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      عند الاعتماد سيتم خصم ({paidAmount.toFixed(2)} {settings.currency}) فوراً من هذه الخزينة.
                    </p>
                  </div>
                )}
                
                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات الفاتورة</label>
                  <input 
                    type="text" 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="أي ملاحظات إضافية على الفاتورة..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary bg-slate-50 focus:bg-white" 
                  />
                </div>
                
                {/* Dual Buttons: Draft / Hold VS Finalize */}
                <div className="pt-2 space-y-2">
                  {/* Button 1: Save & Finalize */}
                  <button 
                    onClick={handleFinalizeInvoice} 
                    disabled={!supplierId || invoiceItems.length === 0} 
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-xl shadow-md text-xs sm:text-sm flex items-center justify-center gap-2 transition-all transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 size={16} />
                    <span>حفظ واعتماد الفاتورة نهائياً</span>
                  </button>

                  {/* Button 2: Save as Draft / Hold */}
                  <button 
                    onClick={handleSaveDraftInvoice} 
                    disabled={!supplierId || invoiceItems.length === 0} 
                    className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Bookmark size={15} />
                    <span>تعليق الفاتورة / حفظ كمسودة (بدون أثر مالي أو مخزني)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PREVIEW INVOICE MODAL (معاينة محتويات الفاتورة) */}
      {/* ======================================================== */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Eye size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg text-slate-800">
                      معاينة فاتورة مشتريات
                    </h3>
                    {previewInvoice.status === 'draft' || previewInvoice.isDraft ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        مسودة / معلقة
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        معتمدة
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    رقم الفاتورة: {previewInvoice.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewInvoice(null)} 
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">التاريخ:</span>
                  <span className="text-xs font-bold text-slate-800">{previewInvoice.date}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">المورد:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {suppliers.find(s => s.id === previewInvoice.supplierId)?.name || 'غير محدد'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">الخزينة المخصومة:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {settings.treasuries.find(t => t.id === previewInvoice.treasuryId)?.name || 'الرئيسية'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">طريقة الدفع:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {previewInvoice.paymentMethod === 'card' ? 'بطاقة / شبكة' : (previewInvoice.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'كاش نقدي')}
                  </span>
                </div>
              </div>

              {/* Notes if any */}
              {previewInvoice.notes && (
                <div className="bg-amber-50/50 border border-amber-200/60 p-3 rounded-xl text-xs text-amber-900">
                  <span className="font-bold">ملاحظات: </span>
                  <span>{previewInvoice.notes}</span>
                </div>
              )}

              {/* Items List */}
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <FileText size={16} className="text-slate-500" />
                  <span>الأصناف والمحتويات المشتراة</span>
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">اسم المنتج / الصنف</th>
                        <th className="p-3 text-center">الكمية</th>
                        <th className="p-3 text-center">سعر الشراء</th>
                        <th className="p-3 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(previewInvoice.items || []).map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <span className="font-bold text-slate-800">{prod?.name || item.productId}</span>
                              {prod?.barcode && (
                                <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                                  {prod.barcode}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700">{item.quantity}</td>
                            <td className="p-3 text-center font-mono">{item.costPrice.toFixed(2)}</td>
                            <td className="p-3 text-center font-bold font-mono text-slate-900">{item.total.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                  <span className="text-[11px] text-slate-500 block mb-1">المجموع:</span>
                  <span className="font-bold text-xs sm:text-sm font-mono text-slate-800">
                    {previewInvoice.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                  <span className="text-[11px] text-slate-500 block mb-1">الخصم:</span>
                  <span className="font-bold text-xs sm:text-sm font-mono text-red-600">
                    {previewInvoice.discount > 0 ? `-${previewInvoice.discount.toFixed(2)}` : '0.00'}
                  </span>
                </div>
                <div className="p-2 bg-indigo-50/80 rounded-xl border border-indigo-200/60">
                  <span className="text-[11px] text-indigo-700 block mb-1">الصافي:</span>
                  <span className="font-black text-xs sm:text-sm font-mono text-indigo-900">
                    {previewInvoice.total.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 bg-emerald-50/80 rounded-xl border border-emerald-200/60">
                  <span className="text-[11px] text-emerald-700 block mb-1">المدفوع:</span>
                  <span className="font-black text-xs sm:text-sm font-mono text-emerald-800">
                    {previewInvoice.paid.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 bg-red-50/80 rounded-xl border border-red-200/60 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-red-700 block mb-1">المتبقي:</span>
                  <span className="font-black text-xs sm:text-sm font-mono text-red-800">
                    {previewInvoice.remaining.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => handlePrintInvoice(previewInvoice)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Printer size={15} />
                <span>طباعة الفاتورة</span>
              </button>

              {(previewInvoice.status === 'draft' || previewInvoice.isDraft) && (
                <button
                  onClick={() => {
                    const toEdit = previewInvoice;
                    setPreviewInvoice(null);
                    handleEditDraft(toEdit);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Edit3 size={15} />
                  <span>استئناف وتعديل المسودة</span>
                </button>
              )}

              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CONFIRM DELETE MODAL (تأكيد قبل حذف الفاتورة) */}
      {/* ======================================================== */}
      {deleteModalInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 text-center border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={30} />
            </div>

            <h3 className="font-black text-lg text-slate-800 mb-2">
              تأكيد حذف فاتورة المشتريات
            </h3>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              هل أنت متأكد من حذف فاتورة المشتريات رقم{' '}
              <span className="font-mono font-bold text-slate-900">({deleteModalInvoice.id})</span>؟
            </p>

            {/* Explanatory Notice depending on status */}
            {deleteModalInvoice.status === 'draft' || deleteModalInvoice.isDraft ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-right text-xs text-amber-800 mb-6">
                <strong>ملاحظة أمان:</strong> هذه الفاتورة مسودة معلقة (لا يوجد لها أي أثر مالي أو مخزني) وسيتم حذفها من قائمة المسودات فقط.
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-right text-xs text-rose-700 mb-6">
                <strong>تنبيه هام:</strong> هذه الفاتورة معتمدة، وسيتم تلقائياً عكس أثرها على المخزون وحساب المورد وحركات الخزينة المرتبطة بها.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-rose-600/20"
              >
                نعم، تأكيد الحذف
              </button>
              <button
                onClick={() => setDeleteModalInvoice(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
