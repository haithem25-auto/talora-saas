"use client";

import React, { useEffect } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
}: ModalProps) {
  // إغلاق النافذة المنبثقة عند الضغط على زر Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* الخلفية المعتمة مع تأثير الضبابية */}
      <div 
        className="fixed inset-0 bg-[#0B1F3A]/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* حاوية النافذة المنبثقة */}
      <div 
        className={`
          relative bg-white dark:bg-slate-900 
          rounded-3xl w-full max-w-lg p-6 md:p-8 
          border border-slate-100 dark:border-slate-800 
          shadow-2xl z-10 transition-all transform scale-100 animate-scale-up
          ${className}
        `}
      >
        {/* الهيدر والعنوان */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <h2 className="text-xl md:text-2xl font-black text-[#0B1F3A] dark:text-white">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center text-lg font-bold"
            aria-label="إغلاق النافذة"
          >
            ✕
          </button>
        </div>

        {/* محتوى النافذة */}
        <div className="text-slate-700 dark:text-slate-300">
          {children}
        </div>
      </div>
    </div>
  );
}