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

    // 1. تبديل الـ Code بجلسة تسجيل الدخول
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (!authError && authData?.user) {
      const user = authData.user;

      // 2. استعلام أُحادي ومدمج (Single Roundtrip) ينفذ البحث عن id أو email في طلب واحد
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .or(`id.eq.${user.id}${user.email ? `,email.eq.${user.email}` : ""}`)
        .maybeSingle();

      const userRole = profile?.role ? String(profile.role).trim().toLowerCase() : "";

      // 3. التوجيه المباشر والمنفصل
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