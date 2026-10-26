"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface Group {
  id: string;
  name: string;
  school_id: string;
}

interface Student {
  id: string;
  full_name: string;
  parent_id: string | null;
  group_id: string | null;
}

type AttendanceStatus = "present" | "late" | "absent" | "excused";

interface StudentAttendanceRecord {
  status: AttendanceStatus;
  notes: string;
}

interface AttendanceState {
  [studentId: string]: StudentAttendanceRecord;
}

const STATUS_CONFIG: { id: AttendanceStatus; label: string; activeClass: string; icon: string }[] = [
  { id: "present", label: "حاضر", activeClass: "bg-emerald-600 text-white shadow-emerald-600/20", icon: "✓" },
  { id: "late", label: "متأخر", activeClass: "bg-amber-500 text-white shadow-amber-500/20", icon: "⏱" },
  { id: "absent", label: "غائب", activeClass: "bg-rose-600 text-white shadow-rose-600/20", icon: "✕" },
  { id: "excused", label: "مبرر", activeClass: "bg-sky-600 text-white shadow-sky-600/20", icon: "✉" },
];

export default function TeacherAttendancePage() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // جلب بيانات المعلم والأفواج المسندة إليه
  useEffect(() => {
    async function getTeacherData() {
      try {
        setLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) throw new Error("لم يتم العثور على جلسة دخول نشطة");

        setTeacherId(user.id);

        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("id, name, school_id")
          .eq("teacher_id", user.id);

        if (groupsError) throw groupsError;
        setGroups(groupsData || []);
      } catch (error) {
        console.error("خطأ أثناء جلب أفواج المعلم:", error);
      } finally {
        setLoading(false);
      }
    }
    getTeacherData();
  }, []);

  // جلب الطلاب عند اختيار الفوج
  useEffect(() => {
    async function fetchStudents() {
      if (!selectedGroup) {
        setStudents([]);
        return;
      }
      try {
        setLoading(true);
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id, first_name, last_name, parent_id, group_id")
          .eq("group_id", selectedGroup);

        if (studentsError) throw studentsError;

        const formattedStudents = (studentsData || []).map((s) => ({
          id: s.id,
          full_name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "بدون اسم",
          parent_id: s.parent_id,
          group_id: s.group_id,
        }));

        setStudents(formattedStudents);

        // تهيئة الحالة الافتراضية
        const initialAttendance: AttendanceState = {};
        formattedStudents.forEach((student) => {
          initialAttendance[student.id] = {
            status: "present",
            notes: "",
          };
        });
        setAttendance(initialAttendance);
      } catch (error) {
        console.error("خطأ أثناء جلب قائمة الطلاب:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [selectedGroup]);

  const updateStudentState = (
    studentId: string,
    field: keyof StudentAttendanceRecord,
    value: any
  ) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedGroup || students.length === 0 || !teacherId) return;

    try {
      setSaving(true);

      const currentGroup = groups.find((g) => g.id === selectedGroup);

      const attendanceRecords = students.map((student) => {
        const studentRecord = attendance[student.id] || {
          status: "present",
          notes: "",
        };

        return {
          student_id: student.id,
          group_id: selectedGroup,
          teacher_id: teacherId,
          school_id: currentGroup?.school_id || null,
          status: studentRecord.status,
          notes: studentRecord.notes,
          attendance_date: new Date().toISOString().split("T")[0],
        };
      });

      const { error: attendanceError } = await supabase
        .from("attendance")
        .insert(attendanceRecords);

      if (attendanceError) throw attendanceError;

      // إرسال الإشعارات لأولياء الأمور للطلاب الغائبين
      const absentStudents = students.filter(
        (student) => attendance[student.id]?.status === "absent" && student.parent_id
      );

      if (absentStudents.length > 0) {
        const notificationRecords = absentStudents.map((student) => ({
          user_id: student.parent_id,
          title: "تنبيه غياب طالب",
          message: `نفيدكم علماً بغياب ابنكم/ابنتكم ${student.full_name} عن الحصة اليوم.`,
          is_read: false,
          is_sent: false,
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notificationRecords);

        if (notificationError) {
          console.warn("تنبيه: تعذر إرسال الإشعارات لجداول الإشعارات", notificationError);
        }
      }

      alert("تم تسجيل وتوثيق الحضور والغياب اليومي بنجاح!");
    } catch (error: any) {
      console.error("خطأ أثناء حفظ الحضور:", error);
      alert(`حدث خطأ أثناء الحفظ: ${error.message || "يرجى المحاولة لاحقاً"}`);
    } finally {
      setSaving(false);
    }
  };

  const SidebarComponent = Sidebar as any;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex" dir="rtl">
      <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* شريط العنونة العلوي */}
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
            TALORA Attendance System
          </div>
        </header>

        <main className="p-4 md:p-8 flex-1 max-w-6xl mx-auto w-full space-y-6">
          {/* بطاقة الترويسة الرئيسية */}
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-900/10 border border-emerald-500/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl border border-white/20">
                📋
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight">رصد وتسجيل الحضور والغياب</h1>
                <p className="text-emerald-100 text-xs md:text-sm mt-0.5 font-medium">
                  حدد الفوج للبدء في تسحيل حضور وغياب الطلاب اليومي
                </p>
              </div>
            </div>
          </div>

          {/* تحديد الفوج */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
            <label className="block text-xs font-bold text-slate-700 mb-2">اختر الفوج الدراسي:</label>
            <div className="relative w-full md:w-80">
              <select
                className="w-full p-3 pl-10 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition text-sm appearance-none cursor-pointer"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="">-- اختر الفوج المطلوب --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* قائمة الطلاب وتنسيق الرصد */}
          {selectedGroup && students.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden space-y-4">
              
              {/* عرض الشاشات الكبيرة (جدول) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200/80">
                      <th className="p-4 pr-6">اسم الطالب</th>
                      <th className="p-4">حالة الحضور</th>
                      <th className="p-4 pl-6">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium">
                    {students.map((student) => {
                      const currentState = attendance[student.id] || {
                        status: "present",
                        notes: "",
                      };

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-4 pr-6 font-bold text-slate-900">{student.full_name}</td>
                          <td className="p-4">
                            <div className="flex gap-1.5 bg-slate-100/80 p-1 rounded-xl w-fit border border-slate-200/60">
                              {STATUS_CONFIG.map((conf) => {
                                const isActive = currentState.status === conf.id;
                                return (
                                  <button
                                    key={conf.id}
                                    type="button"
                                    onClick={() => updateStudentState(student.id, "status", conf.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
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
                          <td className="p-4 pl-6">
                            <input
                              type="text"
                              placeholder="أضف ملاحظة..."
                              value={currentState.notes}
                              onChange={(e) => updateStudentState(student.id, "notes", e.target.value)}
                              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* عرض الجوال (بطاقات تفاعلية) */}
              <div className="block md:hidden p-4 space-y-4">
                {students.map((student) => {
                  const currentState = attendance[student.id] || {
                    status: "present",
                    notes: "",
                  };

                  return (
                    <div key={student.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                      <div className="font-bold text-slate-900 text-base">{student.full_name}</div>
                      
                      <div className="space-y-2">
                        <span className="block text-xs font-bold text-slate-500">الحالة:</span>
                        <div className="grid grid-cols-2 gap-2">
                          {STATUS_CONFIG.map((conf) => {
                            const isActive = currentState.status === conf.id;
                            return (
                              <button
                                key={conf.id}
                                type="button"
                                onClick={() => updateStudentState(student.id, "status", conf.id)}
                                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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

                      <input
                        type="text"
                        placeholder="أضف ملاحظة سريعة..."
                        value={currentState.notes}
                        onChange={(e) => updateStudentState(student.id, "notes", e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  );
                })}
              </div>

              {/* زر الحفظ */}
              <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={saving}
                  className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-8 py-3 rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? "جاري الحفظ..." : "💾 حفظ الحضور"}
                </button>
              </div>
            </div>
          )}

          {/* تنبيه عدم وجود طلاب */}
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