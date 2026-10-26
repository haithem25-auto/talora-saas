"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import Sidebar from "@/app/components/dashboard/Sidebar"; 

interface Transaction {
  id: string;
  type: "subscription" | "additional_income" | "expense";
  category: string;
  description: string;
  amount: number;
  flow: "income" | "expense";
  date: string;
  created_at: string;
  debt?: number;
}

export default function FinancialPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("school_owner");
  const [schoolId, setSchoolId] = useState<string>("");

  // الفلترة والبحث
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all"); // فلتر الشهر

  // حالات النوافذ المنبثقة (Modals)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // نماذج الإدخال
  const [expenseData, setExpenseData] = useState({
    category: "",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [incomeData, setIncomeData] = useState({
    category: "",
    description: "",
    amount: "",
    income_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // 1. جلب بيانات المستخدم الحالي
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. تحديد المعرّف الخاص بالمدرسة والدور بشكل صارم
      let currentSchoolId = "";
      let currentRole = "school_owner";

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        currentRole = profile.role || "school_owner";
        if (profile.school_id) {
          currentSchoolId = profile.school_id;
        }
      }

      // البحث بجدول schools بالمالك في حال لم يربط ببروفايله
      if (!currentSchoolId) {
        const { data: ownedSchool } = await supabase
          .from("schools")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (ownedSchool?.id) {
          currentSchoolId = ownedSchool.id;
        }
      }

      setUserRole(currentRole);
      setSchoolId(currentSchoolId);

      // ⛔ إذا لم يتوفر معرّف مدرسة مخصص، نوقف العمليات
      if (!currentSchoolId) {
        console.warn("تنبيه أمان: لم يتم التعرف على معرّف المدرسة للمستخدم الحالي.");
        setTransactions([]);
        setLoading(false);
        return;
      }

      await fetchFinancialData(currentSchoolId);
    } catch (error) {
      console.error("خطأ أثناء جلب البيانات الأساسية:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialData = async (sId: string) => {
    try {
      // أ. جلب الاشتراكات الخاصة بالمدرسة الحالية فقط
      const { data: subscriptionsData } = await supabase
        .from("student_subscriptions")
        .select("*")
        .eq("school_id", sId);

      // ب. جلب الإيرادات الإضافية الخاصة بالمدرسة الحالية فقط
      const { data: additionalIncomeData } = await supabase
        .from("additional_income")
        .select("*")
        .eq("school_id", sId);

      // ج. جلب المصروفات الخاصة بالمدرسة الحالية فقط
      const { data: expensesData } = await supabase
        .from("expenses")
        .select("*")
        .eq("school_id", sId);

      let allTransactions: Transaction[] = [];

      // معالجة الاشتراكات
      if (subscriptionsData) {
        subscriptionsData.forEach((sub: any) => {
          const paid = Number(sub.amount_paid) || 0;
          const req = Number(sub.amount_required) || Number(sub.amount_due) || 0;
          const debtAmt = req > paid ? req - paid : 0;
          const subDate = sub.created_at ? sub.created_at.split("T")[0] : "";

          if (paid > 0 || debtAmt > 0) {
            allTransactions.push({
              id: `sub-${sub.id}`,
              type: "subscription",
              category: "اشتراكات التلاميذ",
              description: `اشتراك شهر ${sub.month_year || sub.billing_month || "-"}`,
              amount: paid,
              flow: "income",
              date: subDate,
              created_at: sub.created_at || "",
              debt: debtAmt,
            });
          }
        });
      }

      // معالجة الإيرادات الإضافية
      if (additionalIncomeData) {
        additionalIncomeData.forEach((inc: any) => {
          const amt = Number(inc.amount) || 0;
          allTransactions.push({
            id: `inc-${inc.id}`,
            type: "additional_income",
            category: inc.category || "إيراد إضافي",
            description: inc.description || "بدون وصف",
            amount: amt,
            flow: "income",
            date: inc.income_date || inc.created_at?.split("T")[0] || "",
            created_at: inc.created_at || "",
          });
        });
      }

      // معالجة المصروفات
      if (expensesData) {
        expensesData.forEach((exp: any) => {
          const amt = Number(exp.amount) || 0;
          allTransactions.push({
            id: `exp-${exp.id}`,
            type: "expense",
            category: exp.category || "مصروفات",
            description: exp.description || "بدون وصف",
            amount: amt,
            flow: "expense",
            date: exp.expense_date || exp.created_at?.split("T")[0] || "",
            created_at: exp.created_at || "",
          });
        });
      }

      // ترتيب كل الحركات تنازلياً حسب التاريخ
      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTransactions);
    } catch (err) {
      console.error("خطأ أثناء جلب الحركات المالية:", err);
    }
  };

  // تسجيل مصروف جديد
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) {
      alert("خطأ أمان: لا توجد مدرسة محددة لإضافة المصروف عليها.");
      return;
    }
    if (!expenseData.category || !expenseData.amount) {
      alert("يرجى اختيار تصنيف المصروف وإدخال المبلغ.");
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from("expenses").insert([
        {
          school_id: schoolId,
          category: expenseData.category.trim(),
          description: expenseData.description.trim(),
          amount: Number(expenseData.amount),
          expense_date: expenseData.expense_date,
          notes: expenseData.notes,
        },
      ]);

      if (error) throw error;

      setIsExpenseModalOpen(false);
      setExpenseData({
        category: "",
        description: "",
        amount: "",
        expense_date: new Date().toISOString().split("T")[0],
        notes: "",
      });

      await fetchFinancialData(schoolId);
      alert("تم تسجيل المصروف بنجاح!");
    } catch (err: any) {
      console.error("خطأ أثناء إضافة المصروف:", err);
      alert("حدث خطأ أثناء حفظ المصروف: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // تسجيل إيراد إضافي جديد
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) {
      alert("خطأ أمان: لا توجد مدرسة محددة لإضافة الإيراد عليها.");
      return;
    }
    if (!incomeData.category || !incomeData.amount) {
      alert("يرجى تحديد تصنيف الإيراد وإدخال المبلغ.");
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from("additional_income").insert([
        {
          school_id: schoolId,
          category: incomeData.category.trim(),
          description: incomeData.description.trim(),
          amount: Number(incomeData.amount),
          income_date: incomeData.income_date,
          notes: incomeData.notes,
        },
      ]);

      if (error) throw error;

      setIsIncomeModalOpen(false);
      setIncomeData({
        category: "",
        description: "",
        amount: "",
        income_date: new Date().toISOString().split("T")[0],
        notes: "",
      });

      await fetchFinancialData(schoolId);
      alert("تم تسجيل الإيراد الإضافي بنجاح!");
    } catch (err: any) {
      console.error("خطأ أثناء إضافة الإيراد الإضافي:", err);
      alert("حدث خطأ أثناء حفظ الإيراد: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // استخراج الأشهر المتوفرة في البيانات تلقائياً (بصيغة YYYY-MM)
  const availableMonths = Array.from(
    new Set(
      transactions
        .map((t) => (t.date ? t.date.slice(0, 7) : ""))
        .filter((m) => m.length === 7)
    )
  ).sort().reverse();

  // تصفية الحركات المالية حسب الشهر أولاً
  const monthFilteredTransactions = transactions.filter((t) => {
    if (selectedMonth === "all") return true;
    return t.date && t.date.startsWith(selectedMonth);
  });

  // حساب المبالغ والإحصائيات الخاصة بالشهر المختار فقط
  const totalIncome = monthFilteredTransactions
    .filter((t) => t.flow === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = monthFilteredTransactions
    .filter((t) => t.flow === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebts = monthFilteredTransactions
    .reduce((sum, t) => sum + (t.debt || 0), 0);

  // تصفية الحركات للجدول بالبحث ونوع الحركة
  const filteredTransactions = monthFilteredTransactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === "all" ||
      (filterType === "income" && t.flow === "income") ||
      (filterType === "expense" && t.flow === "expense");
    return matchesSearch && matchesType;
  });

  const SidebarComponent = Sidebar as any;
  const isSchoolOwner = userRole === "school_owner";

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
      <div
        className={`
        fixed inset-y-0 right-0 z-40 w-64 bg-white transform transition-transform duration-300 ease-in-out
        md:static md:translate-x-0 md:z-20
        ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}
      >
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <span className="font-semibold text-slate-800 text-sm">المعاملات المالية</span>
        </div>

        {/* رأس الصفحة */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-5 border-slate-200/60 gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
              المعاملات المالية والشاملة
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              متابعة الإيرادات والمصروفات والاشتراكات المدرسية في مكان واحد
            </p>
          </div>

          {/* أزرار الإجراءات السريعة */}
          {isSchoolOwner && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsIncomeModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-xs cursor-pointer"
              >
                ➕ إضافة إيراد إضافي
              </button>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-xs cursor-pointer"
              >
                ➖ إضافة مصروف جديد
              </button>
            </div>
          )}
        </div>

        {/* بطاقات الإحصائيات (KPIs) - محتسبة حسب الشهر المحدد */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي الواردات</span>
            <div className="text-2xl font-black text-emerald-600">
              {totalIncome.toLocaleString()} د.ج
            </div>
            <span className="text-xs text-slate-400 mt-1 block">اشتراكات + إيرادات إضافية</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي المصروفات</span>
            <div className="text-2xl font-black text-rose-600">
              {totalExpenses.toLocaleString()} د.ج
            </div>
            <span className="text-xs text-slate-400 mt-1 block">كافة النفقات التشغيلية</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block mb-1">صافي الرصيد الحالي</span>
            <div
              className={`text-2xl font-black ${
                (totalIncome - totalExpenses) >= 0 ? "text-slate-900" : "text-rose-600"
              }`}
            >
              {(totalIncome - totalExpenses).toLocaleString()} د.ج
            </div>
            <span className="text-xs text-slate-400 mt-1 block">الفرق بين الوارد والمصروف</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block mb-1">مستحقات على التلاميذ</span>
            <div className="text-2xl font-black text-amber-600">
              {totalDebts.toLocaleString()} د.ج
            </div>
            <span className="text-xs text-slate-400 mt-1 block">المبالغ المتبقية غير المدفوعة</span>
          </div>
        </div>

        {/* أدوات البحث والتصفية (تتضمن الآن الفلترة حسب الشهر) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
          <input
            type="text"
            placeholder="بحث حسب البيان أو التصنيف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-72 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-emerald-500"
          />

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* فلتر الشهر */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-48 border border-slate-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:border-emerald-500 font-bold text-slate-700"
            >
              <option value="all">📅 جميع الأشهر</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  🗓️ شهر {m}
                </option>
              ))}
            </select>

            {/* فلتر نوع الحركة */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full sm:w-48 border border-slate-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:border-emerald-500 text-slate-700"
            >
              <option value="all">جميع الحركات</option>
              <option value="income">الواردات فقط (+)</option>
              <option value="expense">المصروفات فقط (-)</option>
            </select>
          </div>
        </div>

        {/* الجدول أو حالة التحميل */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 py-12">
            <div className="text-center">جاري تحميل البيانات المالية...</div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-full max-w-2xl text-center py-16 bg-white rounded-xl border border-dashed border-slate-200 p-8 shadow-xs">
              <h3 className="text-lg font-semibold text-slate-700 mb-1">لا توجد معاملات مالية</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                لم يتم تسجيل أي حركات مالية مطابقة للشهر والبحث المختار حالياً.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b border-slate-200/60">
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">نوع الحركة</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">البيان / التفاصيل</th>
                    <th className="p-4">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {filteredTransactions.map((item) => {
                    const isInc = item.flow === "income";
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-600 whitespace-nowrap">{item.date || "-"}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                              isInc
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {isInc ? "وارد (+)" : "صادر (-)"}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">{item.category}</td>
                        <td className="p-4 text-slate-600">{item.description}</td>
                        <td
                          className={`p-4 font-black whitespace-nowrap ${
                            isInc ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isInc ? "+" : "-"} {item.amount.toLocaleString()} د.ج
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* نافذة تسجيل مصروف جديد (Modal) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">➖ تسجيل مصروف جديد</h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-6 space-y-4 text-xs md:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">تصنيف المصروف *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: رواتب، كهرباء، صيانة، كراء..."
                  value={expenseData.category}
                  onChange={(e) => setExpenseData({ ...expenseData, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ المالي (د.ج) *</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={expenseData.amount}
                  onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف / بيان المصروف</label>
                <input
                  type="text"
                  placeholder="تفاصيل توضيحية للمصروف..."
                  value={expenseData.description}
                  onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تاريخ الإنفاق</label>
                <input
                  type="date"
                  value={expenseData.expense_date}
                  onChange={(e) => setExpenseData({ ...expenseData, expense_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "جاري الحفظ..." : "حفظ المصروف"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تسجيل إيراد إضافي (Modal) */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">➕ تسجيل إيراد إضافي</h3>
              <button
                type="button"
                onClick={() => setIsIncomeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddIncome} className="p-6 space-y-4 text-xs md:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">تصنيف الإيراد *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: رحلات، بيع كتب، دورات خاصة..."
                  value={incomeData.category}
                  onChange={(e) => setIncomeData({ ...incomeData, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ المالي (د.ج) *</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={incomeData.amount}
                  onChange={(e) => setIncomeData({ ...incomeData, amount: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف / بيان الإيراد</label>
                <input
                  type="text"
                  placeholder="تفاصيل مصدر الإيراد..."
                  value={incomeData.description}
                  onChange={(e) => setIncomeData({ ...incomeData, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تاريخ التحصيل</label>
                <input
                  type="date"
                  value={incomeData.income_date}
                  onChange={(e) => setIncomeData({ ...incomeData, income_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "جاري الحفظ..." : "حفظ الإيراد"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsIncomeModalOpen(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}