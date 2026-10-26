"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

export default function ParentDashboard() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();

  // States الأساسية للوحة
  const [children, setChildren] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: string; monthlyAbsences: number }>
  >({});
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("");
  const [schoolName, setSchoolName] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (roleLoading || role !== "parent") return;

    async function loadDashboardData() {
      try {
        setLoading(true);

        // 1️⃣ جلب بيانات المستخدم الحالي من Supabase Auth
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login");
          return;
        }

        const parentId = user.id;

        // 2️⃣ جلب بيانات البروفايل من جدول profiles
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name, school_id, school_name")
          .eq("id", parentId)
          .maybeSingle();

        if (profileError) {
          console.warn("تنبيه عند جلب البروفايل:", profileError.message);
        }

        let detectedSchoolName = "";

        if (profileData) {
          const fullName = `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim();
          setParentName(fullName || user.user_metadata?.full_name || "ولي الأمر");

          if (profileData.school_name && profileData.school_name.trim() !== "") {
            detectedSchoolName = profileData.school_name.trim();
          } else if (profileData.school_id) {
            const { data: schoolData } = await supabase
              .from("schools")
              .select("name")
              .eq("id", profileData.school_id)
              .maybeSingle();

            if (schoolData?.name) {
              detectedSchoolName = schoolData.name;
            }
          }
        } else {
          setParentName(user.user_metadata?.full_name || "ولي الأمر");
        }

        // 3️⃣ جلب الأبناء المربوطين بولي الأمر
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("*")
          .eq("parent_id", parentId);

        if (studentsError) {
          console.error("خطأ أثناء جلب الأبناء:", studentsError.message);
          setLoading(false);
          return;
        }

        if (!studentsData || studentsData.length === 0) {
          setChildren([]);
          setSchoolName(detectedSchoolName || "غير محددة");
          setLoading(false);
          return;
        }

        // تحديد اسم المدرسة من المدارس المربوطة بالطلاب إذا لم تتحدد من البروفايل
        if (!detectedSchoolName) {
          const studentSchoolIds = Array.from(
            new Set(studentsData.map((s) => s.school_id).filter(Boolean))
          );

          if (studentSchoolIds.length > 0) {
            const { data: childSchools } = await supabase
              .from("schools")
              .select("name")
              .in("id", studentSchoolIds);

            if (childSchools && childSchools.length > 0) {
              detectedSchoolName = childSchools.map((s) => s.name).join(" • ");
            }
          }
        }

        setSchoolName(detectedSchoolName || "غير محددة");

        // 4️⃣ جلب الأفواج المربوطة بالأبناء
        const groupIds = Array.from(new Set(studentsData.map((s) => s.group_id).filter(Boolean)));

        let groupsData: any[] = [];
        if (groupIds.length > 0) {
          const { data: fetchedGroups } = await supabase
            .from("groups")
            .select("*")
            .in("id", groupIds);
          groupsData = fetchedGroups || [];
          setGroups(groupsData);
        }

        // دمج بيانات الطلاب مع أسماء أفواجهم
        const enrichedStudents = studentsData.map((student) => {
          const matchedGroup = groupsData.find((g) => g.id === student.group_id);
          return {
            ...student,
            full_name:
              `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
              "ابن مسجل",
            group_name: matchedGroup ? matchedGroup.name : "غير مسجل في فوج",
          };
        });

        setChildren(enrichedStudents);
        const studentIds = enrichedStudents.map((s) => s.id);

        // 5️⃣ جلب سجل الحضور والغياب الخاص بالأبناء
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("student_id, status, attendance_date")
          .in("student_id", studentIds);

        if (attendanceError) {
          console.error("خطأ أثناء جلب سجلات الحضور والغياب:", attendanceError.message);
        }

        const map: Record<string, { status: string; monthlyAbsences: number }> = {};

        // تحضير الصيغ النصية للتاريخ اليوم والشهر بأسلوب موحد (YYYY-MM و YYYY-MM-DD)
        const now = new Date();
        const yearStr = now.getFullYear().toString();
        const monthStr = String(now.getMonth() + 1).padStart(2, "0");
        const dayStr = String(now.getDate()).padStart(2, "0");

        const currentYearMonth = `${yearStr}-${monthStr}`; // مثال: "2026-10"
        const todayDateStr = `${yearStr}-${monthStr}-${dayStr}`; // مثال: "2026-10-24"

        studentIds.forEach((id) => {
          const studentRecords = attendanceData?.filter((r) => r.student_id === id) || [];

          // بحث عن تسجيل اليوم المباشر
          const todayRecord = studentRecords.find((r) => {
            if (!r.attendance_date) return false;
            const dateStr = String(r.attendance_date).substring(0, 10);
            return dateStr === todayDateStr;
          });

          // حساب عدد مرات الغياب في الشهر الحالي بالمطابقة النصية
          const monthlyAbsentCount = studentRecords.filter((r) => {
            if (!r.attendance_date) return false;
            const datePrefix = String(r.attendance_date).substring(0, 7); // يستخرج YYYY-MM
            return datePrefix === currentYearMonth && r.status === "absent";
          }).length;

          map[id] = {
            status: todayRecord?.status || "unregistered",
            monthlyAbsences: monthlyAbsentCount,
          };
        });

        setAttendanceMap(map);
      } catch (err) {
        console.error("خطأ عام في تحميل اللوحة الرئيسة لولي الأمر:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [role, roleLoading, router]);

  // حساب إجمالي غيابات جميع الأبناء للشهر الحالي
  const totalMonthlyAbsences = useMemo(() => {
    return Object.values(attendanceMap).reduce(
      (acc, item) => acc + (item.monthlyAbsences || 0),
      0
    );
  }, [attendanceMap]);

  const SidebarComponent = Sidebar as any;

  if (roleLoading || (role !== "parent" && !roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-sm font-medium">جاري التحقق من حساب ولي الأمر...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex text-slate-800">
      <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 p-4 sticky top-0 z-10 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition md:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-400">TALORA Parent Portal</span>
          </div>
        </header>

        <main className="p-4 md:p-8 flex-1 max-w-7xl mx-auto w-full space-y-8">
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-emerald-900/10 border border-emerald-500/20 relative overflow-hidden">
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl border border-white/20 shadow-inner">
                👋
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  مرحباً بك، {parentName ? `أ. ${parentName}` : "ولي الأمر"}
                </h1>
                <p className="text-emerald-100 text-xs md:text-sm font-medium mt-1">
                  تابع التفاصيل اليومية لأبنائك، المدارس المرتبطة بها والأفواج الدراسية بسهولة
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400">الأبناء المسجلين</p>
                <h3 className="text-2xl font-black text-slate-900">{children.length} أبناء</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold border border-emerald-100">
                👨‍👩‍👧
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="space-y-1 min-w-0 flex-1 pr-2">
                <p className="text-xs font-bold text-slate-400">المؤسسة / المدرسة</p>
                <h3 className="text-sm font-black text-slate-900 truncate">
                  {schoolName}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold border border-teal-100 shrink-0">
                🏫
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400">غيابات الأبناء هذا الشهر</p>
                <h3 className="text-2xl font-black text-rose-600">
                  {totalMonthlyAbsences} {totalMonthlyAbsences === 1 ? "غياب" : "غيابات"}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl font-bold border border-rose-100">
                ⚠️
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-base">
                  👦
                </span>
                <span>بطاقات الأبناء المسجلين ({children.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                جاري جلب قائمة الأبناء...
              </div>
            ) : children.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-center text-slate-400 text-sm">
                لا يوجد أبناء مسجلين بحسابك حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {children.map((child) => {
                  const childAttendance = attendanceMap[child.id];
                  const todayStatus = childAttendance?.status || "unregistered";
                  const monthlyAbsences = childAttendance?.monthlyAbsences || 0;

                  return (
                    <div
                      key={child.id}
                      className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4 relative overflow-hidden"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-3xl shrink-0 border border-slate-200/60 shadow-inner">
                          👦
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 text-base truncate">
                            {child.full_name}
                          </h3>
                          <p className="text-xs font-semibold text-emerald-600 mt-0.5 truncate">
                            {child.group_name}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-3 rounded-2xl text-center text-xs border border-slate-100">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-slate-400">المستوى الدراسي</p>
                          <p className="font-bold text-slate-800 truncate">
                            {child.level || "عام"}
                          </p>
                        </div>
                        <div className="space-y-0.5 border-r border-slate-200/80">
                          <p className="text-[10px] font-bold text-slate-400">غيابات الشهر</p>
                          <p className="font-extrabold text-rose-600">
                            {monthlyAbsences} {monthlyAbsences === 1 ? "غياب" : "مرات"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-xs">
                        <span className="font-bold text-slate-500 text-[11px]">حضور اليوم:</span>
                        {todayStatus === "present" && (
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[11px] flex items-center gap-1">
                            <span>✓</span> حاضر
                          </span>
                        )}
                        {todayStatus === "late" && (
                          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[11px] flex items-center gap-1">
                            <span>⏱</span> متأخر
                          </span>
                        )}
                        {todayStatus === "absent" && (
                          <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[11px] flex items-center gap-1">
                            <span>✕</span> غائب
                          </span>
                        )}
                        {todayStatus === "unregistered" && (
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-semibold text-[11px]">
                            لم يُسجل بعد
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center text-sm">
                📅
              </span>
              <span>جدول الأفواج والمواعيد الدراسية للأبناء</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                    <th className="p-3.5 pr-4">اسم الفوج</th>
                    <th className="p-3.5">المادة / التخصص</th>
                    <th className="p-3.5">المستوى</th>
                    <th className="p-3.5 pl-4">الجدول الزمني والتوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        {loading ? "جاري التحميل..." : "لا توجد أفواج دراسية مسجلة حالياً."}
                      </td>
                    </tr>
                  ) : (
                    groups.map((group) => (
                      <tr key={group.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 pr-4 font-bold text-emerald-700">{group.name}</td>
                        <td className="p-3.5 text-slate-600">{group.subject || "عام"}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold">
                            {group.level || "عام"}
                          </span>
                        </td>
                        <td className="p-3.5 pl-4 font-mono text-slate-800 font-semibold">
                          {group.schedule || "غير محدد"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}