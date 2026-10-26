"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import Sidebar from "@/app/components/dashboard/Sidebar"; 

// استخدام string بدلاً من UUID الخاص بـ Node.js للحفاظ على توافقية العميل (Client-side)
type UUID = string;

interface Student {
  id: UUID;
  first_name: string;
  last_name: string;
  level?: string;
  school_id?: UUID;
  group_id?: UUID;
}

interface Group {
  id: UUID;
  name: string;
  school_id?: UUID;
  subject?: string;
  monthly_sessions_count?: number;
}

interface Subscription {
  id: UUID;
  student_id: UUID;
  school_id: UUID;
  group_id?: UUID;
  billing_month: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date?: string;
  created_at: string;
}

export default function StudentSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("school_owner");
  const [schoolId, setSchoolId] = useState<string>("");

  // البحث والبحث عن التلميذ
  const [firstNameSearch, setFirstNameSearch] = useState("");
  const [lastNameSearch, setLastNameSearch] = useState("");
  const [searchedStudents, setSearchedStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentGroup, setStudentGroup] = useState<Group | null>(null);

  // بيانات اشتراك التلميذ المختار
  const [attendedSessionsCount, setAttendedSessionsCount] = useState<number>(0);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  
  // نموذج تأكيد الدفع
  const [paymentAmount, setPaymentAmount] = useState<number | string>("");
  const [billingMonth, setBillingMonth] = useState<string>(
    new Date().toISOString().substring(0, 7) // مثال: "2026-10"
  );
  const [submitting, setSubmitting] = useState(false);

  // سجل الاشتراكات الأخيرة بالمدرسة
  const [recentSubscriptions, setRecentSubscriptions] = useState<any[]>([]);

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

      if (currentSchoolId) {
        await fetchRecentSubscriptions(currentSchoolId);
      }
    } catch (error) {
      console.error("خطأ أثناء جلب البيانات الأساسية:", error);
    } finally {
      setLoading(false);
    }
  };

  // جلب سجل آخر الاشتراكات المسجلة في المدرسة
  const fetchRecentSubscriptions = async (sId: string) => {
    try {
      const { data, error } = await supabase
        .from("student_subscriptions")
        .select("*, students(first_name, last_name), groups(name)")
        .eq("school_id", sId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setRecentSubscriptions(data);
      }
    } catch (err) {
      console.error("خطأ في جلب السجلات الأخيرة:", err);
    }
  };

  // البحث عن التلميذ حسب الاسم واللقب
  const handleSearchStudents = async () => {
    if (!firstNameSearch.trim() && !lastNameSearch.trim()) {
      alert("يرجى كتابة الاسم أو اللقب للبحث.");
      return;
    }

    try {
      setLoading(true);
      let query = supabase.from("students").select("*");

      if (schoolId) {
        query = query.eq("school_id", schoolId);
      }

      if (firstNameSearch.trim()) {
        query = query.ilike("first_name", `%${firstNameSearch.trim()}%`);
      }
      if (lastNameSearch.trim()) {
        query = query.ilike("last_name", `%${lastNameSearch.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSearchedStudents(data || []);
      setSelectedStudent(null);
      setStudentGroup(null);
      setCurrentSubscription(null);
      setAttendedSessionsCount(0);
    } catch (err: any) {
      console.error("خطأ أثناء البحث عن الطلاب:", err);
      alert("حدث خطأ أثناء البحث: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // اختيار تلميذ محدد لعرض بيانات الحضور والاشتراك
  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setLoading(true);

    try {
      // 1. جلب بيانات الفوج المعني بالتلميذ
      if (student.group_id) {
        const { data: gData } = await supabase
          .from("groups")
          .select("*")
          .eq("id", student.group_id)
          .maybeSingle();
        setStudentGroup(gData || null);
      } else {
        setStudentGroup(null);
      }

      // 2. جلب عدد الحصص التي حضرها التلميذ في هذا الشهر من جدول attendance
      const startDate = `${billingMonth}-01`;
      const endDate = `${billingMonth}-31`;

      const { data: attendanceData, error: attError } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", student.id)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      if (!attError && attendanceData) {
        setAttendedSessionsCount(attendanceData.length);
      } else {
        setAttendedSessionsCount(0);
      }

      // 3. جلب الاشتراك الخاص بهذا الشهر للتلميذ من جدول student_subscriptions
      const { data: subData } = await supabase
        .from("student_subscriptions")
        .select("*")
        .eq("student_id", student.id)
        .eq("billing_month", billingMonth)
        .maybeSingle();

      if (subData) {
        setCurrentSubscription(subData);
        setPaymentAmount(subData.amount_due || "");
      } else {
        setCurrentSubscription(null);
        setPaymentAmount(3000); // مبلغ افتراضي في حال عدم وجود اشتراك مسبق
      }
    } catch (err) {
      console.error("خطأ أثناء جلب تفاصيل التلميذ:", err);
    } finally {
      setLoading(false);
    }
  };

  // تأكيد الدفع والتجديد
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert("يرجى اختيار تلميذ أولاً.");
      return;
    }

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("يرجى إدخال مبلغ دفع صحيح.");
      return;
    }

    try {
      setSubmitting(true);

      const paidVal = Number(paymentAmount);

      if (currentSubscription) {
        // تحديث سجل الاشتراك الحالي
        const { error } = await supabase
          .from("student_subscriptions")
          .update({
            amount_paid: paidVal,
            status: paidVal >= currentSubscription.amount_due ? "paid" : "partially_paid",
          })
          .eq("id", currentSubscription.id);

        if (error) throw error;
      } else {
        // إنشاء سجل اشتراك جديد
        const { error } = await supabase.from("student_subscriptions").insert([
          {
            school_id: schoolId || studentGroup?.school_id || null,
            student_id: selectedStudent.id,
            group_id: selectedStudent.group_id || null,
            billing_month: billingMonth,
            amount_due: paidVal,
            amount_paid: paidVal,
            status: "paid",
          },
        ]);

        if (error) throw error;
      }

      alert("تم تأكيد دفع الاشتراك بنجاح! ✅");

      if (schoolId) {
        await fetchRecentSubscriptions(schoolId);
      }
      await handleSelectStudent(selectedStudent);
    } catch (err: any) {
      console.error("خطأ أثناء تأكيد الاشتراك:", err);
      alert("حدث خطأ أثناء حفظ الاشتراك: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const SidebarComponent = Sidebar as any;

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
          <span className="font-semibold text-slate-800 text-sm">تأكيد اشتراكات الطلاب</span>
        </div>

        {/* رأس الصفحة */}
        <div className="border-b pb-5 border-slate-200/60">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">إدارة وتأكيد اشتراكات التلاميذ</h1>
          <p className="text-sm text-slate-500 mt-1">
            البحث عن التلميذ بالاسم واللقب، الاطلاع على عدد الحصص الحاضرة، وتأكيد دفع الاشتراك الشهري
          </p>
        </div>

        {/* قسم البحث عن التلميذ */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
          <h2 className="text-base font-bold text-slate-800">🔍 البحث عن التلميذ</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم</label>
              <input
                type="text"
                placeholder="ادخل اسم التلميذ..."
                value={firstNameSearch}
                onChange={(e) => setFirstNameSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اللقب</label>
              <input
                type="text"
                placeholder="ادخل لقب التلميذ..."
                value={lastNameSearch}
                onChange={(e) => setLastNameSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearchStudents}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
              >
                بحث عن التلميذ
              </button>
            </div>
          </div>

          {/* قائمة نتائج البحث */}
          {searchedStudents.length > 0 && (
            <div className="mt-4 border-t pt-3 border-slate-100">
              <span className="text-xs font-bold text-slate-500 block mb-2">اختر التلميذ من القائمة:</span>
              <div className="flex flex-wrap gap-2">
                {searchedStudents.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => handleSelectStudent(st)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedStudent?.id === st.id
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    🎓 {st.first_name} {st.last_name} {st.level ? `(${st.level})` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* قسم تفاصيل الاشتراك وتأكيد الدفع */}
        {selectedStudent && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* بطاقة معلومات التلميذ والحضور */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-3 border-slate-100">
                بطاقة التلميذ
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">اسم التلميذ الكامل:</span>
                  <span className="font-bold text-slate-800 text-base">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">المستوى الدراسي:</span>
                  <span className="font-semibold text-slate-700">
                    {selectedStudent.level || "غير محدد"}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">الفوج المسجل فيه:</span>
                  <span className="font-semibold text-emerald-700">
                    {studentGroup ? studentGroup.name : "غير مسجل بفرقة"}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400 block">الشهر المالي الحالي:</span>
                  <input
                    type="month"
                    value={billingMonth}
                    onChange={(e) => {
                      setBillingMonth(e.target.value);
                      handleSelectStudent(selectedStudent);
                    }}
                    className="mt-1 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 w-full outline-none"
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                  <span className="text-xs font-bold text-emerald-800 block mb-1">
                    عدد الحصص الحاضرة هذا الشهر
                  </span>
                  <span className="text-3xl font-black text-emerald-600">
                    {attendedSessionsCount}
                  </span>
                  <span className="text-xs text-emerald-600 block mt-1">
                    من أصل {studentGroup?.monthly_sessions_count || 8} حصص مقترحة
                  </span>
                </div>
              </div>
            </div>

            {/* نموذج تأكيد الاشتراك والتسديد */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-3 border-slate-100">
                تأكيد الدفع والتجديد
              </h3>

              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      المبلغ المطلوب (د.ج)
                    </label>
                    <input
                      type="number"
                      disabled
                      value={currentSubscription?.amount_due || paymentAmount}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      المبلغ المدفوع فعلياً (د.ج) *
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="3000"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* حالة الاشتراك الحالية */}
                <div className="p-4 rounded-xl border bg-slate-50 border-slate-200/80 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700">حالة الاشتراك لهذا الشهر:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    currentSubscription?.status === "paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {currentSubscription?.status === "paid" ? "مدفوع بالكامل ✅" : "غير مدفوع / مدفوع جزئياً ⏳"}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-md text-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "جاري التأكيد والحفظ..." : "تأكيد واستلام المبلغ"}
                </button>
              </form>
            </div>

          </div>
        )}

        {/* سجل الدفعات الأخيرة */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden mt-6">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-800 text-sm">
            📋 سجل أحدث اشتراكات التلاميذ المسجلة
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200/60">
                  <th className="p-3">التلميذ</th>
                  <th className="p-3">الفوج</th>
                  <th className="p-3">الشهر</th>
                  <th className="p-3">المبلغ المدفوع</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {recentSubscriptions.length > 0 ? (
                  recentSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        {sub.students?.first_name} {sub.students?.last_name}
                      </td>
                      <td className="p-3">{sub.groups?.name || "غير محدد"}</td>
                      <td className="p-3 font-semibold">{sub.billing_month}</td>
                      <td className="p-3 font-black text-emerald-600">
                        {(sub.amount_paid || 0).toLocaleString()} د.ج
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {sub.status === "paid" ? "مكتمل" : "معلق"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      لا توجد اشتراكات مسجلة مؤخراً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}