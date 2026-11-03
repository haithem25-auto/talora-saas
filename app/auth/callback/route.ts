import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      }
    );

    // 1. تبديل رمز المصادقة بجلسة
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (!authError && authData?.user) {
      const user = authData.user;

      // 2. البحث عن البروفايل أولاً بـ ID الحساب
      let { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // 3. إذا لم يجد بـ ID (حساب مسجل سابقاً)، يبحث بالبريد الإلكتروني مباشرة
      if (!profile && user.email) {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("role")
          .eq("email", user.email)
          .maybeSingle();

        if (profileByEmail) {
          profile = profileByEmail;
          // تحديث id في جدول profiles لربطه بـ Google مستقبلاً
          await supabase
            .from("profiles")
            .update({ id: user.id })
            .eq("email", user.email);
        }
      }

      // تنظيف القيمة
      const userRole = profile?.role ? String(profile.role).trim().toLowerCase() : "";

      // 4. التوجيه المباشر إلى اللوحة المخصصة
      switch (userRole) {
        case "teacher":
          return NextResponse.redirect(`${origin}/teacher`);

        case "parent":
          return NextResponse.redirect(`${origin}/parent`);

        case "independent_teacher":
          return NextResponse.redirect(`${origin}/freelancetech-dashboard`);

        case "school_owner":
          return NextResponse.redirect(`${origin}/dashboard`);

        default:
          return NextResponse.redirect(`${origin}/dashboard`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}