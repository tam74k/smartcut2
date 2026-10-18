import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Mic, MicOff, Sparkles, Database, Trash2, Settings, 
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Check,
  Code2, RefreshCw, Terminal, ArrowRight, Zap, ShieldCheck, HelpCircle,
  Key, ExternalLink, X, Lock
} from 'lucide-react';
import { AppSettings, AppUser } from '../types';
import { 
  ChatMessage, 
  sendManagerGeminiMessage, 
  getAiCredentials, 
  saveAiCredentials,
  DEFAULT_AI_MODEL,
  POPULAR_AI_MODELS 
} from '../services/geminiSqlService';
import { DB } from '../services/db';

interface ManagerAIChatScreenProps {
  settings: AppSettings;
  setSettings?: (s: AppSettings) => void;
  currentUser?: AppUser | null;
  onNavigateScreen?: (screen: string) => void;
}

const SUGGESTED_QUERIES = [
  { label: 'مبيعات اليوم', query: 'ما هو إجمالي المبيعات وعدد الفواتير الصادرة اليوم في الصالون؟' },
  { label: 'إيرادات الفنيين', query: 'من هم أعلى 5 فنيين وحلاقين تحقيقاً للإيرادات مع إجمالي مبالغ كل منهم؟' },
  { label: 'أرصدة الخزائن الحالية', query: 'كم الرصيد الحالي المتوفر في كل خزينة من خزائن الصالون؟' },
  { label: 'نواقص المخزون', query: 'ما هي المنتجات التي وصلت لحد إعادة الطلب أو التي كمياتها صفر أو منخفضة؟' },
  { label: 'كبار العملاء (VIP)', query: 'أعطني قائمة بأعلى 5 عملاء إنفاقاً وزيارات في الصالون مع أرقام هواتفهم وإجمالي إنفاقهم.' },
  { label: 'مصروفات الشهر', query: 'ما هو إجمالي سندات الصرف والمصروفات المسجلة لهذا الشهر مقسمة حسب البنود؟' }
];

export function ManagerAIChatScreen({
  settings,
  setSettings,
  currentUser,
  onNavigateScreen
}: ManagerAIChatScreenProps) {
  const credentials = getAiCredentials(settings);
  const [geminiApiKey, setGeminiApiKey] = useState(credentials.apiKey);
  const [geminiModel, setGeminiModel] = useState(credentials.model || DEFAULT_AI_MODEL);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showKeyText, setShowKeyText] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const isKeyConfigured = Boolean(geminiApiKey && geminiApiKey.trim().length > 10);
  const activeModel = geminiModel || DEFAULT_AI_MODEL;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartcut_manager_ai_history_gemini');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Failed to load saved chat history:', e);
      }
    }
    return [
      {
        role: 'assistant',
        content: `مرحباً بك يا مدير الصالون.\n\nأنا **مساعد الإدارة الذكي** الخاص بصالونك.\nيمكنني مساعدتك في الإجابة على استفساراتك وتقديم تقارير دقيقة وتحليلات وإحصائيات فورية لأداء الصالون.\n\nيمكنك سؤالي كتابةً أو **بالصوت** عن المبيعات، أداء الفنيين، الحجوزات، المصروفات، الخزائن، المخزون، أو كبار العملاء.`
      }
    ];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [expandedSqlIndex, setExpandedSqlIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync settings when changed externally
  useEffect(() => {
    const creds = getAiCredentials(settings);
    if (creds.apiKey && creds.apiKey !== geminiApiKey) {
      setGeminiApiKey(creds.apiKey);
    }
    if (creds.model && creds.model !== geminiModel) {
      setGeminiModel(creds.model);
    }
  }, [settings.aiApiKey, settings.aiModel, settings.openrouterApiKey]);

  // Persist history to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        const toSave = messages.slice(-40);
        localStorage.setItem('smartcut_manager_ai_history_gemini', JSON.stringify(toSave));
      } catch (e) {
        console.warn('Failed to save chat history:', e);
      }
    }
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Microphone permission state
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'prompt' | 'denied' | 'unsupported'>('checking');
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [micSuccessMessage, setMicSuccessMessage] = useState<string | null>(null);

  // Initialize Web Speech Recognition
  const initSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch (e) {}
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInputQuery(prev => {
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${transcript}` : transcript;
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setMicPermission('denied');
            setSpeechError('تم رفض إذن الوصول إلى الميكروفون في المتصفح. اضغط على زر تفعيل الميكروفون بالأعلى للسماح به.');
          } else if (event.error === 'no-speech') {
            // Quietly reset
          } else {
            setSpeechError(`خطأ في التسجيل الصوتي (${event.error})`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to initialize speech recognition:', e);
      }
    }
  };

  // Check microphone permission across modern browsers
  const checkMicPermission = async () => {
    if (typeof window === 'undefined') return;

    const hasGetUserMedia = Boolean(navigator?.mediaDevices?.getUserMedia);
    const hasSpeech = Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!hasGetUserMedia && !hasSpeech) {
      setMicPermission('unsupported');
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' as any });
        setMicPermission(status.state as any);
        status.onchange = () => {
          setMicPermission(status.state as any);
          if (status.state === 'granted') {
            initSpeechRecognition();
          }
        };
        return;
      }
    } catch (e) {
      // Ignored for iOS Safari
    }

    const cached = localStorage.getItem('smartcut_mic_permission');
    if (cached === 'granted') {
      setMicPermission('granted');
    } else {
      setMicPermission('prompt');
    }
  };

  // Request microphone permission on demand
  const requestMicPermission = async () => {
    setSpeechError(null);
    setIsRequestingMic(true);

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setMicPermission('granted');
          return;
        }
        setMicPermission('unsupported');
        setSpeechError('المتصفح الحالي لا يدعم الوصول المباشر للمايكروفون.');
        return;
      }

      // Triggers the native browser permission prompt!
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately after granting
      stream.getTracks().forEach(track => track.stop());

      setMicPermission('granted');
      if (typeof window !== 'undefined') {
        localStorage.setItem('smartcut_mic_permission', 'granted');
      }

      initSpeechRecognition();
      setMicSuccessMessage('تم تفعيل إذن الميكروفون بنجاح! يمكنك الآن التحدث مباشرة عبر زر المايك.');
      setTimeout(() => setMicSuccessMessage(null), 3500);
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied');
        setSpeechError('تم رفض إذن المايكروفون. لتفعيله: اضغط على رمز القفل 🔒 أو الكاميرا/المايك بجوار شريط العنوان في المتصفح واسمح بالمايكروفون ثم حدّث الصفحة.');
      } else {
        setSpeechError(`تعذر تفعيل المايكروفون: ${err.message || 'خطأ غير معروف'}`);
      }
    } finally {
      setIsRequestingMic(false);
    }
  };

  useEffect(() => {
    checkMicPermission();
    initSpeechRecognition();

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const toggleListening = async () => {
    setSpeechError(null);

    // If permission not granted yet, ask for it first!
    if (micPermission !== 'granted') {
      await requestMicPermission();
      return;
    }

    if (!recognitionRef.current) {
      initSpeechRecognition();
    }

    if (!recognitionRef.current) {
      setSpeechError('ميزة الإدخال الصوتي غير متوفرة في هذا المتصفح. يرجى استخدام Google Chrome أو Edge.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err);
        setSpeechError('تعذر بدء التعرف على الصوت. تحقق من الميكروفون.');
        setIsListening(false);
      }
    }
  };

  const handleSaveGeminiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiApiKey.trim()) {
      alert('الرجاء إدخال مفتاح API');
      return;
    }

    const cleanKey = geminiApiKey.trim();
    saveAiCredentials(cleanKey, geminiModel);

    const isGem = !geminiModel.includes('/');
    const updatedSettings: AppSettings = {
      ...settings,
      aiApiKey: cleanKey,
      aiProvider: isGem ? 'gemini' : 'openrouter',
      aiModel: geminiModel,
      aiAssistantEnabled: true,
      ...(isGem ? {} : { openrouterApiKey: cleanKey })
    };

    if (setSettings) {
      setSettings(updatedSettings);
    }

    try {
      await DB.saveSettings(settings.salonId, updatedSettings);
    } catch (saveErr) {
      console.warn('Failed to save settings to Supabase:', saveErr);
    }

    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
      setShowConfigModal(false);
    }, 1200);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputQuery).trim();
    if (!text || isLoading) return;

    if (!isKeyConfigured) {
      setShowConfigModal(true);
      return;
    }

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }

    const currentHistory = [...messages];
    const newMsg: ChatMessage = { role: 'user', content: text };
    
    setMessages(prev => [...prev, newMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const isGem = !geminiModel.includes('/');
      const activeSettingsWithKey: AppSettings = {
        ...settings,
        aiApiKey: geminiApiKey,
        aiProvider: isGem ? 'gemini' : 'openrouter',
        aiModel: geminiModel,
        aiAssistantEnabled: true,
        ...(isGem ? {} : { openrouterApiKey: geminiApiKey })
      };

      const response = await sendManagerGeminiMessage({
        userMessage: text,
        conversationHistory: currentHistory,
        settings: activeSettingsWithKey
      });

      setMessages(response.updatedHistory);
    } catch (err: any) {
      console.error('Manager AI Chat Error:', err);
      const rawMessage = err?.message || 'حدث خطأ غير متوقع أثناء معالجة السؤال.';
      let friendlyError = rawMessage;

      if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('403') || rawMessage.includes('invalid key')) {
        friendlyError = `مفتاح Google Gemini API Key غير صالح أو منتهي الصلاحية. يرجى التأكد من المفتاح وضبطه عبر زر الإعدادات بالصالون.`;
      } else if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
        friendlyError = `تم تجاوز معدل الطلبات المسموح به في حساب Gemini المجاني. يرجى الانتظار دقيقة والمحاولة مجدداً.`;
      } else if (rawMessage.includes('خرق أمني')) {
        friendlyError = rawMessage;
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `**تعذر إكمال الاستعلام:**\n\n${friendlyError}`,
          error: true
        }
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في مسح سجل المحادثة؟')) {
      const defaultMsg: ChatMessage = {
        role: 'assistant',
        content: `تم مسح المحادثة بنجاح. أهلاً بك من جديد! كيف يمكنني مساعدتك الآن؟`
      };
      setMessages([defaultMsg]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('smartcut_manager_ai_history_gemini');
      }
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-1.5 sm:p-4 gap-1.5 sm:gap-3 overflow-hidden select-none">
      {/* Alert when assistant is disabled in settings */}
      {settings.aiAssistantEnabled === false && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-2.5 sm:p-3 px-3 sm:px-4 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <span className="text-[11px] sm:text-xs">المساعد الذكي غير مفعّل حالياً في الإعدادات العامة للصالون.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const updated = { ...settings, aiAssistantEnabled: true };
                if (setSettings) setSettings(updated);
                try {
                  await DB.saveSettings(settings.salonId, updated);
                } catch (e) {}
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl transition text-[11px] cursor-pointer"
            >
              تفعيل المساعد الآن
            </button>
            {onNavigateScreen && (
              <button
                type="button"
                onClick={() => onNavigateScreen('settings')}
                className="bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold px-3 py-1.5 rounded-xl transition text-[11px] cursor-pointer"
              >
                الإعدادات
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2.5 sm:p-3.5 shadow-xs flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Back button on mobile to quickly exit chat */}
          {onNavigateScreen && (
            <button
              type="button"
              onClick={() => onNavigateScreen('dashboard')}
              className="p-1.5 sm:p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 sm:hidden shrink-0 cursor-pointer"
              title="العودة"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-primary to-teal-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xs sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                المساعد الذكي لإدارة الصالون
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 items-center gap-1 shadow-2xs">
                <Lock className="w-2.5 h-2.5 text-emerald-600" />
                آمن ومخصص لصالونك
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              تحليلات وتقارير ذكية وإحصائيات فورية لأداء الصالون بدقة عالية
            </p>
          </div>
        </div>

        {/* Model & Config Badges */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-[10px] sm:text-xs">
            <Zap className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 max-w-[80px] sm:max-w-[140px] truncate" title={activeModel}>
              {activeModel.replace(/^gemini-/, '')}
            </span>
          </div>

          {isKeyConfigured ? (
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-xs font-medium hover:bg-emerald-100 transition cursor-pointer"
              title="تعديل مفتاح Gemini"
            >
              <ShieldCheck className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">مفعل</span>
            </button>
          ) : (
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[10px] sm:text-xs font-medium hover:bg-rose-100 transition cursor-pointer animate-pulse"
            >
              <Key className="w-3 h-3 text-rose-500 shrink-0" />
              <span>ضبط</span>
            </button>
          )}

          <button
            onClick={handleClearHistory}
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
            title="مسح المحادثة بالكامل"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="p-1.5 sm:p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
            title="إعدادات Google Gemini"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Microphone Permission Prompt Banner */}
      {micPermission !== 'granted' && micPermission !== 'unsupported' && (
        <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 dark:from-indigo-950/40 dark:via-sky-950/30 dark:to-emerald-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-2 sm:p-3 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 text-xs">
                <span>تفعيل الميكروفون</span>
                {micPermission === 'denied' ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                    محظور
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                    مطلوب الإذن
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-1">
                {micPermission === 'denied'
                  ? 'اضغط رمز القفل 🔒 بجانب الرابط واسمح بالمايك ثم أعد المحاولة.'
                  : 'اضغط لتفعيل الميكروفون وسؤال المساعد بالصوت.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={requestMicPermission}
            disabled={isRequestingMic}
            className="w-full sm:w-auto shrink-0 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl transition text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isRequestingMic ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>جاري الطلب...</span>
              </>
            ) : (
              <>
                <Mic className="w-3 h-3" />
                <span>{micPermission === 'denied' ? 'إعادة طلب الإذن' : 'طلب وتفعيل الإذن الآن'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mic Success Toast */}
      {micSuccessMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-2 sm:p-2.5 rounded-xl text-xs flex items-center justify-between animate-fade-in shadow-xs shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">{micSuccessMessage}</span>
          </div>
          <button 
            onClick={() => setMicSuccessMessage(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 p-1 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Speech Error Banner if any */}
      {speechError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-2 sm:p-2.5 rounded-xl text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="text-[11px] sm:text-xs truncate">{speechError}</span>
          </div>
          <button 
            onClick={() => setSpeechError(null)}
            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer flex items-center justify-center shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2.5 sm:p-4 overflow-y-auto space-y-2.5 sm:space-y-4 shadow-inner">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isExpanded = expandedSqlIndex === index;

          return (
            <div
              key={index}
              className={`flex gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isUser
                    ? 'bg-zinc-800 dark:bg-zinc-700 text-amber-400'
                    : msg.error
                    ? 'bg-rose-600 text-white'
                    : 'bg-gradient-to-tr from-indigo-600 to-teal-500 text-white'
                }`}
              >
                {isUser ? (
                  <span className="font-bold text-[10px] sm:text-xs">{currentUser?.name?.[0] || 'م'}</span>
                ) : (
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </div>

              {/* Message Bubble Container */}
              <div className={`flex flex-col max-w-[90%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="text-[10px] sm:text-[11px] text-zinc-400 mb-1 px-1">
                  {isUser ? (currentUser?.name || 'المدير') : 'المساعد الذكي'}
                </div>

                <div
                  className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-indigo-600 text-white dark:bg-indigo-600 rounded-tr-none shadow-sm'
                      : msg.error
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-tl-none'
                      : 'bg-slate-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700/60 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Collapsible Executed SQL Query Card */}
                {msg.executedSql && (
                  <div className="mt-1.5 w-full max-w-full sm:max-w-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                    <button
                      onClick={() => setExpandedSqlIndex(isExpanded ? null : index)}
                      className="w-full flex items-center justify-between p-2 sm:p-2.5 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        <Terminal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">تفاصيل الاستعلام</span>
                        {msg.sqlResultCount !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-[9px] sm:text-[10px] shrink-0">
                            {msg.sqlResultCount} نتيجة
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-zinc-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-2 sm:p-3 bg-zinc-900 text-zinc-200 border-t border-zinc-200 dark:border-zinc-800 text-xs font-mono relative">
                        <div className="flex justify-between items-center mb-1 text-[10px] sm:text-[11px] text-zinc-400">
                          <span className="flex items-center gap-1 truncate">
                            <Code2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            استعلام آمن ومحمي
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.executedSql!, index)}
                            className="flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-400 hover:text-white transition px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer shrink-0"
                            title="نسخ الاستعلام"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="overflow-x-auto p-2 bg-zinc-950/80 rounded border border-zinc-800 text-teal-300 font-mono text-[10px] sm:text-[11px] leading-relaxed">
                          {msg.executedSql}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-2 sm:gap-3 items-start animate-fade-in">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-col items-start">
              <div className="text-[10px] sm:text-[11px] text-zinc-400 mb-1 px-1">المساعد الذكي</div>
              <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl rounded-tl-none px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 text-zinc-600 dark:text-zinc-300 text-xs shadow-sm">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                <span className="text-[11px] sm:text-xs">جاري تحليل البيانات وإعداد الإجابة...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Query Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 scrollbar-none shrink-0">
        <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          مقترحات:
        </span>
        {SUGGESTED_QUERIES.map((chip, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(chip.query)}
            disabled={isLoading}
            className="shrink-0 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs bg-slate-100 hover:bg-indigo-50 dark:bg-zinc-800/80 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-zinc-300 hover:text-indigo-800 dark:hover:text-indigo-300 border border-slate-200 dark:border-zinc-700 hover:border-indigo-300 transition-all cursor-pointer disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Box & Voice Controls */}
      <div className="shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 sm:p-3 shadow-md">
        {/* Active Listening Visual Banner */}
        {isListening && (
          <div className="mb-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>جاري الاستماع لصوتك... تحدث الآن</span>
            </div>
            <button
              onClick={toggleListening}
              className="text-[11px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              إيقاف
            </button>
          </div>
        )}

        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Voice Input Mic Button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={toggleListening}
              disabled={isRequestingMic}
              title={
                micPermission !== 'granted'
                  ? 'طلب سماحية المايكروفون وتفعيلها'
                  : isListening
                  ? 'إيقاف التسجيل الصوتي'
                  : 'تحدث بالصوت بدلاً من الكتابة'
              }
              className={`p-2 sm:p-2.5 min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105 animate-pulse'
                  : micPermission !== 'granted'
                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-indigo-600'
              }`}
            >
              {isRequestingMic ? (
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : isListening ? (
                <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
            {micPermission !== 'granted' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white dark:border-zinc-900 animate-ping" />
            )}
          </div>

          {/* Text Area */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? 'جاري الاستماع لصوتك...'
                  : 'اكتب سؤالك أو تحدث بالمايك...'
              }
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-0 leading-relaxed max-h-28"
            />
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputQuery.trim() || isLoading}
            className={`p-2 sm:p-2.5 min-w-[42px] min-h-[42px] rounded-xl font-bold flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
              !inputQuery.trim() || isLoading
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-indigo-600 to-teal-500 text-white hover:from-indigo-700 hover:to-teal-600 shadow-md shadow-indigo-600/25 active:scale-95'
            }`}
            title="إرسال"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5 rtl:rotate-180" />
          </button>
        </div>

        {/* Footer Subtext */}
        <div className="hidden sm:flex mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">استعلام آمن مقيد برقم صالونك فقط</span>
          </div>
          <span className="shrink-0">Shift + Enter لسطر جديد</span>
        </div>
      </div>

      {/* Google Gemini Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">إعدادات Google Gemini AI</h3>
                  <p className="text-[11px] text-zinc-500">ضبط مفتاح API لربط المساعد الذكي المالي</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGeminiConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Google Gemini API Key:
                </label>
                <div className="relative">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    required
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-100 focus:border-indigo-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-800 bg-white dark:bg-zinc-700 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-600"
                  >
                    {showKeyText ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">احصل على مفتاح مجاني:</span>
                  <a
                    href={!geminiModel.includes('/') ? 'https://aistudio.google.com/app/apikey' : 'https://openrouter.ai/keys'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {!geminiModel.includes('/') ? 'Google AI Studio' : 'OpenRouter Keys'}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  نموذج الذكاء الاصطناعي (Model):
                </label>
                <select
                  value={geminiModel}
                  onChange={e => setGeminiModel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:border-indigo-600 outline-none"
                >
                  <optgroup label="⭐ نماذج Google Gemini (الافتراضية)">
                    {POPULAR_AI_MODELS.filter(m => m.provider === 'gemini').map(m => (
                      <option key={m.id} value={m.id}>{m.name} - [{m.badge}]</option>
                    ))}
                  </optgroup>
                  <optgroup label="🌐 نماذج إضافية (عبر OpenRouter)">
                    {POPULAR_AI_MODELS.filter(m => m.provider === 'openrouter').map(m => (
                      <option key={m.id} value={m.id}>{m.name} - [{m.badge}]</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 rounded-xl text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck size={14} className="text-amber-600" />
                  أمان وعزل متعدد الصالونات (Multi-Tenant):
                </div>
                <p>
                  يتم ترجمة الأسئلة آلياً إلى استعلامات SQL مقيدة حصراً بمعرف الصالون الحالي (<code className="font-mono font-bold text-[10px]">{settings.salonId?.substring(0, 8)}...</code>). لا يمكن لأي استعلام قراءة أو كشف بيانات صالونات أخرى إطلاقاً.
                </p>
              </div>

              {saveSuccessNotice && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-2.5 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  تم حفظ مفتاح Gemini وتفعيل المساعد بنجاح!
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer"
                >
                  حفظ وتفعيل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
