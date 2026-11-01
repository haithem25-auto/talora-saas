"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface Group {
  id: string;
  name: string;
  monthly_price: number | null;
  monthly_sessions_count: number | null;
  level: string | null;
  count_absent_as_session?: boolean;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  level: string | null;
  group_id: string | null;
  group_name?: string;
}

interface SubscriptionRecord {
  id?: string;
  student_id: string;
  billing_month?: string;
  amount_due: number;
  amount_paid: number;
  status: "paid" | "partial" | "unpaid";
}

export default function SubscriptionsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // معطيات المدرسة
  const [schoolId, setSchoolId] = useState<string>("");

  // القوائم المجلوبة من قاعدة البيانات
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subscriptionsMap, setSubscriptionsMap] = useState<Record<string, SubscriptionRecord>>({});
  const [attendanceCountMap, setAttendanceCountMap] = useState<Record<string, number>>({});

  // التلميذ المحدد حالياً
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  // قيم نموذج الدفع والتجديد
  const [amountRequired, setAmountRequired] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);

  // التاريخ المالي الحالي (شهر وسنة)
  const now = new Date();
  const currentMonthYear = now.toLocaleString("ar-DZ", { month: "long", year: "numeric" });
  const yearStr = now.getFullYear().toString();
  const monthStr = String(now.getMonth() + 1).padStart(2, "0");
  const currentYYYYMM = `${yearStr}-${monthStr}`;
  const currentBillingDate = `${currentYYYYMM}-01`; // بداية الشهر المالي

  useEffect(() => {
    loadSubscriptionsData();
  }, []);

  // جلب البيانات مع تطبيق أمان وعزل المدرسة والتاريخ الآمن
  async function loadSubscriptionsData() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. تحديد معرّف المدرسة بأسلوب صارم
      let currentSchoolId = "";
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.school_id) {
        currentSchoolId = profile.school_id;
      } else {
        const { data: ownedSchool } = await supabase
          .from("schools")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (ownedSchool?.id) {
          currentSchoolId = ownedSchool.id;
        }
      }

      setSchoolId(currentSchoolId);

      if (!currentSchoolId) {
        setStudents([]);
        setGroups([]);
        setLoading(false);
        return;
      }

      // 2. جلب أفواج المدرسة الحالية مع السعر والحصص
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, monthly_price, monthly_sessions_count, level, count_absent_as_session")
        .eq("school_id", currentSchoolId);

      const loadedGroups: Group[] = groupsData || [];
      setGroups(loadedGroups);

      // 3. جلب طلاب المدرسة الحالية فقط
      const { data: studentsData } = await supabase
        .from("students")
        .select("id, first_name, last_name, level, group_id")
        .eq("school_id", currentSchoolId);

      const loadedStudents: Student[] = (studentsData || []).map((s) => {
        const matchedGroup = loadedGroups.find((g) => g.id === s.group_id);
        return {
          ...s,
          group_name: matchedGroup ? matchedGroup.name : "غير مسجل في فوج",
        };
      });

      setStudents(loadedStudents);

      if (loadedStudents.length > 0 && !selectedStudentId) {
        setSelectedStudentId(loadedStudents[0].id);
      }

      const studentIds = loadedStudents.map((s) => s.id);

      if (studentIds.length > 0) {
        // 4. جلب الاشتراكات الشهرية المسجلة للتلاميذ للشهر الحالي بنطاق تاريخ آمن (gte و lt)
        const startOfMonth = `${currentYYYYMM}-01`;
        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextYearStr = nextMonthDate.getFullYear();
        const nextMonthStr = String(nextMonthDate.getMonth() + 1).padStart(2, "0");
        const startOfNextMonth = `${nextYearStr}-${nextMonthStr}-01`;

        const { data: subsData } = await supabase
          .from("student_subscriptions")
          .select("id, student_id, billing_month, amount_due, amount_paid, status")
          .in("student_id", studentIds)
          .gte("billing_month", startOfMonth)
          .lt("billing_month", startOfNextMonth);

        const subMap: Record<string, SubscriptionRecord> = {};
        (subsData || []).forEach((sub: any) => {
          subMap[sub.student_id] = {
            id: sub.id,
            student_id: sub.student_id,
            billing_month: sub.billing_month,
            amount_due: Number(sub.amount_due) || 0,
            amount_paid: Number(sub.amount_paid) || 0,
            status: sub.status,
          };
        });
        setSubscriptionsMap(subMap);

        // 5. جلب عدد الحصص الحاضرة للشهر الحالي بنطاق تاريخ آمن
        const { data: attData } = await supabase
          .from("attendance")
          .select("student_id, status, attendance_date")
          .in("student_id", studentIds)
          .eq("school_id", currentSchoolId)
          .gte("attendance_date", startOfMonth)
          .lt("attendance_date", startOfNextMonth);

        const attMap: Record<string, number> = {};
        (attData || []).forEach((r) => {
          if (r.status === "present" || r.status === "late") {
            attMap[r.student_id] = (attMap[r.student_id] || 0) + 1;
          }
        });
        setAttendanceCountMap(attMap);
      }
    } catch (err) {
      console.error("خطأ أثناء تحميل بيانات الاشتراكات:", err);
    } finally {
      setLoading(false);
    }
  }

  // التلميذ والفوج المحددان
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedGroup = groups.find((g) => g.id === selectedStudent?.group_id);
  const existingSub = selectedStudentId ? subscriptionsMap[selectedStudentId] : null;

  // تحديث القيم المطلوب دفعها جلب السعر الشهري من الفوج (monthly_price)
  useEffect(() => {
    if (selectedStudent && selectedGroup) {
      // استخراج السعر الشهري المباشر من الفوج
      const groupMonthlyPrice = Number(selectedGroup.monthly_price) || 0;

      // تحديد المبلغ المطلوب بناءً على سعر الفوج أو الاشتراك السابِق
      const required = existingSub ? existingSub.amount_due : groupMonthlyPrice;
      const paid = existingSub ? existingSub.amount_paid : groupMonthlyPrice;

      setAmountRequired(required);
      setAmountPaid(paid);
    } else {
      setAmountRequired(0);
      setAmountPaid(0);
    }
  }, [selectedStudentId, selectedGroup, existingSub]);

  // حساب حالة الاشتراك تلقائياً
  const calculatedStatus =
    amountPaid >= amountRequired && amountRequired > 0
      ? "paid"
      : amountPaid > 0
      ? "partial"
      : "unpaid";

  // معالجة حفظ واستلام الاشتراك في Supabase
  const handleSavePayment = async () => {
    if (!selectedStudentId) {
      alert("يرجى اختيار تلميذ أولاً.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        student_id: selectedStudentId,
        school_id: schoolId || null,
        group_id: selectedGroup?.id || null,
        billing_month: currentBillingDate,
        amount_due: amountRequired,
        amount_paid: amountPaid,
        status: calculatedStatus,
      };

      const { error } = await supabase
        .from("student_subscriptions")
        .upsert([payload], { onConflict: "student_id,billing_month" });

      if (error) throw error;

      alert("تم تسجيل واستلام المبلغ وتجديد الاشتراك بنجاح!");
      await loadSubscriptionsData();
    } catch (err: any) {
      console.error("خطأ أثناء حفظ الاشتراك:", err);
      alert("حدث خطأ أثناء حفظ الاشتراك: " + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const SidebarComponent = Sidebar as any;

  return (
    <div className="flex min-h-screen bg-slate-50 text-right" dir="rtl">
      <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col p-4 md:p-8 space-y-6 overflow-x-hidden min-w-0">
        {/* شريط الأجهزة المحمولة */}
        <div className="flex items-center justify-between md:hidden pb-3 border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            ☰
          </button>
          <span className="font-bold text-slate-800 text-sm">اشتراكات التلاميذ</span>
        </div>

        {/* قائمة اختيار التلميذ */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
          <label className="block text-xs font-bold text-slate-500">اختر التلميذ من القائمة:</label>
          <div className="flex flex-wrap gap-2">
            {students.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStudentId(st.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedStudentId === st.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                🎓 {st.first_name} {st.last_name} ({st.level || "عام"})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-medium text-xs">
            جاري تحميل الاشتراكات وقوائم التلاميذ...
          </div>
        ) : !selectedStudent ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs">
            لا يوجد تلاميذ مسجلون بالمدرسة حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* كارت تأكيد الدفع والتجديد */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-6">
              <h2 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
                تأكيد الدفع والتجديد
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المبلغ المطلوب (د.ج)
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={amountRequired}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المبلغ المدفوع فعلياً (د.ج) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl p-3 text-sm font-bold text-slate-900 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  حالة الاشتراك لهذا الشهر:
                </label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  {calculatedStatus === "paid" && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                      ✓ مدفوع بالكامل
                    </span>
                  )}
                  {calculatedStatus === "partial" && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">
                      ⏳ غير مدفوع / مدفوع جزئياً
                    </span>
                  )}
                  {calculatedStatus === "unpaid" && (
                    <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold">
                      ✕ غير مدفوع
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-slate-500">
                    {amountPaid} / {amountRequired} د.ج
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSavePayment}
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "جاري الاعتماد والحفظ..." : "تأكيد واستلام المبلغ 💾"}
              </button>
            </div>

            {/* بطاقة التلميذ ومعلومات الفوج */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-6">
              <h2 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
                بطاقة التلميذ
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">اسم التلميذ الكامل:</span>
                  <span className="font-black text-slate-900 text-sm">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">المستوى الدراسي:</span>
                  <span className="font-bold text-slate-800">
                    {selectedStudent.level || "عام"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">الفوج المسجل فيه:</span>
                  <span className="font-bold text-emerald-700">
                    {selectedStudent.group_name}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">الشهر المالي الحالي:</span>
                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                    📅 {currentMonthYear}
                  </span>
                </div>
              </div>

              {/* بطاقة إحصاء الحصص المباشرة من الفوج */}
              <div className="bg-emerald-50/70 border border-emerald-100 p-5 rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-emerald-800">عدد الحصص الحاضرة هذا الشهر</p>
                <div className="text-3xl font-black text-emerald-700">
                  {attendanceCountMap[selectedStudent.id] || 0}
                </div>
                <p className="text-[11px] text-emerald-600 font-medium">
                  من أصل {selectedGroup?.monthly_sessions_count || 4} حصص مقترحة
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}