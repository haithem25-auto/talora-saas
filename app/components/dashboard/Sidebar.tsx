"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type UserRole = "school_owner" | "teacher" | "parent" | "independent_teacher";

const navigationConfig: Record<UserRole, NavItem[]> = {
  school_owner: [
    { label: "الصفحة الرئيسية", href: "/dashboard", icon: "🏠" },
    { label: "الطلبة", href: "/dashboard/students", icon: "🎓" },
    { label: "إحصائيات الطلاب", href: "/dashboard/student-stats", icon: "📊" },
    { label: "اشتراكات التلاميذ", href: "/dashboard/subscriptions", icon: "💰" },
    { label: "الأفواج والدروس", href: "/dashboard/groups", icon: "👥" },
    { label: "الإشعارات", href: "/dashboard/notifications", icon: "🔔" },
    { label: "المعاملات المالية", href: "/dashboard/finance", icon: "💳" },
    { label: "الإعدادات", href: "/dashboard/settings", icon: "⚙️" },
  ],
  independent_teacher: [
    { label: "الصفحة الرئيسية", href: "/freelancetech-dashboard", icon: "🏠" },
    { label: "تسجيل الحضور", href: "/freelancetech-dashboard/attendance", icon: "📝" },
    { label: "الطلبة", href: "/freelancetech-dashboard/students", icon: "🎓" },
    { label: "الأفواج والدروس", href: "/freelancetech-dashboard/groups", icon: "👥" },
    { label: "الإشعارات", href: "/freelancetech-dashboard/notifications", icon: "🔔" },
    { label: "المعاملات المالية", href: "/freelancetech-dashboard/finance", icon: "💳" },
    { label: "الإعدادات", href: "/freelancetech-dashboard/settings", icon: "⚙️" },
  ],
  teacher: [
    { label: "الصفحة الرئيسية", href: "/teacher", icon: "🏠" },
    { label: "تسجيل الحضور", href: "/teacher/attendance", icon: "📝" },
    { label: "الأفواج والدروس", href: "/teacher/groups", icon: "👥" },
    { label: "إشعارات الغياب", href: "/teacher/notifications", icon: "🔔" },
  ],
  parent: [
    { label: "الصفحة الرئيسية", href: "/parent", icon: "🏠" },
    { label: "إضافة ابن", href: "/parent/add-child", icon: "👶" },
    { label: "إضافة مدرسة", href: "/parent/add-school", icon: "🏫" },
    
    { label: "الإشعارات", href: "/parent/notifications", icon: "🔔" },
  ],
};

const roleBadgeLabels: Record<UserRole, string> = {
  school_owner: "إدارة المؤسسة",
  independent_teacher: "أستاذ مستقل",
  teacher: "أستاذ محاضر",
  parent: "ولي أمر",
};

// مسارات الصفحة الرئيسية المخصصة لكل دور عند الضغط على الشعار
const homeRoutes: Record<UserRole, string> = {
  school_owner: "/dashboard",
  independent_teacher: "/freelancetech-dashboard",
  teacher: "/teacher",
  parent: "/parent",
};

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading } = useUserRole();

  // تنظيف الرتبة والتأكد من ملاءمتها للأدوار المحددة فقط
  const normalizedRole = role ? (role.toLowerCase().trim() as UserRole) : null;
  const currentRole: UserRole | null =
    normalizedRole && navigationConfig[normalizedRole] ? normalizedRole : null;

  // جلب عناصر القائمة بناءً على الدور الفعلي المحدد حنكةً وعدم عرض أي عنصر حتى التأكد
  const navigationItems: NavItem[] = currentRole ? navigationConfig[currentRole] : [];
  const homeHref = currentRole ? homeRoutes[currentRole] : "/login";

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setSidebarOpen(false);
      router.push("/login");
    } catch (error) {
      console.error("خطأ أثناء تسجيل الخروج:", error);
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-50 flex w-64 flex-col border-l border-slate-800 bg-slate-950 p-4 shadow-2xl transition-transform duration-300 ease-in-out md:static md:z-20 md:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      }`}
      aria-label="القائمة الرئيسية"
    >
      {/* الشعار برابط يوجه للصفحة الرئيسية الخاصة بدور المستخدم */}
      <div className="mb-5 flex items-center justify-between border-b border-slate-800/80 pb-4">
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 group"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 font-black text-white shadow-lg shadow-emerald-900/30">
            T
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-wider text-white group-hover:text-emerald-400 transition-colors">
              TAL<span className="text-emerald-400">ORA</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">المنصة التعليمية الشاملة</span>
          </div>
        </Link>

        <button
          type="button"
          className="rounded-xl bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden transition-colors"
          onClick={() => setSidebarOpen(false)}
          aria-label="إغلاق القائمة"
        >
          ✕
        </button>
      </div>

      {/* شارة الدور الحالي للمستخدم */}
      <div className="mb-4 rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-slate-400">نوع الحساب النشط</span>
          <span className="text-xs font-bold text-slate-200 truncate">
            {loading
              ? "جاري التحقق..."
              : currentRole
              ? roleBadgeLabels[currentRole]
              : "غير مسجل"}
          </span>
        </div>
      </div>

      {/* عناصر القائمة الجانبية المخصصة للمستخدم فقط */}
      <nav className="flex-1 space-y-1 overflow-y-auto pl-1">
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-500 font-medium">
            جاري تحضير القائمة...
          </div>
        ) : navigationItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 font-medium">
            لا توجد صلاحيات لعرض القائمة
          </div>
        ) : (
          navigationItems.map((item: NavItem) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs md:text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-bold"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                }`}
              >
                <span aria-hidden="true" className="text-base">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })
        )}
      </nav>

      {/* زر تسجيل الخروج وذيل القائمة */}
      <div className="mt-auto border-t border-slate-800/80 pt-3 space-y-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-between rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </span>
          <span className="text-xs">←</span>
        </button>

        <p className="text-center text-[10px] font-medium text-slate-500">
          منصة TALORA © 2026
        </p>
      </div>
    </aside>
  );
}