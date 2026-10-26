"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface Group {
  id: string;
  name: string;
}

interface TeacherAbsence {
  id: string;
  teacher_id: string;
  group_id: string;
  reason: string;
  status: string;
  created_at: string;
  groups?: {
    name: string;
  } | {
    name: string;
  }[] | null;
}

export default function TeacherAbsencePage() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [absences, setAbsences] = useState<TeacherAbsence[]>([]);

  // نموذج الإشعار بالغياب
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);

        // 1. جلب بيانات المعلم الحالي
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("لم يتم العثور على جلسة مستخدم نشطة");
        setTeacherId(user.id);

        // 2. جلب الأفواج الخاصة بالمعلم فقط
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("id, name")
          .eq("teacher_id", user.id);

        if (groupsError) throw groupsError;
        setGroups(groupsData || []);

        // 3. جلب سجل غيابات المعلم
        const { data: absencesData, error: absencesError } = await supabase
          .from("teacher_absences")
          .select(`
            id,
            teacher_id,
            group_id,
            reason,
            status,
            created_at,
            groups:group_id ( name )
          `)
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false });

        if (absencesError) throw absencesError;

        const formattedAbsences = (absencesData || []).map((item: any) => ({
          ...item,
          groups: Array.isArray(item.groups) ? item.groups[0] : item.groups,
        }));

        setAbsences(formattedAbsences);

      } catch (error) {
        console.error("خطأ أثناء جلب البيانات:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  // إرسال الإشعار بالغياب
  const handleSubmitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacherId) {
      alert("خطأ: تعذر التعرف على حساب الأستاذ.");
      return;
    }

    if (!selectedGroupId || !reason.trim()) {
      alert("يرجى اختيار الفوج وتحديد سبب الغياب.");
      return;
    }

    try {
      setSubmitting(true);

      const newAbsence = {
        teacher_id: teacherId,
        group_id: selectedGroupId,
        reason: reason.trim(),
        status: "notified",
      };

      const { data, error } = await supabase
        .from("teacher_absences")
        .insert([newAbsence])
        .select(`
          id,
          teacher_id,
          group_id,
          reason,
          status,
          created_at,
          groups:group_id ( name )
        `)
        .single();

      if (error) throw error;

      const formattedData = {
        ...data,
        groups: Array.isArray(data.groups) ? data.groups[0] : data.groups,
      };

      // تحديث القائمة محلياً
      setAbsences((prev) => [formattedData, ...prev]);

      // إعادة ضبط النموذج وإغلاق النافذة
      setSelectedGroupId("");
      setReason("");
      setIsModalOpen(false);

      alert("تم إرسال وتسجيل إشعار الغياب بنجاح!");
    } catch (error: any) {
      console.error("خطأ أثناء تسجيل الإشعار بالغياب:", error);
      alert(`حدث خطأ أثناء إرسال الإشعار: ${error.message || "يرجى المحاولة لاحقاً"}`);
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
            TALORA Teacher Absences
          </div>
        </header>

        <main className="p-4 md:p-8 flex-1 max-w-6xl mx-auto w-full space-y-6">
          {/* ترويسة الصفحة وزر الإشعار بالغياب */}
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-900/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl border border-white/20">
                📌
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight">إشعارات غياب الأستاذ</h1>
                <p className="text-emerald-100 text-xs md:text-sm mt-0.5 font-medium">
                  تقديم وتبليغ إدارة المدرسة بالغياب عن الحصص المقررة
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white hover:bg-slate-100 text-emerald-800 font-bold px-5 py-3 rounded-2xl text-xs md:text-sm shadow-md transition flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              <span>🔔</span>
              <span>إشعار بغياب</span>
            </button>
          </div>

          {/* جدول عرض الإشعارات السابقة */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-5 bg-slate-50/80 border-b border-slate-200/80">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>📋</span>
                <span>سجل الإشعارات بالغياب المسجلة</span>
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                جاري جلب بيانات الغيابات...
              </div>
            ) : absences.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                لا توجد إشعارات غياب مسجلة حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200/80">
                      <th className="p-4 pr-6">تاريخ الإشعار</th>
                      <th className="p-4">الفوج المعني</th>
                      <th className="p-4">سبب الغياب</th>
                      <th className="p-4 pl-6 text-center">حالة الإشعار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium">
                    {absences.map((item) => {
                      const groupObj = Array.isArray(item.groups) ? item.groups[0] : item.groups;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-4 pr-6 text-xs font-mono text-slate-600">
                            {new Date(item.created_at).toLocaleDateString("ar-EG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-4 font-bold text-emerald-700">
                            {groupObj?.name || "فوج غير محدد"}
                          </td>
                          <td className="p-4 text-slate-700 text-xs leading-relaxed max-w-xs">
                            {item.reason}
                          </td>
                          <td className="p-4 pl-6 text-center">
                            <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                              {item.status === "notified" ? "مُشعر بها" : item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* نافذة إنشاء إشعار غياب (Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 text-right border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>📢</span>
                <span>إشعار بغياب جديد</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAbsence} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر الفوج الدراسي *</label>
                <select
                  required
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium cursor-pointer"
                >
                  <option value="">-- اختر الفوج --</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب الغياب *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="اكتب سبب الغياب باختصار (مثلاً: ظروف صحية طارئة)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {submitting ? "جاري الإرسال..." : "إنشاء إشعار الغياب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}