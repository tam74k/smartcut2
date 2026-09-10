import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==============================================================================
// 🔗 بيانات الاتصال بـ Supabase — SmartCut V2 Pro (Singleton REST Client Instance)
// ==============================================================================
const DEFAULT_SUPABASE_URL = 'https://api.101488.xyz';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjcyNTMxMjAwLCJleHAiOjE5ODgxNTA0MDB9.vW9qTGUVdfudKMLfAqHL78-QAtSMs58uNMlP-6dyySw';

// Singleton instance created once outside of React component lifecycle
const initialUrl =
  (typeof window !== 'undefined' && localStorage.getItem('smartcut_supabase_url')) ||
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const initialKey =
  (typeof window !== 'undefined' && localStorage.getItem('smartcut_supabase_key')) ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_KEY;

let supabaseClient: SupabaseClient | null = null;
try {
  supabaseClient = createClient(initialUrl, initialKey, {
    auth: { persistSession: false }
  });
} catch (err) {
  console.error('Failed to init singleton Supabase client:', err);
}

export const SupabaseService = {
  /**
   * إرجاع النسخة الفريدة (Singleton) من عميل Supabase
   */
  getClient(url?: string, anonKey?: string): SupabaseClient | null {
    if (supabaseClient && !url && !anonKey) {
      return supabaseClient;
    }

    if (url && anonKey) {
      return this.updateConfig(url, anonKey) ? supabaseClient : null;
    }

    return supabaseClient;
  },

  /** إعادة ضبط الاتصال بإعدادات جديدة (من شاشة الإعدادات) مع الحفاظ على الـ Singleton */
  updateConfig(url: string, key: string): boolean {
    try {
      if (!url || !key) {
        localStorage.removeItem('smartcut_supabase_url');
        localStorage.removeItem('smartcut_supabase_key');
        supabaseClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY, {
          auth: { persistSession: false }
        });
        return true;
      }

      localStorage.setItem('smartcut_supabase_url', url);
      localStorage.setItem('smartcut_supabase_key', key);
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false }
      });
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

