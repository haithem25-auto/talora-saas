"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkRoleAndRedirect() {
      try {
        // 1. جلب بيانات المستخدم الحالي من الجلسة
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login");
          return;
        }

        // 2. البحث عن البروفايل الخاص بالمستخدم
        let { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        // 3. إذا لم يوجد بروفايل (تسجيل دخول لأول مرة عبر Google مثلاً)
        if (!profile) {
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
          const nameArray = fullName.trim().split(" ");
          const firstName = nameArray[0] || "مستخدم";
          const lastName = nameArray.slice(1).join(" ") || "جديد";

          // إنشاء بروفايل جديد بدور افتراضي (مثلاً ولي أمر parent)
          const { data: newProfile, error: insertError } = await supabase
            .from("profiles")
            .insert([
              {
                id: user.id,
                email: user.email,
                first_name: firstName,
                last_name: lastName,
                role: "parent", // الدور الافتراضي لتسجيلات Google المباشرة
                status: "active",
              },
            ])
            .select("role")
            .single();

          if (insertError) {
            console.error("خطأ أثناء إنشاء بروفايل مستخدم Google:", insertError.message);
            router.push("/login");
            return;
          }

          profile = newProfile;
        }

        // 4. التوجيه المباشر حسب دور المستخدم (Role Routing)
        switch (profile?.role) {
          case "school_owner":
          case "school_admin":
          case "staff":
            router.push("/dashboard");
            break;

          case "independent_teacher":
          case "teacher":
            router.push("/teacher-dashboard");
            break;

          case "parent":
            router.push("/parent-dashboard");
            break;

          default:
            router.push("/dashboard");
            break;
        }
      } catch (err) {
        console.error("خطأ في معالجة التوجيه:", err);
        router.push("/login");
      }
    }

    checkRoleAndRedirect();
  }, [router]);

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-white text-slate-800 flex flex-col justify-center items-center p-6 relative overflow-hidden"
    >
      {/* خلفية تالورا السينمائية */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-50/80 via-blue-50/20 to-transparent pointer-events-none -z-10 blur-3xl rounded-full" />

      <div className="flex flex-col items-center justify-center gap-4 text-center">
        {/* الشعار */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-3xl shadow-xl shadow-blue-500/25 ring-4 ring-blue-100 animate-pulse">
          T
        </div>

        {/* المؤشر التفاعلي */}
        <div className="flex items-center gap-2 mt-2">
          <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-bold text-slate-700">
            جاري التحقق وتوجيهك لوحتك الخاصة في Talora...
          </span>
        </div>
      </div>
    </main>
  );
}