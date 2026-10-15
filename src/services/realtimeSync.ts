/**
 * خدمة المزامنة اللحظية عبر WebSockets (Socket.io)
 * تبث أحداث قاعدة بيانات libSQL لحظياً بين كافة الأجهزة المتصلة على الشبكة المحلية أو السحابية
 */
import { io, Socket } from 'socket.io-client';

export interface RealtimeTableEvent {
  type?: 'table_change' | 'db_change';
  table: string;
  action: 'insert' | 'upsert' | 'update' | 'delete';
  data?: any;
  filters?: any;
  id?: string;
  timestamp: number;
}

type TableListener = (event: RealtimeTableEvent) => void;

class RealtimeSyncManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<TableListener>> = new Map();
  private isConnected = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSocket();
    }
  }

  private getSocketUrl(): string | null {
    if (typeof window !== 'undefined') {
      const customUrl = localStorage.getItem('smartcut_api_url') || localStorage.getItem('smartcut_mssql_api_url');
      if (customUrl && customUrl.startsWith('http')) {
        return customUrl.replace(/\/+$/, '');
      }
      const host = window.location.hostname;
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host) || /^10\./.test(host);
      if (isLocalHost) {
        return window.location.origin;
      }
      // On public cloud domains (like smartcut.besmartapps.com), there is no local socket.io server
      // unless customUrl is explicitly set in localStorage. Avoid connecting to prevent errors.
      return null;
    }
    return 'http://localhost:3001';
  }

  public initSocket() {
    if (this.socket || typeof window === 'undefined') return;

    try {
      const socketUrl = this.getSocketUrl();
      if (!socketUrl) {
        // Cloud production mode without dedicated socket server - real-time sync runs via Supabase
        return;
      }
      console.log(`[WebSockets] Connecting to real-time server at: ${socketUrl}`);

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log(`[WebSockets] Connected to real-time server! (ID: ${this.socket?.id})`);
        
        // Re-subscribe to all active table rooms
        for (const table of this.listeners.keys()) {
          if (table !== '*') {
            this.socket?.emit('subscribe_table', table);
          }
        }
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (err) => {
        // Silent or debug only to avoid console noise
      });

      // Listen to universal database changes
      this.socket.on('db_change', (event: RealtimeTableEvent) => {
        if (event && event.table) {
          this.dispatchTableChange(event);
        }
      });

      this.socket.on('table_change', (event: RealtimeTableEvent) => {
        if (event && event.table) {
          this.dispatchTableChange(event);
        }
      });

      // Listen to Turso cloud sync completion events
      this.socket.on('cloud-sync-complete', (payload: any) => {
        console.log('[WebSockets] Received cloud-sync-complete notification:', payload);
        this.dispatchCloudSyncComplete(payload);
      });
    } catch (err: any) {
      console.error('[WebSockets] Initialization error:', err?.message || err);
    }
  }

  private cloudSyncListeners: Set<(payload: any) => void> = new Set();

  private dispatchCloudSyncComplete(payload: any) {
    this.cloudSyncListeners.forEach(fn => {
      try {
        fn(payload);
      } catch (e) {
        console.error('Error in cloud-sync-complete listener:', e);
      }
    });

    try {
      window.dispatchEvent(new CustomEvent('smartcut:cloud-sync-complete', { detail: payload }));
    } catch {}
  }

  public onCloudSyncComplete(callback: (payload: any) => void): () => void {
    this.cloudSyncListeners.add(callback);
    return () => {
      this.cloudSyncListeners.delete(callback);
    };
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  private dispatchTableChange(event: RealtimeTableEvent) {
    const tableKey = (event.table || '').toLowerCase();

    // 1. Notify listeners specific to this table
    const tableListeners = this.listeners.get(tableKey);
    if (tableListeners) {
      tableListeners.forEach(listener => {
        try {
          listener(event);
        } catch (e) {
          console.error(`Error in realtime table listener for [${tableKey}]:`, e);
        }
      });
    }

    // 2. Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => {
        try {
          listener(event);
        } catch (e) {
          console.error('Error in realtime wildcard listener:', e);
        }
      });
    }

    // 3. Dispatch browser CustomEvent for decoupled application-level handling
    try {
      window.dispatchEvent(new CustomEvent('smartcut:realtime_change', { detail: event }));
    } catch {}
  }

  /**
   * الاشتراك في أحداث جدول معين أو عدة جداول
   * @param tables اسم الجدول أو مصفوفة أسماء الجداول (أو '*' للكل)
   * @param callback الدالة المستدعاة فور ورود تعديل
   * @returns دالة إلغاء الاشتراك
   */
  public subscribe(tables: string | string[], callback: TableListener): () => void {
    const tableArr = Array.isArray(tables) ? tables : [tables];

    tableArr.forEach(tbl => {
      const key = tbl.toLowerCase();
      if (!this.listeners.has(key)) {
        this.listeners.set(key, new Set());
        if (this.socket && key !== '*') {
          this.socket.emit('subscribe_table', key);
        }
      }
      this.listeners.get(key)!.add(callback);
    });

    return () => {
      tableArr.forEach(tbl => {
        const key = tbl.toLowerCase();
        const set = this.listeners.get(key);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            this.listeners.delete(key);
            if (this.socket && key !== '*') {
              this.socket.emit('unsubscribe_table', key);
            }
          }
        }
      });
    };
  }
}

export const RealtimeSync = new RealtimeSyncManager();
