"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import Sidebar from "@/app/components/dashboard/Sidebar"; 

interface Group {
  id: string;
  name: string;
  school_id: string;
  teacher_id: string;
  level: string;
  schedule: string;
  created_at: string;
  monthly_sessions_count?: number;
  student_capacity?: number;
  subject?: string;
  teacher_name?: string;
}

interface TeacherOption {
  id: string;
  full_name: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("school_owner");
  const [schoolId, setSchoolId] = useState<string>("");

  // حالة النافذة المنبثقة (Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // نموذج بيانات الفوج الجديد
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    level: "",
    monthly_sessions_count: 8,
    student_capacity: 20,
    schedule: "",
    teacher_id: "",
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // 1. جلب بيانات المستخدم الحالي
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. جلب البروفايل الخاص بالمستخدم
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id, role")
        .eq("id", user.id)
        .maybeSingle();

      const currentSchoolId = profile?.school_id || "";
      const currentRole = profile?.role || "school_owner";

      setUserRole(currentRole);
      setSchoolId(currentSchoolId);

      // 3. جلب الأساتذة المنتمين للمدرسة بالاعتماد على first_name و last_name
      if (currentSchoolId) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, role")
          .eq("school_id", currentSchoolId);

        if (profilesData) {
          const teachersList = profilesData
            .filter((p) => p.role === "teacher" || p.role === "independent_teacher")
            .map((p) => ({
              id: p.id,
              full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "أستاذ بدون اسم",
            }));

          setTeachers(
            teachersList.length > 0 
              ? teachersList 
              : profilesData.map((p) => ({ 
                  id: p.id, 
                  full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "أستاذ" 
                }))
          );
        }
      }

      // 4. جلب الأفواج الخاصة بالمدرسة
      await fetchGroups(currentSchoolId, user.id, currentRole);

    } catch (error) {
      console.error("خطأ أثناء جلب البيانات الأساسية:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async (sId: string, userId: string, role: string) => {
    try {
      let query = supabase.from("groups").select("*").order("created_at", { ascending: false });

      if (sId) {
        query = query.eq("school_id", sId);
      }

      // إذا كان المستخدم أستاذ، يعرض فقط أفواجه
      if (role === "teacher") {
        query = query.eq("teacher_id", userId);
      }

      const { data: groupsData, error } = await query;

      if (error) {
        console.error("خطأ Supabase عند جلب الأفواج:", error);
        setGroups([]);
        return;
      }

      if (groupsData && groupsData.length > 0) {
        const teacherIds = Array.from(new Set(groupsData.map((g) => g.teacher_id).filter(Boolean)));

        let teachersMap: Record<string, string> = {};
        if (teacherIds.length > 0) {
          // جلب first_name و last_name بدلاً من full_name
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", teacherIds);

          if (profilesData) {
            profilesData.forEach((p) => {
              const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
              teachersMap[p.id] = fullName || "غير محدد";
            });
          }
        }

        const formattedData = groupsData.map((item) => ({
          ...item,
          teacher_name: teachersMap[item.teacher_id] || "غير محدد",
        }));

        setGroups(formattedData);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error("خطأ أثناء معالجة الأفواج:", err);
    }
  };

  // إنشاء فوج جديد
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert("يرجى إدخال اسم الفوج.");
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from("groups").insert([
        {
          name: formData.name,
          subject: formData.subject,
          level: formData.level,
          monthly_sessions_count: Number(formData.monthly_sessions_count) || 8,
          student_capacity: Number(formData.student_capacity) || 20,
          schedule: formData.schedule,
          teacher_id: formData.teacher_id || null,
          school_id: schoolId || null,
        },
      ]);

      if (error) throw error;

      setIsModalOpen(false);
      setFormData({
        name: "",
        subject: "",
        level: "",
        monthly_sessions_count: 8,
        student_capacity: 20,
        schedule: "",
        teacher_id: "",
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetchGroups(schoolId, user.id, userRole);
      }
    } catch (err: any) {
      console.error("خطأ أثناء إنشاء الفوج:", err);
      alert("حدث خطأ أثناء حفظ الفوج: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const SidebarComponent = Sidebar as any;
  const isSchoolOwner = userRole === "school_owner";

  return (
    <div className="flex min-h-screen bg-slate-50 text-right" dir="rtl">
      
      {/* خلفية معتمة للهواتف */}
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
        
        {/* شريط أعلى للجوال */}
        <div className="flex items-center justify-between md:hidden pb-3 border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <span className="font-semibold text-slate-800 text-sm">لوحة الأفواج</span>
        </div>

        {/* رأس الصفحة */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-5 border-slate-200/60 gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">إدارة ومتابعة الأفواج والدروس</h1>
            <p className="text-sm text-slate-500 mt-1">
              {isSchoolOwner 
                ? "لوحة التحكم الإدارية لصاحب المؤسسة لإنشاء الأفواج وتعيين الأساتذة" 
                : "لوحة التحكم الخاصة بالأستاذ لمتابعة جدول وأعضاء الأفواج"}
            </p>
          </div>

          {/* زر إنشاء فوج للإدارة */}
          {isSchoolOwner && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-colors font-bold text-sm shadow-sm cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              إضافة فوج جديد
            </button>
          )}
        </div>

        {/* الجدول أو حالة التحميل */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 py-12">
            <div className="text-center">جاري تحميل بيانات الأفواج...</div>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-full max-w-2xl text-center py-16 bg-white rounded-xl border border-dashed border-slate-200 p-8 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-700 mb-1">لا توجد أفواج مسجلة</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                {isSchoolOwner ? "اضغط على زر \"إضافة فوج جديد\" بأعلى الصفحة للبدء بإضافة الأفواج وتعيين الأساتذة." : "لم يتم تسجيلك في أي فوج حالياً."}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b border-slate-200/60">
                    <th className="p-4">اسم الفوج</th>
                    <th className="p-4">المادة الدراسية</th>
                    <th className="p-4">الأستاذ المشرف</th>
                    <th className="p-4">المستوى</th>
                    <th className="p-4">التوقيت</th>
                    <th className="p-4 text-center">حصص/شهر</th>
                    <th className="p-4 text-center">السعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {groups.map((group) => (
                    <tr key={group.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{group.name}</td>
                      <td className="p-4">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                          {group.subject || "عام"}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-700">{group.teacher_name}</td>
                      <td className="p-4 text-slate-600">{group.level || "-"}</td>
                      <td className="p-4 text-slate-600">{group.schedule || "-"}</td>
                      <td className="p-4 text-center font-bold text-slate-700">{group.monthly_sessions_count || "-"}</td>
                      <td className="p-4 text-center font-bold text-slate-700">{group.student_capacity ? `${group.student_capacity} طالب` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* النافذة المنبثقة (Modal) لإنشاء فوج جديد */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">➕ إنشاء فوج تعليمي جديد</h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-6 space-y-4 text-xs md:text-sm">
              {/* اسم الفوج */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الفوج *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فوج التفوق (أ)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              {/* المادة والمستوى */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المادة الدراسية</label>
                  <input
                    type="text"
                    placeholder="مثال: الرياضيات"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المستوى الدراسي</label>
                  <input
                    type="text"
                    placeholder="مثال: التحضيري / السنة 1"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* قائمة اختيار الأساتذة */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر الأستاذ المشرف</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-emerald-500"
                >
                  <option value="">-- حدد أستاذًا من القائمة --</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      👨‍🏫 {teacher.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* عدد الحصص والسعة */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عدد الحصص شهرياً</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.monthly_sessions_count}
                    onChange={(e) => setFormData({ ...formData, monthly_sessions_count: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعة الطلاب القصوى</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.student_capacity}
                    onChange={(e) => setFormData({ ...formData, student_capacity: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* التوقيت */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">التوقيت والجدول</label>
                <input
                  type="text"
                  placeholder="مثال: الأحد والثلاثاء من 10:00 إلى 12:00"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              {/* أزرار الإرسال والإلغاء */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "جاري الحفظ..." : "حفظ الفوج"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}