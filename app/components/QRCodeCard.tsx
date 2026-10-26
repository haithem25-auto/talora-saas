"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

interface QRCodeCardProps {
  slug: string; // 💡 الـ slug الفريد الخاص بالمقر أو الفرع في TALORA
  title?: string;
}

export default function QRCodeCard({ slug, title = "الـ QR Code الرسمي للمقر / الفرع" }: QRCodeCardProps) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    // 💡 بناء الرابط بشكل ديناميكي ليتكيف تلقائياً بين السيرفر المحلي والإنتاج (Production)
    const fullUrl = `${window.location.origin}/orgs/${slug}`;
    
    QRCode.toDataURL(fullUrl, {
      margin: 2,
      color: {
        dark: "#0B1F3A", // لون الـ QR الداكن (لون TALORA الثانوي)
        light: "#FFFFFF",
      },
    })
      .then(setQr)
      .catch((err) => console.error("خطأ أثناء توليد الـ QR Code:", err));
  }, [slug]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors" dir="rtl">
      <h2 className="font-black text-[#0B1F3A] dark:text-white mb-4 text-sm flex items-center gap-2">
        <span className="text-[#14B8A6]">📍</span> {title}
      </h2>

      {qr ? (
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
          <Image
            src={qr}
            alt="Organization QR Code"
            width={192}
            height={192}
            unoptimized
            className="w-48 h-48 object-contain rounded-lg"
          />
        </div>
      ) : (
        <div className="w-48 h-48 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400">
          جاري توليد الرمز...
        </div>
      )}
      
      <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-4 max-w-[220px] leading-relaxed font-medium">
        يمكن للأعضاء والمشرفين المستقلين ورواد المنظومة مسح هذا الرمز للوصول المباشر والتسجيل.
      </p>
    </div>
  );
}
