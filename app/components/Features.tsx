"use client";

import { motion } from "framer-motion";

const features = [
  {
    icon: "👨‍🎓",
    title: "إدارة الطلبة",
    desc: "إدارة بيانات الطلبة ومتابعة حضورهم ومجموعاتهم وحصصهم بسهولة من مكان واحد.",
  },

  {
    icon: "👩‍🏫",
    title: "إدارة الأساتذة",
    desc: "تنظيم الأساتذة والمجموعات التي يدرّسونها مع متابعة الجداول والمهام التعليمية.",
  },

  {
    icon: "📊",
    title: "تقارير وتحليلات",
    desc: "متابعة أداء المؤسسة من خلال إحصائيات واضحة وتقارير تساعدك على اتخاذ قرارات أفضل.",
  },

  {
    icon: "🔔",
    title: "إشعارات تلقائية",
    desc: "إرسال إشعارات الغياب والتنبيهات والتحديثات إلى أولياء الأمور والأساتذة تلقائيًا.",
  },

  {
    icon: "📅",
    title: "إدارة الأفواج والحصص",
    desc: "إنشاء الأفواج وتنظيم أوقات الدروس وتوزيع الطلبة والأساتذة بطريقة بسيطة ومرنة.",
  },

  {
    icon: "🤖",
    title: "أتمتة سير العمل",
    desc: "أتمتة المهام المتكررة والإشعارات والتقارير لتقليل العمل الإداري وتوفير الوقت.",
  },
];

export default function Features() {
  return (
    <section className="px-6 py-24 bg-white" dir="rtl">
      
      <div className="text-center mb-16">
  <h2 className="text-4xl md:text-5xl font-black mb-6 text-[#0B1F3A]">
    لماذا <span className="text-[#2563EB]">TALORA</span>؟
  </h2>

  <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-8">
    منصة متكاملة لإدارة المدارس الخاصة والروضات والأكاديميات، تجمع الإدارة
    والطلبة والأساتذة وأولياء الأمور في نظام واحد، مع أدوات ذكية تساعدك على
    تنظيم العمل وتوفير الوقت.
  </p>
</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        
        {features.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            whileHover={{ y: -8 }}
            className="bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:shadow-2xl hover:shadow-[#2563EB]/10 hover:border-[#2563EB]/30 transition-all duration-300 group"
          >
            
            {/* أيقونة الميزة بداخل حاوية أنيقة */}
            <div className="text-4xl mb-6 w-16 h-16 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-300">
              {item.icon}
            </div>

            <h3 className="text-2xl font-bold mb-4 text-[#0B1F3A]">
              {item.title}
            </h3>

            <p className="text-slate-600 leading-relaxed font-medium">
              {item.desc}
            </p>

          </motion.div>
        ))}

      </div>
    </section>
  );
}