"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface Group {
  id: string;
  name: string;
  level: string | null;
  schedule: string | null;
  subject: string | null;
  student_capacity: number | null;
  monthly_price: number | null;
  monthly_sessions_count: number | null;
  school_id: string;
  count_absence_as_session: boolean;
}

export default function TeacherGroupsPage() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // المعطيات المستنتجة تلقائياً من جلسة المعلم الحالي
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [assignedSchoolId, setAssignedSchoolId] = useState<string | null>(null);

  // مصفوفة الأفواج المجلوبة ديناميكياً
  const [groups, setGroups] = useState<Group[]>([]);

  // حالة استمارة إنشاء الفوج
  const [formData, setFormData] = useState({
    name: "",
    level: "",
    schedule: "",
    subject: "",
    student_capacity: "",
    monthly_price: "",
    monthly_sessions_count: "",
    count_absence_as_session: false,
  });

  // جلب بيانات المعلم، ومعرف المدرسة الخاصة به، وأفواجه الحالية
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);

        // جلب المعلم الحالي من الجلسة
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) throw new Error("لم يتم العثور على جلسة مستخدم نشطة");
        setTeacherId(user.id);

        // جلب معرف المدرسة (school_id) المرتبط بالمعلم من جدول profiles
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("تنبيه أثناء جلب البروفايل:", profileError.message);
        } else if (profileData?.school_id) {
          setAssignedSchoolId(profileData.school_id);
        }

        // جلب أفواج المعلم الحالي من جدول groups شاملاً السعر وحالة احتساب الغياب
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("id, name, level, schedule, subject, student_capacity, monthly_price, monthly_sessions_count, school_id, count_absence_as_session")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false });

        if (groupsError) throw groupsError;
        setGroups(groupsData || []);
      } catch (error: any) {
        console.error("خطأ أثناء تحميل البيانات الأولى:", error.message || error);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  // معالجة حفظ الفوج ورابطه التلقائي بالمدرسة
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacherId) {
      alert("خطأ: لم يتم التعرف على حساب المعلم الحالي.");
      return;
    }

    if (!assignedSchoolId) {
      alert("خطأ: المعلم غير مربوط بمؤسسة تعليمية/مدرسة في ملف البروفايل.");
      return;
    }

    if (!formData.name.trim() || !formData.level.trim() || !formData.schedule.trim()) {
      alert("الرجاء ملء جميع الحقول الأساسية المطلوبة.");
      return;
    }

    try {
      setSubmitting(true);

      const newRecord = {
        name: formData.name.trim(),
        level: formData.level.trim(),
        schedule: formData.schedule.trim(),
        subject: formData.subject.trim() || null,
        student_capacity: formData.student_capacity ? parseInt(formData.student_capacity, 10) : null,
        monthly_price: formData.monthly_price ? parseFloat(formData.monthly_price) : 0,
        monthly_sessions_count: formData.monthly_sessions_count ? parseInt(formData.monthly_sessions_count, 10) : null,
        count_absence_as_session: formData.count_absence_as_session,
        teacher_id: teacherId,
        school_id: assignedSchoolId,
      };

      const { data, error } = await supabase
        .from("groups")
        .insert([newRecord])
        .select("id, name, level, schedule, subject, student_capacity, monthly_price, monthly_sessions_count, school_id, count_absence_as_session")
        .single();

      if (error) {
        if (error.code === "42501") {
          throw new Error("تمنع سياسة أمان Supabase (RLS) إنشاء الأفواج. يرجى تفعيل سياسة الإدراج (INSERT Policy) على جدول groups.");
        }
        throw error;
      }

      // تحديث الجدول فورياً
      setGroups((prev) => [data, ...prev]);

      // تفريغ الحقول
      setFormData({
        name: "",
        level: "",
        schedule: "",
        subject: "",
        student_capacity: "",
        monthly_price: "",
        monthly_sessions_count: "",
        count_absence_as_session: false,
      });

      alert("تمت إضافة الفوج التعليمي بنجاح وربطه بالمؤسسة المسجلة!");
    } catch (error: any) {
      console.error("خطأ أثناء حفظ الفوج:", error);
      alert(`حدث خطأ أثناء الحفظ: ${error.message || "يرجى مراجعة الـ Console."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const SidebarComponent = Sidebar as any;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex" dir="rtl">
      <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* شريط رأس الصفحة */}
        <header className="bg-white border-b border-slate-200/80 p-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition md:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-xs font-bold text-slate-400">
            TALORA Groups Management
          </div>
        </header>

        <main className="p-4 md:p-8 flex-1 max-w-7xl mx-auto w-full space-y-6">
          {/* بطاقة الترويسة الرئيسية */}
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-900/10 border border-emerald-500/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl border border-white/20">
                📚
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight">إدارة وتأسيس الأفواج التعليمية</h1>
                <p className="text-emerald-100 text-xs md:text-sm mt-0.5 font-medium">
                  أضف أفواج جديدة وحدد شروط احتساب الغياب والدفع وضبط المجموعات التعليمية
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* استمارة إضافة فوج جديد */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 lg:col-span-1">
              <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                  ➕
                </span>
                <span>إضافة فوج جديد</span>
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الفوج الدراسي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فوج المتفوقين"
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">المادة / التخصص</label>
                  <input
                    type="text"
                    placeholder="مثال: الرياضيات، علوم، قرآن"
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">المستوى الدراسي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: السنة الأولى متوسط، مبتدئين"
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">التوقيت والجدول الزمني *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: السبت والإثنين 14:00 - 16:00"
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">السعر الشهري (د.ج)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      placeholder="مثال: 2000"
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                      value={formData.monthly_price}
                      onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">عدد الحصص/شهر</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="مثال: 8"
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                      value={formData.monthly_sessions_count}
                      onChange={(e) => setFormData({ ...formData, monthly_sessions_count: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الطاقة الاستيعابية (عدد الطلاب)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="مثال: 25"
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
                    value={formData.student_capacity}
                    onChange={(e) => setFormData({ ...formData, student_capacity: e.target.value })}
                  />
                </div>

                {/* خيار احتساب الغياب كحصة مستهلكة */}
                <div className="pt-1">
                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={formData.count_absence_as_session}
                      onChange={(e) => setFormData({ ...formData, count_absence_as_session: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer mt-0.5 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-800">
                        احتساب الغياب كحصة مدفوعة
                      </span>
                      <span className="block text-[11px] text-slate-500 font-normal leading-relaxed">
                        عند التفعيل، سيتم خصم الحصة التي يغيبها التلميذ من رصيد حسابه واشتراكه الشهري.
                      </span>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 mt-2"
                >
                  {submitting ? "جاري الحفظ والإنشاء..." : "💾 اعتماد وإنشاء الفوج"}
                </button>
              </form>
            </div>

            {/* عرض الأفواج المجلوبة */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 lg:col-span-2 overflow-hidden">
              <div className="p-5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center text-sm">
                    📋
                  </span>
                  <span>الأفواج المسجلة باسمك ({groups.length})</span>
                </h2>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-500 font-medium">
                  جاري جلب الأفواج من قاعدة البيانات...
                </div>
              ) : groups.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  لا توجد أفواج تعليمية مسجلة باسمك حتى الآن.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200/80">
                        <th className="p-4 pr-6">اسم الفوج</th>
                        <th className="p-4">المادة والمستوى</th>
                        <th className="p-4">الجدول الزمني</th>
                        <th className="p-4 text-center">السعر الشهري</th>
                        <th className="p-4 text-center">الحصص/شهر</th>
                        <th className="p-4 text-center">احتساب الغياب</th>
                        <th className="p-4 pl-6 text-center">السعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-medium">
                      {groups.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-4 pr-6 font-bold text-emerald-700">{g.name}</td>
                          <td className="p-4">
                            <div className="text-slate-800 text-xs font-bold">{g.subject || "عام"}</div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                              {g.level || "عام"}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600 text-xs font-mono">{g.schedule || "غير محدد"}</td>
                          <td className="p-4 text-center">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                              {g.monthly_price !== null && g.monthly_price !== undefined ? `${g.monthly_price} د.ج` : "-"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                              {g.monthly_sessions_count ? `${g.monthly_sessions_count} حصص` : "-"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {g.count_absence_as_session ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full">
                                <span>⚠️</span> يُحسب حصة
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-full">
                                <span>✕</span> لا يُحسب
                              </span>
                            )}
                          </td>
                          <td className="p-4 pl-6 text-center">
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                              {g.student_capacity ? `${g.student_capacity} طالب` : "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}