"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole =
  | "school_owner"
  | "teacher"
  | "parent"
  | "independent_teacher"
  | string;

export interface UseUserRoleReturn {
  role: UserRole | null;
  loading: boolean;
  error: Error | null;
}

export function useUserRole(): UseUserRoleReturn {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRole() {
      try {
        setLoading(true);
        setError(null);

        // 1. الحصول على بيانات المستخدم
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          // تجنب رفع الخطأ إذا كان فقط بسبب عدم وجود جلسة دخول (المستخدم زائر)
          if (
            authError.name === "AuthSessionMissingError" ||
            authError.message.includes("Auth session missing")
          ) {
            if (isMounted) {
              setRole(null);
              setError(null);
            }
            return;
          }

          // تفريغ الجلسة القديمة بمسح التوكن التالف من المتصفح في حال وجود رمز غير صالح أو مستخدم محذوف
          await supabase.auth.signOut();
          if (isMounted) {
            setRole(null);
            setError(null);
          }
          return;
        }

        // 2. إذا لم يكن هناك مستخدم مسجل
        if (!user) {
          if (isMounted) {
            setRole(null);
          }
          return;
        }

        // 3. جلب صلاحية المستخدم من جدول profiles
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (isMounted) {
          setRole(data?.role ?? null);
        }
      } catch (err: unknown) {
        console.error("خطأ أثناء جلب صلاحية المستخدم:", err);

        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error("حدث خطأ غير معروف")
          );
          setRole(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadRole();

    // الاستماع لتغيرات جلسة تسجيل الدخول (تسجيل الدخول / الخروج) تلقائياً
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    loading,
    error,
  };
}