"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface JoinPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function JoinSchoolRequestPage({ params }: JoinPageProps) {
  const router = useRouter();
  const { slug } = use(params);

  // التبويبات: parent = ولي أمر، teacher = أستاذ معتمد
  const [activeTab, setActiveTab] = useState<"parent" | "teacher">("parent");

  // الحالات الأساسية
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // 1. استمارة ولي الأمر
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentPassword, setParentPassword] = useState("");

  // 2. استمارة الأستاذ
  const [teacherFirstName, setTeacherFirstName] = useState("");
  const [teacherLastName, setTeacherLastName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  useEffect(() => {
    async function fetchSchoolData() {
      try {
        setLoading(true);
        const { data: schoolData, error: schoolErr } = await supabase
          .from("schools")
          .select("id, name, city")
          .or(`slug.eq.${slug},qr_code.eq.${slug}`)
          .maybeSingle();

        if (schoolErr || !schoolData) {
          setSchool(null);
          return;
        }
        setSchool(schoolData);
      } catch (err) {
        console.error("خطأ أثناء جلب بيانات المؤسسة:", err);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchSchoolData();
  }, [slug]);

  // دالة تسجيل الطلب بجدول profiles ونظام Auth
  const handleAuthRegister = async (
    e: React.FormEvent,
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    password: string,
    targetRole: "parent" | "teacher"
  ) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !password) {
      setMessage({ text: "يرجى ملء جميع الحقول المطلوبة.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error("فشل إنشاء الحساب.");

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: authData.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: targetRole,
        status: "pending", // يبقى معلق لحين قبول إدارة المدرسة
        school_id: school.id,
        school_name: school.name,
      });

      if (profileErr) throw profileErr;

      const successRoleText = targetRole === "parent" ? "ولي أمر" : "أستاذ معتمد";
      setMessage({
        text: `🎉 تم تقديم طلب تسجيلك كـ (${successRoleText}) في "${school.name}" بنجاح! طلبك قيد المراجعة والاعتماد من قبل إدارة المؤسسة.`,
        type: "success",
      });

      if (targetRole === "parent") {
        setParentFirstName("");
        setParentLastName("");
        setParentEmail("");
        setParentPhone("");
        setParentPassword("");
      } else {
        setTeacherFirstName("");
        setTeacherLastName("");
        setTeacherEmail("");
        setTeacherPhone("");
        setTeacherPassword("");
      }
    } catch (err: any) {
      console.error("خطأ التسجيل:", err);
      setMessage({
        text: `فشل إرسال طلب التسجيل: ${err.message || "حدث خطأ غير متوقع"}`,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-white text-slate-800"
        dir="rtl"
      >
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium text-sm">
            جاري تهيئة بيانات الانضمام لمؤسسة Talora...
          </p>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-white p-6 text-center"
        dir="rtl"
      >
        <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md border border-slate-100 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto font-bold">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            المؤسسة غير مسجلة أو الرابط غير صحيح
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            عذراً، الرابط المستعمل لا يحتوي على المعرف الفريد الخاص بالمؤسسة التعليمية. يرجى إعادة مسح الـ QR Code الخاص بها.
          </p>
          <Link
            href="/login"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            العودة لصفحة تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden"
      dir="rtl"
    >
      {/* خلفية تالورا السينمائية */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-50/80 via-blue-50/20 to-transparent pointer-events-none -z-10 blur-3xl rounded-full" />

      <div className="w-full max-w-md my-auto">
        {/* الشعار واسم المؤسسة */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-2xl shadow-xl shadow-blue-500/20 mb-2 ring-4 ring-blue-100">
            T
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            TALORA
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            الانضمام لمؤسسة: <span className="text-blue-600 font-bold">{school?.name}</span>
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-blue-900/5 p-6 sm:p-8">
          {/* تبويبات الاختيار */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/80 rounded-2xl mb-6 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab("parent");
                setMessage({ text: "", type: "" });
              }}
              className={`py-3 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "parent"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              👨‍👩‍👦 حساب ولي أمر
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("teacher");
                setMessage({ text: "", type: "" });
              }}
              className={`py-3 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "teacher"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              👨‍🏫 حساب أستاذ
            </button>
          </div>

          {/* التنبيهات والرسائل */}
          {message.text && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold mb-6 text-center ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-red-50 text-red-600 border border-red-100"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* 1. استمارة ولي الأمر */}
          {activeTab === "parent" && (
            <form
              onSubmit={(e) =>
                handleAuthRegister(
                  e,
                  parentFirstName,
                  parentLastName,
                  parentEmail,
                  parentPhone,
                  parentPassword,
                  "parent"
                )
              }
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    الاسم الأول *
                  </label>
                  <input
                    type="text"
                    value={parentFirstName}
                    onChange={(e) => setParentFirstName(e.target.value)}
                    placeholder="مثال: أحمد"
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    اللقب *
                  </label>
                  <input
                    type="text"
                    value={parentLastName}
                    onChange={(e) => setParentLastName(e.target.value)}
                    placeholder="مثال: محمود"
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  البريد الإلكتروني *
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-right dir-ltr text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="06XXXXXXXX"
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-right dir-ltr text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  كلمة المرور *
                </label>
                <input
                  type="password"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold h-12 rounded-2xl shadow-lg shadow-blue-600/20 transition-all text-sm disabled:opacity-50 mt-2 cursor-pointer"
              >
                {submitting ? "جاري إرسال الطلب..." : "إرسال طلب انضمام كـ ولي أمر"}
              </button>
            </form>
          )}

          {/* 2. استمارة الأستاذ */}
          {activeTab === "teacher" && (
            <form
              onSubmit={(e) =>
                handleAuthRegister(
                  e,
                  teacherFirstName,
                  teacherLastName,
                  teacherEmail,
                  teacherPhone,
                  teacherPassword,
                  "teacher"
                )
              }
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    الاسم الأول *
                  </label>
                  <input
                    type="text"
                    value={teacherFirstName}
                    onChange={(e) => setTeacherFirstName(e.target.value)}
                    placeholder="مثال: يونس"
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    اللقب *
                  </label>
                  <input
                    type="text"
                    value={teacherLastName}
                    onChange={(e) => setTeacherLastName(e.target.value)}
                    placeholder="مثال: القاسمي"
                    className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  البريد الإلكتروني المهني *
                </label>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-right dir-ltr text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  value={teacherPhone}
                  onChange={(e) => setTeacherPhone(e.target.value)}
                  placeholder="06XXXXXXXX"
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-right dir-ltr text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  كلمة المرور *
                </label>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-2xl px-4 h-12 bg-slate-50/30 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold h-12 rounded-2xl shadow-lg shadow-blue-600/20 transition-all text-sm disabled:opacity-50 mt-2 cursor-pointer"
              >
                {submitting ? "جاري إرسال الطلب..." : "إرسال طلب انضمام كـ أستاذ"}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 font-medium">
              أملك حساباً بالفعل؟{" "}
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-700 font-bold underline transition-all"
              >
                تسجيل الدخول
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}