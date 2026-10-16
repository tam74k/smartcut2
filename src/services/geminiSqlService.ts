import { AppSettings } from '../types';
import { SupabaseService } from './supabase';
import { toSalonUUID } from './db';

// ==============================================================================
// Manager AI Text-to-SQL Service for Supabase Cloud Database
// Strict Multi-Tenant Enforcement: Queries MUST strictly scope to current salon_id
// ==============================================================================

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  executedSql?: string;
  sqlResultCount?: number;
  error?: boolean;
}

export interface AiModelOption {
  id: string;
  name: string;
  provider: 'gemini' | 'openrouter';
  badge: string;
  description: string;
  isDefault?: boolean;
}

export const POPULAR_AI_MODELS: AiModelOption[] = [
  { 
    id: 'gemini-3.8-flash', 
    name: 'Google Gemini 3.8 Flash',
    provider: 'gemini',
    badge: 'الافتراضي - الأحدث وموصى به',
    description: 'الجيل الأحدث 3.8 فائق السرعة والأعلى دقة في استعلامات SQL وقراءة سوبابيز',
    isDefault: true
  },
  { 
    id: 'gemini-3.8-pro', 
    name: 'Google Gemini 3.8 Pro',
    provider: 'gemini',
    badge: 'تحليل مالي عميق',
    description: 'أعلى قدرات استدلال وتحليل للقوائم المالية والعمليات الحسابية المعقدة'
  },
  { 
    id: 'gemini-3.5-flash', 
    name: 'Google Gemini 3.5 Flash',
    provider: 'gemini',
    badge: 'سريع وخفيف',
    description: 'استجابة فائقة السرعة للعمليات اليومية واسترجاع البيانات'
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini',
    provider: 'openrouter',
    badge: 'اقتصادي وسريع',
    description: 'نموذج OpenAI المصغر عالي الدقة في التوليد المنطقي للاستعلامات'
  },
  {
    id: 'openai/gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openrouter',
    badge: 'النموذج القيادي الشامل',
    description: 'النموذج الأكثر ذكاءً وقدرة على فهم الأسئلة الإدارية المعقدة'
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat V3',
    provider: 'openrouter',
    badge: 'كفاءة فائقة واقتصادي',
    description: 'نموذج DeepSeek الشهير بسرعة فائقة ودقة ممتازة في البيانات'
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Anthropic Claude Sonnet 4',
    provider: 'openrouter',
    badge: 'دقة فائقة في المنطق',
    description: 'النموذج الأفضل في فهم السياقات الإدارية والمالية المتشعبة'
  }
];

export const DEFAULT_AI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

// Backward compatibility export
export const POPULAR_GEMINI_MODELS = POPULAR_AI_MODELS.map(m => ({
  id: m.id,
  name: `${m.name} (${m.badge})`
}));

// Resolve credentials safely from settings or local storage
export function getAiCredentials(settings?: AppSettings): {
  apiKey: string;
  model: string;
  provider: 'gemini' | 'openrouter';
} {
  let model = settings?.aiModel || '';
  if (!model && typeof window !== 'undefined') {
    model = localStorage.getItem('smartcut_ai_model') || localStorage.getItem('smartcut_gemini_model') || '';
  }
  // Automatically migrate legacy/deprecated model names to gemini-3.8-flash
  if (!model || model.includes('1.5') || model.includes('2.0') || model.includes('2.5') || model === 'gemini-flash') {
    model = DEFAULT_AI_MODEL;
  }

  const isGemini = !model.includes('/');
  let apiKey = '';

  if (isGemini) {
    apiKey = settings?.aiApiKey || '';
    if (!apiKey && typeof window !== 'undefined') {
      apiKey = localStorage.getItem('smartcut_ai_api_key') || localStorage.getItem('smartcut_gemini_api_key') || '';
    }
  } else {
    apiKey = settings?.openrouterApiKey || settings?.aiApiKey || '';
    if (!apiKey && typeof window !== 'undefined') {
      apiKey = localStorage.getItem('smartcut_openrouter_api_key') || localStorage.getItem('smartcut_ai_api_key') || '';
    }
  }

  return {
    apiKey: apiKey.trim(),
    model: model.trim(),
    provider: isGemini ? 'gemini' : 'openrouter'
  };
}

// Backward compatibility helper
export function getGeminiCredentials(settings?: AppSettings): GeminiConfig {
  const creds = getAiCredentials(settings);
  return { apiKey: creds.apiKey, model: creds.model };
}

// Save credentials locally
export function saveAiCredentials(apiKey: string, model: string): void {
  const cleanKey = apiKey.trim();
  const cleanModel = model.trim();
  if (typeof window !== 'undefined') {
    localStorage.setItem('smartcut_ai_api_key', cleanKey);
    localStorage.setItem('smartcut_ai_model', cleanModel);
    if (!cleanModel.includes('/')) {
      localStorage.setItem('smartcut_gemini_api_key', cleanKey);
      localStorage.setItem('smartcut_gemini_model', cleanModel);
    } else {
      localStorage.setItem('smartcut_openrouter_api_key', cleanKey);
      localStorage.setItem('smartcut_openrouter_model', cleanModel);
    }
  }
}

// Backward compatibility helper
export function saveGeminiCredentials(apiKey: string, model: string): void {
  saveAiCredentials(apiKey, model);
}

// PostgreSQL Schema on Supabase for AI Text-to-SQL
export function getSupabaseSchemaPrompt(salonId: string): string {
  return `
You have direct read-only SQL access to PostgreSQL database on Supabase for the current salon.

STRICT TENANT ISOLATION RULE:
Every single queried table MUST explicitly include: salon_id = '${salonId}'
IT IS STRICTLY FORBIDDEN to query or access any data with a different salon_id or without filtering by salon_id = '${salonId}'.

Supabase Tables and Exact Columns:
1. "invoices" (فواتير المبيعات):
   - "id" (TEXT/UUID, PK), "salon_id" (UUID), "branch_id" (UUID), "date" (TIMESTAMPTZ), "client_name" (TEXT), "client_phone" (TEXT), "subtotal" (NUMERIC), "discount" (NUMERIC), "vat" (NUMERIC), "total" (NUMERIC), "paid" (NUMERIC), "remaining" (NUMERIC), "payment_method" (TEXT: 'cash', 'card', 'online', 'mixed'), "shift_code" (TEXT), "created_at" (TIMESTAMPTZ).
   - Note: For date queries on invoices, cast timestamp to date: "date::date = CURRENT_DATE".

2. "clients" (العملاء والولاء):
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "name" (TEXT), "phone" (TEXT), "email" (TEXT), "total_spend" (NUMERIC), "visits_count" (INTEGER), "cashback_balance" (NUMERIC), "tier_level" (TEXT: 'standard', 'distinguished', 'vip', 'royal'), "is_vip" (BOOLEAN), "notes" (TEXT).

3. "employees" (الموظفين والكادر الفني):
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "name" (TEXT), "phone" (TEXT), "role" (TEXT: 'barber', 'technician', 'cashier', 'cleaner', 'manager'), "base_salary" (NUMERIC), "commission_rate" (NUMERIC), "is_active" (BOOLEAN).

4. "products" (المخزون والمنتجات للبيع والاستخدام الداخلي):
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "name" (TEXT), "barcode" (TEXT), "cost_price" (NUMERIC), "sell_price" (NUMERIC), "current_stock" (INTEGER), "reorder_limit" (INTEGER), "is_active" (BOOLEAN).

5. "services" (الخدمات المقدمة):
   - "id" (TEXT, PK), "salon_id" (UUID), "category_id" (TEXT), "name" (TEXT), "price" (NUMERIC), "duration_minutes" (INTEGER), "type" (TEXT), "is_active" (BOOLEAN).

6. "categories" (أقسام وتصنيفات الخدمات):
   - "id" (TEXT, PK), "salon_id" (UUID), "name" (TEXT), "icon" (TEXT), "type" (TEXT).

7. "transactions" (الحركات المالية، المصروفات، السلف، وسندات الصرف):
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "date" (TIMESTAMPTZ), "type" (TEXT: 'in', 'out' - where 'out' is expenses/advances/withdrawals, 'in' is income/sales), "amount" (NUMERIC), "category" (TEXT: 'expense', 'advance', 'salary', 'commission', 'general'), "expense_category" (TEXT), "description" (TEXT), "treasury" (TEXT), "treasury_id" (TEXT), "shift_code" (TEXT), "shift_id" (TEXT), "shift_date" (DATE), "user_name" (TEXT).
   - Note: Employee advances are stored with category = 'advance' or type = 'out'.

8. "bookings" (الحجوزات والمواعيد والعربون):
   - "id" (TEXT, PK), "salon_id" (UUID), "booking_code" (TEXT), "customer_name" (TEXT), "customer_phone" (TEXT), "employee_name" (TEXT), "date" (DATE), "time" (TEXT), "total_amount" (NUMERIC), "status" (TEXT: 'pending', 'confirmed', 'completed', 'cancelled'), "deposit_paid" (NUMERIC), "notes" (TEXT).

9. "work_shifts" (ورديات العمل وإغلاق الكاشير):
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (TEXT), "shift_code" (TEXT), "shift_date" (VARCHAR - NOTE: Stored as VARCHAR(50). When comparing with DATE columns like transactions.shift_date, ALWAYS explicitly cast: "t.shift_date::text = ws.shift_date::text" or use "t.shift_code = ws.shift_code" or "t.shift_id = ws.id"!), "opened_at" (TIMESTAMPTZ), "closed_at" (TIMESTAMPTZ), "opened_by_user_name" (TEXT), "status" (TEXT: 'open' for the active shift, 'closed' for closed shifts), "initial_cash" (NUMERIC), "total_sales" (NUMERIC), "total_cash_sales" (NUMERIC), "total_card_sales" (NUMERIC), "total_expenses" (NUMERIC), "total_advances" (NUMERIC), "expected_cash" (NUMERIC), "actual_cash" (NUMERIC), "cash_difference" (NUMERIC).

10. "treasuries" (الخزائن وأرصدة الصندوق):
    - "id" (TEXT, PK), "salon_id" (UUID), "name" (TEXT), "type" (TEXT: 'cash', 'bank', 'drawer'), "balance" (NUMERIC), "is_default" (BOOLEAN).

11. "customer_complaints" (شكاوى واقتراحات العملاء):
    - "id" (TEXT, PK), "salon_id" (UUID), "client_name" (TEXT), "client_phone" (TEXT), "category" (TEXT), "complaint_text" (TEXT), "status" (TEXT: 'open', 'resolved', 'closed'), "created_at" (TIMESTAMPTZ).

12. "tips" (البقشيش والإكراميات):
    - "id" (TEXT, PK), "salon_id" (UUID), "employee_name" (TEXT), "client_name" (TEXT), "amount" (NUMERIC), "status" (TEXT: 'pending_payout', 'paid_out'), "created_at" (TIMESTAMPTZ).

13. "suppliers" (الموردين وأرصدتهم):
    - "id" (TEXT, PK), "salon_id" (UUID), "name" (TEXT), "phone" (TEXT), "current_balance" (NUMERIC).

14. "purchase_invoices" (فواتير المشتريات):
    - "id" (TEXT, PK), "salon_id" (UUID), "supplier_id" (TEXT), "invoice_number" (TEXT), "date" (DATE), "total_amount" (NUMERIC), "paid_amount" (NUMERIC), "remaining_amount" (NUMERIC).

15. "branches" (فروع الصالون):
    - "id" (UUID, PK), "salon_id" (UUID), "name" (TEXT), "code" (TEXT), "country" (TEXT), "currency" (TEXT), "phone" (TEXT), "is_main" (BOOLEAN).

16. "salons" (بيانات المنشأة):
    - "id" (UUID, PK), "name" (TEXT), "code" (TEXT), "country" (TEXT), "currency" (TEXT), "phone" (TEXT), "tax_number" (TEXT), "commercial_reg" (TEXT).
`;
}

// Client-side Strict Validator for Read-Only SQL & Salon Isolation
export function validateAiSql(sql: string, salonId: string): { valid: boolean; error?: string; cleanSql?: string } {
  if (!sql || typeof sql !== 'string' || !sql.trim()) {
    return { valid: false, error: 'استعلام SQL فارغ.' };
  }

  // Strip Markdown code blocks if any
  let clean = sql.replace(/```(?:sql)?/gi, '').replace(/```/g, '').trim();
  clean = clean.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();

  // Strip trailing semicolon
  clean = clean.replace(/;+$/, '').trim();

  const upper = clean.toUpperCase();

  // 1. Must start with SELECT or WITH
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return { valid: false, error: 'خرق أمني: يُسمح فقط بتنفيذ استعلامات القراءة (SELECT).' };
  }

  // 2. Reject multiple statements
  if (clean.includes(';')) {
    return { valid: false, error: 'خرق أمني: لا يُسمح بتنفيذ أكثر من جملة SQL واحدة.' };
  }

  // 3. Reject mutating or dangerous keywords
  const forbidden = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
    'REPLACE', 'EXEC', 'CREATE', 'ATTACH', 'DETACH', 'PRAGMA',
    'GRANT', 'REVOKE', 'VACUUM', 'REINDEX', 'COPY', 'DO'
  ];

  for (const kw of forbidden) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(clean)) {
      return { valid: false, error: `خرق أمني: الأمر '${kw}' محظور تماماً. قاعدة البيانات في وضع القراءة فقط.` };
    }
  }

  // 4. Strict Salon Isolation: Query MUST filter by salonId!
  const cleanSalonId = salonId.trim().toLowerCase();
  if (!clean.toLowerCase().includes(cleanSalonId)) {
    return { 
      valid: false, 
      error: 'خرق أمني صارم: الاستعلام محظور لعدم احتوائه على شرط تقييد الصالون الحالي (salon_id). يمنع منعاً باتاً استعلام بيانات صالونات أخرى.' 
    };
  }

  return { valid: true, cleanSql: clean };
}

// Execute query safely via Supabase RPC rpc_execute_ai_sql
export async function executeSupabaseAiSql(
  sql: string, 
  salonId: string
): Promise<{ success: boolean; rows?: any[]; error?: string; rowCount?: number }> {
  // 1. Client-side security verification
  const check = validateAiSql(sql, salonId);
  if (!check.valid || !check.cleanSql) {
    return { success: false, error: check.error };
  }

  const client = SupabaseService.getClient();
  if (!client) {
    return { success: false, error: 'تعذر الاتصال بقاعدة بيانات Supabase السحابية.' };
  }

  try {
    const { data, error } = await client.rpc('rpc_execute_ai_sql', {
      p_salon_id: salonId,
      p_query: check.cleanSql
    });

    if (error) {
      console.error('rpc_execute_ai_sql error:', error.message);
      if (
        error.message.includes('Could not find the function') || 
        error.message.includes('function rpc_execute_ai_sql') || 
        (error as any).code === 'PGRST202'
      ) {
        return {
          success: false,
          error: 'دالة rpc_execute_ai_sql غير مثبتة في قاعدة بيانات Supabase. يرجى تنفيذ كود الإنشاء من ملف supabase_schema.sql في Supabase SQL Editor.'
        };
      }
      return { success: false, error: `خطأ قاعدة البيانات: ${error.message}` };
    }

    if (data && typeof data === 'object' && !Array.isArray(data) && (data as any).error) {
      return { success: false, error: (data as any).error };
    }

    const rows = Array.isArray(data) ? data : [];
    return {
      success: true,
      rows,
      rowCount: rows.length
    };
  } catch (err: any) {
    console.error('executeSupabaseAiSql exception:', err);
    return { success: false, error: err?.message || 'تعذر استدعاء دالة الاستعلام السحابي.' };
  }
}

// Smart Fallback Google Gemini Caller
async function callGeminiApiWithSmartFallback({
  apiKey,
  model,
  prompt,
  systemInstruction
}: {
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
}): Promise<{ text: string; resolvedModel: string }> {
  const requestBody: any = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 20,
      topP: 0.8
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  // Candidate models in priority order
  const normalizedModel = (!model || model.includes('1.5') || model.includes('2.0') || model.includes('2.5')) 
    ? 'gemini-3.8-flash' 
    : model;

  const candidates = [
    normalizedModel,
    'gemini-3.8-flash',
    'gemini-3.8-pro',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

  let lastErrorMsg = '';

  for (const candidate of candidates) {
    // Try v1beta first, then v1
    const versions = ['v1beta', 'v1'];
    for (const ver of versions) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/${ver}/models/${candidate}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return { text: text.trim(), resolvedModel: candidate };
          }
        }

        const errText = await response.text();
        try {
          const errJson = JSON.parse(errText);
          lastErrorMsg = errJson?.error?.message || errText;
        } catch {
          lastErrorMsg = errText;
        }

        // If it's a 404 (model not found), proceed to next version/candidate immediately
        if (response.status === 404 || lastErrorMsg.includes('not found') || lastErrorMsg.includes('not supported')) {
          continue;
        }

        // If it's an authentication error, throw immediately
        if (lastErrorMsg.includes('API_KEY_INVALID') || (response.status === 400 && lastErrorMsg.includes('API key'))) {
          throw new Error(`مفتاح Google Gemini API غير صالح: ${lastErrorMsg}`);
        }
      } catch (networkErr: any) {
        if (networkErr.message?.includes('Google Gemini API')) {
          throw networkErr;
        }
        lastErrorMsg = networkErr?.message || 'Network error';
      }
    }
  }

  // If all hardcoded candidates failed, try dynamic ListModels lookup
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      headers: { 'x-goog-api-key': apiKey }
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData?.models)) {
        const availableNames: string[] = listData.models.map((m: any) => (m.name || '').replace(/^models\//, '')).filter(Boolean);
        const dynamicName = availableNames.find(n => n.includes('3.8') || n.includes('flash')) || availableNames[0];
        if (dynamicName) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${dynamicName}:generateContent?key=${apiKey}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
          });
          if (res.ok) {
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              return { text: text.trim(), resolvedModel: dynamicName };
            }
          }
        }
      }
    }
  } catch (e) {}

  throw new Error(`خطأ Google Gemini API: ${lastErrorMsg || 'تعذر العثور على نموذج متوافق مع مفتاح API الحالي.'}`);
}

// Unified LLM Caller (Google Gemini or OpenRouter)
export async function callLlmApi({
  apiKey,
  model,
  prompt,
  systemInstruction
}: {
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
}): Promise<{ text: string; resolvedModel: string }> {
  const targetModel = model || DEFAULT_AI_MODEL;

  // OpenRouter Provider (Models with '/')
  if (targetModel.includes('/')) {
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://smartcut.app',
        'X-Title': 'SmartCut AI Manager'
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsed = `HTTP ${response.status}`;
      try {
        const j = JSON.parse(errText);
        parsed = j?.error?.message || parsed;
      } catch {}
      throw new Error(`خطأ OpenRouter (${targetModel}): ${parsed}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('لم يتم استلام أي رد من نموذج OpenRouter.');
    }
    return { text: content.trim(), resolvedModel: targetModel };
  }

  // Google Gemini Provider with Smart Fallback
  return await callGeminiApiWithSmartFallback({
    apiKey,
    model: targetModel,
    prompt,
    systemInstruction
  });
}

// Test live connectivity with the selected AI model & API key
export async function testAiConnection({
  apiKey,
  model
}: {
  apiKey: string;
  model: string;
}): Promise<{ success: boolean; latencyMs?: number; error?: string; activeModel?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'يرجى إدخال مفتاح API أولاً قبل الاختبار.' };
  }

  const t0 = performance.now();
  try {
    const reply = await callLlmApi({
      apiKey: apiKey.trim(),
      model: model || DEFAULT_AI_MODEL,
      prompt: 'أجب بكلمة واحدة فقط: جاهز'
    });
    const latencyMs = Math.round(performance.now() - t0);
    if (reply?.text) {
      return { success: true, latencyMs, activeModel: reply.resolvedModel };
    }
    return { success: false, error: 'لم يتم استلام رد من النموذج.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل الاتصال بالنموذج' };
  }
}

// Main Function: Question -> AI SQL Generation -> Supabase Execution -> AI Natural Language Answer
export async function sendManagerGeminiMessage({
  userMessage,
  conversationHistory,
  settings,
  onSqlExecuted
}: {
  userMessage: string;
  conversationHistory: ChatMessage[];
  settings?: AppSettings;
  onSqlExecuted?: (sql: string, rowsCount: number) => void;
}): Promise<{
  reply: string;
  executedSql?: string;
  sqlResultCount?: number;
  updatedHistory: ChatMessage[];
}> {
  const creds = getAiCredentials(settings);
  const apiKey = creds.apiKey;
  const model = creds.model;

  if (!apiKey) {
    throw new Error('يرجى إدخال وتفعيل مفتاح الذكاء الاصطناعي (API Key) في إعدادات المساعد الذكي أولاً.');
  }

  // Strictly enforce canonical salon UUID
  const rawSalonId = settings?.salonId;
  const salonId = (rawSalonId && toSalonUUID(rawSalonId)) || toSalonUUID(null) || rawSalonId || '11111111-1111-4111-8111-111111111111';
  const salonName = settings?.salonName || 'الصالون';
  const currency = settings?.currency || 'SAR';

  // Step 1: Prompt AI to convert Question to SQL
  const schemaPrompt = getSupabaseSchemaPrompt(salonId);
  const sqlSystemInstruction = `You are an expert PostgreSQL Text-to-SQL Generator for Supabase.
Your ONLY task is to convert the manager's question into a single valid, read-only PostgreSQL SELECT query.

CRITICAL NON-NEGOTIABLE SECURITY & POSTGRESQL RULES:
1. STRICT SALON ISOLATION:
   You MUST include "WHERE salon_id = '${salonId}'" (or "AND salon_id = '${salonId}'") on EVERY table being queried.
   NEVER query across all salons. Only salon '${salonId}'.
2. READ-ONLY SELECT ONLY:
   You must NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE statements.
3. OUTPUT FORMAT:
   Return ONLY the raw SQL query. Do NOT add explanation, markdown formatting, or preamble. Just the SQL.
   If the user's message is a greeting or general pleasantry that requires no database query, return: NO_QUERY_NEEDED
4. DATE & TIMESTAMP HANDLING:
   Use CURRENT_DATE for today. For month start: date_trunc('month', CURRENT_DATE).
   For invoices, transactions, and shifts with TIMESTAMPTZ columns:
   To filter by today's date: "date::date = CURRENT_DATE" or "opened_at::date = CURRENT_DATE".
5. POSTGRESQL STRICT TYPING & CASTING (PREVENTS 'operator does not exist: date = character varying'):
   - PostgreSQL CANNOT compare a DATE or TIMESTAMPTZ column directly with a VARCHAR column.
   - ALWAYS use explicit casting:
     * e.g. "t.shift_date::text = ws.shift_date::text"
     * e.g. "t.shift_code = ws.shift_code" (both are TEXT/VARCHAR)
     * e.g. "t.shift_id = ws.id" (both are TEXT/VARCHAR)
     * e.g. "t.date::date = CURRENT_DATE"
6. SHIFT QUERIES & CURRENT SHIFT EXPENSES (الوردية الحالية ومصروفاتها):
   - Current active shift is in "work_shifts" where "status = 'open'".
   - To query current shift expenses:
     SELECT t.id, t.date, t.amount, t.description, t.category, t.expense_category, t.user_name
     FROM transactions t
     JOIN work_shifts ws ON ws.salon_id = '${salonId}' AND ws.status = 'open'
     WHERE t.salon_id = '${salonId}'
       AND t.type = 'out'
       AND (
         t.shift_id = ws.id 
         OR t.shift_code = ws.shift_code 
         OR t.shift_date::text = ws.shift_date::text 
         OR (t.date >= ws.opened_at AND (ws.closed_at IS NULL OR t.date <= ws.closed_at))
       )
     ORDER BY t.date DESC
     LIMIT 50;
7. LIMITS:
   For lists, always append LIMIT 50.

Database Schema:
${schemaPrompt}
`;

  const sqlPrompt = `Manager Question: ${userMessage}
Generate the PostgreSQL query for salon '${salonId}':`;

  const rawSqlResponse = await callLlmApi({
    apiKey,
    model,
    prompt: sqlPrompt,
    systemInstruction: sqlSystemInstruction
  });

  const cleanSql = rawSqlResponse.text
    .replace(/```(?:sql)?/gi, '')
    .replace(/```/g, '')
    .trim();

  // If general conversation without database need
  if (cleanSql === 'NO_QUERY_NEEDED' || (!cleanSql.toUpperCase().startsWith('SELECT') && !cleanSql.toUpperCase().startsWith('WITH'))) {
    const conversationalPrompt = `أنت مساعد الإدارة الذكي لصالون (${salonName}). أجب بلطف واحترافية باللغة العربية على الرسالة التالية:\n${userMessage}`;
    const directReply = await callLlmApi({
      apiKey,
      model: rawSqlResponse.resolvedModel || model,
      prompt: conversationalPrompt
    });

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: directReply.text }
    ];

    return {
      reply: directReply.text,
      updatedHistory
    };
  }

  // Step 2: Validate and Execute SQL on Supabase (with Self-Healing Retry)
  let activeSql = cleanSql;
  let sqlExecution = await executeSupabaseAiSql(activeSql, salonId);

  // Self-Healing SQL Retry: If PostgreSQL query execution fails, automatically prompt AI with exact error to fix it
  if (!sqlExecution.success || sqlExecution.error) {
    console.warn('[AI Text-to-SQL] Initial query failed, attempting self-healing correction...', sqlExecution.error);
    const retryInstruction = `You are an expert PostgreSQL DBA for Supabase.
The previous SQL query failed with this exact PostgreSQL error:
"${sqlExecution.error}"

Failed Query:
${activeSql}

Database Schema & Exact Types:
${schemaPrompt}

Instructions:
1. Fix the error completely (e.g. resolve type mismatches with explicit type casts like ::text or ::date, verify exact column names).
2. Strict isolation: MUST keep salon_id = '${salonId}' on every table.
3. Return ONLY the single corrected read-only SELECT query. No explanations, no markdown.`;

    try {
      const retryResponse = await callLlmApi({
        apiKey,
        model: rawSqlResponse.resolvedModel || model,
        prompt: `Fix this PostgreSQL query so it runs successfully without PostgreSQL error:\n${activeSql}\nPostgreSQL Error: ${sqlExecution.error}`,
        systemInstruction: retryInstruction
      });

      const fixedSql = retryResponse.text.replace(/```(?:sql)?/gi, '').replace(/```/g, '').trim();
      if (fixedSql.toUpperCase().startsWith('SELECT') || fixedSql.toUpperCase().startsWith('WITH')) {
        const retryExec = await executeSupabaseAiSql(fixedSql, salonId);
        if (retryExec.success && !retryExec.error) {
          activeSql = fixedSql;
          sqlExecution = retryExec;
          console.log('[AI Text-to-SQL] Self-healing retry succeeded with query:', fixedSql);
        }
      }
    } catch (retryErr) {
      console.warn('[AI Text-to-SQL] Self-healing retry failed:', retryErr);
    }
  }

  if (onSqlExecuted && sqlExecution.success) {
    onSqlExecuted(activeSql, sqlExecution.rowCount ?? 0);
  }

  // Step 3: Prompt AI to synthesize answer based on real Supabase data
  const answerSystemInstruction = `أنت المساعد المالي والتحليلي الذكي لمدير صالون (${salonName}).
لديك سؤال المدير، واستعلام SQL الذي نُفذ على قاعدة بيانات Supabase، والنتائج الفعلية المسترجعة من قاعدة البيانات.

تعليمات الإجابة الصارمة:
1. انعدام التخمين (Zero Hallucination): اعتمد حصراً وبشكل تام على أرقام وبيانات JSON المسترجعة. لا تخترع أرقاماً أبداً.
2. إذا كانت البيانات فارغة ([] أو 0 سجلات): اذكر بوضوح: "لم يتم العثور على أي بيانات مطابقة في قاعدة البيانات لهذا الاستفسار."
3. إذا كان هناك خطأ في قاعدة البيانات، اشرح المشكلة بلطف واقترح صياغة أخرى مبسطة للسؤال دون إظهار أخطاء برمجية معقدة.
4. استخدم العملة المعتمدة (${currency}) مع أي مبالغ مالية.
5. نسق الإجابة بتنسيق Markdown جميل (عناوين، نقاط، جداول، خط عريض للأرقام الهامة).
6. كن مختصراً ودقيقاً ومباشراً.`;

  const answerPrompt = `سؤال المدير:
${userMessage}

استعلام SQL المنفذ على Supabase:
${activeSql}

نتائج قاعدة البيانات الفعلية (JSON):
${JSON.stringify(sqlExecution.rows || (sqlExecution.error ? { error: sqlExecution.error } : []))}

صغ إجابتك الاحترافية للمدير الآن:`;

  const finalAnswer = await callLlmApi({
    apiKey,
    model: rawSqlResponse.resolvedModel || model,
    prompt: answerPrompt,
    systemInstruction: answerSystemInstruction
  });

  const updatedHistory: ChatMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
    { 
      role: 'assistant', 
      content: finalAnswer.text,
      executedSql: activeSql,
      sqlResultCount: sqlExecution.rowCount ?? 0
    }
  ];

  return {
    reply: finalAnswer.text,
    executedSql: activeSql,
    sqlResultCount: sqlExecution.rowCount ?? 0,
    updatedHistory
  };
}
