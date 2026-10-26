"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();

  // الخطوة الحالية
  const [currentStep, setCurrentStep] = useState(1);

  // البيانات الشخصية الحسابية
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // نوع الحساب بالواجهة: academy | kindergarten | freelance_teacher
  const [accountType, setAccountType] = useState<
    "academy" | "kindergarten" | "freelance_teacher"
  >("academy");

  // بيانات المؤسسة (تخص الأكاديمية والروضة فقط)
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // حالات التحميل والأخطاء
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // دالة تحويل النصوص العربية إلى إنجليزية لتوليد الـ QR Code والـ Slug
  const arabicToLatin = (text: string): string => {
    const map: { [key: string]: string } = {
      أ: "a", إ: "a", آ: "a", ا: "a", ب: "b", ت: "t", ث: "th", ج: "j",
      ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh",
      ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q",
      ك: "k", ل: "l", م: "m", ن: "n", هـ: "h", ه: "h", و: "w", ي: "y",
      ى: "a", ة: "h", ء: "a", ئ: "y", ؤ: "w", " ": "-"
    };

    return text
      .split("")
      .map((char) => map[char] || char)
      .join("");
  };

  const generateSlugOrQr = (name: string): string => {
    const latinText = arabicToLatin(name);
    const cleanSlug = latinText
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const randomId = Math.random().toString(36).substring(2, 6);
    return `${cleanSlug || "school"}-${randomId}`;
  };

  const handleFirstStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setErrorMessage("يرجى إكمال جميع البيانات المطلوبة للبدء.");
      return;
    }
    setErrorMessage("");

    if (accountType === "freelance_teacher") {
      handleRegisterIndependentTeacher();
    } else {
      setCurrentStep(2);
    }
  };

  // 1. تسجيل الأستاذ الحر
  async function handleRegisterIndependentTeacher() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("فشل إنشاء حساب المستخدم.");

      const userId = authData.user.id;

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role: "independent_teacher",
        status: "active",
      });

      if (profileErr) throw profileErr;

      router.push("/teacher-dashboard");
    } catch (err: any) {
      console.error("خطأ أثناء التسجيل:", err);
      setErrorMessage(err.message || "حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  }

  // 2. تسجيل الأكاديمية أو الروضة
  async function handleRegisterSchoolOwner() {
    if (!schoolName.trim() || !city.trim() || !address.trim()) {
      setErrorMessage("يرجى ملء كافة تفاصيل بيانات المؤسسة.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("فشل إنشاء حساب المشرف.");

      const ownerId = authData.user.id;

      // إنشاء بروفايل المشرف أولاً
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: ownerId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role: "school_owner",
        school_name: schoolName.trim(),
        status: "active",
      });

      if (profileErr) throw profileErr;

      // توليد قيمة الـ qr_code والـ slug
      const generatedCode = generateSlugOrQr(schoolName.trim());

      // إنشاء المؤسسة في جدول schools
      const { data: schoolData, error: schoolErr } = await supabase
        .from("schools")
        .insert({
          name: schoolName.trim(),
          city: city.trim(),
          address: address.trim(),
          owner_id: ownerId,
          qr_code: generatedCode,
          slug: generatedCode,
        })
        .select("id")
        .single();

      if (schoolErr) {
        console.error("خطأ إنشاء المدرسة:", schoolErr);
        throw schoolErr;
      }

      // ربط school_id ببروفايل المالك
      const { error: updateProfileErr } = await supabase
        .from("profiles")
        .update({ school_id: schoolData.id })
        .eq("id", ownerId);

      if (updateProfileErr) throw updateProfileErr;

      router.push("/dashboard");
    } catch (err: any) {
      console.error("خطأ أثناء تسجيل المؤسسة:", err);
      setErrorMessage(err.message || "عذراً، تعذر إنشاء حساب المؤسسة في الوقت الحالي.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-white text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden"
      dir="rtl"
    >
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-50/80 via-blue-50/20 to-transparent pointer-events-none -z-10 blur-3xl rounded-full" />
      
      <div className="w-full max-w-xl my-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-3xl shadow-xl shadow-blue-500/25 mb-3 ring-4 ring-blue-100">
            T
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            TALORA
          </h1>
          <p className="text-sm font-semibold text-slate-400 mt-1">
            المنصة الذكية لإدارة وتطوير المؤسسات التعليمية
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-2xl shadow-blue-900/5">
          {/* شريط الخطوات */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-sm transition-all ${
                  currentStep === 1
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                1
              </div>
              <div className="text-right">
                <span className="text-xs font-bold block text-slate-900">
                  الحساب والبيانات
                </span>
                <span className="text-[10px] text-slate-400">
                  {accountType === "freelance_teacher"
                    ? "إكمال التسجيل"
                    : "الخطوة الأولى"}
                </span>
              </div>
            </div>

            <div className="w-12 h-0.5 bg-slate-100 rounded-full" />

            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-sm transition-all ${
                  currentStep === 2
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                2
              </div>
              <div className="text-right">
                <span className="text-xs font-bold block text-slate-900">
                  بيانات المؤسسة
                </span>
                <span className="text-[10px] text-slate-400">
                  {accountType === "freelance_teacher" ? "غير مطلوب" : "الخطوة الأخيرة"}
                </span>
              </div>
            </div>
          </div>

          {/* رسائل الخطأ والتنبيهات */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4 shrink-0 fill-current"
                viewBox="0 0 20 20"
              >
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* الخطوة 1 */}
          {currentStep === 1 && (
            <form onSubmit={handleFirstStepSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  حدد طبيعة الانضمام لـ Talora:
                </label>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAccountType("academy")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      accountType === "academy"
                        ? "border-blue-600 bg-blue-50/50 text-blue-700 ring-2 ring-blue-600/20 font-bold"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="text-xl">🏫</span>
                    <span className="text-xs font-bold">أكاديمية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType("kindergarten")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      accountType === "kindergarten"
                        ? "border-blue-600 bg-blue-50/50 text-blue-700 ring-2 ring-blue-600/20 font-bold"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="text-xl">🧸</span>
                    <span className="text-xs font-bold">روضة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType("freelance_teacher")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      accountType === "freelance_teacher"
                        ? "border-blue-600 bg-blue-50/50 text-blue-700 ring-2 ring-blue-600/20 font-bold"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="text-xl">👨‍🏫</span>
                    <span className="text-xs font-bold">أستاذ حر</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    الاسم الأول
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: محمد"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    اللقب
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: العربي"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm dir-ltr text-right"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="tel"
                  placeholder="06XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm text-right"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white h-13 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 mt-2 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري المعالجة...
                  </span>
                ) : accountType === "freelance_teacher" ? (
                  "إنشاء حساب أستاذ حر "
                ) : (
                  "التالي (بيانات المؤسسة) ──►"
                )}
              </button>
            </form>
          )}

          {/* الخطوة 2 */}
          {currentStep === 2 && accountType !== "freelance_teacher" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  تفاصيل {accountType === "academy" ? "الأكاديمية" : "الروضة"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  المعلومات الأساسية لمقرك لتسهيل تنظيم وإدارة الطلاب
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    اسم {accountType === "academy" ? "الأكاديمية" : "الروضة"} الرسمي
                  </label>
                  <input
                    type="text"
                    placeholder={
                      accountType === "academy"
                        ? "أكاديمية تالورا للتعليم"
                        : "روضة الأجيال السعيدة"
                    }
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    الولاية / المدينة
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: سطيف"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    العنوان التفصيلي
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: شارع القدس، مقابل البريد المركزي"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all font-medium text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  onClick={handleRegisterSchoolOwner}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white h-12 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      جاري الاعتماد...
                    </span>
                  ) : (
                    "تأكيد وانشاء الحساب 🔐"
                  )}
                </button>
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setErrorMessage("");
                  }}
                  disabled={loading}
                  className="px-5 h-12 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-sm"
                >
                  السابق
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}