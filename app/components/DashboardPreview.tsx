export default function DashboardPreview() {

  // القائمة الجانبية لمنظومة TALORA
  const sidebarItems = [
    "الرئيسية",
    "الطلبة",
    "الأساتذة",
    "الأفواج والحصص",
    "الحضور والغياب",
    "المدفوعات",
    "أولياء الأمور",
    "التقارير والإحصائيات",
    "الإشعارات",
  ];

const stats = [
  { title: "إجمالي الطلبة", value: "245" },
  { title: "نسبة الحضور اليوم", value: "92%" },
  { title: "عدد الأساتذة", value: "18" },
];

  const chartHeights = [60, 80, 50, 90, 70, 85];

  return (
    <section className="px-6 py-28 bg-white" dir="rtl">
   <div className="text-center mb-16">
  <h2 className="text-4xl md:text-5xl font-black mb-6 text-[#0B1F3A]">
    لوحة تحكم متكاملة لإدارة مؤسستك
  </h2>

  <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-8">
    تجربة إدارية حديثة تمنحك رؤية واضحة للطلبة والأساتذة والأفواج والحضور
    والمدفوعات والتقارير، كل ذلك من مكان واحد وبسهولة تامة.
  </p>
</div>

      <div className="max-w-7xl mx-auto bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-2xl font-bold text-[#0B1F3A]">
              لوحة الإدارة التنفيذية
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              فرع TALORA الرئيسي
            </p>
          </div>

          <button 
            type="button"
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2.5 rounded-xl font-bold transition-colors duration-200 shadow-sm"
          >
            ابدأ تجربة TALORA
          </button>
        </div>

        {/* Dashboard Body */}
        <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[500px] overflow-hidden">
          
          {/* Sidebar */}
          <div className="bg-[#0B1F3A] text-white p-6 flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-[#2563EB] tracking-wide px-2">
                TALORA
              </h2>
              
              <nav className="space-y-1.5 text-sm">
                {sidebarItems.map((item, index) => (
                  <div
                    key={index}
                    className="block hover:bg-white/10 text-slate-300 hover:text-white rounded-xl px-4 py-3 transition-all duration-200 font-medium cursor-pointer"
                  >
                    {item}
                  </div>
                ))}
              </nav>
            </div>
            
            <div className="pt-6 border-t border-slate-800 text-xs text-slate-400 px-2">
              منصة TALORA الإدارية v2.0
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 p-4 md:p-8 bg-[#F7F9FC]">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-200"
                >
                  <p className="text-slate-500 text-sm font-medium mb-2">
                    {stat.title}
                  </p>
                  <h3 className="text-3xl md:text-4xl font-black text-[#0B1F3A]">
                    {stat.value}
                  </h3>
                </div>
              ))}
            </div>

            {/* Attendance Chart Preview */}
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-bold text-[#0B1F3A]">
                  إحصائيات الالتزام والنشاط
                </h3>
                <span className="text-sm text-slate-400 font-medium">
                  آخر 30 يوم
                </span>
              </div>

              <div className="flex items-end gap-3 md:gap-4 h-64 px-2">
                {chartHeights.map((height, index) => (
                  <div
                    key={index}
                    className="bg-[#2563EB]/90 hover:bg-[#2563EB] w-full rounded-t-xl transition-all duration-300 cursor-pointer relative group"
                    style={{ height: `${height}%` }}
                  >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0B1F3A] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                      {height}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}