import { AppSettings } from '../types';
import { SupabaseService } from './supabase';

// ==============================================================================
// 🤖 Gemini Text-to-SQL Service for Supabase Cloud Database
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

export const POPULAR_GEMINI_MODELS = [
  { id: 'gemini-1.5-flash', name: 'Google Gemini 1.5 Flash (الأسرع والأدق في استعلامات SQL - موصى به 🌟)' },
  { id: 'gemini-2.0-flash', name: 'Google Gemini 2.0 Flash (الجيل الأحدث فائق السرعة)' },
  { id: 'gemini-1.5-pro', name: 'Google Gemini 1.5 Pro (أعلى قدرات استدلال وتحليل)' }
];

export const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

// Get credentials from settings or localStorage
export function getGeminiCredentials(settings?: AppSettings): GeminiConfig {
  let apiKey = '';
  let model = DEFAULT_GEMINI_MODEL;

  if (settings?.aiApiKey) {
    apiKey = settings.aiApiKey.trim();
  }
  if (!apiKey && typeof window !== 'undefined') {
    apiKey = (localStorage.getItem('smartcut_gemini_api_key') || localStorage.getItem('smartcut_ai_api_key') || '').trim();
  }

  if (settings?.aiModel && settings.aiModel.includes('gemini')) {
    model = settings.aiModel.trim();
  } else if (typeof window !== 'undefined') {
    const local = localStorage.getItem('smartcut_gemini_model') || localStorage.getItem('smartcut_ai_model');
    if (local && local.includes('gemini')) {
      model = local.trim();
    }
  }

  return { apiKey, model };
}

// Save credentials locally and in state
export function saveGeminiCredentials(apiKey: string, model: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('smartcut_gemini_api_key', apiKey.trim());
    localStorage.setItem('smartcut_ai_api_key', apiKey.trim());
    localStorage.setItem('smartcut_gemini_model', model.trim());
    localStorage.setItem('smartcut_ai_model', model.trim());
  }
}

// PostgreSQL Schema on Supabase for Gemini
export function getSupabaseSchemaPrompt(salonId: string): string {
  return `
You have direct read-only SQL access to PostgreSQL database on Supabase for the current salon.
STRICT TENANT ISOLATION RULE:
Every queried table MUST include the filter: salon_id = '${salonId}'
IT IS STRICTLY FORBIDDEN to query or access any data with a different salon_id or without filtering by salon_id.

Supabase Tables and Columns:
1. "invoices":
   - "id" (TEXT/UUID, PK), "salon_id" (UUID), "branch_id" (UUID), "invoice_number" (TEXT), "date" (DATE), "client_name" (TEXT), "client_phone" (TEXT), "subtotal" (NUMERIC), "discount" (NUMERIC), "vat_amount" (NUMERIC), "total" (NUMERIC), "paid" (NUMERIC), "remaining" (NUMERIC), "payment_method" (TEXT: 'cash', 'card', 'online', 'mixed'), "status" (TEXT: 'completed', 'cancelled'), "cashier_name" (TEXT), "shift_code" (TEXT), "created_at" (TIMESTAMPTZ).

2. "clients":
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "name" (TEXT), "phone" (TEXT), "email" (TEXT), "total_spend" (NUMERIC), "visits_count" (INTEGER), "cashback_balance" (NUMERIC), "tier_level" (TEXT: 'standard', 'distinguished', 'vip', 'royal'), "is_vip" (BOOLEAN), "last_visit" (DATE), "notes" (TEXT), "is_blacklisted" (BOOLEAN).

3. "employees":
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "name" (TEXT), "phone" (TEXT), "role" (TEXT: 'barber', 'technician', 'cashier', 'cleaner', 'manager'), "base_salary" (NUMERIC), "salary_type" (TEXT: 'salary', 'commission_only', 'salary_plus_commission'), "commission_rate" (NUMERIC), "target" (NUMERIC), "target_type" (TEXT: 'daily', 'monthly'), "is_active" (BOOLEAN).

4. "products":
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "name" (TEXT), "barcode" (TEXT), "cost_price" (NUMERIC), "sell_price" (NUMERIC), "stock_quantity" (NUMERIC), "reorder_limit" (INTEGER), "category" (TEXT), "unit" (TEXT), "is_active" (BOOLEAN).

5. "services":
   - "id" (TEXT, PK), "salon_id" (UUID), "category_id" (TEXT), "name" (TEXT), "price" (NUMERIC), "duration_minutes" (INTEGER), "type" (TEXT), "is_active" (BOOLEAN).

6. "categories":
   - "id" (TEXT, PK), "salon_id" (UUID), "name" (TEXT), "icon" (TEXT), "type" (TEXT).

7. "transactions":
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "type" (TEXT: 'income', 'expense'), "amount" (NUMERIC), "category" (TEXT: 'sales', 'expense', 'advance', 'salary', 'commission'), "description" (TEXT), "payment_method" (TEXT), "treasury" (TEXT), "treasury_id" (TEXT), "shift_date" (DATE), "date" (DATE).

8. "bookings":
   - "id" (TEXT, PK), "salon_id" (UUID), "booking_code" (TEXT), "customer_name" (TEXT), "customer_phone" (TEXT), "employee_name" (TEXT), "date" (DATE), "time" (TEXT), "total_amount" (NUMERIC), "status" (TEXT: 'pending', 'confirmed', 'completed', 'cancelled'), "deposit_paid" (NUMERIC), "notes" (TEXT).

9. "work_shifts":
   - "id" (TEXT, PK), "salon_id" (UUID), "branch_id" (UUID), "shift_code" (TEXT), "shift_date" (DATE), "opened_at" (TIMESTAMPTZ), "closed_at" (TIMESTAMPTZ), "opened_by_user_name" (TEXT), "status" (TEXT: 'open', 'closed'), "initial_cash" (NUMERIC), "total_sales" (NUMERIC), "total_expenses" (NUMERIC), "expected_cash" (NUMERIC), "actual_cash" (NUMERIC), "cash_difference" (NUMERIC).

10. "customer_complaints":
    - "id" (TEXT, PK), "salon_id" (UUID), "client_name" (TEXT), "client_phone" (TEXT), "category" (TEXT), "complaint_text" (TEXT), "status" (TEXT: 'open', 'resolved', 'closed'), "created_at" (TIMESTAMPTZ).

11. "tips":
    - "id" (TEXT, PK), "salon_id" (UUID), "employee_name" (TEXT), "client_name" (TEXT), "amount" (NUMERIC), "status" (TEXT: 'pending_payout', 'paid_out'), "created_at" (TIMESTAMPTZ).

12. "suppliers":
    - "id" (TEXT, PK), "salon_id" (UUID), "name" (TEXT), "phone" (TEXT), "current_balance" (NUMERIC).

13. "purchase_invoices":
    - "id" (TEXT, PK), "salon_id" (UUID), "supplier_id" (TEXT), "invoice_number" (TEXT), "date" (DATE), "total_amount" (NUMERIC), "paid_amount" (NUMERIC), "remaining_amount" (NUMERIC).

14. "branches":
    - "id" (UUID, PK), "salon_id" (UUID), "name" (TEXT), "code" (TEXT), "country" (TEXT), "currency" (TEXT), "phone" (TEXT), "is_main" (BOOLEAN).

15. "salons":
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

// Call Google Gemini API
async function callGeminiApi({
  apiKey,
  model,
  prompt,
  systemInstruction
}: {
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
}): Promise<string> {
  const targetModel = model || DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedMsg = `HTTP ${response.status}`;
    try {
      const errJson = JSON.parse(errText);
      parsedMsg = errJson?.error?.message || parsedMsg;
    } catch {}
    throw new Error(`خطأ في Gemini API: ${parsedMsg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('لم يتم استلام أي رد من نموذج Gemini الذكي.');
  }

  return text.trim();
}

// Main Function: Question -> Gemini SQL Generation -> Supabase Execution -> Gemini Natural Language Answer
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
  const { apiKey, model } = getGeminiCredentials(settings);

  if (!apiKey) {
    throw new Error('يرجى إدخال وتفعيل مفتاح Google Gemini API Key في إعدادات المساعد الذكي أولاً.');
  }

  const salonId = settings?.salonId || '11111111-1111-4111-8111-111111111111';
  const salonName = settings?.salonName || 'الصالون';
  const currency = settings?.currency || 'EGP';

  // Step 1: Prompt Gemini to convert Question to SQL
  const schemaPrompt = getSupabaseSchemaPrompt(salonId);
  const sqlSystemInstruction = `You are a PostgreSQL Text-to-SQL Generator for Supabase.
Your ONLY task is to convert the manager's question into a single valid, read-only PostgreSQL SELECT query.

CRITICAL NON-NEGOTIABLE SECURITY RULES:
1. STRICT SALON ISOLATION:
   You MUST include "WHERE salon_id = '${salonId}'" (or "AND salon_id = '${salonId}'") on EVERY table being queried.
   NEVER query across all salons. Only salon '${salonId}'.
2. READ-ONLY SELECT ONLY:
   You must NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE statements.
3. OUTPUT FORMAT:
   Return ONLY the raw SQL query. Do NOT add explanation, markdown formatting, or preamble. Just the SQL.
   If the user's message is a greeting or general pleasantry that requires no database query, return: NO_QUERY_NEEDED
4. DATE HANDLING:
   Use CURRENT_DATE for today. For month start: date_trunc('month', CURRENT_DATE).
5. LIMITS:
   For lists, always append LIMIT 50.

Database Schema:
${schemaPrompt}
`;

  const sqlPrompt = `Manager Question: ${userMessage}
Generate the PostgreSQL query for salon '${salonId}':`;

  const rawSqlResponse = await callGeminiApi({
    apiKey,
    model,
    prompt: sqlPrompt,
    systemInstruction: sqlSystemInstruction
  });

  const cleanSql = rawSqlResponse
    .replace(/```(?:sql)?/gi, '')
    .replace(/```/g, '')
    .trim();

  // If general conversation without database need
  if (cleanSql === 'NO_QUERY_NEEDED' || (!cleanSql.toUpperCase().startsWith('SELECT') && !cleanSql.toUpperCase().startsWith('WITH'))) {
    const conversationalPrompt = `أنت مساعد الإدارة الذكي لصالون (${salonName}). أجب بلطف واحترافية باللغة العربية على الرسالة التالية:\n${userMessage}`;
    const directReply = await callGeminiApi({
      apiKey,
      model,
      prompt: conversationalPrompt
    });

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: directReply }
    ];

    return {
      reply: directReply,
      updatedHistory
    };
  }

  // Step 2: Validate and Execute SQL on Supabase
  const sqlExecution = await executeSupabaseAiSql(cleanSql, salonId);

  if (onSqlExecuted && sqlExecution.success) {
    onSqlExecuted(cleanSql, sqlExecution.rowCount ?? 0);
  }

  // Step 3: Prompt Gemini to synthesize answer based on real Supabase data
  const answerSystemInstruction = `أنت المساعد المالي والتحليلي الذكي لمدير صالون (${salonName}).
لديك سؤال المدير، واستعلام SQL الذي نُفذ على قاعدة بيانات Supabase، والنتائج الفعلية المسترجعة من قاعدة البيانات.

تعليمات الإجابة الصارمة:
1. انعدام التخمين (Zero Hallucination): اعتمد حصراً وبشكل تام على أرقام وبيانات JSON المسترجعة. لا تخترع أرقاماً أبداً.
2. إذا كانت البيانات فارغة ([] أو 0 سجلات): اذكر بوضوح: "لم يتم العثور على أي بيانات مطابقة في قاعدة البيانات لهذا الاستفسار."
3. استخدم العملة المعتمدة (${currency}) مع أي مبالغ مالية.
4. نسق الإجابة بتنسيق Markdown جميل (عناوين، نقاط، جداول، خط عريض للأرقام الهامة).
5. كن مختصراً ودقيقاً ومباشراً.`;

  const answerPrompt = `سؤال المدير:
${userMessage}

استعلام SQL المنفذ على Supabase:
${cleanSql}

نتائج قاعدة البيانات الفعلية (JSON):
${JSON.stringify(sqlExecution.rows || (sqlExecution.error ? { error: sqlExecution.error } : []))}

صغ إجابتك الاحترافية للمدير الآن:`;

  const finalAnswer = await callGeminiApi({
    apiKey,
    model,
    prompt: answerPrompt,
    systemInstruction: answerSystemInstruction
  });

  const updatedHistory: ChatMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
    { 
      role: 'assistant', 
      content: finalAnswer,
      executedSql: cleanSql,
      sqlResultCount: sqlExecution.rowCount ?? 0
    }
  ];

  return {
    reply: finalAnswer,
    executedSql: cleanSql,
    sqlResultCount: sqlExecution.rowCount ?? 0,
    updatedHistory
  };
}
