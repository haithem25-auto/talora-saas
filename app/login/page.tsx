"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const router = useRouter();

  // دالة توجيه المستخدم حسب دوره في جدول profiles
  async function redirectUserByRole(userId: string) {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("خطأ أثناء جلب البروفايل:", error);
      }

      // تنظيف نص الرتبة وتوحيد الأحرف
      const userRole = profile?.role ? String(profile.role).trim().toLowerCase() : "";

      console.log("الدور المستخرج للمستخدم:", userRole);

      switch (userRole) {
        case "teacher":
          router.push("/teacher");
          break;

        case "parent":
          router.push("/parent");
          break;

        case "independent_teacher":
          router.push("/freelancetech-dashboard");
          break;

        case "school_owner":
          router.push("/dashboard");
          break;

        default:
          // التوجيه الافتراضي للوحة التحكم الرئيسية
          router.push("/dashboard");
          break;
      }
    } catch (err) {
      console.error("خطأ أثناء جلب دور المستخدم:", err);
      // التوجيه الافتراضي لوحة التحكم الرئيسية
      router.push("/dashboard");
    }
  }

  // 1. تسجيل الدخول بالبريد وكلمة المرور
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!email || !password) {
      setErrorMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        await redirectUserByRole(data.user.id);
      }
    } catch (err: any) {
      console.error("خطأ تسجيل الدخول:", err);
      setErrorMessage(
        err.message === "Invalid login credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : err.message || "حدث خطأ أثناء تسجيل الدخول."
      );
    } finally {
      setIsLoading(false);
    }
  }

  // 2. تسجيل الدخول باستخدام Google
  async function handleGoogleLogin() {
    setIsGoogleLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsGoogleLoading(false);
    }
  }

  // 3. إعادة تعيين كلمة السر
  async function handleForgotPassword() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      setErrorMessage("يرجى كتابة بريدك الإلكتروني أولاً في حقل البريد الإلكتروني لإرسال رابط الاستعادة.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setSuccessMessage("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.");
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء إرسال رابط الاستعادة.");
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-white text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden"
    >
      {/* خلفية تالورا السينمائية */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-50/80 via-blue-50/20 to-transparent pointer-events-none -z-10 blur-3xl rounded-full" />

      <div className="w-full max-w-md my-auto">
        {/* الشعار والهوية البصرية لـ Talora */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-3xl shadow-xl shadow-blue-500/25 mb-3 ring-4 ring-blue-100">
            T
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            TALORA
          </h1>
          <p className="text-sm font-semibold text-slate-400 mt-1">
            مرحباً بك مجدداً، سجل دخولك للوصول إلى لوحة التحكم
          </p>
        </div>

        {/* بطاقة تسجيل الدخول */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-2xl shadow-blue-900/5">
          <h2 className="text-xl font-bold text-slate-900 mb-6">تسجيل الدخول</h2>

          {/* تنبيه الأخطاء */}
          {errorMessage && (
            <div className="mb-5 p-4 bg-red-50/80 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center flex items-center justify-center gap-2">
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* تنبيه النجاح */}
          {successMessage && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold text-center">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* البريد الإلكتروني */}
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isGoogleLoading}
                className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm dir-ltr text-right disabled:opacity-50"
                required
              />
            </div>

            {/* كلمة المرور */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-600 block">
                  كلمة المرور
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline focus:outline-none"
                >
                  نسيت كلمة السر؟
                </button>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isGoogleLoading}
                className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm disabled:opacity-50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white h-12 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 mt-2 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري تسجيل الدخول...
                </span>
              ) : (
                "تسجيل الدخول"
              )}
            </button>
          </form>

          {/* فاصل بصري */}
          <div className="relative flex py-5 items-center my-1">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium">أو عبر</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* زر Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 h-12 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-sm shadow-sm"
          >
            {isGoogleLoading ? (
              <svg className="animate-spin h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.073 14.96 0 12 0 7.354 0 3.392 2.673 1.48 6.564l3.786 3.201z" />
                  <path fill="#4285F4" d="M23.491 12.275c0-.796-.073-1.564-.191-2.305H12v4.51h6.464a5.523 5.523 0 01-2.395 3.618l3.723 2.891c2.177-2.005 3.423-4.955 3.423-8.714z" />
                  <path fill="#FBBC05" d="M5.266 14.235L1.48 17.436A11.936 11.936 0 0012 24c2.96 0 5.642-1.073 7.714-2.927l-3.723-2.891a7.121 7.121 0 01-3.991 1.118 7.077 7.077 0 01-6.734-4.855z" />
                  <path fill="#34A853" d="M12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.073 14.96 0 12 0 7.354 0 3.392 2.673 1.48 6.564l3.786 3.201A7.077 7.077 0 0112 4.91z" />
                </svg>
                <span>المتابعة باستخدام Google</span>
              </>
            )}
          </button>

          {/* رابط إنشاء حساب جديد */}
          <div className="mt-6 text-center text-xs text-slate-500 font-medium">
            ليس لديك حساب بعد؟{" "}
            <Link href="/register" className="text-blue-600 font-bold hover:underline">
              أنشئ حسابك الآن
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}