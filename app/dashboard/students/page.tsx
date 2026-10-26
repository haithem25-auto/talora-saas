"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";
import Sidebar from "../../components/dashboard/Sidebar";

// واجهات البيانات الخاصة بـ TALORA
interface StudentItem {
  id: string;
  first_name: string;
  last_name: string;
  level?: string;
  school_id?: string;
  group_id?: string;
  teacher_id?: string;
  parent_id?: string;
  parent_phone?: string;
  status?: string;
  created_at?: string;
  group_name?: string;
  subject_name?: string;
  parent_name?: string;
  attended_sessions_count?: number;
}

interface GroupItem {
  id: string;
  name: string;
  subject?: string;
  level?: string;
  school_id?: string;
}

export default function StudentsPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState("المؤسسة التعليمية");
  const [schoolId, setSchoolId] = useState<string>("");

  // البيانات الأساسية
  const [allStudents, setAllStudents] = useState<StudentItem[]>([]);
  const [allGroups, setAllGroups] = useState<GroupItem[]>([]);
  
  // حالة التقسيم والتنقل الهرمي
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // حالة البحث المباشر
  const [searchQuery, setSearchQuery] = useState<string>("");

  // حالة النافذة المنبثقة (Modal) لتسجيل تلميذ جديد
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalData, setModalData] = useState({
    first_name: "",
    last_name: "",
    subject: "",
    group_id: "",
  });

  // حماية الصفحة والتأكد من الصلاحيات
  useEffect(() => {
    if (!roleLoading && !role) {
      router.push("/");
    }
  }, [role, roleLoading, router]);

  useEffect(() => {
    if (roleLoading) return;
    loadAllData();
  }, [role, roleLoading]);

  // جلب البيانات الشاملة للمدرسة بأسلوب آمن يمنع التسريب
  async function loadAllData() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. تحديد معرّف المدرسة بشكل صارم ودقيق
      let currentSchoolId = "";

      // أ) البحث من ملف المستخدم
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.school_id) {
        currentSchoolId = profile.school_id;
      } else {
        // ب) إذا كان مالك مدرسة ولم يربط في البروفايل، نبحث عنه في جدول schools بواسطة owner_id
        const { data: ownedSchool } = await supabase
          .from("schools")
          .select("id, name")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (ownedSchool?.id) {
          currentSchoolId = ownedSchool.id;
          setSchoolName(ownedSchool.name || "المؤسسة التعليمية");
        }
      }

      setSchoolId(currentSchoolId);

      // ⛔ إذا لم نجد معرّف المدرسة، نوقف الاستعلام لمنع جلب بيانات المدارس الأخرى!
      if (!currentSchoolId) {
        console.warn("تنبيه أمان: لم يتم التعرف على معرّف المدرسة للمستخدم الحالي.");
        setAllGroups([]);
        setAllStudents([]);
        setLoading(false);
        return;
      }

      // جلب اسم المدرسة إن لم نجلبه سابقاً
      if (!schoolName || schoolName === "المؤسسة التعليمية") {
        const { data: schoolData } = await supabase
          .from("schools")
          .select("name")
          .eq("id", currentSchoolId)
          .maybeSingle();

        if (schoolData?.name) {
          setSchoolName(schoolData.name);
        }
      }

      // 2. جلب أفواج المدرسة الحالية فقط بأسلوب إجباري
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("*")
        .eq("school_id", currentSchoolId);

      if (groupsError) throw groupsError;
      const loadedGroups: GroupItem[] = groupsData || [];
      setAllGroups(loadedGroups);

      // 3. جلب طلاب المدرسة الحالية فقط
      let studentsQuery = supabase
        .from("students")
        .select("*")
        .eq("school_id", currentSchoolId);

      if (role === "teacher") {
        studentsQuery = studentsQuery.eq("teacher_id", user.id);
      }

      const { data: studentsData, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;

      if (studentsData && studentsData.length > 0) {
        // جلب أسماء أولياء الأمور
        const parentIds = Array.from(
          new Set(studentsData.map((s) => s.parent_id).filter((id): id is string => Boolean(id)))
        );
        let parentsMap: Record<string, string> = {};

        if (parentIds.length > 0) {
          const { data: parentsData } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", parentIds);

          if (parentsData) {
            parentsData.forEach((p) => {
              parentsMap[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim();
            });
          }
        }

        // جلب إحصائيات الحضور للتلاميذ المحددين فقط
        const studentIds = studentsData.map((s) => s.id);
        let attendanceMap: Record<string, number> = {};

        if (studentIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from("attendance")
            .select("student_id, status")
            .in("student_id", studentIds)
            .eq("status", "present");

          if (attendanceData) {
            attendanceData.forEach((att) => {
              attendanceMap[att.student_id] = (attendanceMap[att.student_id] || 0) + 1;
            });
          }
        }

        // دمج البيانات الكاملة للطلاب
        const formattedStudents: StudentItem[] = studentsData.map((s) => {
          const matchingGroup = loadedGroups.find((g) => g.id === s.group_id);
          return {
            ...s,
            group_name: matchingGroup?.name || "غير محدد",
            subject_name: matchingGroup?.subject || "عام",
            parent_name: s.parent_id ? parentsMap[s.parent_id] || "مسجل عبر النظام" : "في انتظار ربط الولي",
            attended_sessions_count: attendanceMap[s.id] || 0,
          };
        });

        setAllStudents(formattedStudents);
      } else {
        setAllStudents([]);
      }
    } catch (err) {
      console.error("خطأ في تحميل بيانات الطلاب:", err);
    } finally {
      setLoading(false);
    }
  }

  // استخراج قائمة المستويات الدراسية المتاحة لمدرسة اليوم فقط
  const availableLevels: string[] = Array.from(
    new Set(
      allGroups
        .map((g) => g.level)
        .concat(allStudents.map((s) => s.level))
        .filter((lvl): lvl is string => Boolean(lvl))
    )
  );

  // استخراج قائمة المواد المتاحة حسب المستوى المحدد
  const availableSubjects: string[] = Array.from(
    new Set(
      allGroups
        .filter((g) => !selectedLevel || g.level === selectedLevel)
        .map((g) => g.subject || "عام")
        .filter((sbj): sbj is string => Boolean(sbj))
    )
  );

  // استخراج قائمة الأفواج المتاحة
  const availableGroups = allGroups.filter((g) => {
    const matchLevel = !selectedLevel || g.level === selectedLevel;
    const matchSubject = !selectedSubject || (g.subject || "عام") === selectedSubject;
    return matchLevel && matchSubject;
  });

  // تصفية الطلاب
  const displayedStudents = allStudents.filter((student) => {
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.toLowerCase();
    
    if (searchQuery.trim() !== "") {
      return fullName.includes(searchQuery.trim().toLowerCase());
    }

    const matchLevel = !selectedLevel || student.level === selectedLevel;
    const matchGroup = !selectedGroupId || student.group_id === selectedGroupId;
    
    let matchSubject = true;
    if (selectedSubject) {
      const studentGroup = allGroups.find((g) => g.id === student.group_id);
      matchSubject = (studentGroup?.subject || "عام") === selectedSubject;
    }

    return matchLevel && matchSubject && matchGroup;
  });

  // معالجة تسجيل تلميذ جديد
  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolId) {
      alert("خطأ أمان: لا توجد مدرسة مخصصة لحسابك لتسجيل التلميذ عليها.");
      return;
    }

    if (!modalData.first_name || !modalData.last_name || !modalData.group_id) {
      alert("يرجى ملء جميع الحقول واختيار الفوج المناسب.");
      return;
    }

    try {
      setSubmitting(true);
      const selectedGroup = allGroups.find((g) => g.id === modalData.group_id);

      const { error } = await supabase.from("students").insert([
        {
          first_name: modalData.first_name.trim(),
          last_name: modalData.last_name.trim(),
          group_id: modalData.group_id,
          level: selectedGroup?.level || selectedLevel || "غير محدد",
          school_id: schoolId,
          parent_id: null,
          parent_phone: null,
          status: "active",
        },
      ]);

      if (error) throw error;

      setIsModalOpen(false);
      setModalData({ first_name: "", last_name: "", subject: "", group_id: "" });
      await loadAllData();
      alert("تم تسجيل التلميذ بنجاح وربطه بالمؤسسة!");
    } catch (err: any) {
      console.error("خطأ أثناء تسجيل التلميذ:", err);
      alert("حدث خطأ أثناء حفظ التلميذ: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#053F2E] text-white">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-emerald-100 font-medium">جاري التحقق من صلاحيات الأمان...</p>
        </div>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen flex bg-slate-50 text-slate-800 font-sans relative overflow-x-hidden">
      {/* القائمة الجانبية */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-y-auto w-full">
        {/* الهيدر العلوي */}
        <header className="bg-white border-b border-slate-100 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs w-full">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="lg:hidden w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xl text-slate-700"
          >
            ☰
          </button>
          
          {/* شريط البحث المباشر باسم ولقب الطالب */}
          <div className="flex-1 max-w-md flex items-center bg-slate-100/80 border border-slate-200/80 rounded-2xl px-3.5 py-2 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
            <span className="text-slate-400 ml-2">🔍</span>
            <input 
              type="text" 
              placeholder="ابحث فوراً بـ (الاسم واللقب)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs md:text-sm w-full outline-none text-slate-800 placeholder-slate-400 font-medium" 
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-emerald-50 rounded-full flex items-center justify-center text-lg border border-emerald-100 shadow-inner shrink-0">🎓</div>
              <div className="hidden sm:block text-right min-w-0">
                <h4 className="text-xs md:text-sm font-bold text-slate-900 truncate">لوحة شؤون الطلاب</h4>
                <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{schoolName}</p>
              </div>
            </div>
          </div>
        </header>

        {/* محتوى الصفحة الرئيسي */}
        <section className="p-4 md:p-8 space-y-6 flex-1 w-full box-border">
          
          {/* كارد الترحيب وأزرار العمليات */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-xs">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">السجل الشامل للتلاميذ 👥</h2>
              <p className="text-xs md:text-sm text-slate-500 mt-1">تصفح التلاميذ إما بالبحث المباشر أو التقسيم حسب المستويات والأفواج</p>
            </div>
            
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs md:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <span>➕</span>
                <span>تسجيل تلميذ جديد</span>
              </button>
              
              <div className="bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl font-bold text-xs border border-emerald-100">
                إجمالي المسجلين: {allStudents.length}
              </div>
            </div>
          </div>

          {/* 1️⃣ التقسيم حسب المستويات الدراسية */}
          {!searchQuery && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span>📌</span>اختر المستوى الدراسي:
                </h3>
                {selectedLevel && (
                  <button 
                    onClick={() => { setSelectedLevel(""); setSelectedSubject(""); setSelectedGroupId(""); }}
                    className="text-[11px] text-rose-600 font-bold hover:underline"
                  >
                    إلغاء التحديد
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <button
                  onClick={() => { setSelectedLevel(""); setSelectedSubject(""); setSelectedGroupId(""); }}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                    selectedLevel === "" 
                      ? "bg-slate-900 text-white border-slate-900 shadow-md font-bold" 
                      : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <p className="text-xs opacity-75">عرض الكل</p>
                  <p className="text-sm font-black mt-0.5">جميع المستويات</p>
                </button>

                {availableLevels.map((lvl: string) => (
                  <button
                    key={lvl}
                    onClick={() => { setSelectedLevel(lvl); setSelectedSubject(""); setSelectedGroupId(""); }}
                    className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                      selectedLevel === lvl 
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md font-bold" 
                        : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    <p className="text-[10px] opacity-80">المستوى الدراسي</p>
                    <p className="text-sm font-bold mt-0.5 truncate">{lvl}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2️⃣ اختيار المادة والأفواج */}
          {!searchQuery && (selectedLevel || availableSubjects.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-xs">
              {/* المواد */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">📖 2. اختار المادة الدراسية:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedSubject(""); setSelectedGroupId(""); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedSubject === ""
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    كل المواد
                  </button>
                  {availableSubjects.map((sbj: string) => (
                    <button
                      key={sbj}
                      onClick={() => { setSelectedSubject(sbj); setSelectedGroupId(""); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedSubject === sbj
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {sbj}
                    </button>
                  ))}
                </div>
              </div>

              {/* الأفواج */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">👥 3. حدد الفوج التعليمي:</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                >
                  <option value="">-- عرض كل أفواج المادة --</option>
                  {availableGroups.map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      فوج: {grp.name} ({grp.subject || "عام"})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 3️⃣ نتائج العرض وقائمة التلاميذ ومعلوماتهم الكاملة */}
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 border border-slate-100 shadow-xs w-full">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h4 className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-2">
                📋 قائمة التلاميذ المحددين 
                <span className="bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 rounded-md border border-emerald-100">
                  {displayedStudents.length} تلميذ
                </span>
              </h4>
            </div>

            {loading ? (
              <div className="space-y-3 py-10">
                <div className="h-6 bg-slate-100 animate-pulse rounded-md w-1/3 mx-auto"></div>
                <div className="h-10 bg-slate-50 animate-pulse rounded-lg w-full"></div>
                <div className="h-10 bg-slate-50 animate-pulse rounded-lg w-full"></div>
              </div>
            ) : displayedStudents.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <p className="text-slate-400 text-xs">لا يوجد أي تلاميذ مطابقين لشروط البحث أو المدرسة المحددة.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedStudents.map((student) => (
                  <div 
                    key={student.id} 
                    className="bg-slate-50/80 hover:bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all shadow-2xs hover:shadow-md space-y-3 relative group"
                  >
                    {/* رأس بطاقة التلميذ */}
                    <div className="flex justify-between items-start gap-2 border-b border-slate-200/60 pb-2.5">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm md:text-base">
                          {student.first_name} {student.last_name}
                        </h4>
                        <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                          المستوى: {student.level || "غير محدد"}
                        </p>
                      </div>
                      <span className="bg-emerald-100/80 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-200">
                        {student.status === "active" || !student.status ? "نشط" : "غير نشط"}
                      </span>
                    </div>

                    {/* معلومات الفوج والمادة */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium">الفوج الدراسي:</p>
                        <p className="font-bold text-slate-800 truncate">{student.group_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium">المادة:</p>
                        <p className="font-bold text-emerald-700 truncate">{student.subject_name}</p>
                      </div>
                    </div>

                    {/* معلومات الولي وعدد الحصص */}
                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">👨‍👦 اسم الولي:</span>
                        <span className="font-bold text-slate-800">{student.parent_name}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">📞 هاتف الولي:</span>
                        <span className={`font-mono font-bold ${student.parent_phone ? "text-slate-800" : "text-amber-600 text-[10px]"}`}>
                          {student.parent_phone || "لم يسجل الولي بعد"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400 text-[11px]">📚 الحصص المدروسة:</span>
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-black text-xs border border-blue-100">
                          {student.attended_sessions_count} حصة
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>
      </div>

      {/* 4️⃣ النافذة المنبثقة (Modal) لتسجيل تلميذ جديد */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="font-bold text-slate-800 text-base">➕ تسجيل تلميذ جديد في المدرسة</h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterStudent} className="p-6 space-y-4 text-xs md:text-sm">
              
              {/* الاسم واللقب */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الاسم الأول *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد"
                    value={modalData.first_name}
                    onChange={(e) => setModalData({ ...modalData, first_name: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اللقب *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: بن علي"
                    value={modalData.last_name}
                    onChange={(e) => setModalData({ ...modalData, last_name: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* اختيار المادة الدراسية */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">المادة الدراسية *</label>
                <select
                  required
                  value={modalData.subject}
                  onChange={(e) => setModalData({ ...modalData, subject: e.target.value, group_id: "" })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="">-- حدد المادة الدراسية --</option>
                  {Array.from(new Set(allGroups.map((g) => g.subject || "عام"))).map((sbj) => (
                    <option key={sbj} value={sbj}>
                      📖 {sbj}
                    </option>
                  ))}
                </select>
              </div>

              {/* اختيار الفوج */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر الفوج *</label>
                <select
                  required
                  disabled={!modalData.subject}
                  value={modalData.group_id}
                  onChange={(e) => setModalData({ ...modalData, group_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-emerald-500 font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- اختر الفوج المخصص لهذه المادة --</option>
                  {allGroups
                    .filter((g) => (g.subject || "عام") === modalData.subject)
                    .map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        👥 فوج: {grp.name} ({grp.level || "مستوى غير محدد"})
                      </option>
                    ))}
                </select>
              </div>

              {/* ملاحظة ربط ولي الأمر */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">💡 ملاحظة ربط ولي الأمر:</p>
                <p>سيتم ترك حقول الولي فارغة. يمكن للولي ربط حسابه لاحقاً بإدخال اسم ولقب الطالب من لوحة تحكم الولي.</p>
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "جاري التسجيل..." : "تأكيد تسجيل التلميذ"}
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

    </main>
  );
}