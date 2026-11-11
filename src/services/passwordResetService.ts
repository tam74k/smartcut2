import { SupabaseService } from './supabase';
import { DB, dbUserToApp } from './db';
import { AuthService } from './auth';
import { ResendService } from './resendService';

interface TokenPayload {
  u: string;     // userId
  e: string;     // email
  exp: number;   // expiration timestamp in ms
  h: string;     // snippet of current password hash to guarantee single-use
  n: string;     // random nonce
}

const TOKEN_SECRET = 'sc_pwreset_sec_2026_x89!smartcut';

// Helper to calculate HMAC-SHA256 signature using browser standard SubtleCrypto
async function generateHmacSignature(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert payload to URL-safe base64 string
function encodeBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

export class PasswordResetService {
  /**
   * Generates a single-use cryptographically signed reset token valid for 30 minutes
   */
  public static async createResetToken(userId: string, email: string, currentPasswordOrHash: string): Promise<string> {
    const hashSnippet = (currentPasswordOrHash || 'default').slice(-8);
    const nonce = Math.random().toString(36).substring(2, 10);
    const exp = Date.now() + 30 * 60 * 1000; // 30 minutes expiry

    const payload: TokenPayload = {
      u: userId,
      e: email.toLowerCase().trim(),
      exp,
      h: hashSnippet,
      n: nonce,
    };

    const payloadString = JSON.stringify(payload);
    const base64Payload = encodeBase64Url(payloadString);
    const signature = await generateHmacSignature(payloadString, TOKEN_SECRET);

    return `${base64Payload}.${signature}`;
  }

  /**
   * Decodes and verifies the authenticity, expiration, and user active status
   */
  public static async verifyResetToken(token: string): Promise<{ valid: boolean; error?: string; user?: any }> {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'رابط إعادة تعيين كلمة المرور غير صالح.' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'صيغة رابط الاستعادة غير صحيحة.' };
    }

    const [base64Payload, signature] = parts;
    let payload: TokenPayload;

    try {
      const payloadString = decodeBase64Url(base64Payload);
      const expectedSig = await generateHmacSignature(payloadString, TOKEN_SECRET);
      if (signature !== expectedSig) {
        return { valid: false, error: 'رمز الأمان غير متطابق أو تم العبث بالرابط.' };
      }
      payload = JSON.parse(payloadString);
    } catch {
      return { valid: false, error: 'بيانات الرابط تالفة أو غير صالحة.' };
    }

    // 1. Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'انتهت صلاحية هذا الرابط (صالح لمدة 30 دقيقة فقط). يرجى طلب رابط جديد.' };
    }

    // 2. Fetch fresh user from DB
    let user: any = null;
    const client = SupabaseService.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('users')
          .select('*')
          .eq('id', payload.u)
          .maybeSingle();

        if (data && !error) {
          user = dbUserToApp(data);
        }
      } catch (err) {
        console.warn('Supabase fetch user error during verify:', err);
      }
    }

    // Fallback to local storage if offline
    if (!user) {
      const localUsers = AuthService.getUsers();
      user = localUsers.find(u => u.id === payload.u);
    }

    if (!user) {
      return { valid: false, error: 'لم يتم العثور على حساب المستخدم المرتبط بهذا الرابط.' };
    }

    // 3. CRITICAL CHECK: User active check
    const isUserActive = user.active !== false && 
                         user.status !== 'disabled' && 
                         user.status !== 'inactive' && 
                         (user as any).is_active !== false;

    if (!isUserActive) {
      return {
        valid: false,
        error: 'عذراً، هذا الحساب معطل أو غير نشط في النظام حالياً. يرجى مراجعة إدارة الصالون.',
      };
    }

    // 4. CRITICAL CHECK: Check linked employee status if applicable
    const empId = user.employeeId || (user as any).employee_id;
    if (empId && client) {
      try {
        const { data: emp } = await client
          .from('employees')
          .select('id, is_active, status')
          .eq('id', empId)
          .maybeSingle();

        if (emp) {
          const empActive = emp.is_active !== false && 
                            emp.status !== 'inactive' && 
                            emp.status !== 'terminated' && 
                            emp.status !== 'resigned';
          if (!empActive) {
            return {
              valid: false,
              error: 'عذراً، تم إنهاء أو إيقاف خدمات هذا الموظف. لا يمكن استعادة كلمة المرور.',
            };
          }
        }
      } catch (err) {
        console.warn('Employee check failed:', err);
      }
    }

    // 5. Single-use check: Verify current password hash still matches the hash snippet in token
    const currentPass = String(user.password || (user as any).passwordHash || (user as any).password_hash || '');
    const currentHashSnippet = currentPass.slice(-8);
    if (payload.h !== currentHashSnippet) {
      return {
        valid: false,
        error: 'تم استخدام هذا الرابط مسبقاً أو تم تغيير كلمة المرور بالفعل. يرجى طلب رابط جديد إذا لزم الأمر.',
      };
    }

    return { valid: true, user };
  }

  /**
   * Initiates the password reset flow: finds user, verifies active status, creates link, and sends email via Resend
   */
  public static async requestPasswordReset(rawEmail: string): Promise<{ success: boolean; message: string }> {
    const email = (rawEmail || '').trim().toLowerCase();

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return { success: false, message: 'يرجى إدخال بريد إلكتروني صحيح ومعتمد.' };
    }

    let user: any = null;
    const client = SupabaseService.getClient();

    // 1. Query Supabase users table by email
    if (client) {
      try {
        const { data, error } = await client
          .from('users')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (data && !error) {
          user = dbUserToApp(data);
        }
      } catch (err) {
        console.warn('Supabase query failed during password reset request:', err);
      }
    }

    // Fallback to local users list
    if (!user) {
      const localUsers = AuthService.getUsers();
      user = localUsers.find(u => (u.email || '').trim().toLowerCase() === email);
    }

    if (!user) {
      return {
        success: false,
        message: 'لم يتم العثور على أي حساب مسجل بهذا البريد الإلكتروني. يرجى التأكد من البريد المدخل.',
      };
    }

    // 2. CRITICAL SAFETY CHECK: Verify user is strictly active and not terminated/disabled
    const isUserActive = user.active !== false && 
                         user.status !== 'disabled' && 
                         user.status !== 'inactive' && 
                         (user as any).is_active !== false;

    if (!isUserActive) {
      return {
        success: false,
        message: 'عذراً، هذا الحساب معطل أو غير نشط في النظام. يرجى مراجعة إدارة الصالون.',
      };
    }

    // 3. Verify employee status if linked to an employee
    const empId = user.employeeId || (user as any).employee_id;
    if (empId && client) {
      try {
        const { data: emp } = await client
          .from('employees')
          .select('id, is_active, status')
          .eq('id', empId)
          .maybeSingle();

        if (emp) {
          const empActive = emp.is_active !== false && 
                            emp.status !== 'inactive' && 
                            emp.status !== 'terminated' && 
                            emp.status !== 'resigned';
          if (!empActive) {
            return {
              success: false,
              message: 'عذراً، تم إنهاء أو إيقاف خدمات هذا الموظف في الصالون. لا يمكن استعادة كلمة المرور.',
            };
          }
        }
      } catch (err) {
        console.warn('Employee active check warning:', err);
      }
    }

    // 4. Generate secure single-use token
    const currentPass = String(user.password || (user as any).passwordHash || (user as any).password_hash || '');
    const token = await this.createResetToken(user.id, email, currentPass);

    // 5. Construct reset URL
    const origin = window.location.origin;
    // Route using both query parameter and path for maximum hosting compatibility
    const resetLink = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    // Resolve Salon name
    let salonName = 'صالون SmartCut';
    try {
      const storedSettings = localStorage.getItem('smartcut_app_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed.salonName) salonName = parsed.salonName;
      }
    } catch {}

    // 6. Send the email using Resend
    const res = await ResendService.sendPasswordResetEmail(
      email,
      user.name || user.username || 'مستخدم النظام',
      resetLink,
      salonName
    );

    if (!res.success) {
      return {
        success: false,
        message: res.error || 'تعذر إرسال البريد الإلكتروني في الوقت الحالي. يرجى المحاولة لاحقاً.',
      };
    }

    return {
      success: true,
      message: `تم إرسال رابط استعادة كلمة المرور بنجاح إلى (${email}). يرجى التحقق من صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam).`,
    };
  }

  /**
   * Validates token and commits the new password to database & local storage
   */
  public static async executePasswordReset(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const cleanPass = (newPassword || '').trim();
    if (!cleanPass) {
      return { success: false, message: 'يرجى إدخال كلمة المرور الجديدة.' };
    }

    if (cleanPass.length < 6) {
      return { success: false, message: 'كلمة المرور الجديدة يجب ألا تقل عن 6 خانات.' };
    }

    // Re-verify token validity
    const verifyRes = await this.verifyResetToken(token);
    if (!verifyRes.valid || !verifyRes.user) {
      return { success: false, message: verifyRes.error || 'رمز الاستعادة غير صالح أو منتهي.' };
    }

    const user = verifyRes.user;

    // Update user password
    const updatedUser = {
      ...user,
      password: cleanPass,
      password_hash: cleanPass,
      passwordHash: cleanPass,
    };

    try {
      // 1. Update in local storage
      AuthService.saveUser(updatedUser);

      // 2. Update in Supabase
      const savedInDb = await DB.saveUser(updatedUser, user.salonId);
      if (!savedInDb) {
        console.warn('DB.saveUser returned false during password reset, but local state was updated.');
      }

      return {
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
      };
    } catch (err: any) {
      console.error('Failed to save updated password:', err);
      return {
        success: false,
        message: 'حدث خطأ أثناء حفظ كلمة المرور الجديدة في النظام. يرجى المحاولة مجدداً.',
      };
    }
  }
}
