"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import Image from "next/image";
import { useUserRole } from "@/hooks/useUserRole"; 
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import QRCode from "qrcode"; 
import { supabase } from "@/lib/supabase";
import Sidebar from "../components/dashboard/Sidebar";

interface ChartDayData {
  day: string;
  حضور: number;
}

interface PendingProfileItem {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: "teacher" | string;
  created_at: string;
}

interface ParentProfileItem {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { role, loading: roleLoading, error: roleError } = useUserRole();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [school, setSchool] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string>(""); 

  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    halaqat: 0,
  });

  const [chartData, setChartData] = useState<ChartDayData[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfileItem[]>([]);
  const [parentsList, setParentsList] = useState<ParentProfileItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const ALLOWED_ROLES = ["school_owner", "school_admin", "staff"];

  // التحقق من الصلاحيات والتوجيه
  useEffect(() => {
    if (!roleLoading) {
      if (!role || !ALLOWED_ROLES.includes(role) || roleError) {
        router.push("/login");
      }
    }
  }, [role, roleLoading, roleError, router]);

  const refreshLists = async (schoolId: string) => {
    const cleanId = String(schoolId).trim();
    if (!cleanId || cleanId.length !== 36 || cleanId === "demo-id") {
      setPendingProfiles([]);
      setParentsList([]);
      return;
    }
    
    try {
      // 1. جلب طلبات الأساتذة المعلقة الخاصة بهذه الأكاديمية حصراً
      const { data: reqData, error: reqErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, role, created_at, status")
        .eq("status", "pending")
        .eq("role", "teacher")
        .eq("school_id", cleanId);
      
      if (!reqErr && reqData) {
        const formattedRequests = reqData.map((p: any) => ({
          id: p.id,
          full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email,
          email: p.email,
          phone: p.phone || p.phone_number || "غير متوفر",
          role: p.role,
          created_at: p.created_at,
        }));
        setPendingProfiles(formattedRequests as PendingProfileItem[]);
      }

      // 2. جلب حسابات أولياء الأمور الخاصة بهذه الأكاديمية حصراً
      const { data: parentsData, error: parentsErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, created_at, status")
        .eq("role", "parent")
        .eq("school_id", cleanId)
        .order("created_at", { ascending: false });

      if (!parentsErr && parentsData) {
        const formattedParents = parentsData.map((p: any) => ({
          id: p.id,
          full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email,
          email: p.email,
          phone: p.phone || p.phone_number || "غير متوفر",
          status: p.status || "active",
          created_at: p.created_at,
        }));
        setParentsList(formattedParents as ParentProfileItem[]);
      }

    } catch (err) {
      console.error("خطأ في جلب القوائم:", err);
    }
  };

  useEffect(() => {
    if (roleLoading || !role || !ALLOWED_ROLES.includes(role)) return;

    async function loadDashboardData() {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // جلب معرف الأكاديمية الخاص بالمسؤول الحالي
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("school_id, school_name")
          .eq("id", user.id)
          .maybeSingle();

        const rawSchoolId = adminProfile?.school_id || "";
        const currentSchoolId = String(rawSchoolId).trim();
        const currentSchoolName = adminProfile?.school_name || "المؤسسة التعليمية";
        let schoolSlug = "default-school";

        const isUuidValid = currentSchoolId && currentSchoolId.length === 36 && currentSchoolId !== "demo-id";

        if (isUuidValid) {
          const { data: schoolTableData } = await supabase
            .from("schools")
            .select("slug, qr_code")
            .eq("id", currentSchoolId)
            .maybeSingle();

          if (schoolTableData?.slug || schoolTableData?.qr_code) {
            schoolSlug = schoolTableData.slug || schoolTableData.qr_code;
          }
          setSchool({ id: currentSchoolId, name: currentSchoolName, slug: schoolSlug });

          // توليد QR Code
          const siteUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
          const targetPublicUrl = `${siteUrl}/schools/${schoolSlug}`;
          try {
            const generatedQrDataUrl = await QRCode.toDataURL(targetPublicUrl, {
              width: 300,
              margin: 2,
              color: { dark: "#2563EB", light: "#FFFFFF" }
            });
            setQrImageUrl(generatedQrDataUrl);
          } catch (qrErr) {
            console.error("خطأ أثناء توليد الـ QR Code:", qrErr);
          }

          // جلب إحصائيات الأكاديمية حصراً بشرط صارم على school_id
          const [studentsRes, teachersRes, groupsRes] = await Promise.all([
            supabase
              .from("students")
              .select("id", { count: "exact", head: true })
              .eq("school_id", currentSchoolId),
            supabase
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .eq("role", "teacher")
              .eq("status", "active")
              .eq("school_id", currentSchoolId),
            supabase
              .from("groups")
              .select("id", { count: "exact", head: true })
              .eq("school_id", currentSchoolId)
          ]);

          setStats({
            students: studentsRes.count || 0,
            teachers: teachersRes.count || 0,
            halaqat: groupsRes.count || 0,
          });

          await refreshLists(currentSchoolId);

          // حساب نسبة الحضور الحقيقية الخاصة بالأكاديمية الحالية فقط
          const daysNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
          
          const { data: attendanceLogs } = await supabase
            .from("attendance")
            .select("date, status")
            .eq("school_id", currentSchoolId);

          if (attendanceLogs && attendanceLogs.length > 0) {
            const statsByDay: Record<number, { total: number; present: number }> = {
              0: { total: 0, present: 0 },
              1: { total: 0, present: 0 },
              2: { total: 0, present: 0 },
              3: { total: 0, present: 0 },
              4: { total: 0, present: 0 },
              5: { total: 0, present: 0 },
              6: { total: 0, present: 0 },
            };

            attendanceLogs.forEach((log: any) => {
              if (log.date) {
                const dayIdx = new Date(log.date).getDay();
                statsByDay[dayIdx].total += 1;
                if (log.status === "present" || log.status === "حاضر") {
                  statsByDay[dayIdx].present += 1;
                }
              }
            });

            const resolvedChartData = daysNames.map((dayName, idx) => {
              const dayStat = statsByDay[idx];
              const rate = dayStat.total > 0 ? Math.round((dayStat.present / dayStat.total) * 100) : 0;
              return {
                day: dayName,
                حضور: rate,
              };
            });
            setChartData(resolvedChartData);
          } else {
            setChartData(daysNames.map((dayName) => ({ day: dayName, حضور: 0 })));
          }
        } else {
          // إذا لم يملك المستخدم معرف أكاديمية صالح، يتم تفريغ البيانات وعدم الاستعلام إطلاقاً
          setSchool({ id: "demo-id", name: "المؤسسة التعليمية الافتراضية", slug: "default-school" });
          setStats({ students: 0, teachers: 0, halaqat: 0 });
          setChartData([]);
          setPendingProfiles([]);
          setParentsList([]);
        }

      } catch (err) {
        console.error("خطأ في جلب بيانات لوحة التحكم:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [role, roleLoading]);

  const handleAcceptProfile = async (id: string) => {
    if (!school || school.id === "demo-id") return;
    try {
      setActionLoading(id);
      
      const { error } = await supabase
        .from("profiles")
        .update({ 
          status: "active",
          school_id: school.id,
          school_name: school.name
        })
        .eq("id", id)
        .eq("school_id", school.id); // تأكيد عدم التعديل خارج نطاق الأكاديمية

      if (error) throw error;
      alert("✅ تم تفعيل وقبول حساب المعلم بنجاح!");
      await refreshLists(school.id);
    } catch (err: unknown) {
      alert(`فشل قبول الحساب: ${err instanceof Error ? err.message : "حدث خطأ غير متوقع"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectProfile = async (id: string) => {
    if (!school || school.id === "demo-id") return;
    if (!confirm("هل أنت متأكد من رفض هذا الطلب وحذفه نهائياً من النظام؟")) return;
    
    try {
      setActionLoading(id);
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id)
        .eq("school_id", school.id); // تأكيد عدم الحذف خارج نطاق الأكاديمية

      if (error) throw error;
      alert("🗑️ تم حذف وإلغاء طلب الحساب المعلق بنجاح.");
      await refreshLists(school.id);
    } catch (err: unknown) {
      alert(`فشل حذف الحساب: ${err instanceof Error ? err.message : "حدث خطأ غير متوقع"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const downloadQrCode = () => {
    if (!qrImageUrl) return;
    const downloadLink = document.createElement("a");
    downloadLink.href = qrImageUrl;
    downloadLink.download = `TALORA_QR_${school?.slug || "center"}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-800">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-bold text-sm">جاري التحقق والوصول للوحة التحكم...</p>
        </div>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen flex bg-slate-50/50 text-slate-800 font-sans relative">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-y-auto w-full">
        
        {/* Top Navbar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-10 py-4 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl text-slate-700 hover:bg-slate-200 transition"
          >
            ☰
          </button>
          
          <div className="hidden md:flex items-center bg-slate-100/70 border border-slate-200 rounded-2xl px-4 py-2.5 w-64 lg:w-96 focus-within:border-blue-600 focus-within:bg-white transition-all">
            <span className="text-slate-400 ml-2 text-sm">🔍</span>
            <input type="text" placeholder="ابحث عن طالب، أستاذ، أو فوج..." className="bg-transparent text-xs w-full outline-none text-slate-800 placeholder-slate-400" />
          </div>

          <div className="flex items-center gap-3 mr-auto">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shadow-sm">
              T
            </div>
            <div className="block text-right">
              <h4 className="text-xs font-bold text-slate-900">إدارة تالورا</h4>
              {loading ? <div className="w-16 h-3 bg-slate-200 animate-pulse rounded mt-1" /> : <p className="text-[11px] text-blue-600 font-semibold">{school?.name}</p>}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <section className="p-6 md:p-10 space-y-8 flex-1 w-full max-w-7xl mx-auto">
          
          {/* Welcome Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-blue-700 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-blue-600/10 relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="min-w-0 z-10 space-y-1">
              <h2 className="text-2xl font-black tracking-tight">مرحباً بك في لوحة القيادة 👋</h2>
              <p className="text-xs text-blue-100 font-medium">مؤسسة {school?.name || "تالورا التعليمية"}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3 text-right self-start sm:self-auto z-10">
              <span className="text-lg">📅</span>
              <div className="text-xs min-w-0">
                <p className="text-[10px] text-blue-200 font-semibold">تاريخ اليوم</p>
                <p className="font-bold truncate mt-0.5">{new Date().toLocaleDateString("ar-DZ", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { title: "إجمالي الطلاب المسجلين", value: stats.students, sub: "طالب نشط بالمؤسسة", icon: "👥", color: "text-blue-600 bg-blue-50 border-blue-100" },
              { title: "الأفواج والمجموعات", value: stats.halaqat, sub: "فوج تعليمي متوفر", icon: "📚", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
              { title: "الطاقم التعليمي", value: stats.teachers, sub: "أستاذ ومعلم معتمد", icon: "🎓", color: "text-purple-600 bg-purple-50 border-purple-100" },
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 truncate">{item.title}</p>
                  {loading ? <div className="w-16 h-7 bg-slate-200 animate-pulse rounded my-1" /> : <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{item.value}</h3>}
                  <p className="text-[11px] text-slate-400 truncate">{item.sub}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl border ${item.color} flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>
                  {item.icon}
                </div>
              </div>
            ))}
          </div>

          {/* Charts & QR Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart Card */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  معدل التفاعل والحضور الأسبوعي الفعلية
                </h3>
              </div>
              <div className="w-full h-[250px]">
                {loading ? (
                  <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value) => [`${value}%`, "نسبة الحضور الفعلية"]} 
                      />
                      <Line type="monotone" dataKey="حضور" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* QR Code Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col items-center justify-between text-center">
              <div className="w-full space-y-2">
                <h3 className="text-sm font-bold text-slate-900">رمز الانضمام السريع (Talora QR)</h3>
                <p className="text-xs text-slate-500 leading-relaxed">شارِك الرمز ليتمكن أولياء الأمور والأساتذة من التسجيل في مؤسستك مباشرة.</p>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-center mx-auto w-44 h-44 shadow-inner mt-4">
                  {loading || !qrImageUrl ? (
                    <div className="w-full h-full bg-slate-200 animate-pulse rounded-xl" />
                  ) : (
                    <Image
                      src={qrImageUrl} 
                      alt="رابط الانضمام لتالورا" 
                      width={170}
                      height={170}
                      unoptimized
                      className="w-full h-full object-contain rounded-lg"
                    />
                  )}
                </div>
              </div>

              <button 
                onClick={downloadQrCode}
                disabled={loading || !qrImageUrl}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl text-xs transition duration-300 flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-blue-600/20"
              >
                📥 تحميل رمز QR عالي الدقة
              </button>
            </div>

          </div>

          {/* Pending Teachers Requests Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                ⏳ طلبات انضمام الأساتذة المعلقة ({pendingProfiles.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              {pendingProfiles.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">لا توجد أي طلبات انضمام معلقة للأساتذة حالياً.</p>
              ) : (
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="pb-3 font-bold">الاسم الكامل</th>
                      <th className="pb-3 font-bold">البريد الإلكتروني</th>
                      <th className="pb-3 font-bold">رقم الهاتف</th>
                      <th className="pb-3 font-bold">نوع الحساب</th>
                      <th className="pb-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingProfiles.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 font-bold text-slate-800">{item.full_name}</td>
                        <td className="py-4 text-slate-500 dir-ltr text-right">{item.email}</td>
                        <td className="py-4 text-slate-600 dir-ltr text-right font-medium">{item.phone}</td>
                        <td className="py-4">
                          <span className="px-3 py-1 rounded-full font-bold text-[10px] bg-blue-50 text-blue-600 border border-blue-100">
                            👨‍🏫 طلب أستاذ
                          </span>
                        </td>
                        <td className="py-4 text-center flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleAcceptProfile(item.id)}
                            disabled={actionLoading !== null}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl text-[11px] font-bold shadow-sm transition disabled:opacity-40"
                          >
                            {actionLoading === item.id ? "..." : "قبول"}
                          </button>
                          <button
                            onClick={() => handleRejectProfile(item.id)}
                            disabled={actionLoading !== null}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 px-4 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
                          >
                            رفض
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Parents Information Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                👨‍👩‍👦 سجل أولياء الأمور المسجلين بالمؤسسة ({parentsList.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              {parentsList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">لا يوجد أولياء أمور مسجلين حالياً.</p>
              ) : (
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="pb-3 font-bold">الاسم الكامل</th>
                      <th className="pb-3 font-bold">البريد الإلكتروني</th>
                      <th className="pb-3 font-bold">رقم الهاتف</th>
                      <th className="pb-3 font-bold">تاريخ التسجيل</th>
                      <th className="pb-3 font-bold text-center">حالة الحساب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parentsList.map((parent) => (
                      <tr key={parent.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 font-bold text-slate-800">{parent.full_name}</td>
                        <td className="py-4 text-slate-500 dir-ltr text-right">{parent.email}</td>
                        <td className="py-4 text-slate-600 dir-ltr text-right font-medium">{parent.phone}</td>
                        <td className="py-4 text-slate-400 text-[11px]">
                          {parent.created_at ? new Date(parent.created_at).toLocaleDateString("ar-DZ") : "-"}
                        </td>
                        <td className="py-4 text-center">
                          <span className="px-3 py-1 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100">
                            مفعل تلقائياً ✅
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}