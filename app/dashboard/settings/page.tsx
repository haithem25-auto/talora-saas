"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface Teacher {
  id: string;
  full_name: string;
  email?: string;
}

interface Student {
  id: string;
  full_name: string;
  group_id?: string;
  group_name?: string;
  absences_count: number;
}

interface Group {
  id: string;
  name: string;
  teacher_id?: string;
  teacher_name?: string;
}

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string>("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<"teachers" | "students" | "groups">("teachers");

  // حالة Modal نقل الطالب
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. جلب حساب المستخدم الحالي
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. تحديد معرّف المدرسة بأسلوب آمن ومزدوج
      let currentSchoolId = "";

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.school_id) {
        currentSchoolId = profile.school_id;
      } else {
        // البحث عن المدرسة المملوكة بواسطة owner_id
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

      // ⛔ إذا لم يتم التعرف على مدرسة مخصصة، نمنع الجلب تماماً لتفادي اختلاط البيانات
      if (!currentSchoolId) {
        console.warn("تنبيه أمان: لم يتم التعرف على معرّف المدرسة للمستخدم الحالي.");
        setTeachers([]);
        setGroups([]);
        setStudents([]);
        setLoading(false);
        return;
      }

      // 3. جلب الأساتذة الخاصين بهذه المدرسة حصراً
      const { data: teachersData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("role", "teacher")
        .eq("school_id", currentSchoolId);

      const formattedTeachers = teachersData?.map((t: any) => ({
        id: t.id,
        full_name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || "بدون اسم",
        email: t.email,
      })) || [];

      setTeachers(formattedTeachers);

      // 4. جلب الأفواج الخاصة بهذه المدرسة ودمج اسم الأستاذ المسؤول
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, teacher_id")
        .eq("school_id", currentSchoolId);

      const formattedGroups = groupsData?.map((g: any) => {
        const teacher = formattedTeachers.find((t) => t.id === g.teacher_id);
        return {
          id: g.id,
          name: g.name,
          teacher_id: g.teacher_id,
          teacher_name: teacher ? teacher.full_name : "بدون أستاذ",
        };
      }) || [];

      setGroups(formattedGroups);

      // 5. جلب الطلاب الخاصين بهذه المدرسة والربط مع الأفواج
      const { data: studentsData } = await supabase
        .from("students")
        .select(`
          id,
          first_name,
          last_name,
          group_id,
          groups:group_id ( name )
        `)
        .eq("school_id", currentSchoolId);

      const formattedStudents = studentsData?.map((s: any) => ({
        id: s.id,
        full_name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "بدون اسم",
        group_id: s.group_id,
        group_name: s.groups?.name || "غير مسجل في فوج",
        absences_count: 0,
      })) || [];

      setStudents(formattedStudents);

    } catch (error) {
      console.error("خطأ أثناء تحميل بيانات الإعدادات:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- [ إجراءات إدارة الأساتذة ] ----------------
  const handleDeleteTeacher = async (teacherId: string) => {
    if (!schoolId) return;

    const confirmAction = confirm(
      "هل أنت متأكد من إنهاء مهام وحذف هذا الأستاذ؟ ستبقى الأفواج الخاصة به معلقة لحين تعيين أستاذ جديد."
    );
    if (!confirmAction) return;

    try {
      // تفريغ الأستاذ من الأفواج المرتبطة به في هذه المدرسة
      await supabase
        .from("groups")
        .update({ teacher_id: null })
        .eq("teacher_id", teacherId)
        .eq("school_id", schoolId);

      // حذف بروفايل الأستاذ
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", teacherId)
        .eq("school_id", schoolId);

      if (error) throw error;

      setTeachers(teachers.filter((t) => t.id !== teacherId));
      setGroups(groups.map(g => g.teacher_id === teacherId ? { ...g, teacher_name: "بدون أستاذ", teacher_id: undefined } : g));
      alert("تمت إزالة الأستاذ بنجاح وتحويل أفواجه لحالة الانتظار.");
    } catch (error: any) {
      alert("حدث خطأ أثناء حذف الأستاذ: " + (error.message || error));
      console.error(error);
    }
  };

  // ---------------- [ إجراءات إدارة الأفواج ] ----------------
  const handleDeleteGroup = async (groupId: string) => {
    if (!schoolId) return;

    const confirmAction = confirm(
      "هل أنت متأكد من حذف هذا الفوج؟ سيتم فك ارتباط جميع الطلاب المنسوبين إليه ليصبحوا بدون فوج."
    );
    if (!confirmAction) return;

    try {
      // تفريغ الطلاب من الفوج داخل نفس المدرسة
      await supabase
        .from("students")
        .update({ group_id: null })
        .eq("group_id", groupId)
        .eq("school_id", schoolId);

      // حذف الفوج
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId)
        .eq("school_id", schoolId);

      if (error) throw error;

      setGroups(groups.filter((g) => g.id !== groupId));
      setStudents(students.map(s => s.group_id === groupId ? { ...s, group_name: "غير مسجل في فوج", group_id: undefined } : s));
      alert("تم حذف الفوج وفك ارتباط الطلاب به بنجاح.");
    } catch (error: any) {
      alert("حدث خطأ أثناء حذف الفوج: " + (error.message || error));
      console.error(error);
    }
  };

  // ---------------- [ إجراءات إدارة الطلاب ] ----------------
  const handleDeleteStudent = async (studentId: string) => {
    if (!schoolId) return;

    const confirmAction = confirm("هل أنت متأكد من حذف هذا الطالب نهائياً من النظام؟");
    if (!confirmAction) return;

    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId)
        .eq("school_id", schoolId);

      if (error) throw error;

      setStudents(students.filter((s) => s.id !== studentId));
      alert("تم حذف الطالب من النظام بنجاح.");
    } catch (error: any) {
      alert("حدث خطأ أثناء حذف الطالب: " + (error.message || error));
      console.error(error);
    }
  };

  // نقل الطالب من فوج إلى آخر
  const handleTransferStudent = async () => {
    if (!selectedStudent || !schoolId) return;

    try {
      setIsTransferring(true);
      const newGroupId = targetGroupId || null;

      const { error } = await supabase
        .from("students")
        .update({ group_id: newGroupId })
        .eq("id", selectedStudent.id)
        .eq("school_id", schoolId);

      if (error) throw error;

      const newGroup = groups.find(g => g.id === targetGroupId);

      setStudents(students.map(s => {
        if (s.id === selectedStudent.id) {
          return {
            ...s,
            group_id: targetGroupId || undefined,
            group_name: newGroup ? newGroup.name : "غير مسجل في فوج"
          };
        }
        return s;
      }));

      alert("تم نقل الطالب إلى الفوج الجديد بنجاح.");
      setSelectedStudent(null);
      setTargetGroupId("");
    } catch (error: any) {
      alert("حدث خطأ أثناء نقل الطالب: " + (error.message || error));
      console.error(error);
    } finally {
      setIsTransferring(false);
    }
  };

  const SidebarComponent = Sidebar as any;

  return (
    <div className="flex min-h-screen bg-slate-50 text-right" dir="rtl">
      {/* خلفية للجوال */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* الشريط الجانبي */}
      <div className={`
        fixed inset-y-0 right-0 z-40 w-64 bg-white transform transition-transform duration-300 ease-in-out
        md:static md:translate-x-0 md:z-20
        ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}>
        <SidebarComponent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col p-4 md:p-8 space-y-6 overflow-x-hidden min-w-0">
        
        {/* شريط الجوال */}
        <div className="flex items-center justify-between md:hidden pb-3 border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none"
            aria-label="فتح القائمة"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <span className="font-semibold text-slate-800 text-sm">إعدادات النظام</span>
        </div>

        {/* رأس الصفحة */}
        <div className="border-b pb-5 border-slate-200/60">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">إدارة النظام وإعدادات الصلاحيات</h1>
          <p className="text-sm text-slate-500 mt-1">
            صلاحيات إدارة المدرسة للتحكم في الأساتذة، الطلاب، والأفواج.
          </p>
        </div>

        {/* التبويبات */}
        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("teachers")}
            className={`pb-3 px-4 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "teachers"
                ? "border-b-2 border-emerald-600 text-emerald-600 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            إدارة الأساتذة ({teachers.length})
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`pb-3 px-4 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "groups"
                ? "border-b-2 border-emerald-600 text-emerald-600 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            إدارة الأفواج ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`pb-3 px-4 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "students"
                ? "border-b-2 border-emerald-600 text-emerald-600 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            إدارة الطلاب وتوزيعهم ({students.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">جاري تحميل البيانات...</div>
        ) : (
          <>
            {/* تبويب الأساتذة */}
            {activeTab === "teachers" && (
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200/60">
                  <h3 className="font-bold text-slate-800">قائمة أساتذة المدرسة</h3>
                  <p className="text-xs text-slate-500 mt-0.5">يمكنك إنهاء مهام أي أستاذ وسيتم تحويل أفواجه لحالة الانتظار</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {teachers.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">لا يوجد أساتذة مسجلون حالياً.</div>
                  ) : (
                    teachers.map((teacher) => (
                      <div key={teacher.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {teacher.full_name[0] || "أ"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-900 block">{teacher.full_name}</span>
                            <span className="text-xs text-slate-400">{teacher.email || "لا يوجد بريد محدد"}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTeacher(teacher.id)}
                          className="w-full sm:w-auto text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-colors text-center cursor-pointer"
                        >
                          إنهاء المهام والحذف
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* تبويب الأفواج */}
            {activeTab === "groups" && (
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200/60">
                  <h3 className="font-bold text-slate-800">قائمة الأفواج</h3>
                  <p className="text-xs text-slate-500 mt-0.5">حذف الفوج سيقوم بفك ارتباط الطلاب دون حذف حساباتهم</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {groups.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">لا توجد أفواج حالياً.</div>
                  ) : (
                    groups.map((group) => (
                      <div key={group.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50/40 transition-colors">
                        <div>
                          <span className="font-semibold text-slate-900 block">{group.name}</span>
                          <span className="text-xs text-slate-500">الأستاذ المسؤول: {group.teacher_name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="w-full sm:w-auto text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-colors text-center cursor-pointer"
                        >
                          حذف الفوج
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* تبويب الطلاب */}
            {activeTab === "students" && (
              <div className="bg-white rounded-xl shadow-xs border border-slate-200/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b border-slate-200/60">
                        <th className="p-4">اسم الطالب</th>
                        <th className="p-4">الفوج الحالي</th>
                        <th className="p-4 text-center">إجراءات الإدارة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-slate-500">لا يوجد طلاب مسجلون حالياً</td>
                        </tr>
                      ) : (
                        students.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-900">{student.full_name}</td>
                            <td className="p-4 text-slate-600">
                              <span className="inline-block bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-medium">
                                {student.group_name}
                              </span>
                            </td>
                            <td className="p-4 text-center space-x-2 space-x-reverse">
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setTargetGroupId(student.group_id || "");
                                }}
                                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                              >
                                نقل إلى فوج آخر
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                              >
                                حذف الطالب
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal نقل الطالب */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4 text-right" dir="rtl">
              <h3 className="text-lg font-bold text-slate-800">نقل الطالب: {selectedStudent.full_name}</h3>
              <p className="text-xs text-slate-500">اختر الفوج الجديد الذي ترغب بنقل الطالب إليه:</p>

              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- بدون فوج --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.teacher_name})
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleTransferStudent}
                  disabled={isTransferring}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {isTransferring ? "جاري النقل..." : "تأكيد النقل"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}