"use client";

import { useState } from "react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setIsOpen(false);
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 transition-colors" dir="rtl">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
        
        {/* الشعار - Logo */}
        <button 
          onClick={() => scrollToSection("top")} 
          className="text-2xl font-black tracking-wide text-[#0B1F3A] cursor-pointer text-right"
        >
          TAL<span className="text-[#2563EB]">ORA</span>
        </button>

        {/* روابط التنقل للشاشات الكبيرة */}
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
          <button 
            onClick={() => scrollToSection("top")} 
            className="hover:text-[#2563EB] transition cursor-pointer"
          >
            الرئيسية
          </button>
          <a 
            href="#features" 
            className="hover:text-[#2563EB] transition cursor-pointer"
          >
            المميزات
          </a>
          <a 
            href="#dashboard" 
            className="hover:text-[#2563EB] transition cursor-pointer"
          >
            لوحة التحكم
          </a>
          <a 
            href="#contact" 
            className="hover:text-[#2563EB] transition cursor-pointer"
          >
            تواصل معنا
          </a>
        </div>

        {/* أزرار الإجراءات - Actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => scrollToSection("cta")}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-6 py-2.5 rounded-2xl font-bold transition shadow-sm active:scale-95 text-sm cursor-pointer"
          >
            ابدأ الآن
          </button>
        </div>

        {/* زر القائمة للشاشات الصغيرة - Mobile Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-700"
          aria-label="القائمة"
        >
          {isOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* قائمة الجوال - Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-slate-100 px-6 py-4 space-y-4">
          <button 
            onClick={() => scrollToSection("top")} 
            className="block w-full text-right text-sm font-bold text-slate-700"
          >
            الرئيسية
          </button>
          <a 
            href="#features" 
            onClick={() => setIsOpen(false)} 
            className="block text-sm font-bold text-slate-700"
          >
            المميزات
          </a>
          <a 
            href="#dashboard" 
            onClick={() => setIsOpen(false)} 
            className="block text-sm font-bold text-slate-700"
          >
            لوحة التحكم
          </a>
          <a 
            href="#contact" 
            onClick={() => setIsOpen(false)} 
            className="block text-sm font-bold text-slate-700"
          >
            تواصل معنا
          </a>
          <button
            onClick={() => scrollToSection("cta")}
            className="block w-full text-center bg-[#2563EB] text-white py-3 rounded-2xl font-bold text-sm"
          >
            ابدأ الآن
          </button>
        </div>
      )}
    </nav>
  );
}