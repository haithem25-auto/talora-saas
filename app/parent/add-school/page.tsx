"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface School {
  id: string;
  name: string;
  city: string;
  address: string;
  groups_count?: number;
}

interface GroupItem {
  id: string;
  name: string;
  level?: string;
  subject?: string;
  schedule?: string;
  monthly_price: number;
  monthly_sessions_count?: number;
  student_capacity?: number;
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

export default function AddSchoolPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // حالات البحث والتصفية
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("ALL");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // تفاصيل المدرسة المختارة
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [activeLevelTab, setActiveLevelTab] = useState<string>("ALL");

  // جلب قائمة المدن الفريدة المتاحة في النظام
  const fetchCities = async () => {
    try {
      const { data } = await supabase.from("schools").select("city");
      if (data) {
        const cities = Array.from(
          new Set(data.map((item) => item.city).filter(Boolean))
        ) as string[];
        setAvailableCities(cities);
      }
    } catch (err) {
      console.error("خطأ أثناء جلب قائمة المدن:", err);
    }
  };

  // 1. جلب المؤسسات باستخدام دالة البحث المرن (RPC) والمدينة
  const fetchSchools = async (queryText = searchQuery, city = selectedCity) => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase.rpc("search_schools", {
        search_term: queryText.trim(),
        selected_city: city === "ALL" ? "" : city,
      });

      if (error) throw error;
      setSchools((data as School[]) || []);
    } catch (err: unknown) {
      console.error("خطأ أثناء جلب المؤسسات:", err);
      setErrorMsg("حدث خطأ أثناء جلب قائمة المؤسسات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
    fetchSchools("", "ALL");
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSchools(searchQuery, selectedCity);
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    fetchSchools(searchQuery, city);
  };

  // 2. اختيار مؤسسة، ربط الولي بها تلقائياً في profiles، وجلب الأفواج
  const handleSelectSchool = async (school: School) => {
    setSelectedSchool(school);
    setLoadingDetails(true);

    try {
      // أ) تحديث بيانات الولي وتعيين المدرسة المختارة له
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({
            school_id: school.id,
            school_name: school.name,
            status: "active",
          })
          .eq("id", user.id);

        if (updateErr) {
          console.error("خطأ أثناء ربط الولي بالمؤسسة:", updateErr);
        }
      }

      // ب) جلب الأفواج المتاحة في المؤسسة
      const { data: groupsData, error: groupsErr } = await supabase
        .from("groups")
        .select(`
          id, 
          name, 
          level, 
          subject, 
          schedule, 
          monthly_price, 
          monthly_sessions_count, 
          student_capacity,
          profiles:teacher_id (first_name, last_name)
        `)
        .eq("school_id", school.id);

      if (groupsErr) throw groupsErr;

      const fetchedGroups = (groupsData as unknown as GroupItem[]) || [];
      setGroups(fetchedGroups);

      // استخراج المستويات والمواد الفريدة
      const uniqueLevels = Array.from(
        new Set(fetchedGroups.map((g) => g.level).filter(Boolean))
      ) as string[];
      const uniqueSubjects = Array.from(
        new Set(fetchedGroups.map((g) => g.subject).filter(Boolean))
      ) as string[];

      setLevels(uniqueLevels);
      setSubjects(uniqueSubjects);
      setActiveLevelTab("ALL");
    } catch (err) {
      console.error("خطأ في جلب تفاصيل الأفواج:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // تصفية الأفواج حسب المستوى المحدد في التبويب
  const filteredGroups =
    activeLevelTab === "ALL"
      ? groups
      : groups.filter((g) => g.level === activeLevelTab);

  return (
    <main dir="rtl" className="min-h-screen flex bg-slate-50 text-slate-800 font-sans relative">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-y-auto w-full">
        {/* الهيدر العلوي */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 border flex items-center justify-center text-xl"
          >
            ☰
          </button>
          <h1 className="text-base font-bold text-slate-900">البحث واختيار مؤسسة تعليمية</h1>
        </header>

        <section className="p-6 md:p-10 space-y-8 flex-1 w-full max-w-6xl mx-auto">
          {/* بنر الصفحة */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              إضافة مدرسة أو أكاديمية إلى حسابك 🏫
            </h2>
            <p className="text-xs md:text-sm text-slate-500">
              ابحث باسم الأكاديمية، تصفح المدارس حسب مدينتك، واطلع على الأسعار والأفواج المتاحة.
            </p>
          </div>

          {/* صندوق البحث والفلترة */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الأكاديمية (مثلاً: روضة الأجيال)..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-blue-600 focus:bg-white transition"
              />

              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-blue-600 transition font-medium"
              >
                <option value="ALL">📍 جميع المدن</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl text-xs transition shadow-md shadow-blue-600/20"
              >
                🔍 بحث
              </button>
            </form>

            {errorMsg && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
                ⚠️ {errorMsg}
              </p>
            )}
          </div>

          {/* قائمة المدارس */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              المؤسسات المتوفرة بالنظام ({schools.length})
            </h3>

            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs animate-pulse">
                جاري البحث في المؤسسات...
              </div>
            ) : schools.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 text-xs border border-slate-200">
                لم يتم العثور على أي مؤسسة تطابق معايير البحث.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {schools.map((school) => {
                  const isSelected = selectedSchool?.id === school.id;
                  return (
                    <div
                      key={school.id}
                      className={`bg-white rounded-3xl p-6 border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-sm ${
                        isSelected
                          ? "border-blue-600 ring-2 ring-blue-600/20 shadow-md"
                          : "border-slate-200/80 hover:border-blue-300"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-lg">
                            🏫
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold">
                            📍 {school.city || "المدينة غير محددة"}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-900">
                            {school.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            📍 {school.address || "العنوان غير مدخل"}
                          </p>
                        </div>
                        <div className="text-[11px] text-blue-600 bg-blue-50/60 px-3 py-1.5 rounded-xl font-bold w-fit">
                          👥 {school.groups_count || 0} أفواج متوفرة
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectSchool(school)}
                        className={`w-full py-2.5 rounded-2xl text-xs font-bold transition ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700"
                        }`}
                      >
                        {isSelected ? "✓ تم اختيار هذه المؤسسة" : "اختيار واستعراض التفاصيل"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* تفاصيل المدرسة والأفواج عند اختيار مدرسة */}
          {selectedSchool && (
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-blue-200 shadow-md space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    ✓ أنت الآن تنتمي لهذه المؤسسة
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    {selectedSchool.name} ({selectedSchool.city})
                  </h3>
                </div>

                <button
                  onClick={() => router.push(`/parent/add-child?school_id=${selectedSchool.id}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  ➕ الانتقال لتسجيل ابن في هذه المؤسسة
                </button>
              </div>

              {loadingDetails ? (
                <div className="text-center py-8 text-xs text-slate-400 animate-pulse">
                  جاري جلب تفاصيل الأفواج والأساتذة...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* تبويبات الفلترة حسب المستوى */}
                  {levels.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                        المستوى:
                      </span>
                      <button
                        onClick={() => setActiveLevelTab("ALL")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                          activeLevelTab === "ALL"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        الكل ({groups.length})
                      </button>
                      {levels.map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setActiveLevelTab(lvl)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                            activeLevelTab === lvl
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* بطاقات تفاصيل الأفواج */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGroups.length === 0 ? (
                      <p className="text-xs text-slate-400 col-span-full text-center py-6">
                        لا توجد أفواج مسجلة لهذا المستوى حالياً.
                      </p>
                    ) : (
                      filteredGroups.map((group) => {
                        const teacherFullName = `${group.profiles?.first_name || ""} ${
                          group.profiles?.last_name || ""
                        }`.trim();

                        return (
                          <div
                            key={group.id}
                            className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-slate-900 text-sm">
                                {group.name}
                              </h5>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                {group.monthly_price} دج / شهر
                              </span>
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-600">
                              {group.subject && (
                                <p className="flex items-center gap-1.5">
                                  📖 <span className="font-medium">{group.subject}</span>
                                </p>
                              )}
                              {teacherFullName && (
                                <p className="flex items-center gap-1.5">
                                  👨‍🏫 الأستاذ:{" "}
                                  <span className="font-bold text-slate-800">
                                    {teacherFullName}
                                  </span>
                                </p>
                              )}
                              {group.schedule && (
                                <p className="flex items-center gap-1.5">
                                  ⏰ التوقيت:{" "}
                                  <span className="font-medium text-slate-700">
                                    {group.schedule}
                                  </span>
                                </p>
                              )}
                              {group.monthly_sessions_count && (
                                <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  🗓️ {group.monthly_sessions_count} حصص شهرياً
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}