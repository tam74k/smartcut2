import React, { useState, useRef, useEffect } from 'react';
import { 
  AppSettings, Employee, Invoice, Booking, Transaction, Client, 
  ServiceItem, Product, AIChatMessage 
} from '../types';
import { 
  Bot, Send, Sparkles, User, Calendar, Clock, DollarSign, 
  Trash2, Settings, ShieldCheck, CheckCircle2, ChevronRight, 
  Phone, ShoppingCart, Printer, Layers, AlertTriangle, Key, Cpu, HelpCircle
} from 'lucide-react';
import { processAIChatMessage, SystemDataContext } from '../services/aiAssistantService';

export function AIAssistantScreen({
  settings,
  setSettings,
  employees,
  setEmployees,
  invoices,
  bookings,
  setBookings,
  transactions,
  setTransactions,
  clients,
  setClients,
  services,
  setServices,
  products,
  onNavigateScreen,
  onToPOS,
  currentUser
}: {
  settings: AppSettings;
  setSettings?: (s: AppSettings) => void;
  employees: Employee[];
  setEmployees?: (e: Employee[]) => void;
  invoices: Invoice[];
  bookings: Booking[];
  setBookings?: (b: Booking[]) => void;
  transactions: Transaction[];
  setTransactions?: (t: Transaction[]) => void;
  clients: Client[];
  setClients?: (c: Client[]) => void;
  services: ServiceItem[];
  setServices?: (s: ServiceItem[]) => void;
  products: Product[];
  onNavigateScreen?: (screen: string) => void;
  onToPOS?: (b: Booking) => void;
  currentUser?: any;
}) {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `مرحباً بك يا **${currentUser?.name || 'مدير النظام'}**! 👋 أنا **المساعد الذكي لنظام SMART CUT**.\n\nيمكنك توجيه أي سؤال للاستعلام عن أي بيانات في النظام بالكامل، أو إعطائي أوامر لتنفيذ العمليات فوراً كالحجوزات، السلف، المصروفات، وأرصدة الخزائن!`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    aiProvider: settings.aiProvider || 'builtin',
    aiApiKey: settings.aiApiKey || '',
    aiModel: settings.aiModel || 'gemini-1.5-flash'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Suggested Prompts
  const suggestedPrompts = [
    'احجز للعميل تامر مصطفى رقم 01014889704 يوم الخميس القادم الساعة 7 مساء مع كريم ليعمل حلاقة وتنظيف بشرة',
    'كم عدد ايام غياب الموظف احمد محمد لشهر اغسطس 2026؟',
    'ما هو صافي راتب الموظف كريم مع العمولات والمستحقات؟',
    'كم الرصيد المتوفر في الخزائن والكاشير حالياً؟',
    'ما هي المنتجات التي وصلت لحد النواقص في المخزن؟',
    'كم إجمالي مبيعات وفواتير اليوم؟'
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isProcessing) return;

    const userMsg: AIChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsProcessing(true);

    const context: SystemDataContext = {
      settings,
      employees,
      invoices,
      bookings,
      transactions,
      clients,
      services,
      products,
      currentUser
    };

    try {
      const result = await processAIChatMessage(query, context);

      // Apply state updates if returned by action execution
      if (result.updatedData?.bookings && setBookings) {
        setBookings(result.updatedData.bookings);
      }
      if (result.updatedData?.transactions && setTransactions) {
        setTransactions(result.updatedData.transactions);
      }
      if (result.updatedData?.employees && setEmployees) {
        setEmployees(result.updatedData.employees);
      }

      const assistantMsg: AIChatMessage = {
        id: 'assistant-' + Date.now(),
        sender: 'assistant',
        text: result.message,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        actionCard: result.actionCard
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: AIChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'assistant',
        text: 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveConfig = () => {
    if (setSettings) {
      setSettings({
        ...settings,
        aiProvider: configForm.aiProvider as any,
        aiApiKey: configForm.aiApiKey,
        aiModel: configForm.aiModel
      });
    }
    setShowConfigModal(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full h-[calc(100vh-5rem)] flex flex-col font-sans gap-4" dir="rtl">
      
      {/* Header Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/20">
            <Bot size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">المساعد الذكي (Smart AI Assistant)</h2>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200">
                متصل 🟢
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              استعلام فوري عن بيانات الصالون وتنفيذ العمليات والحجوزات والمصروفات بالأوامر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="إعدادات المساعد الذكي"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">إعدادات الربط</span>
          </button>
          <button
            onClick={() => setMessages([messages[0]])}
            className="p-2.5 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 rounded-xl transition-colors cursor-pointer"
            title="مسح سجل المحادثة"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Main Chat Feed */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 font-bold ${
              msg.sender === 'user'
                ? 'bg-slate-900 text-white'
                : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs'
            }`}>
              {msg.sender === 'user' ? <User size={16} /> : <Bot size={18} />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 text-xs leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-xs'
                : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-tl-xs space-y-3'
            }`}>
              <div className="whitespace-pre-wrap font-medium">
                {msg.text}
              </div>

              {/* Interactive Action Card */}
              {msg.actionCard && (
                <div className="mt-3 bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-xs space-y-2.5 text-slate-900">
                  <div className="flex items-center gap-1.5 font-black text-indigo-900 border-b border-slate-100 pb-2">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span>{msg.actionCard.title}</span>
                  </div>

                  {msg.actionCard.actions && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.actionCard.actions.map((act, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (act.actionType === 'open_screen' && act.screenName && onNavigateScreen) {
                              onNavigateScreen(act.screenName);
                            } else if (act.actionType === 'to_pos' && onToPOS && msg.actionCard?.data) {
                              onToPOS(msg.actionCard.data);
                            }
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className={`text-[10px] font-mono mt-1 ${
                msg.sender === 'user' ? 'text-indigo-200 text-left' : 'text-slate-400'
              }`}>
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking Indicator */}
        {isProcessing && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0">
              <Bot size={18} />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-3xl rounded-tl-xs p-4 text-xs text-slate-600 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce delay-100" />
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce delay-200" />
              </div>
              <span className="font-bold text-slate-600">جاري قراءة البيانات ومعالجة الطلب...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs shrink-0 no-scrollbar">
        <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles size={13} className="text-amber-500" />
          مقترحات سريعة:
        </span>
        {suggestedPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            className="bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold transition-all shadow-2xs cursor-pointer shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <div className="bg-white p-3 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="اكتب سؤالك أو أمرك الذكي هنا (مثال: احجز موعد لفلان، كم غياب موظف، كم رصيد الخزنة...)"
          className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600"
          disabled={isProcessing}
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputQuery.trim() || isProcessing}
          className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
          title="إرسال الطلب"
        >
          <Send size={18} className="rotate-180" />
        </button>
      </div>

      {/* AI REQUIREMENTS & CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150" dir="rtl">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">إعدادات ومتطلبات المساعد الذكي</h3>
                  <p className="text-xs text-slate-500 mt-0.5">خيارات الربط السحابي ومحركات الذكاء الاصطناعي</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Informative Alert */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2 text-indigo-950">
                <h4 className="font-black flex items-center gap-1.5">
                  <HelpCircle size={15} className="text-indigo-600" />
                  <span>المتطلبات التي يجب توفيرها:</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-indigo-900 leading-relaxed">
                  <li><strong>المحرك الداخلي المدمج (Built-in NLP):</strong> يعمل فورياً ومجانياً 100% بدون أي مفاتيح API أو اشتراكات خارجية، ويستعلم عن كافة بيانات النظام وينفذ الحجوزات والعمليات بدقة كاملة.</li>
                  <li><strong>ربط Google Gemini API (اختياري):</strong> يمكنك توفير مفتاح مجاني (Gemini API Key) لتمكين التفكير والتحليل التوليدي المتقدم.</li>
                </ul>
              </div>

              {/* Provider selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">مزود محرك الذكاء الاصطناعي:</label>
                <select
                  value={configForm.aiProvider}
                  onChange={e => setConfigForm({ ...configForm, aiProvider: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600"
                >
                  <option value="builtin">المحرك الداخلي المدمج فائق السرعة (موصى به - مجاني 100%)</option>
                  <option value="gemini">Google Gemini AI (عبر API Key)</option>
                </select>
              </div>

              {/* API Key if external */}
              {configForm.aiProvider === 'gemini' && (
                <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Key size={13} className="text-amber-600" />
                      <span>Google Gemini API Key:</span>
                    </label>
                    <input
                      type="password"
                      value={configForm.aiApiKey}
                      onChange={e => setConfigForm({ ...configForm, aiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">النموذج المختار:</label>
                    <select
                      value={configForm.aiModel}
                      onChange={e => setConfigForm({ ...configForm, aiModel: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (سريع ومثالي)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (تحليلي متقدم)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
