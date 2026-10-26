"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface StudentSubscription {
  id: string;
  student_id: string;
  billing_month: string;
  amount_due: number;
  amount_paid: number;
  status: "pending" | "partial" | "paid" | "overdue" | string;
  due_date?: string;
}

interface NotificationItem {
  id: string;
  school_id?: string;
  user_id: string;
  student_id?: string;
  title: string;
  message: string;
  type: string;
  category: "students" | "attendance" | "lessons" | "payments" | "announcements" | "groups" | "schedule" | "requests" | "system" | "general" | string;
  related_id?: string;
  related_table?: string;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export default function StudentAttendanceReportsPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();

  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, string>>({});

  // الفلاتر
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  useEffect(() => {
    if (roleLoading || role !== "parent") return;

    async function fetchDashboardData() {
      try {
        setLoading(true);

        // 1️⃣ جلب بيانات ولي الأمر الحالي
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push("/login");
          return;
        }

        // 2️⃣ جلب أبناء الولي الحالي حتمياً بناءً على parent_id = user.id
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id, first_name, last_name")
          .eq("parent_id", user.id);

        if (studentsError) {
          console.error("خطأ في جلب الأبناء:", studentsError);
        }

        const map: Record<string, string> = {};
        const studentIds: string[] = [];

        if (studentsData && studentsData.length > 0) {
          studentsData.forEach((student: any) => {
            const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "طالب بدون اسم";
            map[student.id] = fullName;
            studentIds.push(student.id);
          });
        }

        setStudentsMap(map);

        // 3️⃣ جلب اشتراكات أبناء هذا الولي فقط
        if (studentIds.length > 0) {
          const { data: subsData, error: subsError } = await supabase
            .from("student_subscriptions")
            .select("id, student_id, billing_month, amount_due, amount_paid, status, due_date")
            .in("student_id", studentIds)
            .order("billing_month", { ascending: false });

          if (subsError) {
            console.error("خطأ في جلب بيانات الاشتراكات:", subsError);
          } else if (subsData) {
            setSubscriptions(subsData as StudentSubscription[]);
          }
        }

        // 4️⃣ جلب الإشعارات الموجهة حكراً لـ user.id الخاص بهذا الولي (منع اختلاط البيانات)
        const { data: notifsData, error: notifsError } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id) // شرط أمان صارم: يمنع تسريب إشعارات الأولياء الآخرين
          .order("created_at", { ascending: false });

        if (notifsError) {
          console.error("خطأ في جلب الإشعارات:", notifsError);
        } else if (notifsData) {
          // جدار أمان إضافي: التأكد أن الإشعار إذا كان مرتبطة بطالب فهو ينتمي لأبناء هذا الولي
          const secureNotifs = notifsData.filter(
            (notif) => !notif.student_id || studentIds.includes(notif.student_id)
          );
          setNotifications(secureNotifs as NotificationItem[]);
        }

      } catch (err) {
        console.error("خطأ غير متوقع:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [role, roleLoading, router]);

  // دالة تحديد إشعار محدد كمقروء
  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingRead(notificationId);
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: nowIso })
        .eq("id", notificationId);

      if (error) {
        console.error("خطأ في تحديث حالة الإشعار:", error);
        return;
      }

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true, read_at: nowIso } : item
        )
      );
    } catch (err) {
      console.error("حدث خطأ:", err);
    } finally {
      setMarkingRead(null);
    }
  };

  // دالة تحديد جميع الإشعارات كمقروءة
  const markAllAsRead = async () => {
    const unreadIds = filteredNotifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      setLoading(true);
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: nowIso })
        .in("id", unreadIds);

      if (error) {
        console.error("خطأ أثناء تحديد الجميع كمقروء:", error);
        return;
      }

      setNotifications((prev) =>
        prev.map((item) =>
          unreadIds.includes(item.id) ? { ...item, is_read: true, read_at: nowIso } : item
        )
      );
    } catch (err) {
      console.error("حدث خطأ:", err);
    } finally {
      setLoading(false);
    }
  };

  // فلترة البيانات
  const filteredSubscriptions = useMemo(() => {
    if (selectedStudentFilter === "all") return subscriptions;
    return subscriptions.filter((sub) => sub.student_id === selectedStudentFilter);
  }, [subscriptions, selectedStudentFilter]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      const matchStudent =
        selectedStudentFilter === "all" ||
        !notif.student_id ||
        notif.student_id === selectedStudentFilter;

      const matchCategory =
        categoryFilter === "all" || notif.category === categoryFilter;

      return matchStudent && matchCategory;
    });
  }, [notifications, selectedStudentFilter, categoryFilter]);

  const unreadCount = useMemo(() => {
    return filteredNotifications.filter((n) => !n.is_read).length;
  }, [filteredNotifications]);

  const pendingOrOverdueSubscriptions = useMemo(() => {
    return filteredSubscriptions.filter(
      (sub) => sub.status === "pending" || sub.status === "partial" || sub.status === "overdue"
    );
  }, [filteredSubscriptions]);

  if (roleLoading || (role !== "parent" && !roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium text-sm">جاري التحقق من الصلاحيات والوصول...</p>
        </div>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen flex bg-slate-50 text-slate-800 font-sans relative">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-y-auto w-full">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl text-slate-700 hover:bg-slate-200 transition"
          >
            ☰
          </button>
          <h1 className="text-base font-bold text-slate-900">مركز الإشعارات وتقارير الأبناء</h1>
          <button
            onClick={() => router.push("/parent")}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold transition"
          >
            ← لوحة التحكم
          </button>
        </header>

        {/* Section Body */}
        <section className="p-6 md:p-8 space-y-6 flex-1 w-full max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-2">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>🔔</span> الإشعارات ومتابعة الحضور والاشتراكات
            </h2>
            <p className="text-xs text-slate-500">
              تابع كافة التنبيهات المباشرة وحالات التسديد المالي للاشتراكات لأبنائك.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-600 shrink-0">الابن:</span>
                <select
                  value={selectedStudentFilter}
                  onChange={(e) => setSelectedStudentFilter(e.target.value)}
                  className="bg-slate-50 text-xs font-bold text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-600 transition cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">جميع الأبناء</option>
                  {Object.entries(studentsMap).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-600 shrink-0">نوع الإشعار:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 text-xs font-bold text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-600 transition cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">جميع التصنيفات</option>
                  <option value="attendance">الغياب والحضور 📝</option>
                  <option value="payments">الاشتراكات والدفعات 💳</option>
                  <option value="announcements">الإعلانات العامة 📢</option>
                  <option value="schedule">مواعيد الحصص 📅</option>
                  <option value="general">إشعارات عامة 🔔</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-4 text-xs text-slate-500 font-medium w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
              <div className="flex items-center gap-3">
                <span>إشعارات غير مقروءة: <strong className="text-blue-600">{unreadCount}</strong></span>
                <span>•</span>
                <span>تنبيهات الدفع: <strong className="text-amber-600">{pendingOrOverdueSubscriptions.length}</strong></span>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-bold transition"
                >
                  ✓ تحديد الكل كمقروء
                </button>
              )}
            </div>
          </div>

          {/* 🔔 Notifications Section */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="text-base">💬</span> مركز الإشعارات والرسائل
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                إجمالي الإشعارات: {filteredNotifications.length}
              </span>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">جاري تحميل الإشعارات...</p>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="text-3xl">🔕</div>
                <p className="text-xs text-slate-400">لا توجد إشعارات مسجلة لهذه الفلاتر.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notif) => {
                  const studentName = notif.student_id ? studentsMap[notif.student_id] : null;

                  let icon = "🔔";
                  if (notif.category === "attendance") {
                    icon = "📝";
                  } else if (notif.category === "payments") {
                    icon = "💳";
                  } else if (notif.category === "announcements") {
                    icon = "📢";
                  }

                  return (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-2xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        !notif.is_read
                          ? "bg-blue-50/40 border-blue-200/80 shadow-sm"
                          : "bg-white border-slate-200/70"
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base shrink-0 shadow-xs">
                          {icon}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900">{notif.title}</h4>
                            {!notif.is_read && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                            )}
                            {studentName && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                                👦 {studentName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 dir-ltr text-right pt-1">
                            📅 {new Date(notif.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {!notif.is_read ? (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            disabled={markingRead === notif.id}
                            className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-bold transition disabled:opacity-50"
                          >
                            {markingRead === notif.id ? "جاري الحفظ..." : "تحديد كمقروء ✓"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                            تمت القراءة ✅
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 💳 Subscription Notifications Section */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="text-base">💳</span> حالة تسديد الاشتراكات الشهرية
              </h3>
              {pendingOrOverdueSubscriptions.length > 0 && (
                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse">
                  ⚠️ يوجد {pendingOrOverdueSubscriptions.length} اشتراك يتطلب الدفع
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-4 text-center">جاري التحقق من حالة الاشتراكات...</p>
            ) : filteredSubscriptions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">لا توجد سجلات اشتراكات مسجلة حالياً.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSubscriptions.map((sub) => {
                  const studentName = studentsMap[sub.student_id] || "طالب غير معروف";
                  const remaining = Number(sub.amount_due) - Number(sub.amount_paid);

                  let statusBadge = { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "مسدد بالكامل ✅" };
                  if (sub.status === "overdue") {
                    statusBadge = { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", label: "متأخر عن التسديد 🔴" };
                  } else if (sub.status === "partial") {
                    statusBadge = { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "مدفوع جزئياً 🟡" };
                  } else if (sub.status === "pending") {
                    statusBadge = { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "في انتظار التسديد 🔵" };
                  }

                  return (
                    <div
                      key={sub.id}
                      className={`p-4 rounded-2xl border ${statusBadge.bg} ${statusBadge.border} transition flex flex-col justify-between space-y-3`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-xs shadow-sm font-bold">
                            👦
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{studentName}</h4>
                            <p className="text-[10px] text-slate-500">شهر: {sub.billing_month}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadge.text} bg-white`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center bg-white/80 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px]">المبلغ المطلوب</span>
                          <span className="font-bold text-slate-800">{sub.amount_due} د.ج</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">المدفوع</span>
                          <span className="font-bold text-emerald-600">{sub.amount_paid} د.ج</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">المتبقي</span>
                          <span className={`font-bold ${remaining > 0 ? "text-rose-600" : "text-slate-700"}`}>
                            {remaining > 0 ? `${remaining} د.ج` : "0 د.ج"}
                          </span>
                        </div>
                      </div>

                      {sub.due_date && remaining > 0 && (
                        <p className="text-[10px] text-slate-500 text-left dir-ltr">
                          📅 آخر أجل للتسديد: <span className="font-bold text-slate-700">{sub.due_date}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}