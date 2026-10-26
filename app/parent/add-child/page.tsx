"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface SchoolOption {
  id: string;
  name: string;
  city?: string;
}

interface Group {
  id: string;
  name: string;
  level: string | null;
  subject: string | null;
  student_capacity: number | null;
  school_id: string;
  teacher_id?: string | null;
  enrolledCount?: number;
}

interface ExistingStudent {
  id: string;
  first_name: string;
  last_name: string;
  level: string | null;
  group_id: string | null;
  school_id: string | null;
}

interface MyChild {
  id: string;
  first_name: string;
  last_name: string;
  level: string | null;
  school_id: string | null;
}

// 1️⃣ المكون الداخلي الذي يحتوي على المنطق و useSearchParams
function AddChildContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSchoolId = searchParams.get("school_id");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "enroll_group" | "existing">("new");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);

  // قائمة المدارس المتاحة للولي
  const [userSchools, setUserSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");

  // قوائم البيانات الديناميكية
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [unlinkedStudents, setUnlinkedStudents] = useState<ExistingStudent[]>([]);
  const [myChildren, setMyChildren] = useState<MyChild[]>([]);

  // خيارات الاستمارة المفلترة (تسجيل جديد)
  const [levels, setLevels] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);

  // نموذج تسجيل ابن جديد
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    selectedLevel: "",
    selectedSubject: "",
    selectedGroupId: "",
  });

  // نموذج تسجيل ابن مسجل في فوج إضافي
  const [enrollData, setEnrollData] = useState({
    selectedChildId: "",
    selectedSubject: "",
    selectedGroupId: "",
  });
  const [enrollSubjects, setEnrollSubjects] = useState<string[]>([]);
  const [enrollAvailableGroups, setEnrollAvailableGroups] = useState<Group[]>([]);

  // نموذج ربط ابن مسجل بالفعل
  const [linkData, setLinkData] = useState({
    selectedLevel: "",
    selectedSubject: "",
    selectedGroupId: "",
    selectedStudentId: "",
  });

  // جلب بيانات المستخدم والمدارس المسجلة لديه
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login");
          return;
        }

        setParentId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("school_id, school_name")
          .eq("id", user.id)
          .maybeSingle();

        const { data: schoolsData } = await supabase
          .from("schools")
          .select("id, name, city");

        const availableSchoolsList: SchoolOption[] = schoolsData || [];
        setUserSchools(availableSchoolsList);

        if (initialSchoolId) {
          setSelectedSchoolId(initialSchoolId);
        } else if (profile?.school_id) {
          setSelectedSchoolId(profile.school_id);
        } else if (availableSchoolsList.length > 0) {
          setSelectedSchoolId(availableSchoolsList[0].id);
        }
      } catch (err) {
        console.error("خطأ أثناء تحميل البيانات الأولية:", err);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [router, initialSchoolId]);

  // إعادة جلب الأفواج والمستويات والأبناء عند تغيير المدرسة المحددة
  useEffect(() => {
    async function loadSchoolData() {
      if (!selectedSchoolId || !parentId) {
        setAllGroups([]);
        setLevels([]);
        setMyChildren([]);
        return;
      }

      try {
        setFormData((prev) => ({
          ...prev,
          selectedLevel: "",
          selectedSubject: "",
          selectedGroupId: "",
        }));
        setEnrollData({
          selectedChildId: "",
          selectedSubject: "",
          selectedGroupId: "",
        });
        setLinkData((prev) => ({
          ...prev,
          selectedLevel: "",
          selectedSubject: "",
          selectedGroupId: "",
          selectedStudentId: "",
        }));

        // 1. جلب أفواج المدرسة
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("*")
          .eq("school_id", selectedSchoolId);

        if (groupsError) throw groupsError;

        // 2. جلب أعداد الطلاب المسجلين بكل فوج
        const { data: studentsData } = await supabase
          .from("students")
          .select("group_id, id")
          .eq("school_id", selectedSchoolId);

        const groupCounts: Record<string, number> = {};
        (studentsData || []).forEach((s) => {
          if (s.group_id) {
            groupCounts[s.group_id] = (groupCounts[s.group_id] || 0) + 1;
          }
        });

        const processedGroups = (groupsData || []).map((g) => ({
          ...g,
          enrolledCount: groupCounts[g.id] || 0,
        }));

        setAllGroups(processedGroups);

        const uniqueLevels = Array.from(
          new Set(processedGroups.map((g) => g.level).filter(Boolean))
        ) as string[];
        setLevels(uniqueLevels);

        // 3. جلب أطفال الولي المسجلين بهذه المدرسة
        const { data: childrenData } = await supabase
          .from("students")
          .select("id, first_name, last_name, level, school_id")
          .eq("parent_id", parentId)
          .eq("school_id", selectedSchoolId);

        // إزالة التكرار للأسماء إذا كان الطفل مسجلاً بأكثر من فوج سابقاً
        const uniqueChildMap = new Map<string, MyChild>();
        (childrenData || []).forEach((c) => {
          const key = `${c.first_name}_${c.last_name}`;
          if (!uniqueChildMap.has(key)) {
            uniqueChildMap.set(key, c);
          }
        });

        setMyChildren(Array.from(uniqueChildMap.values()));
      } catch (err) {
        console.error("خطأ في جلب بيانات المدرسة المختارة:", err);
      }
    }

    loadSchoolData();
  }, [selectedSchoolId, parentId]);

  // فلترة المواد عند اختيار المستوى (تسجيل طفل جديد)
  useEffect(() => {
    if (!formData.selectedLevel) {
      setSubjects([]);
      setAvailableGroups([]);
      setFormData((prev) => ({ ...prev, selectedSubject: "", selectedGroupId: "" }));
      return;
    }

    const filteredByLevel = allGroups.filter((g) => g.level === formData.selectedLevel);
    const uniqueSubjects = Array.from(
      new Set(filteredByLevel.map((g) => g.subject).filter(Boolean))
    ) as string[];

    setSubjects(uniqueSubjects);
    setFormData((prev) => ({ ...prev, selectedSubject: "", selectedGroupId: "" }));
  }, [formData.selectedLevel, allGroups]);

  // فلترة الأفواج عند اختيار المادة (تسجيل طفل جديد)
  useEffect(() => {
    if (!formData.selectedSubject) {
      setAvailableGroups([]);
      setFormData((prev) => ({ ...prev, selectedGroupId: "" }));
      return;
    }

    const matchingGroups = allGroups.filter(
      (g) => g.level === formData.selectedLevel && g.subject === formData.selectedSubject
    );

    setAvailableGroups(matchingGroups);
  }, [formData.selectedSubject, formData.selectedLevel, allGroups]);

  // ---------------- [ منطق التبويب الثاني: تسجيل ابن في فوج إضافي ] ----------------
  const selectedChildObj = myChildren.find((c) => c.id === enrollData.selectedChildId);

  // تحديث المواد المتاحة للطفل المختار حسب مستواه
  useEffect(() => {
    if (!selectedChildObj || !selectedChildObj.level) {
      setEnrollSubjects([]);
      setEnrollAvailableGroups([]);
      setEnrollData((prev) => ({ ...prev, selectedSubject: "", selectedGroupId: "" }));
      return;
    }

    const filteredByLevel = allGroups.filter((g) => g.level === selectedChildObj.level);
    const uniqueSubjects = Array.from(
      new Set(filteredByLevel.map((g) => g.subject).filter(Boolean))
    ) as string[];

    setEnrollSubjects(uniqueSubjects);
    setEnrollData((prev) => ({ ...prev, selectedSubject: "", selectedGroupId: "" }));
  }, [enrollData.selectedChildId, allGroups]);

  // تحديث الأفواج المتاحة للمادة المختارة للطفل
  useEffect(() => {
    if (!enrollData.selectedSubject || !selectedChildObj) {
      setEnrollAvailableGroups([]);
      setEnrollData((prev) => ({ ...prev, selectedGroupId: "" }));
      return;
    }

    const matchingGroups = allGroups.filter(
      (g) => g.level === selectedChildObj.level && g.subject === enrollData.selectedSubject
    );

    setEnrollAvailableGroups(matchingGroups);
  }, [enrollData.selectedSubject, selectedChildObj, allGroups]);

  // ---------------- [ منطق التبويب الثالث: ربط ابن مسجل بالفعل ] ----------------
  useEffect(() => {
    if (!linkData.selectedLevel) {
      setSubjects([]);
      setLinkData((prev) => ({
        ...prev,
        selectedSubject: "",
        selectedGroupId: "",
        selectedStudentId: "",
      }));
      return;
    }

    const filteredByLevel = allGroups.filter((g) => g.level === linkData.selectedLevel);
    const uniqueSubjects = Array.from(
      new Set(filteredByLevel.map((g) => g.subject).filter(Boolean))
    ) as string[];

    setSubjects(uniqueSubjects);
  }, [linkData.selectedLevel, allGroups]);

  useEffect(() => {
    if (!linkData.selectedSubject) {
      setAvailableGroups([]);
      setLinkData((prev) => ({ ...prev, selectedGroupId: "", selectedStudentId: "" }));
      return;
    }

    const matchingGroups = allGroups.filter(
      (g) => g.level === linkData.selectedLevel && g.subject === linkData.selectedSubject
    );

    setAvailableGroups(matchingGroups);
  }, [linkData.selectedSubject, linkData.selectedLevel, allGroups]);

  // جلب الطلاب غير المربوطين بولي أمر بالفوج المختار
  useEffect(() => {
    async function fetchUnlinkedStudents() {
      if (!linkData.selectedGroupId || !selectedSchoolId) {
        setUnlinkedStudents([]);
        return;
      }

      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, level, group_id, school_id")
        .eq("group_id", linkData.selectedGroupId)
        .is("parent_id", null);

      if (!error && data) {
        setUnlinkedStudents(data);
      }
    }

    if (activeTab === "existing") {
      fetchUnlinkedStudents();
    }
  }, [linkData.selectedGroupId, selectedSchoolId, activeTab]);

  // 1️⃣ حفظ وتسجيل طفل جديد
  const handleRegisterNewChild = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parentId) {
      alert("خطأ: يرجى تسجيل الدخول بحساب ولي الأمر.");
      return;
    }

    if (!selectedSchoolId) {
      alert("يرجى اختيار المدرسة أولاً.");
      return;
    }

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.selectedLevel ||
      !formData.selectedGroupId
    ) {
      alert("يرجى ملء جميع الحقول المطلوبة واختيار الفوج.");
      return;
    }

    const selectedGroup = allGroups.find((g) => g.id === formData.selectedGroupId);
    if (selectedGroup && selectedGroup.student_capacity) {
      if ((selectedGroup.enrolledCount || 0) >= selectedGroup.student_capacity) {
        alert("عذراً، هذا الفوج مكتمل العدد تماماً، يرجى اختيار فوج آخر.");
        return;
      }
    }

    try {
      setSubmitting(true);

      const newStudent = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        level: formData.selectedLevel,
        school_id: selectedSchoolId,
        group_id: formData.selectedGroupId,
        teacher_id: selectedGroup?.teacher_id || null,
        parent_id: parentId,
        status: "active",
      };

      const { error } = await supabase.from("students").insert([newStudent]);

      if (error) throw error;

      alert("تم تسجيل وتوثيق بيانات الطفل بنجاح!");
      router.push("/parent");
    } catch (err: any) {
      console.error("خطأ أثناء تسجيل الطفل:", err);
      alert(`حدث خطأ أثناء التسجيل: ${err.message || "يرجى المحاولة لاحقاً"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 2️⃣ تسجيل طفل مسجل سابقاً في فوج إضافي جديد
  const handleEnrollChildInNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parentId || !selectedSchoolId) {
      alert("خطأ: يرجى التأكد من تسجيل الدخول واختيار المدرسة.");
      return;
    }

    if (!selectedChildObj || !enrollData.selectedGroupId) {
      alert("يرجى اختيار الابن والفوج المُراد التسجيل فيه.");
      return;
    }

    const selectedGroup = allGroups.find((g) => g.id === enrollData.selectedGroupId);
    if (selectedGroup && selectedGroup.student_capacity) {
      if ((selectedGroup.enrolledCount || 0) >= selectedGroup.student_capacity) {
        alert("عذراً، هذا الفوج مكتمل العدد تماماً، يرجى اختيار فوج آخر.");
        return;
      }
    }

    try {
      setSubmitting(true);

      const newEnrollment = {
        first_name: selectedChildObj.first_name,
        last_name: selectedChildObj.last_name,
        level: selectedChildObj.level,
        school_id: selectedSchoolId,
        group_id: enrollData.selectedGroupId,
        teacher_id: selectedGroup?.teacher_id || null,
        parent_id: parentId,
        status: "active",
      };

      const { error } = await supabase.from("students").insert([newEnrollment]);

      if (error) throw error;

      alert(`تم تسجيل الابن (${selectedChildObj.first_name}) في الفوج الجديد بنجاح!`);
      router.push("/parent");
    } catch (err: any) {
      console.error("خطأ أثناء تسجيل الطفل في الفوج الإضافي:", err);
      alert(`حدث خطأ أثناء التسجيل: ${err.message || "يرجى المحاولة لاحقاً"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 3️⃣ ربط طفل مسجل بالفعل
  const handleLinkExistingChild = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parentId || !linkData.selectedStudentId) {
      alert("يرجى اختيار الابن المُراد ربطه من القائمة.");
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("students")
        .update({ parent_id: parentId })
        .eq("id", linkData.selectedStudentId);

      if (error) throw error;

      alert("تمت عملية ربط حساب الابن بحسابكم بنجاح!");
      router.push("/parent");
    } catch (err: any) {
      console.error("خطأ أثناء ربط الطفل:", err);
      alert(`حدث خطأ أثناء الربط: ${err.message || "يرجى المحاولة لاحقاً"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const SidebarComponent = Sidebar as any;

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-xs font-bold text-slate-400">TALORA Student Registration</div>
        </header>

        <main className="p-4 md:p-8 flex-1 max-w-4xl mx-auto w-full space-y-6">
          {/* TABS التبديل بين الأقسام الثلاثة */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "new"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>➕</span>
              <span>تسجيل طفل جديد</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("enroll_group")}
              className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "enroll_group"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>📚</span>
              <span>تسجيل ابن في فوج إضافي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("existing")}
              className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "existing"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>🔗</span>
              <span>ربط حساب طفل مسجل</span>
            </button>
          </div>

          {/* 1️⃣ استمارة تسجيل طفل جديد */}
          {activeTab === "new" && (
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-base">
                    📝
                  </span>
                  <span>استمارة تسجيل ابن جديد</span>
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  اختر المدرسة أولاً، ثم املأ البيانات واقتنِ الفوج المناسب
                </p>
              </div>

              <form onSubmit={handleRegisterNewChild} className="space-y-5">
                {/* 🏫 حقل اختيار المدرسة */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اختر المدرسة / الأكاديمية *
                  </label>
                  <select
                    required
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full p-3 border border-emerald-500/80 bg-emerald-50/20 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
                  >
                    <option value="">-- اختر المدرسة لتصفية المستويات والأفواج --</option>
                    {userSchools.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        🏫 {sch.name} {sch.city ? `(${sch.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم الأول *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: محمد"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">اللقب *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: بن علي"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    />
                  </div>
                </div>

                {/* اختيار المستوى */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">المستوى الدراسي *</label>
                  <select
                    required
                    disabled={!selectedSchoolId}
                    value={formData.selectedLevel}
                    onChange={(e) => setFormData({ ...formData, selectedLevel: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition cursor-pointer disabled:opacity-50"
                  >
                    <option value="">
                      {selectedSchoolId
                        ? levels.length === 0
                          ? "لا توجد مستويات مسجلة بهذه المدرسة"
                          : "-- اختر المستوى المسجل بالمدرسة --"
                        : "-- يرجى اختيار المدرسة أولاً --"}
                    </option>
                    {levels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* اختيار المادة */}
                {formData.selectedLevel && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">المادة / التخصص *</label>
                    <select
                      required
                      value={formData.selectedSubject}
                      onChange={(e) => setFormData({ ...formData, selectedSubject: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition cursor-pointer"
                    >
                      <option value="">-- اختر المادة التابعة لهذا المستوى --</option>
                      {subjects.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* اختيار الفوج مع فحص المقاعد */}
                {formData.selectedSubject && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">الفوج الدراسي *</label>

                    {availableGroups.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                        لا توجد أفواج متاحة لهذه المادة حالياً بالمدرسة المختارة.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {availableGroups.map((g) => {
                          const cap = g.student_capacity || 0;
                          const enrolled = g.enrolledCount || 0;
                          const isFull = cap > 0 && enrolled >= cap;
                          const remaining = cap > 0 ? cap - enrolled : null;

                          return (
                            <button
                              key={g.id}
                              type="button"
                              disabled={isFull}
                              onClick={() => setFormData({ ...formData, selectedGroupId: g.id })}
                              className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between space-y-2 relative cursor-pointer ${
                                formData.selectedGroupId === g.id
                                  ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                                  : isFull
                                  ? "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed"
                                  : "border-slate-200 bg-white hover:border-emerald-300"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 text-sm">{g.name}</span>
                                {isFull ? (
                                  <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold">
                                    الفوج مكتمل
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                                    متاح
                                  </span>
                                )}
                              </div>

                              {remaining !== null && !isFull && (
                                <p className="text-[10px] font-bold text-emerald-600">
                                  متبقي {remaining} مقاعد من إجمالي {cap}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !formData.selectedGroupId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl text-xs md:text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {submitting ? "جاري الحفظ والتسجيل..." : "💾 إتمام تسجيل الابن"}
                </button>
              </form>
            </div>
          )}

          {/* 2️⃣ استمارة تسجيل ابن في فوج إضافي جديد */}
          {activeTab === "enroll_group" && (
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center text-base">
                    📚
                  </span>
                  <span>تسجيل ابن في فوج / مادة إضافية</span>
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  اختر الابن المسجل لديك مسبقاً، واقيده في مادة وفوج آخر من الأفواج المتاحة
                </p>
              </div>

              <form onSubmit={handleEnrollChildInNewGroup} className="space-y-5">
                {/* 🏫 حقل اختيار المدرسة */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اختر المدرسة / الأكاديمية *
                  </label>
                  <select
                    required
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full p-3 border border-blue-500/80 bg-blue-50/20 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                  >
                    <option value="">-- اختر المدرسة --</option>
                    {userSchools.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        🏫 {sch.name} {sch.city ? `(${sch.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 👦 1. اختيار الطفل المسجل للولي */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اختر الطفل المسجل لديك *
                  </label>
                  <select
                    required
                    disabled={!selectedSchoolId || myChildren.length === 0}
                    value={enrollData.selectedChildId}
                    onChange={(e) => setEnrollData({ ...enrollData, selectedChildId: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedSchoolId
                        ? "-- يرجى اختيار المدرسة أولاً --"
                        : myChildren.length === 0
                        ? "لا يوجد أبناء مسجلون باسمك بهذه المدرسة"
                        : "-- اختر الطفل --"}
                    </option>
                    {myChildren.map((child) => (
                      <option key={child.id} value={child.id}>
                        👦 {child.first_name} {child.last_name} ({child.level || "المستوى غير محدد"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 📖 2. اختيار المادة المتاحة لمستوى الطفل */}
                {enrollData.selectedChildId && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اختر المادة الإضافية لمستوى ({selectedChildObj?.level}) *
                    </label>
                    <select
                      required
                      value={enrollData.selectedSubject}
                      onChange={(e) => setEnrollData({ ...enrollData, selectedSubject: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer"
                    >
                      <option value="">-- اختر المادة --</option>
                      {enrollSubjects.map((sub) => (
                        <option key={sub} value={sub}>
                          📖 {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 👥 3. اختيار الفوج مع التحقق من المقاعد */}
                {enrollData.selectedSubject && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اختر الفوج الدراسي المتاح *
                    </label>

                    {enrollAvailableGroups.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl font-medium">
                        لا توجد أفواج إضافية متاحة لهذه المادة بهذا المستوى.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {enrollAvailableGroups.map((g) => {
                          const cap = g.student_capacity || 0;
                          const enrolled = g.enrolledCount || 0;
                          const isFull = cap > 0 && enrolled >= cap;
                          const remaining = cap > 0 ? cap - enrolled : null;

                          return (
                            <button
                              key={g.id}
                              type="button"
                              disabled={isFull}
                              onClick={() => setEnrollData({ ...enrollData, selectedGroupId: g.id })}
                              className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between space-y-2 relative cursor-pointer ${
                                enrollData.selectedGroupId === g.id
                                  ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20"
                                  : isFull
                                  ? "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed"
                                  : "border-slate-200 bg-white hover:border-blue-300"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 text-sm">{g.name}</span>
                                {isFull ? (
                                  <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold">
                                    الفوج مكتمل
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                                    متاح للتسجيل
                                  </span>
                                )}
                              </div>

                              {remaining !== null && !isFull && (
                                <p className="text-[10px] font-bold text-blue-600">
                                  متبقي {remaining} مقاعد من إجمالي {cap}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !enrollData.selectedGroupId}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 rounded-2xl text-xs md:text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {submitting ? "جاري إضافة الطفل للفوج..." : "➕ إتمام إضافة الابن للفوج الجديد"}
                </button>
              </form>
            </div>
          )}

          {/* 3️⃣ استمارة ربط ابن مسجل بالفعل */}
          {activeTab === "existing" && (
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center text-base">
                    🔗
                  </span>
                  <span>ربط حساب طفل مسجل بالأكاديمية</span>
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  اختر المدرسة والمستوى والمادة والفوج لاستعراض قائمة الطلاب غير المربوطين بولي أمر
                </p>
              </div>

              <form onSubmit={handleLinkExistingChild} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اختر المدرسة / الأكاديمية *
                  </label>
                  <select
                    required
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full p-3 border border-teal-500/80 bg-teal-50/20 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
                  >
                    <option value="">-- اختر المدرسة لاستعراض طلابها --</option>
                    {userSchools.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        🏫 {sch.name} {sch.city ? `(${sch.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر المستوى الدراسي *</label>
                  <select
                    required
                    disabled={!selectedSchoolId}
                    value={linkData.selectedLevel}
                    onChange={(e) => setLinkData({ ...linkData, selectedLevel: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition cursor-pointer disabled:opacity-50"
                  >
                    <option value="">
                      {selectedSchoolId
                        ? levels.length === 0
                          ? "لا توجد مستويات مسجلة بهذه المدرسة"
                          : "-- اختر المستوى --"
                        : "-- يرجى اختيار المدرسة أولاً --"}
                    </option>
                    {levels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {linkData.selectedLevel && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر المادة *</label>
                    <select
                      required
                      value={linkData.selectedSubject}
                      onChange={(e) => setLinkData({ ...linkData, selectedSubject: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition cursor-pointer"
                    >
                      <option value="">-- اختر المادة --</option>
                      {subjects.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkData.selectedSubject && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر الفوج *</label>
                    <select
                      required
                      value={linkData.selectedGroupId}
                      onChange={(e) => setLinkData({ ...linkData, selectedGroupId: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition cursor-pointer"
                    >
                      <option value="">-- اختر الفوج الدراسي --</option>
                      {availableGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkData.selectedGroupId && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      حدد الابن من القائمة التالية *
                    </label>

                    {unlinkedStudents.length === 0 ? (
                      <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center font-medium">
                        لا يوجد طلاب غير مربوطين بولي أمر في هذا الفوج حالياً.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {unlinkedStudents.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setLinkData({ ...linkData, selectedStudentId: st.id })}
                            className={`p-4 rounded-2xl border text-right transition flex items-center justify-between cursor-pointer ${
                              linkData.selectedStudentId === st.id
                                ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                                : "border-slate-200 bg-white hover:border-emerald-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">👦</span>
                              <div>
                                <p className="font-bold text-slate-900 text-sm">
                                  {st.first_name} {st.last_name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  مستوى: {st.level || "عام"}
                                </p>
                              </div>
                            </div>
                            {linkData.selectedStudentId === st.id && (
                              <span className="text-emerald-600 font-bold text-sm">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !linkData.selectedStudentId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl text-xs md:text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {submitting ? "جاري الربط..." : "🔗 تأكيد وربط الابن بالحساب"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// 2️⃣ مكون واجهة التحميل المؤقتة أثناء الـ Prerendering
function AddChildLoading() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-bold text-slate-500">جاري تحميل استمارة تسجيل الطالب...</p>
      </div>
    </div>
  );
}

// 3️⃣ التصدير الرئيسي المغلّف بـ Suspense
export default function AddChildPage() {
  return (
    <Suspense fallback={<AddChildLoading />}>
      <AddChildContent />
    </Suspense>
  );
}