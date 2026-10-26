"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/app/components/dashboard/Sidebar";

interface NotificationItem {
  id: string;
  school_id?: string;
  user_id: string;
  student_id?: string;
  title: string;
  message: string;
  type: string;
  category: string;
  related_id?: string;
  related_table?: string;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  student_name?: string;
}

export default function NotificationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterReadStatus, setFilterReadStatus] = useState<string>("all");

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      // 1. جلب حساب المستخدم وتحديد المدرسة بشكل آمن وصارم
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let schoolId = "";

      // أ) البحث من البروفايل
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.school_id) {
        schoolId = profile.school_id;
      } else {
        // ب) إذا كان مالك مدرسة ولم يربط بالبروفايل، نبحث في جدول schools بواسطة owner_id
        const { data: ownedSchool } = await supabase
          .from("schools")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (ownedSchool?.id) {
          schoolId = ownedSchool.id;
        }
      }

      // ⛔ إذا لم يتم العثور على مدرسة مخصصة، نمنع الجلب تماماً لتفادي اختلاط البيانات
      if (!schoolId) {
        console.warn("تنبيه أمان: لم يتم التعرف على معرّف المدرسة للمستخدم الحالي.");
        setNotifications([]);
        setLoading(false);
        return;
      }

      // 2. جلب الإشعارات المخصصة لهذه المدرسة حصراً
      const { data: notifsData, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("خطأ أثناء جلب الإشعارات:", error);
        setNotifications([]);
        return;
      }

      if (notifsData && notifsData.length > 0) {
        // جلب أسماء الطلاب المرتبطين بالإشعارات داخل هذه المدرسة فقط
        const studentIds = Array.from(
          new Set(notifsData.map((n) => n.student_id).filter((id): id is string => Boolean(id)))
        );

        let studentsMap: Record<string, string> = {};
        if (studentIds.length > 0) {
          const { data: studentsData } = await supabase
            .from("students")
            .select("id, first_name, last_name")
            .in("id", studentIds)
            .eq("school_id", schoolId);

          if (studentsData) {
            studentsData.forEach((s) => {
              studentsMap[s.id] = `${s.first_name || ""} ${s.last_name || ""}`.trim();
            });
          }
        }

        const formattedNotifs: NotificationItem[] = notifsData.map((n) => ({
          ...n,
          student_name: n.student_id ? studentsMap[n.student_id] || "طالب مسجل" : undefined,
        }));

        setNotifications(formattedNotifs);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error("حدث خطأ أثناء معالجة الإشعارات:", err);
    } finally {
      setLoading(false);
    }
  };

  // تحديد الإشعار كـ "مقروء"
  const markAsRead = async (id: string) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .eq("id", id);

      if (!error) {
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_read: true, read_at: now } : item
          )
        );
      }
    } catch (err) {
      console.error("خطأ في تحديث حالة الإشعار:", err);
    }
  };

  // تحديد الكل كـ "مقروء"
  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length === 0) return;

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .in("id", unreadIds);

      if (!error) {
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, is_read: true, read_at: now }))
        );
      }
    } catch (err) {
      console.error("خطأ أثناء تحديد الكل كمقروء:", err);
    }
  };

  // تصفية الإشعارات
  const filteredNotifications = notifications.filter((n) => {
    const matchCategory = selectedCategory === "all" || n.category === selectedCategory;
    const matchRead =
      filterReadStatus === "all"
        ? true
        : filterReadStatus === "unread"
        ? !n.is_read
        : n.is_read;
    return matchCategory && matchRead;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // الحصول على أيقونة الفئة
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "students": return "🎓";
      case "attendance": return "📝";
      case "lessons": return "📖";
      case "payments": return "💳";
      case "announcements": return "📢";
      case "groups": return "👥";
      case "schedule": return "📅";
      case "requests": return "📩";
      case "system": return "⚙️";
      default: return "🔔";
    }
  };

  // تنسيق تاريخ الإشعار
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const SidebarComponent = Sidebar as any;

  return (
    <div className="flex min-h-screen bg-slate-50 text-right" dir="rtl">
      {/* خلفية معتمة للجوال */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* الشريط الجانبي */}
      <div className={`
        fixed inset-y-0 right-0 z-40 w-64 bg-slate-950 transform transition-transform duration-300 ease-in-out
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
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <span className="font-bold text-slate-800 text-sm">مركز الإشعارات</span>
        </div>

        {/* رأس الصفحة */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 border-slate-200/80 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">🔔 مركز الإشعارات والتنبيهات</h1>
              {unreadCount > 0 && (
                <span className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full shadow-xs">
                  {unreadCount} غير مقروء
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">عرض ومتابعة كافة التحديثات والأحداث اليومية في الأكاديمية</p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              ✓ تحديد الكل كمقروء
            </button>
          )}
        </div>

        {/* أدوات الفلترة والتصفية */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          
          {/* فلترة حسب الحالة (مقروء / غير مقروء) */}
          <div className="flex gap-2">
            {[
              { id: "all", label: "الكل" },
              { id: "unread", label: "غير المقروءة" },
              { id: "read", label: "المقروءة" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterReadStatus(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterReadStatus === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* فلترة حسب الفئة (Category) */}
          <div className="w-full md:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full md:w-56 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value="all">🌐 كافة التصنيفات</option>
              <option value="students">🎓 الطلاب (students)</option>
              <option value="attendance">📝 الحضور والغياب (attendance)</option>
              <option value="lessons">📖 الدروس (lessons)</option>
              <option value="payments">💳 المعاملات المالية (payments)</option>
              <option value="announcements">📢 الإعلانات (announcements)</option>
              <option value="groups">👥 الأفواج (groups)</option>
              <option value="schedule">📅 الجدول (schedule)</option>
              <option value="requests">📩 الطلبات (requests)</option>
              <option value="system">⚙️ النظام (system)</option>
              <option value="general">🔔 عام (general)</option>
            </select>
          </div>
        </div>

        {/* قائمة الإشعارات */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-slate-500 font-medium bg-white rounded-2xl border border-slate-100">
              جاري تحميل قائمة الإشعارات...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
              <div className="text-4xl mb-2">🔕</div>
              <h3 className="font-bold text-slate-700 text-sm">لا توجد إشعارات لعرضها</h3>
              <p className="text-slate-400 text-xs mt-1">لا توجد تنبيهات مطابقة للتصنيفات أو الفلاتر المختارة حالياً.</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center relative ${
                  !notif.is_read
                    ? "bg-emerald-50/40 border-emerald-200 shadow-2xs hover:bg-emerald-50/70"
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                {/* علامة غير مقروء */}
                {!notif.is_read && (
                  <span className="absolute top-4 left-4 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse md:static" />
                )}

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-xl shrink-0">
                    {getCategoryIcon(notif.category)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-900 text-sm">{notif.title}</h4>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {notif.category}
                      </span>
                      {notif.student_name && (
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100">
                          الطالب: {notif.student_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{formatDate(notif.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}