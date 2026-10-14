import React, { useState, useEffect } from 'react';
import { 
  Cloud, CloudCheck, CloudOff, RefreshCw, Key, Globe, Clock, ShieldCheck, 
  AlertTriangle, Check, CheckCircle2, Lock, Zap, Server, Database, ArrowRightLeft,
  X, Eye, EyeOff
} from 'lucide-react';
import { RealtimeSync } from '../services/realtimeSync';

interface TursoConfigState {
  turso_url: string;
  turso_auth_token: string;
  has_token: boolean;
  sync_interval: '1m' | '5m' | '15m' | 'manual';
  last_sync_time: string | null;
  last_sync_status: 'idle' | 'syncing' | 'connected' | 'error' | 'disconnected';
  last_sync_error: string | null;
  is_active: boolean;
  is_replica_mode: boolean;
}

interface TursoCloudSyncProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
  onSyncTriggered?: () => void;
}

export function TursoCloudSyncModal({ 
  isOpen = true, 
  onClose, 
  isEmbedded = false,
  onSyncTriggered 
}: TursoCloudSyncProps) {
  const [config, setConfig] = useState<TursoConfigState>({
    turso_url: '',
    turso_auth_token: '',
    has_token: false,
    sync_interval: '5m',
    last_sync_time: null,
    last_sync_status: 'disconnected',
    last_sync_error: null,
    is_active: false,
    is_replica_mode: false
  });

  const [loading, setLoading] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const getBaseApiUrl = () => {
    if (typeof window !== 'undefined') {
      const customUrl = localStorage.getItem('smartcut_api_url') || localStorage.getItem('smartcut_mssql_api_url');
      if (customUrl && customUrl.startsWith('http')) {
        return customUrl.replace(/\/+$/, '');
      }
      return window.location.origin;
    }
    return 'http://localhost:3001';
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getBaseApiUrl()}/api/turso/config`);
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(prev => ({
          ...prev,
          ...data.config,
          is_replica_mode: data.config.is_replica_mode ?? prev.is_replica_mode
        }));
      }
    } catch (err: any) {
      console.warn('Failed to load Turso config:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();

    // Listen to cloud sync complete events
    const unsub = RealtimeSync.onCloudSyncComplete((payload) => {
      setConfig(prev => ({
        ...prev,
        last_sync_time: payload.timestamp || new Date().toISOString(),
        last_sync_status: 'connected',
        last_sync_error: null
      }));
    });

    return () => {
      unsub();
    };
  }, []);

  const handleSaveAndConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config.turso_url.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال عنوان السيرفر السحابي' });
      return;
    }

    if (!config.turso_auth_token.trim() && !config.has_token) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال رمز الأمان السحابي' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${getBaseApiUrl()}/api/turso/save-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turso_url: config.turso_url.trim(),
          turso_auth_token: config.turso_auth_token.trim(),
          sync_interval: config.sync_interval
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: data.warning ? 'warning' : 'success',
          text: data.message || 'تم الاتصال بالسحابة بنجاح!'
        });
        if (data.config) {
          setConfig(prev => ({ ...prev, ...data.config, is_replica_mode: true }));
        }
        if (onSyncTriggered) onSyncTriggered();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'فشل الاتصال بالسحابة'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `خطأ في الاتصال: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('هل أنت متأكد من إيقاف المزامنة والعمل محلياً؟ ستظل جميع بياناتك محفوظة بالكامل وبأمان.')) {
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${getBaseApiUrl()}/api/turso/disconnect`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: 'تم إيقاف المزامنة السحابية والتحول للوضع المحلي بنجاح'
        });
        setConfig(prev => ({
          ...prev,
          turso_url: '',
          turso_auth_token: '',
          has_token: false,
          is_active: false,
          is_replica_mode: false,
          last_sync_status: 'disconnected'
        }));
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'تعذر إيقاف الاتصال' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncingNow(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${getBaseApiUrl()}/api/turso/sync-now`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: 'تمت المزامنة بنجاح!'
        });
        setConfig(prev => ({
          ...prev,
          last_sync_time: data.timestamp || new Date().toISOString(),
          last_sync_status: 'connected',
          last_sync_error: null
        }));
        if (onSyncTriggered) onSyncTriggered();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'فشلت المزامنة. يرجى التحقق من اتصال الإنترنت.'
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingNow(false);
    }
  };

  const isConnected = config.is_replica_mode && config.is_active;

  const content = (
    <div className="space-y-6 text-slate-800">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white border border-indigo-500/20 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner border ${
              isConnected 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-950'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
            }`}>
              {isConnected ? <Zap className="animate-pulse" size={28} /> : <Server size={28} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-white">إعدادات المزامنة السحابية</h3>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    🟢 متصل بالسحابة
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300 border border-slate-700">
                    ⚪ غير متصل (يعمل محلياً)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-xl">
                مزامنة وحفظ بيانات الصالون والحجوزات سحابياً لربط الفروع واستعراض البيانات في أي وقت.
              </p>
            </div>
          </div>

          {isConnected && (
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncingNow || loading}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md hover:shadow-indigo-500/25 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncingNow ? 'animate-spin' : ''} />
              <span>{syncingNow ? 'جاري المزامنة...' : 'مزامنة الآن ☁️'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 border transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
            : statusMessage.type === 'warning'
            ? 'bg-amber-50 text-amber-900 border-amber-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={18} className="text-rose-600 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Status Details Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <Clock size={14} className="text-indigo-600" />
            <span>آخر مزامنة ناجحة</span>
          </div>
          <div className="text-xs font-black text-slate-800">
            {config.last_sync_time 
              ? new Date(config.last_sync_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' - ' + new Date(config.last_sync_time).toLocaleDateString('ar-EG')
              : 'لم تتم مزامنة بعد'}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <ArrowRightLeft size={14} className="text-emerald-600" />
            <span>معدل المزامنة التلقائية</span>
          </div>
          <div className="text-xs font-black text-slate-800">
            {config.sync_interval === '1m' ? 'كل دقيقة' :
             config.sync_interval === '5m' ? 'كل 5 دقائق (الموصى به)' :
             config.sync_interval === '15m' ? 'كل 15 دقيقة' : 'مزامنة يدوية فقط'}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <Database size={14} className="text-blue-600" />
            <span>حالة الاتصال</span>
          </div>
          <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {isConnected ? 'متصل بالسحابة ومفعل' : 'يعمل بالوضع المحلي بدون إنترنت'}
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveAndConnect} className="space-y-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div>
          <label className="block text-xs font-black text-slate-800 mb-1.5">
            رابط السحابة
          </label>
          <div className="relative">
            <input
              type="text"
              value={config.turso_url}
              onChange={(e) => setConfig({ ...config, turso_url: e.target.value })}
              placeholder="أدخل رابط السحابة..."
              dir="ltr"
              required
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 outline-none transition-all pl-9"
            />
            <Globe size={16} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-800 mb-1.5">
            رمز الأمان
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.turso_auth_token}
              onChange={(e) => setConfig({ ...config, turso_auth_token: e.target.value })}
              placeholder={config.has_token ? '•••••••••••••••••••••••• (محفوظ، اكتب لتغييره)' : 'أدخل رمز الأمان هنا...'}
              dir="ltr"
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 outline-none transition-all pl-9 pr-10"
            />
            <Key size={16} className="absolute left-3 top-3 text-slate-400" />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-1"
            >
              {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-800 mb-1.5">
            تكرار التحديث التلقائي
          </label>
          <select
            value={config.sync_interval}
            onChange={(e) => setConfig({ ...config, sync_interval: e.target.value as any })}
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
          >
            <option value="1m">كل دقيقة</option>
            <option value="5m">كل 5 دقائق (الموصى به)</option>
            <option value="15m">كل 15 دقيقة</option>
            <option value="manual">يدوي فقط عند الضغط على زر المزامنة</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>جاري الاتصال...</span>
                </>
              ) : (
                <>
                  <CloudCheck size={16} />
                  <span>حفظ وتفعيل الاتصال السحابي</span>
                </>
              )}
            </button>

            {isConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <CloudOff size={15} />
                <span>إيقاف المزامنة (العمل محلياً فقط)</span>
              </button>
            )}
          </div>

          {!isEmbedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              إغلاق النافذة
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 left-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
        >
          <X size={16} />
        </button>
        {content}
      </div>
    </div>
  );
}
