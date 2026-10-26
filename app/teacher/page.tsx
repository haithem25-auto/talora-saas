"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Group {
  id: string;
  name: string;
  teacher_id: string;
  school_id: string;
  level: string | null;
  schedule: string | null;
  subject: string | null;
  student_capacity: number | null;
}

interface Student {
  id: string;
  full_name: string;
  level: string | null;
  teacher_id: string | null;
  status: string | null;
  group_id: string | null;
}

interface AttendanceRecord {
  status: string;
  group_id: string;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, excused: 0 });
  const [loadingData, setLoadingData] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!roleLoading && role !== "teacher") {
      router.push("/");
    }
  }, [role, roleLoading, router]);

  useEffect(() => {
    if (roleLoading || role !== "teacher") return;

    async function loadDashboardData() {
      setLoadingData(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. جلب الأفواج الخاصة بالمعلم من جدول groups
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("*")
          .eq("teacher_id", user.id);

        if (groupsError) throw groupsError;
        const currentGroups = groupsData || [];
        setGroups(currentGroups);

        const groupIds = currentGroups.map((g) => g.id);

        // 2. جلب قائمة الطلاب التابعين للمعلم
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id, first_name, last_name, level, teacher_id, status, group_id")
          .eq("teacher_id", user.id);

        if (studentsError) throw studentsError;

        const formattedStudents = (studentsData || []).map((s) => ({
          id: s.id,
          full_name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "بدون اسم",
          level: s.level,
          teacher_id: s.teacher_id,
          status: s.status,
          group_id: s.group_id,
        }));

        setStudents(formattedStudents);

        // 3. جلب سجلات الحضور الشاملة المربوطة بالمعلم مباشرة أو بأفواجه
        let attendanceData: AttendanceRecord[] = [];
        
        if (groupIds.length > 0) {
          const { data, error } = await supabase
            .from("attendance")
            .select("status, group_id")
            .or(`teacher_id.eq.${user.id},group_id.in.(${groupIds.join(",")})`);

          if (!error && data) attendanceData = data;
        } else {
          const { data, error } = await supabase
            .from("attendance")
            .select("status, group_id")
            .eq("teacher_id", user.id);

          if (!error && data) attendanceData = data;
        }

        setAttendanceRecords(attendanceData);

        let present = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;

        attendanceData.forEach((record) => {
          if (record.status === "present") present++;
          if (record.status === "absent") absent++;
          if (record.status === "late") late++;
          if (record.status === "excused") excused++;
        });

        setAttendanceStats({ present, absent, late, excused });

      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("خطأ أثناء جلب بيانات لوحة التحكم:", error.message);
        }
      } finally {
        setLoadingData(false);
      }
    }

    loadDashboardData();
  }, [role, roleLoading]);

  // حساب نسب الحضور والغياب الإجمالية من البيانات الفعلية
  const totalAttendanceCount =
    attendanceStats.present +
    attendanceStats.absent +
    attendanceStats.late +
    attendanceStats.excused;

  const presencePercentage = totalAttendanceCount > 0
    ? Math.round(((attendanceStats.present + attendanceStats.late) / totalAttendanceCount) * 100)
    : 0;

  const absencePercentage = totalAttendanceCount > 0
    ? Math.round(((attendanceStats.absent + attendanceStats.excused) / totalAttendanceCount) * 100)
    : 0;

  // حساب نسبة الالتزام الفعلية لكل فوج للرسم البياني بناءً على سجلات attendance
  const chartData = useMemo(() => {
    return groups.map((group) => {
      const groupLogs = attendanceRecords.filter((a) => a.group_id === group.id);
      const groupTotal = groupLogs.length;
      const groupPresent = groupLogs.filter((a) => a.status === "present" || a.status === "late").length;

      const commitmentRate = groupTotal > 0
        ? Math.round((groupPresent / groupTotal) * 100)
        : 0;

      return {
        name: group.name,
        "نسبة الالتزام %": commitmentRate,
      };
    });
  }, [groups, attendanceRecords]);

  if (!mounted || roleLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-700 font-medium font-sans px-4">
            جاري تحضير بيانات منصة TALORA...
          </p>
        </div>
      </div>
    );
  }

  const SidebarComponent = Sidebar as any;

  return (
    <div className="min-h-screen bg-slate-50 flex" dir="rtl">
      {/* الشريط الجانبي */}
      <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 min-h-screen text-right font-sans antialiased relative overflow-hidden selection:bg-emerald-600 selection:text-white">
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 relative z-10 space-y-8">
          
          {/* شريط الجوال */}
          <div className="lg:hidden flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
            <button
              onClick={() => setSidebarOpen(true)}
              className="bg-emerald-600 text-white p-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-transform active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              <span>القائمة</span>
            </button>
            <span className="font-bold text-slate-800 text-sm">لوحة المعلم | TALORA</span>
          </div>

          {/* رأس الصفحة */}
          <header className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-2xl md:text-3xl text-white shadow-md shadow-emerald-600/20 shrink-0">
                👨‍🏫
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  بوابة الأستاذ الإحصائية
                </h1>
                <p className="text-slate-500 mt-1 text-xs md:text-sm font-medium">
                  متابعة حالة الأفواج، الطلاب، ونسب الحضور والغياب المعتمدة بـ TALORA
                </p>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 self-start sm:self-auto">
              نظام متابعة حية
            </div>
          </header>

          {/* البطاقات الإحصائية */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              {
                title: "إجمالي الطلاب",
                value: `${students.length} طالب`,
                color: "text-slate-800",
                bgColor: "border-t-emerald-600",
                icon: "👥",
                desc: "المسجلين تحت إشرافك",
              },
              {
                title: "الأفواج النشطة",
                value: `${groups.length} أفواج`,
                color: "text-emerald-700",
                bgColor: "border-t-indigo-600",
                icon: "📚",
                desc: "الأفواج المسندة إليك",
              },
              {
                title: "نسبة الحضور والتأخير",
                value: `%${presencePercentage}`,
                color: "text-emerald-600",
                bgColor: "border-t-emerald-500",
                icon: "🟢",
                desc: totalAttendanceCount > 0 ? `محسوبة من ${totalAttendanceCount} تسجيل` : "لا توجد سجلات حضور بعد",
              },
              {
                title: "نسبة الغياب العامة",
                value: `%${absencePercentage}`,
                color: "text-rose-600",
                bgColor: "border-t-rose-500",
                icon: "🔴",
                desc: totalAttendanceCount > 0 ? `تتضمن الغياب والغياب المبرر` : "لا توجد سجلات غياب بعد",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-white rounded-2xl p-5 md:p-6 border-t-4 ${item.bgColor} border border-slate-200/80 shadow-sm relative overflow-hidden transition-all hover:shadow-md`}
              >
                <div className="absolute left-4 top-4 text-xl md:text-2xl opacity-30">
                  {item.icon}
                </div>
                <p className="text-slate-500 font-semibold text-xs mb-1">
                  {item.title}
                </p>
                <h3 className={`text-2xl md:text-3xl font-bold ${item.color} my-1.5`}>
                  {item.value}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </section>

          {/* الرسم البياني */}
          <section className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200/80 shadow-sm">
            <div className="border-r-4 border-emerald-600 pr-3 mb-6">
              <h2 className="text-lg md:text-xl font-bold text-slate-800">
                معدل انضباط واستجابة الطلاب حسب الأفواج
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                معدل الالتزام الحقيقي بناءً على تسجيلات الحضور لكل فوج
              </p>
            </div>

            <div className="w-full h-[280px] md:h-[320px] pt-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        textAlign: "right",
                        borderRadius: "12px",
                        borderColor: "#e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="نسبة الالتزام %"
                      stroke="#059669"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                      dot={{
                        stroke: "#10b981",
                        strokeWidth: 2,
                        r: 4,
                        fill: "#fff",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs md:text-sm">
                  لا توجد بيانات كافية لعرض المنحنى البياني حالياً.
                </div>
              )}
            </div>
          </section>

          {/* جدول الأفواج */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 gap-4">
              <div className="border-r-4 border-emerald-600 pr-3">
                <h2 className="text-lg md:text-xl font-bold text-slate-800">
                  قائمة الأفواج والجدول الزمني
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  تفاصيل المواعيد والمستويات للأفواج المسندة للأستاذ
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full shrink-0">
                جدول نشط
              </span>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-right border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-xs md:text-sm border-b border-slate-200/60 whitespace-nowrap">
                    <th className="p-4 pr-6">اسم الفوج</th>
                    <th className="p-4">المادة / التخصص</th>
                    <th className="p-4">المستوى الدراسي</th>
                    <th className="p-4">الجدول الزمني والتوقيت</th>
                    <th className="p-4 pl-6 text-center">الطاقة الاستيعابية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs md:text-sm font-medium text-slate-700 whitespace-nowrap">
                  {groups.map((group) => (
                    <tr
                      key={group.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="p-4 pr-6 font-bold text-emerald-700">
                        {group.name}
                      </td>
                      <td className="p-4 text-slate-600">
                        {group.subject || "غير محدد"}
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {group.level || "جميع المستويات"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 font-mono">
                        {group.schedule || "لم يحدد التوقيت"}
                      </td>
                      <td className="p-4 pl-6 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full font-bold">
                          {group.student_capacity ? `${group.student_capacity} طالب` : "غير محدد"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {groups.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-400 font-medium whitespace-normal"
                      >
                        لا توجد أفواج مسجلة بجدول الأستاذ الحالي.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}