import OpenAI from 'openai';
import { AppSettings } from '../types';

// ==============================================================================
// OpenRouter Text-to-SQL Service (libSQL Local Database Query Engine)
// ==============================================================================

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  executedSql?: string;
  sqlResultCount?: number;
  error?: boolean;
}

export const POPULAR_OPENROUTER_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini (الأسرع والأدق في استعلامات SQL - موصى به)' },
  { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash (سريع جداً ومنخفض التكلفة)' },
  { id: 'google/gemini-2.5-pro', name: 'Google Gemini 2.5 Pro (أعلى قدرات استدلال وتحليل)' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat V3 (أداء عالي واقتصادي)' },
  { id: 'anthropic/claude-sonnet-4', name: 'Anthropic Claude Sonnet 4 (دقة فائقة في المنطق)' },
  { id: 'anthropic/claude-3-haiku', name: 'Anthropic Claude 3 Haiku (سريع وخفيف)' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o (النموذج القيادي الشامل)' }
];

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

// Normalize model ID to handle deprecated/retired slugs gracefully
export function normalizeOpenRouterModel(rawModel?: string | null): string {
  if (!rawModel || !rawModel.trim()) return DEFAULT_OPENROUTER_MODEL;
  const m = rawModel.trim();
  // Automatically migrate deprecated or retired model slugs on OpenRouter to active equivalents
  if (m.includes('claude-3.5-sonnet') || m.includes('claude-3-sonnet')) {
    return 'openai/gpt-4o-mini';
  }
  if (m === 'google/gemini-1.5-flash' || m === 'google/gemini-1.5-pro' || m === 'google/gemini-2.0-flash-001') {
    return 'google/gemini-2.5-flash';
  }
  return m;
}

// Retrieve credentials safely from settings or local storage
export function getOpenRouterCredentials(settings?: AppSettings): OpenRouterConfig {
  let apiKey = '';
  let model = DEFAULT_OPENROUTER_MODEL;

  if (settings?.openrouterApiKey) {
    apiKey = settings.openrouterApiKey.trim();
  }
  if (!apiKey && typeof window !== 'undefined') {
    apiKey = (localStorage.getItem('smartcut_openrouter_api_key') || '').trim();
  }

  if (settings?.openrouterModel) {
    model = normalizeOpenRouterModel(settings.openrouterModel);
  } else if (typeof window !== 'undefined') {
    const local = localStorage.getItem('smartcut_openrouter_model');
    model = normalizeOpenRouterModel(local || DEFAULT_OPENROUTER_MODEL);
  }

  return { apiKey, model };
}

// Save credentials locally and in state
export function saveOpenRouterCredentials(apiKey: string, model: string): void {
  const normModel = normalizeOpenRouterModel(model);
  if (typeof window !== 'undefined') {
    localStorage.setItem('smartcut_openrouter_api_key', apiKey.trim());
    localStorage.setItem('smartcut_openrouter_model', normModel);
  }
}

// Exact Database Schema for the Text-to-SQL Tool
export const DATABASE_SCHEMA_PROMPT = `
You have access to the local SQLite/libSQL database named "smartcut.db".
ALL table names and column names MUST be wrapped in double quotes in your SQL queries (e.g., SELECT "name", "total_amount" FROM "invoices").

Tables and Exact Columns:
1. "salons":
   - "id" (TEXT, PK), "name" (TEXT), "salon_code" (TEXT), "phone" (TEXT), "currency" (TEXT), "tax_number" (TEXT), "commercial_record" (TEXT), "address" (TEXT), "is_active" (INTEGER).

2. "branches":
   - "id" (TEXT, PK), "salon_id" (TEXT), "name" (TEXT), "code" (TEXT), "phone" (TEXT), "address" (TEXT), "is_main" (INTEGER), "is_active" (INTEGER).

3. "users":
   - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "name" (TEXT), "username" (TEXT), "role" (TEXT: 'owner', 'admin', 'cashier', 'accountant', 'barber'), "phone" (TEXT), "is_active" (INTEGER).

4. "categories":
   - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "name" (TEXT), "is_active" (INTEGER).

5. "services":
   - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "category_id" (TEXT), "name" (TEXT), "price" (REAL), "discount_price" (REAL), "duration_minutes" (INTEGER), "type" (TEXT: 'service'), "employee_commission_percentage" (REAL), "employee_commission_amount" (REAL), "is_active" (INTEGER).

6. "products":
   - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "name" (TEXT), "barcode" (TEXT), "cost_price" (REAL), "sell_price" (REAL), "stock_quantity" (REAL), "reorder_limit" (INTEGER), "unit" (TEXT), "is_active" (INTEGER).

7. "employees":
   - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "name" (TEXT), "phone" (TEXT), "role" (TEXT: 'barber', 'technician', 'cashier', 'cleaner', 'manager'), "base_salary" (REAL), "salary_type" (TEXT: 'salary', 'commission_only', 'salary_plus_commission'), "commission_rate" (REAL), "target" (REAL), "target_type" (TEXT: 'daily', 'monthly'), "daily_target_amount" (REAL), "monthly_target_amount" (REAL), "target_commission_rate" (REAL), "available_vacations" (INTEGER), "is_blacklisted" (INTEGER), "blacklist_reason" (TEXT), "is_active" (INTEGER).

8. "clients":
   - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "name" (TEXT), "phone" (TEXT), "email" (TEXT), "total_spend" (REAL), "visits_count" (INTEGER), "cashback_balance" (REAL), "tier_level" (TEXT: 'standard', 'distinguished', 'vip', 'royal'), "is_blacklisted" (INTEGER), "blacklist_reason" (TEXT), "is_active" (INTEGER).

9. "invoices":
   - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "invoice_number" (TEXT), "date" (TEXT: YYYY-MM-DD), "client_id" (TEXT), "client_name" (TEXT), "client_phone" (TEXT), "subtotal" (REAL), "discount_amount" (REAL), "promo_code" (TEXT), "vat" (REAL), "total_amount" (REAL), "paid" (REAL), "remaining" (REAL), "payment_method" (TEXT: 'cash', 'card', 'online', 'mixed'), "status" (TEXT: 'completed', 'cancelled', 'refunded'), "cashier_name" (TEXT), "created_at" (TEXT).

10. "invoice_items":
    - "id" (TEXT, PK), "salon_id" (TEXT), "invoice_id" (TEXT), "service_id" (TEXT), "product_id" (TEXT), "item_name" (TEXT), "item_type" (TEXT: 'service', 'product'), "quantity" (REAL), "unit_price" (REAL), "total_price" (REAL), "employee_id" (TEXT), "employee_name" (TEXT), "employee_commission" (REAL).

11. "bookings":
    - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "booking_code" (TEXT), "client_id" (TEXT), "customer_name" (TEXT), "customer_phone" (TEXT), "employee_id" (TEXT), "date" (TEXT: YYYY-MM-DD), "time" (TEXT: HH:MM), "duration_minutes" (INTEGER), "total_amount" (REAL), "status" (TEXT: 'pending', 'confirmed', 'completed', 'cancelled'), "notes" (TEXT).

12. "transactions":
    - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "type" (TEXT: 'income', 'expense', 'in', 'out'), "amount" (REAL), "category" (TEXT: 'sales', 'expense', 'advance', 'salary', 'commission'), "description" (TEXT), "payment_method" (TEXT), "treasury" (TEXT), "treasury_id" (TEXT), "invoice_id" (TEXT), "shift_date" (TEXT), "date" (TEXT).

13. "customer_complaints":
    - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "client_name" (TEXT), "client_phone" (TEXT), "invoice_id" (TEXT), "invoice_date" (TEXT), "category" (TEXT), "complaint_text" (TEXT), "status" (TEXT: 'open', 'resolved', 'closed'), "created_at" (TEXT).

14. "tips":
    - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "employee_id" (TEXT), "client_name" (TEXT), "amount" (REAL), "status" (TEXT: 'pending_payout', 'paid_out'), "created_at" (TEXT).

15. "fingerprint_logs":
    - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "employee_id" (TEXT), "timestamp" (TEXT: ISO Datetime), "type" (TEXT: 'check_in', 'check_out'), "status" (TEXT), "notes" (TEXT).

16. "work_shifts":
    - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "shift_date" (TEXT), "opened_at" (TEXT), "closed_at" (TEXT), "opened_by_user_name" (TEXT), "initial_cash" (REAL), "expected_cash" (REAL), "actual_cash" (REAL), "cash_difference" (REAL), "status" (TEXT: 'open', 'closed').

17. "suppliers":
    - "id" (TEXT, PK), "salon_id" (TEXT), "name" (TEXT), "phone" (TEXT), "current_balance" (REAL).

18. "purchase_invoices":
    - "id" (TEXT, PK), "salon_id" (TEXT), "supplier_id" (TEXT), "invoice_number" (TEXT), "date" (TEXT), "total_amount" (REAL), "paid_amount" (REAL), "remaining_amount" (REAL).

19. "supplier_payments":
    - "id" (TEXT, PK), "salon_id" (TEXT), "supplier_id" (TEXT), "payment_number" (TEXT), "date" (TEXT), "amount" (REAL).

20. "held_invoices":
    - "id" (TEXT, PK), "salon_id" (TEXT), "branch_id" (TEXT), "client_name" (TEXT), "client_phone" (TEXT), "held_at" (TEXT).
`;

// Strict System Prompt ensuring Zero Hallucination, strict Quotes, and Aggregations
export const SYSTEM_PROMPT = `You are the Senior Executive Database Assistant for the Manager of the Salon Management System.
You answer questions by formulating precise SQLite SELECT queries and calling the "execute_sql" tool.

CRITICAL NON-NEGOTIABLE DIRECTIVES:
1. ZERO HALLUCINATION (STRICTEST RULE):
   - You are strictly forbidden to invent, fabricate, guess, or infer any numbers, metrics, currency values, dates, or names that are not explicitly present in the SQL execution results returned to you.
   - If the SQL query execution returns zero rows or empty data, you MUST reply verbatim: "لم يتم العثور على بيانات مطابقة." (or "No matching data found." if asked in English). Do NOT apologize or add imaginary examples.

2. READ-ONLY SECURITY:
   - You only have permission to execute SELECT queries.
   - You must NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, REPLACE, CREATE, or PRAGMA statements.

3. STRICT SQL SYNTAX (QUOTES REQUIRED):
   - You MUST wrap EVERY table name and column name in double quotes (e.g. SELECT "name", "total_amount" FROM "invoices" WHERE "status" = 'completed').
   - Double quotes prevent syntax errors with SQLite reserved words (such as "date", "order", "group", "time", "status", "type").

4. HANDLING LARGE DATASETS & TOKEN LIMITS:
   - Always use SQL aggregation functions (SUM, COUNT, AVG, MIN, MAX, GROUP BY) when answering summary, financial, or statistical questions.
   - Whenever listing individual records, always append "LIMIT 50" to prevent overwhelming the response.

5. ACCURATE CALCULATIONS:
   - For revenue: SUM("total_amount") from "invoices" where "status" = 'completed'.
   - For today's date: use SQLite function date('now') or date("date") = date('now').
   - For sorting: use ORDER BY "total_amount" DESC, etc.

6. LANGUAGE & TONE:
   - Answer in clear, professional Arabic (or English if the manager speaks in English).
   - Format numbers clearly with appropriate currency symbols.
   - Answer directly and concisely based strictly on the JSON returned by the tool.

Database Schema Overview:
${DATABASE_SCHEMA_PROMPT}
`;

// Tool definition for OpenRouter / OpenAI Function Calling
const EXECUTE_SQL_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'execute_sql',
    description: `Execute a read-only SQLite/libSQL SELECT query against the local database to answer the manager's question.
The query MUST be a SELECT statement. All field names and table names MUST be wrapped in double quotes.`,
    parameters: {
      type: 'object',
      properties: {
        sql_query: {
          type: 'string',
          description: 'The read-only SQLite SELECT query to execute. Must wrap table and column names in double quotes, e.g.: SELECT "name", "total_amount" FROM "invoices" WHERE "status" = \'completed\' LIMIT 10'
        }
      },
      required: ['sql_query']
    }
  }
};

// Client-side validator for Read-Only SQL Security
export function validateReadOnlySql(sql: string): { valid: boolean; error?: string } {
  if (!sql || typeof sql !== 'string' || !sql.trim()) {
    return { valid: false, error: 'استعلام SQL فارغ.' };
  }

  const clean = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const upper = clean.toUpperCase();

  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH') && !upper.startsWith('EXPLAIN')) {
    return { valid: false, error: 'خرق أمني: يُسمح فقط بتنفيذ استعلامات القراءة (SELECT).' };
  }

  const forbidden = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
    'REPLACE', 'EXEC', 'CREATE', 'ATTACH', 'DETACH', 'PRAGMA',
    'GRANT', 'REVOKE', 'VACUUM', 'REINDEX'
  ];

  for (const kw of forbidden) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(clean)) {
      return { valid: false, error: `خرق أمني: الأمر '${kw}' محظور تماماً. قاعدة البيانات في وضع القراءة فقط.` };
    }
  }

  const statementCount = clean.split(';').map(s => s.trim()).filter(Boolean).length;
  if (statementCount > 1) {
    return { valid: false, error: 'خرق أمني: لا يُسمح بتنفيذ أكثر من جملة SQL واحدة.' };
  }

  return { valid: true };
}

// Execute query on the local libSQL backend
export async function executeLocalSql(sql: string): Promise<{ success: boolean; rows?: any[]; error?: string; rowCount?: number }> {
  // 1. Client-side security verification
  const check = validateReadOnlySql(sql);
  if (!check.valid) {
    return { success: false, error: check.error };
  }

  // 2. Determine API base URL
  let baseUrl = '';
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('smartcut_api_url') || localStorage.getItem('smartcut_mssql_api_url');
    if (customUrl && customUrl.startsWith('http')) {
      baseUrl = customUrl.replace(/\/+$/, '');
    }
  }

  const targetUrl = baseUrl ? `${baseUrl}/api/ai/execute-sql` : '/api/ai/execute-sql';

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${res.status}: خطأ في تنفيذ الاستعلام` };
    }

    return {
      success: true,
      rows: data.rows || [],
      rowCount: data.rowCount ?? (data.rows ? data.rows.length : 0)
    };
  } catch (err: any) {
    console.error('ExecuteLocalSql fetch error:', err);
    return { success: false, error: err?.message || 'تعذر الاتصال بخادم قاعدة البيانات المحلي (Port 3001)' };
  }
}

// Main Execution Loop: Manager Message -> AI SQL Generation -> Local libSQL Execution -> AI Final Answer
export async function sendManagerAIMessage({
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
  const { apiKey, model } = getOpenRouterCredentials(settings);

  if (!apiKey) {
    throw new Error('يرجى إدخال وتفعيل مفتاح OpenRouter API Key في شاشة الإعدادات أولاً.');
  }

  // Initialize standard OpenAI client configured for OpenRouter
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'Smart Cut Salon Management System'
    }
  });

  // Prepare messages array starting with strict system prompt
  const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  // Append conversation history (limited to last 10 messages for context efficiency)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === 'user') {
      openAiMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      openAiMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Append new user question
  openAiMessages.push({ role: 'user', content: userMessage });

  let targetModel = normalizeOpenRouterModel(model);

  // Helper to execute completions with auto-fallback to DEFAULT_OPENROUTER_MODEL if chosen model fails
  const createCompletionWithFallback = async (params: any) => {
    try {
      return await openai.chat.completions.create({
        ...params,
        model: targetModel
      });
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      const isModelNotFound = errMsg.includes('No endpoints found') || 
                              errMsg.includes('not found') || 
                              errMsg.includes('404') ||
                              errMsg.includes('does not exist');

      if (isModelNotFound && targetModel !== DEFAULT_OPENROUTER_MODEL) {
        console.warn(`[OpenRouter] Model '${targetModel}' not available. Auto-falling back to '${DEFAULT_OPENROUTER_MODEL}'. Error:`, errMsg);
        targetModel = DEFAULT_OPENROUTER_MODEL;
        saveOpenRouterCredentials(apiKey, DEFAULT_OPENROUTER_MODEL);
        return await openai.chat.completions.create({
          ...params,
          model: DEFAULT_OPENROUTER_MODEL
        });
      }
      throw err;
    }
  };

  // Step 1: Call OpenRouter with Tool Calling enabled
  const firstResponse = await createCompletionWithFallback({
    messages: openAiMessages,
    tools: [EXECUTE_SQL_TOOL],
    tool_choice: 'auto',
    temperature: 0.0 // ZERO HALLUCINATION MANDATE
  });

  const responseMessage = firstResponse.choices[0]?.message;

  if (!responseMessage) {
    throw new Error('لم يتم استلام رد من خدمة OpenRouter.');
  }

  // Check if AI called the execute_sql tool
  const toolCalls = responseMessage.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    const sqlToolCall = toolCalls.find(tc => tc.type === 'function' && tc.function.name === 'execute_sql');

    if (sqlToolCall && sqlToolCall.type === 'function') {
      let sqlQuery = '';
      try {
        const parsedArgs = JSON.parse(sqlToolCall.function.arguments);
        sqlQuery = parsedArgs.sql_query;
      } catch (parseErr) {
        throw new Error('فشل في فك استعلام SQL الصادر من الذكاء الاصطناعي.');
      }

      // Step 2 & 3: Execute SQL locally on libSQL
      const sqlResult = await executeLocalSql(sqlQuery);

      if (onSqlExecuted) {
        onSqlExecuted(sqlQuery, sqlResult.rowCount || 0);
      }

      // Append assistant's tool call message
      openAiMessages.push(responseMessage);

      // Step 4: Append tool response with results JSON
      const toolContent = sqlResult.success
        ? JSON.stringify({
            status: 'success',
            rowCount: sqlResult.rowCount,
            data: (sqlResult.rows || []).slice(0, 100) // Safely limit payload
          })
        : JSON.stringify({
            status: 'error',
            error: sqlResult.error
          });

      openAiMessages.push({
        role: 'tool',
        tool_call_id: sqlToolCall.id,
        content: toolContent
      });

      // Step 5: Second call to formulate final natural language answer strictly from the JSON
      const secondResponse = await createCompletionWithFallback({
        messages: openAiMessages,
        temperature: 0.0 // STRICT ZERO HALLUCINATION
      });

      const finalReply = secondResponse.choices[0]?.message?.content || 'لم يتم استلام صياغة نهائية للرد.';

      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
        {
          role: 'assistant',
          content: finalReply,
          executedSql: sqlQuery,
          sqlResultCount: sqlResult.rowCount
        }
      ];

      return {
        reply: finalReply,
        executedSql: sqlQuery,
        sqlResultCount: sqlResult.rowCount,
        updatedHistory
      };
    }
  }

  // Fallback: If AI answered directly without SQL
  const directReply = responseMessage.content || 'لم يتم استلام رد نصي.';
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
