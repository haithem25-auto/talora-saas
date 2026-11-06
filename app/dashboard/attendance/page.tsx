"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface Group {
  id: string;
  name: string;
  level: string;
  school_id: string;
}

interface Student {
  id: string;
  full_name: string;
  parent_id: string | null;
  group_id: string | null;
}

interface StudentSummary {
  total_consumed_sessions: number;
  target_monthly_sessions: number;
}

interface StudentSubscription {
  status: string;
  amount_due: number;
  amount_paid: number;
}

type AttendanceStatus = "present" | "late" | "absent" | "excused";

interface StudentAttendanceRecord {
  status: AttendanceStatus;
  saving: boolean;
  saved: boolean;
}

interface AttendanceState {
  [studentId: string]: StudentAttendanceRecord;
}

interface SummaryState {
  [studentId: string]: StudentSummary;
}

interface SubscriptionState {
  [studentId: string]: StudentSubscription | null;
}

const STATUS_CONFIG: { id: AttendanceStatus; label: string; activeClass: string; icon: string }[] = [
  { id: "present", label: "حاضر", activeClass: "bg-emerald-600 text-white shadow-emerald-600/20", icon: "✓" },
  { id: "late", label: "متأخر", activeClass: "bg-amber-500 text-white shadow-amber-500/20", icon: "⏱" },
  { id: "absent", label: "غائب", activeClass: "bg-rose-600 text-white shadow-rose-600/20", icon: "✕" },
  { id: "excused", label: "مبرر", activeClass: "bg-sky-600 text-white shadow-sky-600/20", icon: "✉" },
];

export default function AcademyAttendancePage() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [schoolId, setSchoolId] = useState<string>("");

  // المستويات والأفواج
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // قائمة الطلاب والحالات والملخصات والاشتراكات
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [summaries, setSummaries] = useState<SummaryState>({});
  const [subscriptions, setSubscriptions] = useState<SubscriptionState>({});

  // 1. جلب أفواج المدرسة واستخراج المستويات
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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

        setSchoolId(currentSchoolId);

        if (currentSchoolId) {
          const { data: groupsData } = await supabase
            .from("groups")
            .select("id, name, level, school_id")
            .eq("school_id", currentSchoolId);

          if (groupsData) {
            setAllGroups(groupsData);
            const uniqueLevels = Array.from(
              new Set(groupsData.map((g) => g.level).filter(Boolean))
            ) as string[];

            setLevels(uniqueLevels);
          }
        }
      } catch (err) {
        console.error("خطأ أثناء جلب أفواج المدرسة:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // 2. تصفية الأفواج عند اختيار المستوى
  useEffect(() => {
    if (!selectedLevel) {
      setFilteredGroups([]);
    } else {
      setFilteredGroups(allGroups.filter((g) => g.level === selectedLevel));
    }
    setSelectedGroup(null);
    setStudents([]);
    setSummaries({});
    setSubscriptions({});
  }, [selectedLevel, allGroups]);

  // 3. جلب الطلاب، ملخص الحصص (View)، الاشتراكات، وحضور اليوم
  useEffect(() => {
    async function fetchStudentsData() {
      if (!selectedGroup) {
        setStudents([]);
        setSummaries({});
        setSubscriptions({});
        return;
      }
      try {
        setLoading(true);
        const today = new Date().toISOString().split("T")[0];

        // جلب الطلاب
        const { data: studentsData } = await supabase
          .from("students")
          .select("id, first_name, last_name, parent_id, group_id")
          .eq("group_id", selectedGroup.id);

        const formattedStudents = (studentsData || []).map((s) => ({
          id: s.id,
          full_name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "بدون اسم",
          parent_id: s.parent_id,
          group_id: s.group_id,
        }));

        setStudents(formattedStudents);

        // جلب سجلات حضور اليوم
        const { data: existingAttendance } = await supabase
          .from("attendance")
          .select("student_id, status")
          .eq("group_id", selectedGroup.id)
          .eq("attendance_date", today);

        // جلب ملخص الحصص الشهرية من الـ View
        const { data: summaryData } = await supabase
          .from("student_attendance_summary")
          .select("student_id, total_consumed_sessions, target_monthly_sessions, month_period")
          .eq("group_id", selectedGroup.id);

        // جلب الاشتراكات للمجموعة
        const { data: subscriptionsData } = await supabase
          .from("student_subscriptions")
          .select("student_id, status, amount_due, amount_paid")
          .eq("group_id", selectedGroup.id);

        const initialAttendance: AttendanceState = {};
        const initialSummaries: SummaryState = {};
        const initialSubscriptions: SubscriptionState = {};

        formattedStudents.forEach((s) => {
          // الحضور اليومي
          const attRec = existingAttendance?.find((item) => item.student_id === s.id);
          initialAttendance[s.id] = {
            status: (attRec?.status as AttendanceStatus) || "present",
            saving: false,
            saved: !!attRec,
          };

          // ملخص الحصص الشهرية
          const sumRec = summaryData?.find(
            (item) => item.student_id === s.id && item.month_period?.startsWith(today.substring(0, 7))
          );
          initialSummaries[s.id] = {
            total_consumed_sessions: sumRec?.total_consumed_sessions || 0,
            target_monthly_sessions: sumRec?.target_monthly_sessions || 4,
          };

          // حالة الاشتراكات والتسديد
          const subRec = subscriptionsData?.find((item) => item.student_id === s.id);
          initialSubscriptions[s.id] = subRec
            ? {
                status: subRec.status,
                amount_due: subRec.amount_due || 0,
                amount_paid: subRec.amount_paid || 0,
              }
            : null;
        });

        setAttendance(initialAttendance);
        setSummaries(initialSummaries);
        setSubscriptions(initialSubscriptions);
      } catch (err) {
        console.error("خطأ أثناء جلب بيانات الحضور والاشتراكات:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStudentsData();
  }, [selectedGroup]);

  // تحديث حالة الحضور محلياً
  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        saved: false,
      },
    }));
  };

  // 4. حفظ حضور تلميذ فردي
  const handleSaveSingleStudent = async (student: Student) => {
    if (!selectedGroup || !schoolId) return;

    const studentRecord = attendance[student.id];
    if (!studentRecord) return;

    try {
      setAttendance((prev) => ({
        ...prev,
        [student.id]: { ...prev[student.id], saving: true },
      }));

      const today = new Date().toISOString().split("T")[0];
      const { data: { user } } = await supabase.auth.getUser();

      const { error: attError } = await supabase.from("attendance").upsert(
        {
          student_id: student.id,
          group_id: selectedGroup.id,
          school_id: schoolId,
          teacher_id: user?.id || null,
          status: studentRecord.status,
          sessions_count: 1, // تثبيت الحصة بحصة واحدة لكل تسطيل
          attendance_date: today,
        },
        { onConflict: "student_id, attendance_date" }
      );

      if (attError) throw attError;

      // تحديث ملخص الحصص محلياً بعد الحفظ مباشرة
      setSummaries((prev) => {
        const currentSum = prev[student.id] || { total_consumed_sessions: 0, target_monthly_sessions: 4 };
        const addedCount = studentRecord.status === "present" || studentRecord.status === "late" ? 1 : 0;
        return {
          ...prev,
          [student.id]: {
            ...currentSum,
            total_consumed_sessions: currentSum.total_consumed_sessions + addedCount,
          },
        };
      });

      // إرسال إشعار غياب لولي الأمر
      if (studentRecord.status === "absent" && student.parent_id) {
        await supabase.from("notifications").insert({
          user_id: student.parent_id,
          title: "تنبيه غياب طالب",
          message: `نفيدكم علماً بغياب ابنكم/ابنتكم ${student.full_name} عن الحصة اليوم.`,
          is_read: false,
          is_sent: false,
        });
      }

      setAttendance((prev) => ({
        ...prev,
        [student.id]: { ...prev[student.id], saving: false, saved: true },
      }));
    } catch (err: any) {
      console.error("خطأ أثناء حفظ حضور الطالب:", err);
      alert(`فشل الحفظ: ${err.message || "يرجى المحاولة لاحقاً"}`);
      setAttendance((prev) => ({
        ...prev,
        [student.id]: { ...prev[student.id], saving: false },
      }));
    }
  };

  // دالة تحديد حالة التسديد للطالب
  const getPaymentBadge = (studentId: string) => {
    const sub = subscriptions[studentId];
    const sum = summaries[studentId] || { total_consumed_sessions: 0, target_monthly_sessions: 4 };
    const isPaid = sub?.status === "paid" || (sub && sub.amount_paid >= sub.amount_due && sub.amount_due > 0);

    // إذا كان مسدداً
    if (isPaid) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
          ✓ مسدد
        </span>
      );
    }

    // إذا استوفى أو تجاوز عدد الحصص الشهرية المقرر ولم يسدد بعد
    const isOverdue = sum.total_consumed_sessions >= sum.target_monthly_sessions;

    if (isOverdue) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1 animate-pulse">
          ⚠️ متأخر عن التسديد
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
        غير مسدد
      </span>
    );
  };

  const SidebarComponent = Sidebar as any;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex" dir="rtl">
      <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
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
            TALORA Academy Attendance
          </div>
        </header>

        <main className="p-4 md:p-8 flex-1 max-w-6xl mx-auto w-full space-y-6">
          {/* بطاقة العنوان */}
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 p-6 rounded-3xl text-white shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl border border-white/20">
                🏫
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black">إدارة تسجيل حضور الأكاديمية</h1>
                <p className="text-emerald-100 text-xs md:text-sm mt-0.5 font-medium">
                  اختر المستوى ثم الفوج لتأكيد رصد حضور الطلاب ومتابعة حالة التسديد والحصص
                </p>
              </div>
            </div>
          </div>

          {/* فلترة الاختيار: المستوى -> الفوج */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. اختيار المستوى */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">المستوى الدراسي:</label>
              <select
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
              >
                <option value="">-- اختر المستوى الدراسي --</option>
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. اختيار الفوج */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">الفوج الدراسي:</label>
              <select
                disabled={!selectedLevel}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 cursor-pointer"
                value={selectedGroup?.id || ""}
                onChange={(e) => {
                  const grp = filteredGroups.find((g) => g.id === e.target.value) || null;
                  setSelectedGroup(grp);
                }}
              >
                <option value="">-- اختر الفوج المطلوب --</option>
                {filteredGroups.map((grp) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* معلومات الفوج المختار */}
          {selectedGroup && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                الفوج المحدد: <span className="text-emerald-700">{selectedGroup.name}</span> ({selectedGroup.level})
              </h3>
            </div>
          )}

          {/* قائمة الطلاب وحصص كل طالب مع مؤشر الحصص وحالة التسديد */}
          {selectedGroup && students.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              {/* شاشات الحاسوب */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[750px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200">
                      <th className="p-4 pr-6">اسم الطالب</th>
                      <th className="p-4 text-center">مؤشر الحصص</th>
                      <th className="p-4 text-center">حالة التسديد</th>
                      <th className="p-4">حالة الحضور</th>
                      <th className="p-4 text-center">إجراء الحفظ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium">
                    {students.map((student) => {
                      const currentState = attendance[student.id] || {
                        status: "present",
                        saving: false,
                        saved: false,
                      };
                      const summary = summaries[student.id] || { total_consumed_sessions: 0, target_monthly_sessions: 4 };

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-4 pr-6 font-bold text-slate-900">{student.full_name}</td>
                          
                          {/* مؤشر الحصص المستهلكة */}
                          <td className="p-4 text-center">
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                              {summary.total_consumed_sessions} / {summary.target_monthly_sessions} حصة
                            </span>
                          </td>

                          {/* حالة التسديد والتأخر */}
                          <td className="p-4 text-center">
                            {getPaymentBadge(student.id)}
                          </td>

                          <td className="p-4">
                            <div className="flex gap-1.5 bg-slate-100/80 p-1 rounded-xl w-fit border border-slate-200/60">
                              {STATUS_CONFIG.map((conf) => {
                                const isActive = currentState.status === conf.id;
                                return (
                                  <button
                                    key={conf.id}
                                    type="button"
                                    onClick={() => updateStudentStatus(student.id, conf.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                      isActive
                                        ? `${conf.activeClass} shadow-md`
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                                    }`}
                                  >
                                    <span>{conf.icon}</span>
                                    <span>{conf.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleSaveSingleStudent(student)}
                              disabled={currentState.saving}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer ${
                                currentState.saved
                                  ? "bg-slate-100 text-emerald-700 border border-emerald-200"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                              }`}
                            >
                              {currentState.saving ? (
                                "جاري الحفظ..."
                              ) : currentState.saved ? (
                                <><span>✓</span> تم الحفظ</>
                              ) : (
                                <><span>💾</span> حفظ للحالة</>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* شاشات الجوال */}
              <div className="block md:hidden p-4 space-y-4">
                {students.map((student) => {
                  const currentState = attendance[student.id] || {
                    status: "present",
                    saving: false,
                    saved: false,
                  };
                  const summary = summaries[student.id] || { total_consumed_sessions: 0, target_monthly_sessions: 4 };

                  return (
                    <div key={student.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 text-base">{student.full_name}</div>
                        {getPaymentBadge(student.id)}
                      </div>

                      <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-600">الحصص المستهلكة هذا الشهر:</span>
                        <span className="font-bold text-emerald-700">
                          {summary.total_consumed_sessions} / {summary.target_monthly_sessions} حصة
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="block text-xs font-bold text-slate-500">حالة الحضور اليوم:</span>
                        <div className="grid grid-cols-2 gap-2">
                          {STATUS_CONFIG.map((conf) => {
                            const isActive = currentState.status === conf.id;
                            return (
                              <button
                                key={conf.id}
                                type="button"
                                onClick={() => updateStudentStatus(student.id, conf.id)}
                                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isActive
                                    ? `${conf.activeClass} shadow-sm`
                                    : "bg-white text-slate-600 border border-slate-200"
                                }`}
                              >
                                <span>{conf.icon}</span>
                                <span>{conf.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveSingleStudent(student)}
                        disabled={currentState.saving}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          currentState.saved
                            ? "bg-slate-100 text-emerald-700 border border-emerald-200"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                        }`}
                      >
                        {currentState.saving ? (
                          "جاري الحفظ..."
                        ) : currentState.saved ? (
                          <><span>✓</span> تم حفظ حضور الطالب</>
                        ) : (
                          <><span>💾</span> حفظ حضور الطالب</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedGroup && students.length === 0 && !loading && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl text-center text-sm font-semibold">
              لا يوجد طلاب مسجلين في هذا الفوج حالياً.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}