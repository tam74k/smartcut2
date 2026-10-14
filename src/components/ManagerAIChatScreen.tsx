import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Mic, MicOff, Sparkles, Database, Trash2, Settings, 
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Check,
  Code2, RefreshCw, Terminal, ArrowRight, Zap, ShieldCheck, HelpCircle
} from 'lucide-react';
import { AppSettings, AppUser } from '../types';
import { 
  ChatMessage, 
  sendManagerAIMessage, 
  getOpenRouterCredentials, 
  DEFAULT_OPENROUTER_MODEL,
  POPULAR_OPENROUTER_MODELS 
} from '../services/openRouterService';

interface ManagerAIChatScreenProps {
  settings: AppSettings;
  currentUser?: AppUser | null;
  onNavigateScreen?: (screen: string) => void;
}

const SUGGESTED_QUERIES = [
  { label: '📊 مبيعات اليوم', query: 'ما هو إجمالي المبيعات وعدد الفواتير الصادرة اليوم؟' },
  { label: '💈 أعلى الحلاقين دخلاً', query: 'من هم أعلى 5 فنيين وحلاقين تحقيقاً للإيرادات هذا الشهر مع إجمالي مبالغ كل منهم؟' },
  { label: '💰 أرصدة الخزائن الحالية', query: 'كم الرصيد الحالي المتوفر في كل خزينة من خزائن الصالون؟' },
  { label: '⚠️ نواقص المخزون', query: 'ما هي المنتجات التي وصلت لحد إعادة الطلب أو التي كمياتها صفر أو منخفضة؟' },
  { label: '👑 كبار العملاء (VIP)', query: 'أعطني قائمة بأعلى 5 عملاء إنفاقاً وزيارات في الصالون مع أرقام هواتفهم وإجمالي إنفاقهم.' },
  { label: '🧾 مصروفات الشهر', query: 'ما هو إجمالي سندات الصرف والمصروفات المسجلة لهذا الشهر مقسمة حسب البنود؟' }
];

export function ManagerAIChatScreen({
  settings,
  currentUser,
  onNavigateScreen
}: ManagerAIChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartcut_manager_ai_history');
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
        content: `مرحباً بك يا مدير الصالون 💼👋\n\nأنا **مساعد الإدارة الذكي (Manager AI)**. أستطيع الإجابة على أي استفسار تحليلي أو مالي أو إداري حول صالونك من خلال فحص قاعدة البيانات المحلية مباشرة وبدقة متناهية وبدون أي تخمين.\n\nيمكنك السؤال كتابةً أو **بالصوت 🎙️** عن المبيعات، أداء الفنيين، المصروفات، الخزائن، المخزون، أو العملاء.`
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

  const credentials = getOpenRouterCredentials(settings);
  const isKeyConfigured = Boolean(credentials.apiKey && credentials.apiKey.trim().length > 10);
  const activeModel = credentials.model || DEFAULT_OPENROUTER_MODEL;

  // Persist history to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        // Save at most the last 40 messages to avoid quota exhaustion
        const toSave = messages.slice(-40);
        localStorage.setItem('smartcut_manager_ai_history', JSON.stringify(toSave));
      } catch (e) {
        console.warn('Failed to save chat history:', e);
      }
    }
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
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
              // If previous text ended without space, add space
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${transcript}` : transcript;
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setSpeechError('تم رفض إذن الوصول إلى الميكروفون في المتصفح. يرجى السماح بالوصول.');
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
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    setSpeechError(null);
    if (!recognitionRef.current) {
      setSpeechError('ميزة الإدخال الصوتي غير مدعومة في هذا المتصفح. يرجى استخدام Google Chrome أو Edge.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
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

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputQuery).trim();
    if (!text || isLoading) return;

    if (!isKeyConfigured) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        { 
          role: 'assistant', 
          content: '⚠️ **تنبيه:** لم يتم ضبط مفتاح **OpenRouter API Key** بعد!\n\nيرجى التوجه إلى **شاشة الإعدادات** وإدخال المفتاح الخاص بك واختيار النموذج، ثم الضغط على **حفظ إعدادات OpenRouter محلياً** لتتمكن من استخدام المحادثة الذكية.',
          error: true 
        }
      ]);
      setInputQuery('');
      return;
    }

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
    }

    const currentHistory = [...messages];
    const newMsg: ChatMessage = { role: 'user', content: text };
    
    // Add user message immediately
    setMessages(prev => [...prev, newMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await sendManagerAIMessage({
        userMessage: text,
        conversationHistory: currentHistory,
        settings
      });

      setMessages(response.updatedHistory);
    } catch (err: any) {
      console.error('Manager AI Chat Error:', err);
      const rawMessage = err?.message || 'حدث خطأ غير متوقع أثناء معالجة السؤال.';
      let friendlyError = rawMessage;

      if (rawMessage.includes('No endpoints found') || rawMessage.includes('404')) {
        friendlyError = `النموذج المحدد غير متاح حالياً على مزود OpenRouter.\nتم تحويل النظام تلقائياً للنموذج الموصى به (OpenAI GPT-4o Mini). يرجى إعادة إرسال رسالتك الآن.`;
      } else if (rawMessage.includes('401') || rawMessage.includes('Unauthorized') || rawMessage.includes('Missing Authentication')) {
        friendlyError = `مفتاح OpenRouter API Key غير مصرح له أو تم تغييره. يرجى مراجعة المفتاح وحفظه من شاشة الإعدادات.`;
      } else if (rawMessage.includes('402') || rawMessage.includes('Payment Required') || rawMessage.includes('credit')) {
        friendlyError = `رصيد مفتاح OpenRouter غير كافٍ. يرجى شحن الرصيد في حساب OpenRouter الخاص بك.`;
      } else if (rawMessage.includes('Port 3001') || rawMessage.includes('Failed to fetch') || rawMessage.includes('ECONNREFUSED')) {
        friendlyError = `تعذر الاتصال بخادم قاعدة البيانات المحلي (Port 3001).\nيرجى التأكد من أن ملف server_libsql.cjs يعمل بشكل صحيح في الخلفية.`;
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ **تعذر إكمال الاستعلام:**\n\n${friendlyError}`,
          error: true
        }
      ]);
    } finally {
      setIsLoading(false);
      // Auto focus textarea after sending
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
        content: `تم مسح المحادثة بنجاح. أهلاً بك من جديد! كيف يمكنني مساعدتك الآن؟ 🤖`
      };
      setMessages([defaultMsg]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('smartcut_manager_ai_history');
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
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-6xl mx-auto p-2 sm:p-4 gap-3">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-zinc-950 shadow-md shadow-amber-500/20">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                محادثة المدير الذكية (Manager AI)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 flex items-center gap-1">
                <Database className="w-3 h-3" />
                libSQL محلي
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              استعلام حي فوري وقراءة دقيقة لبيانات الصالون بدون أي احتمالية للتخمين
            </p>
          </div>
        </div>

        {/* Model & Config Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-zinc-500 dark:text-zinc-400">النموذج:</span>
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 max-w-[150px] truncate" title={activeModel}>
              {activeModel.split('/')[1] || activeModel}
            </span>
          </div>

          {isKeyConfigured ? (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>المفتاح مفعل</span>
            </div>
          ) : (
            <button
              onClick={() => onNavigateScreen && onNavigateScreen('settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>مفتاح OpenRouter مفقود (اضغط للضبط)</span>
            </button>
          )}

          <button
            onClick={handleClearHistory}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            title="مسح المحادثة بالكامل"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {onNavigateScreen && (
            <button
              onClick={() => onNavigateScreen('settings')}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title="إعدادات الذكاء الاصطناعي"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Speech Error Banner if any */}
      {speechError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-2.5 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{speechError}</span>
          </div>
          <button 
            onClick={() => setSpeechError(null)}
            className="text-rose-500 hover:text-rose-700 text-sm font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 overflow-y-auto space-y-4 shadow-inner">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isExpanded = expandedSqlIndex === index;

          return (
            <div
              key={index}
              className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isUser
                    ? 'bg-zinc-800 dark:bg-zinc-700 text-amber-400'
                    : msg.error
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 text-zinc-950'
                }`}
              >
                {isUser ? (
                  <span className="font-bold text-xs">{currentUser?.name?.[0] || 'م'}</span>
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>

              {/* Message Bubble Container */}
              <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="text-[11px] text-zinc-400 mb-1 px-1">
                  {isUser ? (currentUser?.name || 'المدير') : 'المساعد الذكي (OpenRouter)'}
                </div>

                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950 rounded-tr-none shadow-sm'
                      : msg.error
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-tl-none'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-700/60 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Collapsible Executed SQL Query Card */}
                {msg.executedSql && (
                  <div className="mt-2 w-full max-w-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                    <button
                      onClick={() => setExpandedSqlIndex(isExpanded ? null : index)}
                      className="w-full flex items-center justify-between p-2.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        <Terminal className="w-3.5 h-3.5 text-amber-500" />
                        <span>استعلام SQL المنفذ على قاعدة البيانات</span>
                        {msg.sqlResultCount !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px]">
                            {msg.sqlResultCount} سجل
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-zinc-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 bg-zinc-900 text-zinc-200 border-t border-zinc-200 dark:border-zinc-800 text-xs font-mono relative">
                        <div className="flex justify-between items-center mb-1 text-[11px] text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Code2 className="w-3 h-3 text-emerald-400" />
                            Read-Only SELECT Query
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.executedSql!, index)}
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
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
                        <pre className="overflow-x-auto p-2 bg-zinc-950/80 rounded border border-zinc-800 text-amber-300 font-mono text-[11px] leading-relaxed">
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
          <div className="flex gap-3 items-start animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <div className="text-[11px] text-zinc-400 mb-1 px-1">المساعد الذكي</div>
              <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-zinc-600 dark:text-zinc-300 text-xs shadow-sm">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span>جاري استعلام قاعدة البيانات libSQL وصياغة الإجابة...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Query Chips */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 scrollbar-thin">
        <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          أسئلة مقترحة:
        </span>
        {SUGGESTED_QUERIES.map((chip, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(chip.query)}
            disabled={isLoading}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-zinc-100 hover:bg-amber-100 dark:bg-zinc-800/80 dark:hover:bg-amber-950/50 text-zinc-700 dark:text-zinc-300 hover:text-amber-800 dark:hover:text-amber-300 border border-zinc-200 dark:border-zinc-700 hover:border-amber-300 transition-all cursor-pointer disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Box & Voice Controls */}
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 sm:p-3 shadow-md">
        {/* Active Listening Visual Banner */}
        {isListening && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span>جاري الاستماع لصوتك باللغة العربية... تحدث الآن</span>
            </div>
            <button
              onClick={toggleListening}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              إيقاف التسجيل
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Voice Input Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'إيقاف التسجيل الصوتي' : 'تحدث بالصوت بدلاً من الكتابة'}
            className={`p-3 rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105 animate-pulse'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-amber-500'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Area */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'جاري الاستماع لصوتك وتسجيل الكلمات...' : 'اكتب سؤالك هنا أو اضغط زر الميكروفون... (مثال: كم إجمالي المبيعات وعدد الزبائن اليوم؟)'}
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-0 leading-relaxed max-h-32"
            />
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputQuery.trim() || isLoading}
            className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
              !inputQuery.trim() || isLoading
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-500/20 active:scale-95'
            }`}
            title="إرسال (Enter)"
          >
            <Send className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>

        {/* Footer Subtext */}
        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>استعلام SQL مباشر وآمن (Read-Only) مع تحكم دقيق بدرجة الحرارة 0.0</span>
          </div>
          <span>اضغط Shift + Enter لسطر جديد</span>
        </div>
      </div>
    </div>
  );
}
