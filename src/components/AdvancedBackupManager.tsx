import React, { useState, useEffect } from 'react';
import { 
  Database, Clock, Calendar, Check, Trash2, Plus, 
  RefreshCw, Download, ShieldCheck, AlertCircle, HardDrive, CheckCircle2,
  Folder, FileArchive, Sliders
} from 'lucide-react';
import { DB } from '../services/db';

const DAYS_OF_WEEK = [
  { id: 'Saturday', label: 'السبت' },
  { id: 'Sunday', label: 'الأحد' },
  { id: 'Monday', label: 'الإثنين' },
  { id: 'Tuesday', label: 'الثلاثاء' },
  { id: 'Wednesday', label: 'الأربعاء' },
  { id: 'Thursday', label: 'الخميس' },
  { id: 'Friday', label: 'الجمعة' }
];

const FREQUENCY_PRESETS = [
  { id: 'every_1_hour', label: 'كل ساعة (Every 1 hour)' },
  { id: 'every_3_hours', label: 'كل 3 ساعات (Every 3 hours)' },
  { id: 'every_6_hours', label: 'كل 6 ساعات (Every 6 hours)' },
  { id: 'every_12_hours', label: 'كل 12 ساعة (Every 12 hours)' },
  { id: 'once_a_day', label: 'مرة واحدة يومياً (Once a day)' }
];

export function AdvancedBackupManager() {
  const [enabled, setEnabled] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  ]);
  
  // وضع الجدولة الحصري: إما تكرار دوري (frequency) أو مواعيد دقيقة مخصصة (custom_times) وليس الاثنين معاً
  const [scheduleMode, setScheduleMode] = useState<'frequency' | 'custom_times'>('frequency');
  const [frequencyPreset, setFrequencyPreset] = useState('every_6_hours');
  
  // Custom exact times
  const [customTimes, setCustomTimes] = useState<string[]>(['02:00', '14:00', '23:00']);
  const [selectedHour, setSelectedHour] = useState('02');
  const [selectedMinute, setSelectedMinute] = useState('00');

  // مسار حفظ النسخ الاحتياطية على القرص
  const [backupDir, setBackupDir] = useState<string>('');
  const [defaultDir, setDefaultDir] = useState<string>('');

  // Logs & status
  const [backups, setBackups] = useState<any[]>([]);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load initial settings and backup list
  useEffect(() => {
    loadSettingsAndBackups();
  }, []);

  const loadSettingsAndBackups = async () => {
    setIsLoading(true);
    try {
      const [settingsData, listData] = await Promise.all([
        DB.fetchBackupSettings(),
        DB.fetchBackupList()
      ]);

      if (settingsData) {
        setEnabled(settingsData.enabled !== 0 && settingsData.enabled !== false);
        if (Array.isArray(settingsData.days)) setSelectedDays(settingsData.days);
        if (settingsData.scheduleMode) setScheduleMode(settingsData.scheduleMode === 'custom_times' ? 'custom_times' : 'frequency');
        if (settingsData.frequencyPreset) setFrequencyPreset(settingsData.frequencyPreset);
        if (Array.isArray(settingsData.customTimes)) setCustomTimes(settingsData.customTimes);
        if (settingsData.lastBackupAt) setLastBackupAt(settingsData.lastBackupAt);
        if (settingsData.backupDir) {
          setBackupDir(settingsData.backupDir);
          setDefaultDir(settingsData.backupDir);
        }
      }

      if (listData && Array.isArray(listData.files)) {
        setBackups(listData.files);
      }
    } catch (e: any) {
      console.warn('Error loading backup settings:', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelectAllDays = () => {
    if (selectedDays.length === DAYS_OF_WEEK.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays(DAYS_OF_WEEK.map(d => d.id));
    }
  };

  const handleToggleDay = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleAddExactTime = () => {
    const timeStr = `${selectedHour.padStart(2, '0')}:${selectedMinute.padStart(2, '0')}`;
    if (!customTimes.includes(timeStr)) {
      setCustomTimes([...customTimes, timeStr].sort());
    }
  };

  const handleRemoveExactTime = (timeStr: string) => {
    setCustomTimes(customTimes.filter(t => t !== timeStr));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const ok = await DB.saveBackupSettings({
        enabled,
        days: selectedDays,
        scheduleMode,
        frequencyPreset,
        customTimes,
        backupDir
      });
      if (ok) {
        setMessage({ text: 'تم حفظ إعدادات النسخ الاحتياطي ومسار التخزين ونظام الجدولة بنجاح!', type: 'success' });
      } else {
        setMessage({ text: 'تعذر حفظ الإعدادات، يرجى المحاولة مجدداً.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'حدث خطأ أثناء الحفظ', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleTriggerBackupNow = async () => {
    setIsBackingUp(true);
    setMessage(null);
    try {
      const res = await DB.triggerBackupNow(backupDir);
      if (res.success) {
        const destPath = res.backup?.filepath || backupDir || 'مكان التخزين المحدد';
        setMessage({ 
          text: `تم إنشاء النسخة الاحتياطية بنجاح وضغطها (.zip) وحفظها لحظياً في مكان التخزين: ${destPath}`, 
          type: 'success' 
        });
        setLastBackupAt(new Date().toISOString());
        // Refresh backups list
        const listData = await DB.fetchBackupList();
        if (listData && Array.isArray(listData.files)) {
          setBackups(listData.files);
        }
      } else {
        setMessage({ text: res.error || 'فشل إنشاء النسخة الاحتياطية', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'فشل الاتصال بالسيرفر', type: 'error' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('ar-SA', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-slate-900/90 text-slate-100 rounded-3xl p-6 border-2 border-indigo-500/40 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <FileArchive size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white">إدارة النسخ الاحتياطي التلقائي وضغط البيانات (.zip)</h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                ZIP Compressed 📦
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              جدولة النسخ الدوري أو المواعيد الدقيقة المخصصة، وتحديد مسار الحفظ، وضغط الملفات تلقائياً بصيغة .zip لتوفير المساحة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTriggerBackupNow}
            disabled={isBackingUp}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {isBackingUp ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>جاري إنشاء النسخة وحفظها...</span>
              </>
            ) : (
              <>
                <HardDrive size={15} />
                <span>إنشاء نسخة احتياطية الآن</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
            <span>حفظ الإعدادات</span>
          </button>
        </div>
      </div>

      {/* Status banner */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${
          message.type === 'success' 
            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Backup Directory Path Configuration */}
      <div className="bg-slate-800/90 p-4.5 rounded-2xl border border-slate-700/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-black text-slate-200 flex items-center gap-2">
            <Folder size={16} className="text-amber-400" />
            <span>مسار حفظ وتخزين النسخ الاحتياطية على الجهاز (Backup Save Directory):</span>
          </label>
          {defaultDir && backupDir !== defaultDir && (
            <button
              type="button"
              onClick={() => setBackupDir(defaultDir)}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer text-right"
            >
              استعادة المسار الافتراضي للبرنامج
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          حدد المجلد أو المسار على القرص الصلب لحفظ ملفات النسخ الاحتياطية المضغوطة (.zip) به (مثال: <code className="text-amber-300 font-mono" dir="ltr">D:\SmartCut_Backups</code> أو مجلد البرنامج الافتراضي):
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={backupDir}
            onChange={(e) => setBackupDir(e.target.value)}
            placeholder="مثال: D:\SmartCut_Backups أو C:\Backups..."
            className="bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-xs rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 w-full tracking-wide"
            dir="ltr"
          />
        </div>

        {/* Action Button inside storage box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-700/60">
          <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span>يتم ضغط قاعدة البيانات بصيغة <b>.zip</b> وحفظها فورياً ولحظياً في المسار المحدد أعلاه.</span>
          </div>
          <button
            type="button"
            onClick={handleTriggerBackupNow}
            disabled={isBackingUp}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-900/30 transition-all cursor-pointer whitespace-nowrap"
          >
            {isBackingUp ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>جاري الحفظ في مكان التخزين...</span>
              </>
            ) : (
              <>
                <HardDrive size={14} />
                <span>إنشاء نسخة احتياطية الآن</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Days Selection */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-400" />
                <h4 className="text-sm font-extrabold text-white">أيام عمل النسخ التلقائي</h4>
              </div>
              <button
                type="button"
                onClick={handleToggleSelectAllDays}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                {selectedDays.length === DAYS_OF_WEEK.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              حدد الأيام التي ترغب في تشغيل مهام النسخ التلقائي خلالها:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {DAYS_OF_WEEK.map(day => {
                const isSelected = selectedDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleToggleDay(day.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900/40 border-slate-700/60 text-slate-400 hover:bg-slate-900/70'
                    }`}
                  >
                    <span>{day.label}</span>
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                      isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-600'
                    }`}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/50">
            <span className="text-[11px] text-slate-400">
              الأيام النشطة: <strong className="text-indigo-300">{selectedDays.length}</strong> من أصل 7 أيام
            </span>
          </div>
        </div>

        {/* 2 & 3. Mutually Exclusive Schedule Mode: Either Frequency OR Custom Times */}
        <div className="lg:col-span-2 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-indigo-400" />
                <h4 className="text-sm font-extrabold text-white">نظام وتوقيت الجدولة (اختيار حصري)</h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                اختر إما التردد الدوري (أو) مواعيد دقيقة محددة:
              </span>
            </div>

            {/* Mutually Exclusive Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setScheduleMode('frequency')}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer text-right ${
                  scheduleMode === 'frequency'
                    ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30'
                    : 'bg-slate-900/50 border-slate-700/60 text-slate-400 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    scheduleMode === 'frequency' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Clock size={16} />
                  </div>
                  <div>
                    <p className={`text-xs font-black ${scheduleMode === 'frequency' ? 'text-amber-300' : 'text-slate-300'}`}>
                      الخيار (1): تردد وتكرار دوري
                    </p>
                    <p className="text-[10px] text-slate-400">التشغيل كل عدد محدد من الساعات</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  scheduleMode === 'frequency' ? 'border-amber-400 bg-amber-500 text-slate-950' : 'border-slate-600'
                }`}>
                  {scheduleMode === 'frequency' && <div className="w-2 h-2 rounded-full bg-slate-950"></div>}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScheduleMode('custom_times')}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer text-right ${
                  scheduleMode === 'custom_times'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                    : 'bg-slate-900/50 border-slate-700/60 text-slate-400 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    scheduleMode === 'custom_times' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className={`text-xs font-black ${scheduleMode === 'custom_times' ? 'text-emerald-300' : 'text-slate-300'}`}>
                      الخيار (2): مواعيد دقيقة مخصصة
                    </p>
                    <p className="text-[10px] text-slate-400">ساعات ودقائق محددة يومياً</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  scheduleMode === 'custom_times' ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-600'
                }`}>
                  {scheduleMode === 'custom_times' && <div className="w-2 h-2 rounded-full bg-slate-950"></div>}
                </div>
              </button>
            </div>

            {/* Content for Mode 1: Frequency Presets */}
            {scheduleMode === 'frequency' && (
              <div className="space-y-3 bg-slate-900/50 p-4 rounded-2xl border border-amber-500/30 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  <h5 className="text-xs font-bold text-amber-300">حدد الفترة الزمنية الدورية للتكرار:</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FREQUENCY_PRESETS.map(preset => {
                    const isSelected = frequencyPreset === preset.id;
                    return (
                      <label
                        key={preset.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/60 text-white font-black'
                            : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-950/80'
                        }`}
                      >
                        <input
                          type="radio"
                          name="frequencyPreset"
                          value={preset.id}
                          checked={isSelected}
                          onChange={() => setFrequencyPreset(preset.id)}
                          className="text-amber-500 focus:ring-amber-400 w-3.5 h-3.5"
                        />
                        <span className="text-xs">{preset.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content for Mode 2: Custom Exact Times */}
            {scheduleMode === 'custom_times' && (
              <div className="space-y-3 bg-slate-900/50 p-4 rounded-2xl border border-emerald-500/30 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <h5 className="text-xs font-bold text-emerald-300">تحديد أوقات محددة يومياً (ساعة ودقيقة):</h5>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    المسجل: <strong className="text-emerald-300">{customTimes.length} مواعيد</strong>
                  </span>
                </div>

                {/* Time Pickers */}
                <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-700">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1">الساعة (00-23)</label>
                    <select
                      value={selectedHour}
                      onChange={(e) => setSelectedHour(e.target.value)}
                      className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-1.5 text-xs font-bold text-center focus:border-indigo-500"
                    >
                      {Array.from({ length: 24 }).map((_, i) => {
                        const h = String(i).padStart(2, '0');
                        return <option key={h} value={h}>{h}</option>;
                      })}
                    </select>
                  </div>

                  <span className="font-black text-slate-400 mt-4">:</span>

                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1">الدقيقة (00-59)</label>
                    <select
                      value={selectedMinute}
                      onChange={(e) => setSelectedMinute(e.target.value)}
                      className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-1.5 text-xs font-bold text-center focus:border-indigo-500"
                    >
                      {Array.from({ length: 60 }).map((_, i) => {
                        const m = String(i).padStart(2, '0');
                        return <option key={m} value={m}>{m}</option>;
                      })}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddExactTime}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                    title="إضافة هذا التوقيت"
                  >
                    <Plus size={14} />
                    <span>إضافة</span>
                  </button>
                </div>

                {/* Configured Times Badges */}
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {customTimes.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-2 w-full">لم يتم إضافة مواعيد دقيقة مخصصة بعد</p>
                  ) : (
                    customTimes.map(t => (
                      <div
                        key={t}
                        className="flex items-center gap-2 bg-slate-950 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-bold"
                      >
                        <Clock size={12} className="text-emerald-400" />
                        <span dir="ltr" className="text-emerald-300 font-mono font-black">{t}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExactTime(t)}
                          className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer rounded"
                          title="حذف هذا التوقيت"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
            <span>الجدولة المعتمدة حالياً:</span>
            <span className="font-extrabold text-amber-300">
              {scheduleMode === 'frequency' 
                ? `تردد دوري: ${FREQUENCY_PRESETS.find(p => p.id === frequencyPreset)?.label.split('(')[0] || 'كل 6 ساعات'}`
                : `مواعيد دقيقة مخصصة (${customTimes.length} أوقات محددة يومياً)`
              }
            </span>
          </div>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-indigo-400" />
            <h4 className="text-sm font-extrabold text-white">سجل النسخ الاحتياطية المضغوطة المتوفرة</h4>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-bold">
              {backups.length} نسخة
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            {lastBackupAt && (
              <span>آخر نسخة تم إنشاؤها: <strong className="text-emerald-300">{formatDate(lastBackupAt)}</strong></span>
            )}
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            لا توجد نسخ احتياطية مسجلة بعد. اضغط على "نسخ احتياطي فوري (.zip)" لإنشاء وضغط أول نسخة لقاعدة البيانات.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700/50 text-[11px]">
                  <th className="py-2.5 px-3">اسم ملف النسخة</th>
                  <th className="py-2.5 px-3">حجم الملف المضغوط</th>
                  <th className="py-2.5 px-3">تاريخ ووقت الإنشاء</th>
                  <th className="py-2.5 px-3">الصيغة والحالة</th>
                  <th className="py-2.5 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 font-medium">
                {backups.map((b, idx) => (
                  <tr key={b.filename || idx} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-300 truncate max-w-xs" dir="ltr">
                      {b.filename}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-300">
                      {formatFileSize(b.filesize)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {formatDate(b.createdAt)}
                    </td>
                    <td className="py-2.5 px-3">
                      {b.filename?.endsWith('.zip') || b.isZip ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          <FileArchive size={11} />
                          <span>مضغوطة (.zip) آمنة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} />
                          <span>قاعدة بيانات SQLite</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <a
                        href={`/api/backup/download/${encodeURIComponent(b.filename)}`}
                        download={b.filename}
                        className="inline-flex items-center gap-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white border border-indigo-500/30 px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                        title="تحميل ملف النسخة الاحتياطية"
                      >
                        <Download size={13} />
                        <span>تحميل</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
