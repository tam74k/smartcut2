import React, { useState } from 'react';
import { 
  AppSettings, Employee, Invoice, Booking, Transaction, Client, 
  ServiceItem, Product, AIChatMessage 
} from '../types';
import { 
  Bot, Send, X, Sparkles, User, ShoppingCart, Printer, 
  ChevronUp, Minimize2, Maximize2 
} from 'lucide-react';
import { processAIChatMessage, SystemDataContext } from '../services/aiAssistantService';

export function AIFloatingChat({
  settings,
  employees,
  setEmployees,
  invoices,
  bookings,
  setBookings,
  transactions,
  setTransactions,
  clients,
  services,
  products,
  onNavigateScreen,
  onToPOS,
  currentUser
}: {
  settings: AppSettings;
  employees: Employee[];
  setEmployees?: (e: Employee[]) => void;
  invoices: Invoice[];
  bookings: Booking[];
  setBookings?: (b: Booking[]) => void;
  transactions: Transaction[];
  setTransactions?: (t: Transaction[]) => void;
  clients: Client[];
  services: ServiceItem[];
  products: Product[];
  onNavigateScreen?: (screen: string) => void;
  onToPOS?: (b: Booking) => void;
  currentUser?: any;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'float-welcome',
      sender: 'assistant',
      text: 'مرحباً بك! أنا المساعد الذكي، كيف أساعدك في إدارة الصالون أو الحجوزات أو الموظفين الآن؟ 🤖',
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendMessage = async (customText?: string) => {
    const query = (customText || inputQuery).trim();
    if (!query || isProcessing) return;

    const userMsg: AIChatMessage = {
      id: 'float-user-' + Date.now(),
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
        id: 'float-asst-' + Date.now(),
        sender: 'assistant',
        text: result.message,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        actionCard: result.actionCard
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: 'float-err-' + Date.now(),
          sender: 'assistant',
          text: 'حدث خطأ أثناء المعالجة، يرجى المحاولة مرة أخرى.',
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-40 font-sans print:hidden" dir="rtl">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 hover:scale-105 text-white p-3.5 rounded-full shadow-2xl flex items-center gap-2 cursor-pointer transition-all border-2 border-white group"
          title="المساعد الذكي"
        >
          <Bot size={24} className="animate-pulse" />
          <span className="text-xs font-black pl-1 hidden group-hover:inline transition-all">
            المساعد الذكي
          </span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-80 sm:w-96 h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <div>
                <h3 className="font-black text-xs">المساعد الذكي (Smart AI)</h3>
                <span className="text-[9px] text-indigo-100">استعلام وتنفيذ فوري 🟢</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onNavigateScreen) onNavigateScreen('ai_assistant');
                }}
                className="p-1 text-white/80 hover:text-white rounded-lg"
                title="تكبير لشاشة كاملة"
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] shrink-0 font-bold ${
                  m.sender === 'user' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'
                }`}>
                  {m.sender === 'user' ? <User size={13} /> : <Bot size={14} />}
                </div>

                <div className={`max-w-[80%] p-2.5 rounded-2xl text-[11px] leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs shadow-2xs'
                }`}>
                  <div className="whitespace-pre-wrap font-medium">{m.text}</div>

                  {m.actionCard && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-slate-900">
                      <div className="font-bold text-[10px] text-indigo-800">{m.actionCard.title}</div>
                      {m.actionCard.actions?.map((act, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (act.actionType === 'open_screen' && act.screenName && onNavigateScreen) {
                              onNavigateScreen(act.screenName);
                              setIsOpen(false);
                            } else if (act.actionType === 'to_pos' && onToPOS && m.actionCard?.data) {
                              onToPOS(m.actionCard.data);
                              setIsOpen(false);
                            }
                          }}
                          className="bg-indigo-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold block w-full text-center mt-1"
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-100">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                <span>جاري المعالجة...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="p-2.5 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="اكتب طلبك أو سؤالك..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-600"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isProcessing}
              className="p-2 rounded-xl bg-indigo-600 text-white disabled:opacity-40"
            >
              <Send size={15} className="rotate-180" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
