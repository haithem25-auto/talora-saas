import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import AdminAttendancePreview from "./components/AdminAttendancePreview";
import DashboardPreview from "./components/DashboardPreview";

export default function Home() {
  return (
    <main className="min-h-screen bg-white transition-colors overflow-x-hidden" dir="rtl">
      {/* شريط التنقل العلوي */}
      <Navbar />

      {/* القسم الرئيسي */}
      <Hero />

      {/* قسم المميزات والخصائص */}
      <Features />

      {/* استعراض واجهة الإدارة وتأكيد الالتزام */}
      <AdminAttendancePreview />

      {/* معاينة لوحة التحكم والتحليلات */}
      <DashboardPreview />

      {/* CTA Section */}
      <section className="px-6 py-28 bg-slate-50 transition-colors">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[40px] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] p-12 md:p-20 text-white shadow-2xl">
          {/* Glow Effects */}
          <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-120px] left-[-100px] w-[300px] h-[300px] bg-[#0B1F3A]/20 rounded-full blur-3xl"></div>

          <div className="relative z-10 text-center">
            <div className="inline-block bg-white/15 border border-white/20 backdrop-blur-md px-5 py-2 rounded-full text-xs sm:text-sm font-bold mb-8 shadow-sm">
              مستقبل الإدارة التنفيذية يبدأ هنا ⚡
            </div>

            <h2 className="text-4xl md:text-6xl font-black leading-tight mb-8 max-w-4xl mx-auto">
              حوّل إدارة منظومتك التشغيلية
              إلى منصة رقمية متكاملة
            </h2>

            <p className="text-lg md:text-xl text-blue-50 leading-9 max-w-3xl mx-auto mb-12 font-medium">
              تتيح لك منصة <span className="font-bold text-white">TALORA</span> إدارة الفروع، والمشرفين المستقلين، والأعضاء، وتنظيم الالتزام والتقارير التشغيلية والتنبيهات المباشرة من مكان واحد وبأسلوب عصري وذكي.
            </p>

            <div className="flex flex-wrap justify-center gap-5">
              <button 
                type="button" 
                className="bg-white text-[#0B1F3A] px-8 py-4 rounded-2xl text-lg font-bold hover:scale-105 transition shadow-lg active:scale-95"
              >
                ابدأ مجانًا مع TALORA
              </button>

              <button 
                type="button" 
                className="border border-white/30 bg-white/10 backdrop-blur-md text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-white/20 transition active:scale-95"
              >
                طلب عرض توضيحي
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B1F3A] text-white px-6 py-20 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <h2 className="text-4xl font-black text-white mb-6 tracking-wide">
              TAL<span className="text-[#2563EB]">ORA</span>
            </h2>

            <p className="text-slate-400 leading-8 text-sm font-medium">
              منصة SaaS السحابية الحديثة لإدارة المقرات، الفروع، والمشرفين المستقلين بطريقة احترافية وعصرية.
            </p>
          </div>

          {/* Links - Platform */}
          <div>
            <h3 className="text-lg font-bold mb-5 text-white">المنصة</h3>
            <div className="space-y-3 text-sm text-slate-400 font-medium">
              <p className="hover:text-[#2563EB] transition cursor-pointer">الرئيسية</p>
              <p className="hover:text-[#2563EB] transition cursor-pointer">المميزات</p>
              <p className="hover:text-[#2563EB] transition cursor-pointer">لوحة التحكم</p>
              <p className="hover:text-[#2563EB] transition cursor-pointer">الأسعار</p>
            </div>
          </div>

          {/* Links - Services */}
          <div>
            <h3 className="text-lg font-bold mb-5 text-white">الخدمات</h3>
            <div className="space-y-3 text-sm text-slate-400 font-medium">
              <p className="hover:text-[#2563EB] transition cursor-pointer">إدارة الالتزام والغياب</p>
              <p className="hover:text-[#2563EB] transition cursor-pointer">التنبيهات التلقائية</p>
              <p className="hover:text-[#2563EB] transition cursor-pointer">رموز الـ QR للمقرات</p>
              <p className="hover:text-[#2563EB] transition cursor-pointer">التقارير التشغيلية</p>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-bold mb-5 text-white">تواصل معنا</h3>
            <div className="space-y-3 text-sm text-slate-400 font-medium dir-ltr text-right">
              <p className="hover:text-[#2563EB] transition">haithembakhouche23@gmail.com</p>
              <p className="hover:text-[#2563EB] transition">+213 562 954 676</p>
              <p className="hover:text-[#2563EB] transition">الجزائر</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800/80 mt-16 pt-8 text-center text-xs text-slate-500 font-medium">
          © 2026 TALORA Platform. جميع الحقوق محفوظة.
        </div>
      </footer>
    </main>
  );
}