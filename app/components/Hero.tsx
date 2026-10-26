"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="relative overflow-hidden flex flex-col items-center justify-center text-center px-6 py-24 md:py-32 bg-white"
      dir="rtl"
    >
      {/* Background Glows */}
      <div className="absolute top-[-100px] right-[-100px] w-[350px] h-[350px] bg-[#2563EB]/10 rounded-full blur-3xl opacity-40"></div>
      <div className="absolute bottom-[-120px] left-[-100px] w-[350px] h-[350px] bg-[#2563EB]/10 rounded-full blur-3xl opacity-30"></div>

      {/* Badge */}
      <div className="bg-blue-50 border border-blue-100 text-[#2563EB] px-5 py-2 rounded-full text-xs sm:text-sm font-bold mb-6 relative z-10 shadow-sm">
           إدارة تعليمية متكاملة للمدارس الخاصة والروضات والأكاديميات ⚡
          </div>

      {/* Main Heading */}
      <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight text-[#0B1F3A] max-w-5xl relative z-10">
  كل ما تحتاجه لإدارة
  <span className="text-[#2563EB]"> مؤسستك التعليمية </span>
  في مكان واحد
</h1>

      {/* Description */}
     <p className="mt-8 text-base md:text-lg text-slate-600 max-w-2xl leading-8 relative z-10 font-medium">
  منصة <span className="font-bold text-[#0B1F3A]">TALORA</span> تمنحك نظامًا متكاملًا لإدارة مدرستك أو روضتك أو أكاديميتك، يجمع الطلبة والأساتذة والأفواج وأولياء الأمور في مكان واحد، مع متابعة الحضور، والحصص، والمدفوعات، والإشعارات والتقارير بكل سهولة.
</p>

      {/* CTA Buttons */}
      <div className="flex gap-4 mt-10 flex-wrap justify-center relative z-10 w-full sm:w-auto">
        <Link href="/register" className="w-full sm:w-auto">
          <button className="w-full sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8 py-4 rounded-2xl text-lg font-bold transition shadow-lg shadow-[#2563EB]/20 active:scale-95">
            ابدأ مجاناً مع TALORA
          </button>
        </Link>

        <button className="w-full sm:w-auto border border-slate-200 bg-slate-50 text-slate-800 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-slate-100 transition active:scale-95">
          استكشف النظام
        </button>
      </div>
    </motion.section>
  );
}