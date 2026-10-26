"use client";

import { useState } from "react";

interface OrganizationData {
  org_name: string;
  formatted_address: string;
}

interface OrganizationStepProps {
  onNext: (data: OrganizationData) => void;
  onBack: () => void;
}

export default function OrganizationStep({ onNext, onBack }: OrganizationStepProps) {
  const [orgName, setOrgName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const handleNextStep = () => {
    if (!orgName.trim()) {
      setError("يرجى إدخال اسم المؤسسة التعليمية.");
      return;
    }

    if (!address.trim()) {
      setError("يرجى إدخال عنوان المؤسسة التعليمية.");
      return;
    }

    setError("");

    const extractedData: OrganizationData = {
      org_name: orgName.trim(),
      formatted_address: address.trim(),
    };

    onNext(extractedData);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl" dir="rtl">
      <div>
        <h2 className="text-2xl font-black text-[#0B1F3A] dark:text-white">
          معلومات المؤسسة التعليمية
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          أدخل بيانات المدرسة أو الروضة أو الأكاديمية الخاصة بك ⚡
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-sm font-semibold text-center">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            اسم المؤسسة <span className="text-red-500">*</span>
          </label>

          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="مثال: أكاديمية النجاح للتعليم"
            className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#14B8A6] transition text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            العنوان <span className="text-red-500">*</span>
          </label>

          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="مثال: شارع الاستقلال، وسط المدينة، سطيف"
            className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#14B8A6] transition text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          onClick={handleNextStep}
          className="flex-1 bg-[#14B8A6] hover:bg-[#0D9488] text-white font-bold py-4 rounded-2xl transition shadow-md active:scale-95"
        >
          الانتقال للخطوة التالية ──►
        </button>

        <button
          onClick={onBack}
          className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition"
        >
          السابق
        </button>
      </div>
    </div>
  );
}