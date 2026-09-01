import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==============================================================================
// 🔗 بيانات الاتصال بـ Supabase — SmartCut V2 Pro
// لتغيير قاعدة البيانات: عدّل القيمتين أدناه أو ضعهما في ملف .env
// ==============================================================================
const DEFAULT_SUPABASE_URL = 'https://api.101488.xyz';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjcyNTMxMjAwLCJleHAiOjE5ODgxNTA0MDB9.vW9qTGUVdfudKMLfAqHL78-QAtSMs58uNMlP-6dyySw';

let supabaseClient: SupabaseClient | null = null;

export const SupabaseService = {
  /**
   * ترتيب أولوية الاتصال:
   * 1. متغيرات البيئة (.env) — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
   * 2. الإعدادات المحفوظة في localStorage (من شاشة الإعدادات)
   * 3. القيم الثابتة الافتراضية أعلاه
   */
  getClient(url?: string, anonKey?: string): SupabaseClient | null {
    if (supabaseClient) return supabaseClient;

    const resolvedUrl =
      url ||
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      localStorage.getItem('smartcut_supabase_url') ||
      DEFAULT_SUPABASE_URL;

    const resolvedKey =
      anonKey ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      localStorage.getItem('smartcut_supabase_key') ||
      DEFAULT_SUPABASE_KEY;

    if (resolvedUrl && resolvedKey) {
      try {
        supabaseClient = createClient(resolvedUrl, resolvedKey);
      } catch (err) {
        console.error('Failed to init Supabase client:', err);
      }
    }
    return supabaseClient;
  },

  /** إعادة ضبط الاتصال بإعدادات جديدة (من شاشة الإعدادات) */
  updateConfig(url: string, key: string): boolean {
    try {
      supabaseClient = null;
      if (!url || !key) {
        localStorage.removeItem('smartcut_supabase_url');
        localStorage.removeItem('smartcut_supabase_key');
        return true;
      }
      localStorage.setItem('smartcut_supabase_url', url);
      localStorage.setItem('smartcut_supabase_key', key);
      supabaseClient = createClient(url, key);
      return true;
    } catch (e) {
      console.error('Supabase config error:', e);
      return false;
    }
  },

  isConfigured(): boolean {
    return !!this.getClient();
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const client = this.getClient();
    if (!client) return { success: false, message: 'لم يتم ضبط إعدادات الاتصال بـ Supabase بعد' };
    try {
      const { error } = await client.from('salons').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'تم الاتصال بقاعدة بيانات Supabase السحابية بنجاح! ✅' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'فشل الاتصال' };
    }
  }
};

