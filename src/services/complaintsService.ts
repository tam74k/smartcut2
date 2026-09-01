import { ClientComplaint, ComplaintAction, Invoice } from '../types';
import { DB } from './db';

const STORAGE_KEY = 'smartcut_client_complaints';


export const INITIAL_MOCK_COMPLAINTS: ClientComplaint[] = [];

export const ComplaintsService = {
  getComplaints(): ClientComplaint[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load complaints from storage:', e);
    }
    return [];
  },

  saveComplaints(complaints: ClientComplaint[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
      complaints.forEach(c => DB.saveComplaint(c));
    } catch (e) {
      console.error('Failed to save complaints:', e);
    }
  },

  createComplaint(data: Omit<ClientComplaint, 'id' | 'createdAt' | 'updatedAt' | 'actions'> & { initialAction?: string; createdBy?: string }): ClientComplaint {
    const complaints = this.getComplaints();
    const now = new Date().toISOString();
    const complaintId = 'CMP-' + (100 + complaints.length + 1);

    const initialActions: ComplaintAction[] = [];
    if (data.initialAction) {
      initialActions.push({
        id: 'ACT-' + Math.random().toString(36).substring(2, 7),
        date: now,
        actionText: data.initialAction,
        performedBy: data.createdBy || 'مدير النظام'
      });
    }

    const newComplaint: ClientComplaint = {
      ...data,
      id: complaintId,
      actions: initialActions,
      createdAt: now,
      updatedAt: now
    };

    this.saveComplaints([newComplaint, ...complaints]);
    return newComplaint;
  },

  addAction(complaintId: string, actionText: string, performedBy: string): ClientComplaint | null {
    const complaints = this.getComplaints();
    const idx = complaints.findIndex(c => c.id === complaintId);
    if (idx === -1) return null;

    const newAction: ComplaintAction = {
      id: 'ACT-' + Math.random().toString(36).substring(2, 7),
      date: new Date().toISOString(),
      actionText,
      performedBy
    };

    complaints[idx] = {
      ...complaints[idx],
      actions: [...complaints[idx].actions, newAction],
      status: complaints[idx].status === 'open' ? 'in_progress' : complaints[idx].status,
      updatedAt: new Date().toISOString()
    };

    this.saveComplaints(complaints);
    return complaints[idx];
  },

  resolveComplaint(
    complaintId: string, 
    resolution: string, 
    resolvedBy: string, 
    isRemedyProvided: boolean = false,
    remedyInvoiceId?: string
  ): ClientComplaint | null {
    const complaints = this.getComplaints();
    const idx = complaints.findIndex(c => c.id === complaintId);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    const closeAction: ComplaintAction = {
      id: 'ACT-' + Math.random().toString(36).substring(2, 7),
      date: now,
      actionText: `تم حل الشكوى وإغلاقها: ${resolution}${isRemedyProvided ? ' (مع تقديم إصلاح مجاني على حساب الصالون)' : ''}`,
      performedBy: resolvedBy
    };

    complaints[idx] = {
      ...complaints[idx],
      status: 'resolved',
      resolution,
      resolvedAt: now,
      resolvedBy,
      isRemedyProvided,
      remedyInvoiceId,
      actions: [...complaints[idx].actions, closeAction],
      updatedAt: now
    };

    this.saveComplaints(complaints);
    return complaints[idx];
  },

  updateStatus(complaintId: string, status: ClientComplaint['status'], updatedBy: string): ClientComplaint | null {
    const complaints = this.getComplaints();
    const idx = complaints.findIndex(c => c.id === complaintId);
    if (idx === -1) return null;

    const statusLabels: Record<string, string> = {
      open: 'مفتوحة 🟡',
      in_progress: 'قيد المتابعة 🔵',
      resolved: 'تم الحل 🟢',
      rejected: 'مرفوضة 🔴'
    };

    const action: ComplaintAction = {
      id: 'ACT-' + Math.random().toString(36).substring(2, 7),
      date: new Date().toISOString(),
      actionText: `تغيير حالة الشكوى إلى: ${statusLabels[status] || status}`,
      performedBy: updatedBy
    };

    complaints[idx] = {
      ...complaints[idx],
      status,
      actions: [...complaints[idx].actions, action],
      updatedAt: new Date().toISOString()
    };

    this.saveComplaints(complaints);
    return complaints[idx];
  },

  /**
   * Retrieves all complaints for a specific client phone
   */
  getClientComplaints(phone: string): ClientComplaint[] {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return [];
    const complaints = this.getComplaints();
    return complaints.filter(c => c.clientPhone.replace(/\D/g, '').includes(cleaned) || cleaned.includes(c.clientPhone.replace(/\D/g, '')));
  },

  /**
   * Checks if this client has any prior remedy invoices or complaints
   */
  checkClientHistory(phone: string, invoices: Invoice[]): {
    hasComplaints: boolean;
    complaintsCount: number;
    hasPreviousRemedy: boolean;
    remedyInvoices: Invoice[];
    lastRemedyDate?: string;
    warningMessage?: string;
  } {
    const clientComplaints = this.getClientComplaints(phone);
    const cleaned = phone.replace(/\D/g, '');
    const remedyInvoices = invoices.filter(inv => 
      inv.isRemedyInvoice && 
      inv.clientPhone && 
      (inv.clientPhone.replace(/\D/g, '').includes(cleaned) || cleaned.includes(inv.clientPhone.replace(/\D/g, '')))
    );

    const hasPreviousRemedy = remedyInvoices.length > 0 || clientComplaints.some(c => c.isRemedyProvided);
    const lastRemedy = remedyInvoices[0];

    let warningMessage = '';
    if (hasPreviousRemedy) {
      warningMessage = `⚠️ تنبيه سجل العميل: تم عمل إصلاح مجاني (ضمان الصالون) سابقاً لهذا العميل${lastRemedy ? ` بتاريخ ${lastRemedy.date}` : ''} برصيد 0.00 ر.س. يرجى مراجعة سجل الشكاوى قبل تقديم أي تعويض جديد.`;
    }

    return {
      hasComplaints: clientComplaints.length > 0,
      complaintsCount: clientComplaints.length,
      hasPreviousRemedy,
      remedyInvoices,
      lastRemedyDate: lastRemedy?.date,
      warningMessage: warningMessage || undefined
    };
  }
};
