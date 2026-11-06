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
  status: "paid" | "partially_paid" | "unpaid";
}

interface StudentStatSummary {
  student: Student;
  group?: Group;
  subscription?: SubscriptionRecord;
  presentCount: number;
  absentCount: number;
  consumedSessions: number;
  targetSessions: number;
  isLateOnPayment: boolean;
  unpaidAmount: number;
}

export default function StudentStatsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // تحديد الشهر المالي الحالي بتنسيق YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  });

  const [statsSummary, setStatsSummary] = useState<StudentStatSummary[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "unpaid" | "high_absent">("all");

  useEffect(() => {
    loadDashboardStats(selectedMonth);
  }, [selectedMonth]);

  async function loadDashboardStats(monthYYYYMM?: string) {
    try {
      setLoading(true);

      const targetMonth =
        monthYYYYMM ||
        selectedMonth ||
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. تحديد معرّف المدرسة
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

        if (ownedSchool?.id) currentSchoolId = ownedSchool.id;
      }

      if (!currentSchoolId) {
        setLoading(false);
        return;
      }

      const startOfMonth = `${targetMonth}-01`;

      // 2. جلب الأفواج
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, monthly_price, monthly_sessions_count, level, count_absent_as_session")
        .eq("school_id", currentSchoolId);

      const groupsList: Group[] = groupsData || [];
      const groupsMap = new Map<string, Group>(groupsList.map((g) => [g.id, g]));

      // 3. جلب الطلاب
      const { data: studentsData } = await supabase
        .from("students")
        .select("id, first_name, last_name, level, group_id")
        .eq("school_id", currentSchoolId);

      const studentsList: Student[] = (studentsData || []).map((s) => ({
        ...s,
        group_name: s.group_id ? groupsMap.get(s.group_id)?.name || "غير مسجل" : "غير مسجل",
      }));

      const studentIds = studentsList.map((s) => s.id);
      if (studentIds.length === 0) {
        setStatsSummary([]);
        setLoading(false);
        return;
      }

      // 4. جلب الاشتراكات بمطابقة بداية الشهر القياسية (YYYY-MM-01)
      const { data: subsData } = await supabase
        .from("student_subscriptions")
        .select("id, student_id, billing_month, amount_due, amount_paid, status")
        .in("student_id", studentIds)
        .eq("billing_month", startOfMonth);

      const subMap = new Map<string, SubscriptionRecord>();
      (subsData || []).forEach((sub: any) => {
        subMap.set(sub.student_id, {
          id: sub.id,
          student_id: sub.student_id,
          billing_month: sub.billing_month,
          amount_due: Number(sub.amount_due) || 0,
          amount_paid: Number(sub.amount_paid) || 0,
          status: sub.status as "paid" | "partially_paid" | "unpaid",
        });
      });

      // 5. جلب إحصائيات الحضور الموحدة المباشرة من الـ View
      const { data: summaryViewData } = await supabase
        .from("student_attendance_summary")
        .select("student_id, total_consumed_sessions, target_monthly_sessions, absent_count, month_period")
        .eq("school_id", currentSchoolId);

      const attMap = new Map<string, { consumed: number; target: number; absent: number }>();
      (summaryViewData || []).forEach((row: any) => {
        if (row.month_period?.startsWith(targetMonth)) {
          attMap.set(row.student_id, {
            consumed: Number(row.total_consumed_sessions) || 0,
            target: Number(row.target_monthly_sessions) || 4,
            absent: Number(row.absent_count) || 0,
          });
        }
      });

      // 6. تجميع البيانات وتأكيد حالة التسديد
      const summary: StudentStatSummary[] = studentsList.map((st) => {
        const group = st.group_id ? groupsMap.get(st.group_id) : undefined;
        const sub = subMap.get(st.id);
        const att = attMap.get(st.id) || {
          consumed: 0,
          target: group?.monthly_sessions_count || 4,
          absent: 0,
        };

        const reqPrice = sub ? sub.amount_due : (group?.monthly_price || 0);
        const paidPrice = sub ? sub.amount_paid : 0;
        const unpaidAmount = Math.max(0, reqPrice - paidPrice);

        const isPaid = Boolean(sub?.status === "paid" || (sub && sub.amount_paid >= sub.amount_due && sub.amount_due > 0));

        // تحويل النتيجة بشكل صريح إلى boolean لعدم إرجاع undefined
        const isLateOnPayment = Boolean(!isPaid && (att.consumed >= att.target || (sub && sub.status !== "paid")));

        return {
          student: st,
          group,
          subscription: sub,
          presentCount: Math.max(0, att.consumed - (group?.count_absent_as_session ? att.absent : 0)),
          absentCount: att.absent,
          consumedSessions: att.consumed,
          targetSessions: att.target,
          isLateOnPayment,
          unpaidAmount,
        };
      });

      setStatsSummary(summary);
    } catch (err) {
      console.error("خطأ أثناء تحميل إحصائيات الطلاب:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredSummary = statsSummary.filter((item) => {
    if (filterTab === "unpaid") return item.isLateOnPayment;
    if (filterTab === "high_absent") return item.absentCount >= 2;
    return true;
  });

  const totalUnpaidStudents = statsSummary.filter((s) => s.isLateOnPayment).length;
  const totalHighAbsents = statsSummary.filter((s) => s.absentCount >= 2).length;

  const [selectedYearNum, selectedMonthNum] = selectedMonth.split("-").map(Number);
  const formattedMonthLabel = new Date(selectedYearNum, selectedMonthNum - 1, 1).toLocaleString("ar-DZ", {
    month: "long",
    year: "numeric",
  });

  const SidebarComponent = Sidebar as any;

  return (
    <div className="flex min-h-screen bg-slate-50 text-right" dir="rtl">
      <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col p-4 md:p-8 space-y-6 overflow-x-hidden min-w-0">
        {/* الهيدر الرئيسي وفلتر الشهر */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900">متابعة إحصائيات الحضور والاشتراكات</h1>
            <p className="text-xs text-slate-500 mt-1">
              إحصائيات الطلاب وسجلات الاشتراكات لشهر: <span className="font-bold text-emerald-700">{formattedMonthLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
            <label className="text-xs font-bold text-slate-600 px-1">اختر الشهر:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 transition cursor-pointer"
            />
            <button
              onClick={() => loadDashboardStats(selectedMonth)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              🔄
            </button>
          </div>
        </div>

        {/* كروت الأرقام الإحصائية */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xs font-bold text-slate-400">المتأخرون عن التسديد</span>
            <div className="text-3xl font-black text-rose-600 mt-2">{totalUnpaidStudents}</div>
            <span className="text-[11px] text-rose-500 font-medium">طلاب استوفوا الحصص ولم يسددوا</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xs font-bold text-slate-400">كثرة الغياب (حصتين فأكثر)</span>
            <div className="text-3xl font-black text-amber-600 mt-2">{totalHighAbsents}</div>
            <span className="text-[11px] text-amber-500 font-medium">طلاب غابوا حصتين فأكثر</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xs font-bold text-slate-400">إجمالي المسجلين</span>
            <div className="text-3xl font-black text-emerald-600 mt-2">{statsSummary.length}</div>
            <span className="text-[11px] text-slate-400 font-medium">في جميع أفواج المدرسة</span>
          </div>
        </div>

        {/* أزرار الفلترة السريعة */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterTab === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            جميع الطلاب ({statsSummary.length})
          </button>
          <button
            onClick={() => setFilterTab("unpaid")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterTab === "unpaid" ? "bg-rose-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            المتأخرون في التسديد ({totalUnpaidStudents})
          </button>
          <button
            onClick={() => setFilterTab("high_absent")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterTab === "high_absent" ? "bg-amber-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            الأكثر غياباً ({totalHighAbsents})
          </button>
        </div>

        {/* الجدول الشامل */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">جاري تحميل البيانات...</div>
        ) : filteredSummary.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-xs">لا توجد سجلات مطابقة للفلتر المحدد.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-4">الطالب</th>
                    <th className="p-4">الفوج</th>
                    <th className="p-4">سياسة الغياب للفوج</th>
                    <th className="p-4">الحضور / الغياب</th>
                    <th className="p-4">الحصص المستهلكة</th>
                    <th className="p-4">حالة الاشتراك</th>
                    <th className="p-4">المبلغ المدفوع / المطلوب</th>
                    <th className="p-4">المبلغ المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSummary.map(({ student, group, presentCount, absentCount, consumedSessions, targetSessions, isLateOnPayment, unpaidAmount, subscription }) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 font-bold text-slate-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="p-4">{student.group_name}</td>
                      <td className="p-4">
                        {group?.count_absent_as_session ? (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-[11px]">
                            الغياب يُحسب كحصة ⚠️
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[11px]">
                            الغياب لا يُحسب
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-emerald-600 font-bold">{presentCount} حضور</span>
                        {" / "}
                        <span className={absentCount > 0 ? "text-rose-600 font-bold" : "text-slate-400"}>
                          {absentCount} غياب
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold">
                        {consumedSessions} / {targetSessions} حصص
                      </td>
                      <td className="p-4">
                        {subscription ? (
                          subscription.status === "paid" ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                              ✓ مسجل ومسدد
                            </span>
                          ) : subscription.status === "partially_paid" ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold text-[11px]">
                              ⏳ مدفوع جزئياً
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-rose-100 text-rose-800 rounded font-bold text-[11px]">
                              ✕ غير مدفوع
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[11px]">
                            لم يُسجل اشتراك
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700">
                        {subscription ? `${subscription.amount_paid.toLocaleString()} / ${subscription.amount_due.toLocaleString()} د.ج` : `0 / ${(group?.monthly_price || 0).toLocaleString()} د.ج`}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-900">
                        {unpaidAmount > 0 ? (
                          <span className="text-rose-600">{unpaidAmount.toLocaleString()} د.ج</span>
                        ) : (
                          <span className="text-emerald-600">0 د.ج</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}