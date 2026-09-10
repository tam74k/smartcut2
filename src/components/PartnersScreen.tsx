import React, { useState, useMemo, useEffect } from 'react';
import { 
  AppSettings, Partner, PartnerTransaction, Transaction, 
  PartnerDrawing, ProfitDistribution, PartnerExitInstallment 
} from '../types';
import { 
  Users, Plus, Wallet, ArrowDownRight, ArrowUpRight, DollarSign, 
  PieChart as PieIcon, Trash2, Edit2, CheckCircle2, AlertTriangle, 
  Calendar, Phone, FileText, Printer, ShieldAlert, LogOut, RefreshCw, Layers
} from 'lucide-react';
import { DB } from '../services/db';
import { PartnerLedgerPrintModal, PartnerLedgerEntry } from './PartnerLedgerPrintModal';
import { PartnersProfitReportModal, PartnerProfitReportRow } from './PartnersProfitReportModal';

interface PartnersScreenProps {
  settings: AppSettings;
  partners: Partner[];
  setPartners: (updater: Partner[] | ((prev: Partner[]) => Partner[])) => void;
  partnerTransactions: PartnerTransaction[];
  setPartnerTransactions: (updater: PartnerTransaction[] | ((prev: PartnerTransaction[]) => PartnerTransaction[])) => void;
  transactions: Transaction[];
  setTransactions: (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  activeBranchId?: string;
  currentUser?: any;
}

export function PartnersScreen({
  settings,
  partners = [],
  setPartners,
  partnerTransactions = [],
  setPartnerTransactions,
  transactions = [],
  setTransactions,
  activeBranchId,
  currentUser
}: PartnersScreenProps) {
  // Navigation subtabs
  const [activeTab, setActiveTab] = useState<'partners' | 'transactions' | 'settlement' | 'exit_installments'>('partners');
  
  // Modals state
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  // Transaction Modal (Deposit / Drawing / Profit Share)
  const [showTxModal, setShowTxModal] = useState(false);
  const [txPartner, setTxPartner] = useState<Partner | null>(null);
  const [txType, setTxType] = useState<'deposit' | 'withdrawal' | 'profit_share'>('withdrawal');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txTreasury, setTxTreasury] = useState<string>(settings.treasuries[0]?.id || 'main');
  const [txDescription, setTxDescription] = useState('');

  // Exit Modal (تخارج الشريك والجدولة)
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPartner, setExitPartner] = useState<Partner | null>(null);
  const [exitValuation, setExitValuation] = useState<number | ''>('');
  const [exitInstallmentsCount, setExitInstallmentsCount] = useState<number>(6);
  const [exitFirstDueDate, setExitFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [exitNotes, setExitNotes] = useState<string>('تخارج رضائي متفق عليه');

  // Annual Settlement Modal / Action
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settleYear, setSettleYear] = useState<number>(new Date().getFullYear());
  const [settleProfitPool, setSettleProfitPool] = useState<number | ''>('');
  const [settleLabel, setSettleLabel] = useState<string>(`إقفال السنة المالية ${new Date().getFullYear()}`);

  // Printable Modals State
  const [selectedLedgerPartner, setSelectedLedgerPartner] = useState<Partner | null>(null);
  const [ledgerStartDate, setLedgerStartDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear(), 0, 1);
    return d.toISOString().split('T')[0];
  });
  const [ledgerEndDate, setLedgerEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showProfitReportModal, setShowProfitReportModal] = useState(false);

  // Additional DB Collections (Drawings, Distributions, Exit Installments)
  const [profitDistributions, setProfitDistributions] = useState<ProfitDistribution[]>([]);
  const [exitInstallments, setExitInstallments] = useState<PartnerExitInstallment[]>([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);

  // Partner Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIdNumber, setFormIdNumber] = useState('');
  const [formCapital, setFormCapital] = useState<number | ''>('');
  const [formMaxDrawingsCap, setFormMaxDrawingsCap] = useState<number | ''>('');
  const [formNotes, setFormNotes] = useState('');

  // Fetch Supabase partner distributions and exit installments on mount
  useEffect(() => {
    const sId = settings.salonId;
    if (!sId) return;

    let isMounted = true;
    const fetchExtra = async () => {
      setIsLoadingExtra(true);
      try {
        const [dists, insts] = await Promise.all([
          DB.fetchProfitDistributions(sId),
          DB.fetchPartnerExitInstallments(sId)
        ]);
        if (isMounted) {
          if (Array.isArray(dists)) setProfitDistributions(dists);
          if (Array.isArray(insts)) setExitInstallments(insts);
        }
      } catch (err) {
        console.warn('Error fetching partner extra data:', err);
      } finally {
        if (isMounted) setIsLoadingExtra(false);
      }
    };
    fetchExtra();
    return () => { isMounted = false; };
  }, [settings.salonId]);

  // Calculations
  const activePartners = useMemo(() => {
    return partners.filter(p => p.status !== 'exited' && p.isActive !== false);
  }, [partners]);

  const totalCapital = useMemo(() => {
    return activePartners.reduce((sum, p) => sum + (Number(p.capitalShare) || 0), 0);
  }, [activePartners]);

  const totalWithdrawals = useMemo(() => {
    return partnerTransactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [partnerTransactions]);

  const totalDeposits = useMemo(() => {
    return partnerTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [partnerTransactions]);

  const totalProfitPaid = useMemo(() => {
    return partnerTransactions
      .filter(t => t.type === 'profit_share')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [partnerTransactions]);

  const totalDebitBalances = useMemo(() => {
    return partners.reduce((sum, p) => sum + (Number(p.debitBalance) || 0), 0);
  }, [partners]);

  // Open add partner modal
  const handleOpenAddPartner = () => {
    setEditingPartner(null);
    setFormName('');
    setFormPhone('');
    setFormIdNumber('');
    setFormCapital('');
    setFormMaxDrawingsCap('');
    setFormNotes('');
    setShowAddPartnerModal(true);
  };

  // Open edit partner modal
  const handleOpenEditPartner = (p: Partner) => {
    setEditingPartner(p);
    setFormName(p.name);
    setFormPhone(p.phone);
    setFormIdNumber(p.idNumber || '');
    setFormCapital(p.capitalShare);
    setFormMaxDrawingsCap(p.maxDrawingsCap || '');
    setFormNotes(p.notes || '');
    setShowAddPartnerModal(true);
  };

  // Save partner (with Dynamic Dilution)
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('يرجى كتابة اسم الشريك ورقم الهاتف');
      return;
    }

    const capital = Number(formCapital) || 0;
    const maxCap = Number(formMaxDrawingsCap) || 0;

    let updatedList: Partner[] = [];

    if (editingPartner) {
      updatedList = partners.map(p => {
        if (p.id === editingPartner.id) {
          return {
            ...p,
            name: formName.trim(),
            phone: formPhone.trim(),
            idNumber: formIdNumber.trim() || undefined,
            capitalShare: capital,
            maxDrawingsCap: maxCap,
            notes: formNotes.trim() || undefined
          };
        }
        return p;
      });
    } else {
      const newPartner: Partner = {
        id: 'PRT-' + Math.random().toString(36).substring(2, 9),
        salonId: settings.salonId,
        name: formName.trim(),
        phone: formPhone.trim(),
        idNumber: formIdNumber.trim() || undefined,
        status: 'active',
        capitalShare: capital,
        sharePercentage: 0,
        maxDrawingsCap: maxCap,
        debitBalance: 0,
        totalWithdrawn: 0,
        totalProfitReceived: 0,
        joinDate: new Date().toISOString().split('T')[0],
        notes: formNotes.trim() || undefined,
        isActive: true
      };
      updatedList = [...partners, newPartner];
    }

    // Dynamic Dilution: Recalculate share percentages across all active partners
    const activeTotal = updatedList
      .filter(p => p.status !== 'exited' && p.isActive !== false)
      .reduce((s, p) => s + (Number(p.capitalShare) || 0), 0);

    const finalList = updatedList.map(p => {
      if (p.status === 'exited') return { ...p, sharePercentage: 0 };
      const pct = activeTotal > 0 ? Number(((p.capitalShare / activeTotal) * 100).toFixed(3)) : 0;
      return { ...p, sharePercentage: pct };
    });

    setPartners(finalList);

    // Save to DB
    const savedPartnerObj = finalList.find(p => editingPartner ? p.id === editingPartner.id : p.name === formName.trim());
    if (savedPartnerObj) {
      await DB.savePartner(savedPartnerObj);
    }

    setShowAddPartnerModal(false);
  };

  // Delete partner
  const handleDeletePartner = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الشريك وسجلاته بالكامل؟')) {
      const remaining = partners.filter(p => p.id !== id);
      const activeTotal = remaining
        .filter(p => p.status !== 'exited' && p.isActive !== false)
        .reduce((sum, p) => sum + (p.capitalShare || 0), 0);

      const updated = remaining.map(p => ({
        ...p,
        sharePercentage: activeTotal > 0 ? Number(((p.capitalShare / activeTotal) * 100).toFixed(3)) : 0
      }));
      setPartners(updated);
      await DB.deletePartner(id);
    }
  };

  // Open transaction modal
  const handleOpenTxModal = (partner: Partner, type: 'deposit' | 'withdrawal' | 'profit_share') => {
    setTxPartner(partner);
    setTxType(type);
    setTxAmount('');
    setTxDescription('');
    setShowTxModal(true);
  };

  // Submit Partner Transaction (Drawings Cap & Dynamic Dilution)
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txPartner || !txAmount || Number(txAmount) <= 0) {
      alert('يرجى تحديد المبلغ بشكل صحيح');
      return;
    }

    const amount = Number(txAmount);
    const now = new Date().toISOString();
    const treasuryObj = settings.treasuries.find(t => t.id === txTreasury) || settings.treasuries[0];

    // Check Drawings Cap (سقف السحوبات)
    if (txType === 'withdrawal') {
      const currentWithdrawn = txPartner.totalWithdrawn || 0;
      const cap = txPartner.maxDrawingsCap || 0;
      if (cap > 0 && (currentWithdrawn + amount) > cap) {
        alert(`عذراً، هذا السحب يتجاوز سقف السحوبات المسموح به للشريك (${cap.toLocaleString()} ${settings.currency}). المسحوب الحالي: ${currentWithdrawn.toLocaleString()}`);
        return;
      }
    }

    const newPTx: PartnerTransaction = {
      id: 'PTX-' + Math.random().toString(36).substring(2, 9),
      salonId: settings.salonId,
      partnerId: txPartner.id,
      partnerName: txPartner.name,
      type: txType,
      amount: amount,
      date: now,
      treasuryId: txTreasury,
      treasuryName: treasuryObj?.name || 'الخزينة الرئيسية',
      description: txDescription.trim() || (
        txType === 'withdrawal' ? `مسحوبات الشريك ${txPartner.name} (سلفة على الأرباح)` :
        txType === 'deposit' ? `إيداع زيادة رأس مال من الشريك ${txPartner.name}` :
        `توزيع أرباح للشريك ${txPartner.name}`
      ),
      createdBy: currentUser?.name || 'المالك'
    };

    setPartnerTransactions(prev => [newPTx, ...prev]);

    // Handle Capital Deposit & Dynamic Dilution
    if (txType === 'deposit') {
      const updatedList = partners.map(p => {
        if (p.id === txPartner.id) {
          const newCap = (p.capitalShare || 0) + amount;
          return { ...p, capitalShare: newCap };
        }
        return p;
      });

      const newTotal = updatedList
        .filter(p => p.status !== 'exited' && p.isActive !== false)
        .reduce((s, p) => s + p.capitalShare, 0);

      const dilutedList = updatedList.map(p => ({
        ...p,
        sharePercentage: newTotal > 0 ? Number(((p.capitalShare / newTotal) * 100).toFixed(3)) : 0
      }));

      setPartners(dilutedList);
      const targetP = dilutedList.find(p => p.id === txPartner.id);
      if (targetP) await DB.savePartner(targetP);
    } else if (txType === 'withdrawal') {
      // Update partner totalWithdrawn
      const updatedList = partners.map(p => {
        if (p.id === txPartner.id) {
          return { ...p, totalWithdrawn: (p.totalWithdrawn || 0) + amount };
        }
        return p;
      });
      setPartners(updatedList);
      const targetP = updatedList.find(p => p.id === txPartner.id);
      if (targetP) await DB.savePartner(targetP);

      // Record drawing entry in DB
      await DB.savePartnerDrawing({
        id: 'PDW-' + Math.random().toString(36).substring(2, 9),
        salonId: settings.salonId,
        partnerId: txPartner.id,
        amount: amount,
        drawingDate: now,
        drawingType: 'profit_advance',
        treasuryId: txTreasury,
        treasuryName: treasuryObj?.name,
        notes: txDescription || 'سحب على الأرباح',
        createdBy: currentUser?.name || 'المالك'
      });
    }

    // Save transaction to DB
    await DB.savePartnerTransaction(newPTx);

    // Reflect into general salon financial treasury transactions
    const salonTx: Transaction = {
      id: 'TRX-PTX-' + Math.random().toString(36).substring(2, 9),
      date: now,
      type: txType === 'deposit' ? 'in' : 'out',
      amount: amount,
      category: txType === 'deposit' ? 'إيداع رأس مال' : 'مسحوبات شركاء',
      description: newPTx.description,
      treasury: txTreasury,
      branchId: activeBranchId,
      createdBy: currentUser?.name || 'المالك',
      userId: currentUser?.id,
      userName: currentUser?.name || 'المالك'
    };
    setTransactions(prev => [...prev, salonTx]);

    setShowTxModal(false);
  };

  // Open Exit Modal
  const handleOpenExitModal = (partner: Partner) => {
    setExitPartner(partner);
    setExitValuation(partner.capitalShare);
    setExitInstallmentsCount(6);
    setExitNotes('تخارج رضائي متفق عليه');
    setShowExitModal(true);
  };

  // Execute Partner Exit Liquidation & Installments
  const handleExecutePartnerExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitPartner || !exitValuation || Number(exitValuation) <= 0) {
      alert('يرجى تحديد القيمة المالية العادلة لتخارج الشريك');
      return;
    }

    const valuation = Number(exitValuation);
    const count = Math.max(1, exitInstallmentsCount);
    const instAmount = Number((valuation / count).toFixed(2));
    const newInstallments: PartnerExitInstallment[] = [];

    for (let i = 1; i <= count; i++) {
      const dueDate = new Date(exitFirstDueDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      newInstallments.push({
        id: 'PEX-' + Math.random().toString(36).substring(2, 9),
        salonId: settings.salonId,
        partnerId: exitPartner.id,
        partnerName: exitPartner.name,
        installmentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        amount: instAmount,
        status: 'pending',
        notes: `قسط تخارج رقم ${i} من ${count} للشريك ${exitPartner.name}`
      });
    }

    // 1. Update partner status to exited & zero equity
    const updatedPartners = partners.map(p => {
      if (p.id === exitPartner.id) {
        return {
          ...p,
          status: 'exited' as const,
          sharePercentage: 0,
          isActive: false,
          exitDate: new Date().toISOString().split('T')[0],
          notes: (p.notes ? p.notes + ' | ' : '') + `تم التخارج بقيمة ${valuation} على ${count} أقساط`
        };
      }
      return p;
    });

    // 2. Dynamic Dilution: Recalculate remaining active partners percentages
    const remainingActiveCap = updatedPartners
      .filter(p => p.status !== 'exited' && p.isActive !== false)
      .reduce((s, p) => s + (p.capitalShare || 0), 0);

    const finalPartners = updatedPartners.map(p => {
      if (p.status === 'exited') return p;
      const pct = remainingActiveCap > 0 ? Number(((p.capitalShare / remainingActiveCap) * 100).toFixed(3)) : 0;
      return { ...p, sharePercentage: pct };
    });

    setPartners(finalPartners);
    setExitInstallments(prev => [...newInstallments, ...prev]);

    // Save installments & partner to DB
    for (const inst of newInstallments) {
      await DB.savePartnerExitInstallment(inst);
    }
    const updatedExitedPartner = finalPartners.find(p => p.id === exitPartner.id);
    if (updatedExitedPartner) await DB.savePartner(updatedExitedPartner);

    alert(`تم بنجاح تغيير حالة الشريك إلى منسحب وتوليد ${count} أقساط تخارج مجدولة مع إعادة احتساب نسب باقي الشركاء.`);
    setShowExitModal(false);
  };

  // Pay Exit Installment
  const handlePayInstallment = async (inst: PartnerExitInstallment) => {
    if (!confirm(`هل أنت متأكد من تسجيل سداد القسط رقم ${inst.installmentNumber} بمبلغ ${inst.amount.toLocaleString()} ${settings.currency}؟`)) {
      return;
    }

    const now = new Date().toISOString();
    const updatedInst: PartnerExitInstallment = {
      ...inst,
      status: 'paid',
      paidAt: now
    };

    setExitInstallments(prev => prev.map(item => item.id === inst.id ? updatedInst : item));
    await DB.savePartnerExitInstallment(updatedInst);

    // Record out transaction
    const salonTx: Transaction = {
      id: 'TRX-INST-' + Math.random().toString(36).substring(2, 9),
      date: now,
      type: 'out',
      amount: inst.amount,
      category: 'سداد قسط تخارج',
      description: `سداد ${inst.notes || `قسط تخارج رقم ${inst.installmentNumber}`}`,
      treasury: settings.treasuries[0]?.id || 'main',
      branchId: activeBranchId,
      createdBy: currentUser?.name || 'المالك'
    };
    setTransactions(prev => [...prev, salonTx]);
  };

  // Execute Annual Profit Settlement (المعادلة الصارمة: (صافي الأرباح × النسبة) - السحوبات)
  const handleExecuteAnnualSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleProfitPool || Number(settleProfitPool) <= 0) {
      alert('يرجى إدخال إجمالي صافي الأرباح القابلة للتوزيع');
      return;
    }

    const pool = Number(settleProfitPool);
    const startStr = `${settleYear}-01-01`;
    const endStr = `${settleYear}-12-31`;

    const newDistributions: ProfitDistribution[] = [];
    const updatedPartners = [...partners];

    for (const p of activePartners) {
      if (p.sharePercentage <= 0) continue;

      const grossShare = Number(((pool * p.sharePercentage) / 100).toFixed(2));

      // Calculate total drawings within the year
      const partnerYearDrawings = partnerTransactions
        .filter(t => t.partnerId === p.id && t.type === 'withdrawal' && t.date.startsWith(String(settleYear)))
        .reduce((s, t) => s + (t.amount || 0), 0);

      const priorDebit = p.debitBalance || 0;
      const netSettlement = grossShare - partnerYearDrawings - priorDebit;

      let payable = 0;
      let carriedDebit = 0;

      if (netSettlement >= 0) {
        payable = Number(netSettlement.toFixed(2));
        carriedDebit = 0;
      } else {
        payable = 0;
        carriedDebit = Number(Math.abs(netSettlement).toFixed(2));
      }

      const dist: ProfitDistribution = {
        id: 'PDS-' + Math.random().toString(36).substring(2, 9),
        salonId: settings.salonId,
        partnerId: p.id,
        partnerName: p.name,
        periodStart: startStr,
        periodEnd: endStr,
        periodLabel: settleLabel,
        distributableProfitPool: pool,
        partnerSharePercentage: p.sharePercentage,
        grossProfitShare: grossShare,
        drawingsDeducted: partnerYearDrawings,
        priorDebitDeducted: priorDebit,
        netPayableAmount: payable,
        carriedDebitBalance: carriedDebit,
        status: payable > 0 ? 'approved' : 'carried_forward',
        distributionDate: new Date().toISOString().split('T')[0],
        approvedBy: currentUser?.name || 'المالك',
        notes: carriedDebit > 0 
          ? `مسحوبات الشريك تجاوزت نصيبه من الربح بمبلغ ${carriedDebit.toLocaleString()} وتم ترحيلها كرصيد مدين مستحق السداد`
          : `صافي أرباح معتمدة للصرف: ${payable.toLocaleString()}`
      };

      newDistributions.push(dist);

      // Update partner debit balance & total profit in state
      const pIdx = updatedPartners.findIndex(item => item.id === p.id);
      if (pIdx !== -1) {
        updatedPartners[pIdx] = {
          ...updatedPartners[pIdx],
          debitBalance: carriedDebit,
          totalProfitReceived: (updatedPartners[pIdx].totalProfitReceived || 0) + payable
        };
      }
    }

    setProfitDistributions(prev => [...newDistributions, ...prev]);
    setPartners(updatedPartners);

    // Save to DB
    for (const d of newDistributions) {
      await DB.saveProfitDistribution(d);
    }
    for (const p of updatedPartners) {
      await DB.savePartner(p);
    }

    alert(`تمت التسوية السنوية بنجاح لـ ${newDistributions.length} شركاء، وتم ترحيل الأرصدة المدينة والمستحقات.`);
    setShowSettlementModal(false);
  };

  // Prepare ledger entries for printable modal
  const ledgerData = useMemo(() => {
    if (!selectedLedgerPartner) return null;

    const p = selectedLedgerPartner;
    const entries: PartnerLedgerEntry[] = [];

    // Filter transactions
    const pTxs = partnerTransactions.filter(t => {
      const d = t.date.split('T')[0];
      return t.partnerId === p.id && d >= ledgerStartDate && d <= ledgerEndDate;
    });

    let running = p.openingBalance || 0;

    // Sort by date ascending
    const sorted = [...pTxs].sort((a, b) => a.date.localeCompare(b.date));

    let totalCredits = 0;
    let totalDebits = 0;

    sorted.forEach(t => {
      const isDeposit = t.type === 'deposit';
      const isDrawing = t.type === 'withdrawal';
      const isDividend = t.type === 'profit_share';

      const credit = isDeposit || isDividend ? t.amount : 0;
      const debit = isDrawing ? t.amount : 0;

      totalCredits += credit;
      totalDebits += debit;
      running = running + credit - debit;

      entries.push({
        id: t.id,
        date: t.date,
        type: isDeposit ? 'capital_increase' : isDrawing ? 'drawing' : 'profit_dividend',
        typeLabelAr: isDeposit ? 'إيداع رأس مال' : isDrawing ? 'سحب على الأرباح' : 'توزيع أرباح',
        description: t.description,
        debit,
        credit,
        runningBalance: running
      });
    });

    return {
      partner: p,
      entries,
      openingBalance: p.openingBalance || 0,
      totalCredits,
      totalDebits,
      closingBalance: running
    };
  }, [selectedLedgerPartner, partnerTransactions, ledgerStartDate, ledgerEndDate]);

  // Prepare Profit Report Rows for printable modal
  const profitReportRows: PartnerProfitReportRow[] = useMemo(() => {
    return activePartners.map(p => {
      const grossShare = Number(((100000 * p.sharePercentage) / 100).toFixed(2));
      const drawings = partnerTransactions
        .filter(t => t.partnerId === p.id && t.type === 'withdrawal')
        .reduce((s, t) => s + (t.amount || 0), 0);

      const netPayable = Math.max(0, grossShare - drawings - (p.debitBalance || 0));
      const carriedDebit = grossShare < drawings ? drawings - grossShare : 0;

      return {
        partnerId: p.id,
        partnerName: p.name,
        phone: p.phone,
        status: p.status,
        capitalShare: p.capitalShare,
        sharePercentage: p.sharePercentage,
        grossProfitShare: grossShare,
        drawingsDeducted: drawings,
        priorDebitDeducted: p.debitBalance || 0,
        netPayableAmount: netPayable,
        carriedDebitBalance: carriedDebit
      };
    });
  }, [activePartners, partnerTransactions]);

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 flex flex-col gap-6 font-sans">
      
      {/* 1. Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Users size={22} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              وحدة إدارة الشركاء وحصص رأس المال
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-extrabold">
              نظام SaaS متعدد المستأجرين 🏛️
            </span>
          </div>
          <p className="text-xs text-slate-500">
            أتمتة حقوق الشركاء، التخفيف الديناميكي للحصص، سقف السحوبات، التسويات السنوية، وجدولة مستحقات التخارج
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowProfitReportModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Printer size={15} />
            <span>تقرير أرباح الشركاء 📑</span>
          </button>

          <button
            onClick={() => {
              setSettleYear(new Date().getFullYear());
              setSettleProfitPool(100000);
              setShowSettlementModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw size={15} />
            <span>التسوية الختامية السنوية ⚖️</span>
          </button>

          <button
            onClick={handleOpenAddPartner}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة شريك جديد</span>
          </button>
        </div>
      </div>

      {/* 2. Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي رأس المال المدفوع</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
              {totalCapital.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-blue-600 font-bold mt-0.5">{activePartners.length} شركاء نشطين</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إيداعات رأس المال</div>
            <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">
              +{totalDeposits.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-0.5">تخفيف ديناميكي للحصص</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowDownRight size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي سحوبات الشركاء</div>
            <div className="text-lg sm:text-xl font-black text-rose-600 mt-0.5">
              -{totalWithdrawals.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-rose-600 font-bold mt-0.5">سلف أرباح تحت التسوية</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">الذمم المدينة المرحلة</div>
            <div className="text-lg sm:text-xl font-black text-amber-700 mt-0.5">
              {totalDebitBalances.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-amber-700 font-bold mt-0.5">مستحقة السداد للصالون</div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Sub-Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('partners')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'partners' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          سجل الشركاء ونسب الملكية ({partners.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'transactions' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          سجل الإيداعات والمسحوبات ({partnerTransactions.length})
        </button>
        <button
          onClick={() => setActiveTab('settlement')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'settlement' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          سجل التسويات وتوزيع الأرباح ({profitDistributions.length})
        </button>
        <button
          onClick={() => setActiveTab('exit_installments')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'exit_installments' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          جدولة مستحقات التخارج ({exitInstallments.length})
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PARTNERS LIST & EQUITY DILUTION PROGRESS */}
      {/* ========================================================= */}
      {activeTab === 'partners' && (
        <div className="flex flex-col gap-4">
          {/* Equity Breakdown Progress Bar */}
          {activePartners.length > 0 && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold text-slate-600 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <PieIcon size={16} className="text-amber-500" />
                  <span>توزيع نسب الملكية الحالية في رأس المال (Dynamic Dilution Model)</span>
                </span>
                <span className="text-[10px] text-slate-400">إجمالي رأس المال: {totalCapital.toLocaleString()} {settings.currency}</span>
              </h3>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                {activePartners.map((p, idx) => {
                  const colors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
                  const color = colors[idx % colors.length];
                  return (
                    <div 
                      key={p.id} 
                      style={{ width: `${p.sharePercentage}%` }} 
                      className={`${color} h-full transition-all`}
                      title={`${p.name}: ${p.sharePercentage}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100">
                {activePartners.map((p, idx) => {
                  const colors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <span className={`w-3 h-3 rounded-full ${color}`}></span>
                      <span>{p.name}: <strong>{p.sharePercentage}%</strong> ({p.capitalShare.toLocaleString()} {settings.currency})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {partners.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <Users size={48} className="text-slate-200 stroke-1" />
                <p className="text-sm font-semibold">لم يتم تسجيل أي شركاء أو مستثمرين بعد</p>
                <button
                  onClick={handleOpenAddPartner}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
                >
                  إضافة الشريك الأول
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                    <tr>
                      <th className="p-3.5">الشريك</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5">حصة رأس المال</th>
                      <th className="p-3.5 text-center">النسبة المئوية</th>
                      <th className="p-3.5">سقف السحوبات</th>
                      <th className="p-3.5">الرصيد المدين</th>
                      <th className="p-3.5 text-center">العمليات السريعة</th>
                      <th className="p-3.5 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partners.map(p => {
                      const isExited = p.status === 'exited';
                      return (
                        <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${isExited ? 'bg-slate-100/50 opacity-70' : ''}`}>
                          <td className="p-3.5 font-bold text-slate-800">
                            <div>{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal font-mono">{p.phone} {p.idNumber ? `| ${p.idNumber}` : ''}</div>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              p.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              p.status === 'exited' ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {p.status === 'active' ? '🟢 شريك نشط' : p.status === 'exited' ? '⚪ منسحب (متخارج)' : '🟡 في طور التخارج'}
                            </span>
                          </td>
                          <td className="p-3.5 font-extrabold text-slate-800">
                            {p.capitalShare.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-mono font-black border border-amber-200">
                              {p.sharePercentage}%
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600 font-mono">
                            {p.maxDrawingsCap && p.maxDrawingsCap > 0 ? `${p.maxDrawingsCap.toLocaleString()} ${settings.currency}` : 'بلا سقف'}
                          </td>
                          <td className="p-3.5 font-mono font-bold">
                            {p.debitBalance && p.debitBalance > 0 ? (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                ⚠️ {p.debitBalance.toLocaleString()} {settings.currency}
                              </span>
                            ) : (
                              <span className="text-slate-400">0.00</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isExited && (
                                <>
                                  <button
                                    onClick={() => handleOpenTxModal(p, 'withdrawal')}
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                    title="تسجيل سحب على الأرباح"
                                  >
                                    <ArrowDownRight size={13} />
                                    <span>سحب</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenTxModal(p, 'deposit')}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                    title="إيداع زيادة رأس مال"
                                  >
                                    <ArrowUpRight size={13} />
                                    <span>إيداع</span>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedLedgerPartner(p)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="عرض وطباعة كشف الحساب"
                              >
                                <Printer size={13} />
                                <span>كشف حساب</span>
                              </button>
                            </div>
                          </td>
                          <td className="p-3.5 text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isExited && (
                                <button
                                  onClick={() => handleOpenExitModal(p)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="بدء إجراءات التخارج وجدولة المستحقات"
                                >
                                  <LogOut size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditPartner(p)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="تعديل بيانات الشريك"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeletePartner(p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="حذف الشريك"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TRANSACTIONS LOG */}
      {/* ========================================================= */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {partnerTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <FileText size={48} className="text-slate-200 stroke-1" />
              <p className="text-sm font-semibold">لا توجد حركات مسحوبات أو إيداعات مسجلة للشركاء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">اسم الشريك</th>
                    <th className="p-3.5">نوع العملية</th>
                    <th className="p-3.5">المبلغ</th>
                    <th className="p-3.5">الخزينة المتأثرة</th>
                    <th className="p-3.5">البيان / الملاحظات</th>
                    <th className="p-3.5">المسجل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">{new Date(tx.date).toLocaleString('ar-EG')}</td>
                      <td className="p-3.5 font-bold text-slate-800">{tx.partnerName}</td>
                      <td className="p-3.5">
                        {tx.type === 'withdrawal' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold border border-red-100 flex items-center gap-1 w-max">
                            <ArrowDownRight size={13} />
                            <span>سحب على الأرباح</span>
                          </span>
                        ) : tx.type === 'deposit' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 flex items-center gap-1 w-max">
                            <ArrowUpRight size={13} />
                            <span>إيداع رأس مال</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100 flex items-center gap-1 w-max">
                            <DollarSign size={13} />
                            <span>توزيع أرباح</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-black text-slate-800">
                        {tx.amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                      </td>
                      <td className="p-3.5 text-slate-600">{tx.treasuryName || 'الخزينة الرئيسية'}</td>
                      <td className="p-3.5 text-slate-600">{tx.description}</td>
                      <td className="p-3.5 text-slate-400 text-[11px]">{tx.createdBy || 'المالك'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: ANNUAL SETTLEMENTS & PROFIT DISTRIBUTIONS */}
      {/* ========================================================= */}
      {activeTab === 'settlement' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {profitDistributions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw size={48} className="text-slate-200 stroke-1" />
              <p className="text-sm font-semibold">لم يتم تنفيذ أي تسوية سنوية ختامية للأرباح بعد</p>
              <button
                onClick={() => {
                  setSettleYear(new Date().getFullYear());
                  setSettleProfitPool(100000);
                  setShowSettlementModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                تنفيذ أول تسوية ختامية
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="p-3.5">تاريخ الإقفال</th>
                    <th className="p-3.5">الفترة / البيان</th>
                    <th className="p-3.5">اسم الشريك</th>
                    <th className="p-3.5 text-center">النسبة</th>
                    <th className="p-3.5">إجمالي الأرباح المستحقة</th>
                    <th className="p-3.5">المسحوبات المخصومة</th>
                    <th className="p-3.5">صافي المستحق للصرف</th>
                    <th className="p-3.5">رصيد مدين مرحّل</th>
                    <th className="p-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profitDistributions.map(pd => (
                    <tr key={pd.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">{pd.distributionDate}</td>
                      <td className="p-3.5 font-bold text-slate-800">{pd.periodLabel}</td>
                      <td className="p-3.5 font-bold text-slate-800">{pd.partnerName || 'الشريك'}</td>
                      <td className="p-3.5 text-center font-mono font-black text-amber-700">{pd.partnerSharePercentage}%</td>
                      <td className="p-3.5 font-mono text-emerald-700 font-bold">+{pd.grossProfitShare.toLocaleString()}</td>
                      <td className="p-3.5 font-mono text-rose-600 font-bold">-{pd.drawingsDeducted.toLocaleString()}</td>
                      <td className="p-3.5 font-mono text-indigo-700 font-black">
                        {pd.netPayableAmount > 0 ? `+${pd.netPayableAmount.toLocaleString()}` : '0.00'}
                      </td>
                      <td className="p-3.5 font-mono text-amber-800 font-black">
                        {pd.carriedDebitBalance > 0 ? `⚠️ ${pd.carriedDebitBalance.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                          pd.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {pd.status === 'approved' ? 'معتمد للصرف' : 'مرحّل كمديونية'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: PARTNER EXIT INSTALLMENTS */}
      {/* ========================================================= */}
      {activeTab === 'exit_installments' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {exitInstallments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <LogOut size={48} className="text-slate-200 stroke-1" />
              <p className="text-sm font-semibold">لا توجد أقساط تخارج مجدولة حالياً</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="p-3.5">رقم القسط</th>
                    <th className="p-3.5">الشريك المتخارج</th>
                    <th className="p-3.5">تاريخ الاستحقاق</th>
                    <th className="p-3.5">قيمة القسط</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">البيان</th>
                    <th className="p-3.5 text-left">إجراء السداد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exitInstallments.map(inst => (
                    <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-600">#{inst.installmentNumber}</td>
                      <td className="p-3.5 font-bold text-slate-800">{inst.partnerName || 'الشريك'}</td>
                      <td className="p-3.5 font-mono text-slate-600">{inst.dueDate}</td>
                      <td className="p-3.5 font-mono font-black text-slate-900">
                        {inst.amount.toLocaleString()} {settings.currency}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          inst.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {inst.status === 'paid' ? 'تم السداد' : 'قيد الانتظار'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">{inst.notes}</td>
                      <td className="p-3.5 text-left">
                        {inst.status !== 'paid' && (
                          <button
                            onClick={() => handlePayInstallment(inst)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            سداد القسط الآن
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT PARTNER */}
      {/* ========================================================= */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-amber-600" />
                <span>{editingPartner ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد إلى الصالون'}</span>
              </h3>
              <button 
                onClick={() => setShowAddPartnerModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشريك الكامل *</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="مثال: عبدالله المنصور"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف *</label>
                  <input 
                    type="tel" 
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-left font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهوية / الإقامة</label>
                  <input 
                    type="text" 
                    value={formIdNumber}
                    onChange={e => setFormIdNumber(e.target.value)}
                    placeholder="اختياري"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حصة رأس المال ({settings.currency}) *</label>
                  <input 
                    type="number" 
                    min="0"
                    step="any"
                    value={formCapital}
                    onChange={e => setFormCapital(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سقف السحوبات المسموح</label>
                  <input 
                    type="number" 
                    min="0"
                    step="any"
                    value={formMaxDrawingsCap}
                    onChange={e => setFormMaxDrawingsCap(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0 = بلا سقف"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات وشروط الاتفاق</label>
                <textarea 
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="شروط خاصة، تفاصيل إيداع رأس المال..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                >
                  {editingPartner ? 'حفظ التعديلات' : 'تأكيد إضافة الشريك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PARTNER TRANSACTION (WITHDRAWAL / DEPOSIT) */}
      {/* ========================================================= */}
      {showTxModal && txPartner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                {txType === 'withdrawal' ? (
                  <>
                    <ArrowDownRight size={20} className="text-red-600" />
                    <span>تسجيل سحب على الأرباح: {txPartner.name}</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={20} className="text-emerald-600" />
                    <span>إيداع زيادة رأس مال: {txPartner.name}</span>
                  </>
                )}
              </h3>
              <button 
                onClick={() => setShowTxModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الحركة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxType('withdrawal')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      txType === 'withdrawal' 
                        ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-500/20' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    سحب على الأرباح
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('deposit')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      txType === 'deposit' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    إيداع زيادة رأس مال
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">المبلغ ({settings.currency}) *</label>
                  {txType === 'withdrawal' && txPartner.maxDrawingsCap && txPartner.maxDrawingsCap > 0 && (
                    <span className="text-[10px] text-amber-700 font-bold">
                      السقف: {txPartner.maxDrawingsCap.toLocaleString()} (المسحوب: {(txPartner.totalWithdrawn || 0).toLocaleString()})
                    </span>
                  )}
                </div>
                <input 
                  type="number" 
                  min="0.01"
                  step="any"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الخزينة المتأثرة بالسحب/الإيداع *</label>
                <select
                  value={txTreasury}
                  onChange={e => setTxTreasury(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                >
                  {settings.treasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.isMain ? '(الرئيسية)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان / ملاحظات العملية</label>
                <input 
                  type="text"
                  value={txDescription}
                  onChange={e => setTxDescription(e.target.value)}
                  placeholder="مثال: سلفة أرباح لشهر مارس 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 text-white font-black rounded-xl text-xs transition-colors shadow-xs cursor-pointer ${
                    txType === 'withdrawal' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  تأكيد وقيد العملية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PARTNER EXIT & INSTALLMENT SCHEDULER */}
      {/* ========================================================= */}
      {showExitModal && exitPartner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-amber-50/70">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <LogOut size={20} className="text-amber-700" />
                <span>جدولة مستحقات تخارج الشريك: {exitPartner.name}</span>
              </h3>
              <button 
                onClick={() => setShowExitModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecutePartnerExit} className="p-5 flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1 font-bold">
                <div>⚠️ تنبيه مالي وإداري:</div>
                <div className="text-[11px] font-normal text-amber-800">
                  عند تأكيد التخارج، سيتم تحويل حالة الشريك إلى "منسحب" وتصفير حصته في رأس المال مع إعادة احتساب نسب باقي الشركاء تلقائياً.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  القيمة المالية العادلة للتخارج ({settings.currency}) *
                </label>
                <input 
                  type="number" 
                  min="1"
                  step="any"
                  value={exitValuation}
                  onChange={e => setExitValuation(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="مثال: 50000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-black focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عدد الأقساط الشهرية *</label>
                  <input 
                    type="number" 
                    min="1"
                    max="60"
                    value={exitInstallmentsCount}
                    onChange={e => setExitInstallmentsCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ أول قسط *</label>
                  <input 
                    type="date" 
                    value={exitFirstDueDate}
                    onChange={e => setExitFirstDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    required
                  />
                </div>
              </div>

              {exitValuation && Number(exitValuation) > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                  <span className="text-slate-600 font-bold">قيمة القسط الشهري التقريبية:</span>
                  <span className="font-mono font-black text-indigo-700 text-sm">
                    {Math.round(Number(exitValuation) / Math.max(1, exitInstallmentsCount)).toLocaleString()} {settings.currency}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات التخارج</label>
                <input 
                  type="text"
                  value={exitNotes}
                  onChange={e => setExitNotes(e.target.value)}
                  placeholder="شروط التسوية، رقم الاتفاقية..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                >
                  اعتماد التخارج وتوليد الأقساط
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ANNUAL PROFIT SETTLEMENT */}
      {/* ========================================================= */}
      {showSettlementModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/70">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <RefreshCw size={20} className="text-indigo-600" />
                <span>إجراء التسوية السنوية الختامية للأرباح</span>
              </h3>
              <button 
                onClick={() => setShowSettlementModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteAnnualSettlement} className="p-5 flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 space-y-1 font-bold">
                <div>معادلة التسوية المؤتمتة:</div>
                <div className="text-[11px] font-normal text-indigo-800">
                  (صافي الأرباح × نسبة الشريك) - مسحوبات الشريك. وفي حال كانت النتيجة سالبة، ترحل آلياً كـ "رصيد مدين" مستحق السداد.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السنة المالية *</label>
                <input 
                  type="number" 
                  min="2020"
                  max="2035"
                  value={settleYear}
                  onChange={e => {
                    const yr = Number(e.target.value);
                    setSettleYear(yr);
                    setSettleLabel(`إقفال السنة المالية ${yr}`);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  صافي أرباح الصالون القابلة للتوزيع ({settings.currency}) *
                </label>
                <input 
                  type="number" 
                  min="1"
                  step="any"
                  value={settleProfitPool}
                  onChange={e => setSettleProfitPool(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="مثال: 120000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-black text-emerald-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان وبيان الإقفال</label>
                <input 
                  type="text"
                  value={settleLabel}
                  onChange={e => setSettleLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                >
                  تنفيذ الإقفال والتسوية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINTABLE MODAL 1: PARTNER STATEMENT / LEDGER */}
      {/* ========================================================= */}
      {ledgerData && (
        <PartnerLedgerPrintModal
          settings={settings}
          partner={ledgerData.partner}
          periodStart={ledgerStartDate}
          periodEnd={ledgerEndDate}
          entries={ledgerData.entries}
          openingBalance={ledgerData.openingBalance}
          totalCredits={ledgerData.totalCredits}
          totalDebits={ledgerData.totalDebits}
          closingBalance={ledgerData.closingBalance}
          onClose={() => setSelectedLedgerPartner(null)}
        />
      )}

      {/* ========================================================= */}
      {/* PRINTABLE MODAL 2: PARTNERS PROFIT SUMMARY REPORT */}
      {/* ========================================================= */}
      {showProfitReportModal && (
        <PartnersProfitReportModal
          settings={settings}
          periodLabel={`تقرير أرباح الشركاء ${new Date().getFullYear()}`}
          periodStart={`${new Date().getFullYear()}-01-01`}
          periodEnd={`${new Date().getFullYear()}-12-31`}
          distributableProfitPool={100000}
          rows={profitReportRows}
          onClose={() => setShowProfitReportModal(false)}
        />
      )}
    </div>
  );
}
