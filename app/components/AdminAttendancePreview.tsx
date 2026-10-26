"use client";

import { useState } from "react";

export default function AdminAttendancePreview() {
  // قائمة نموذجية للمشرفين المستقلين والأعضاء (بدون role)
  const members = [
    { id: 1, name: "أحمد محمد", status: "present" },
    { id: 2, name: "يوسف علي", status: "absent" },
    { id: 3, name: "عبد الرحمن محمود", status: "late" },
  ];

  const [memberStatuses, setMemberStatuses] = useState<{ [key: number]: string }>({
    1: "present",
    2: "absent",
    3: "late",
  });

  const handleStatusChange = (id: number, status: string) => {
    setMemberStatuses((prev) => ({ ...prev, [id]: status }));
  };

  return (
    <section className="px-6 py-28 bg-white transition-colors" dir="rtl">
      
      {/* Title & Description */}
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-black mb-6 text-[#0B1F3A]">
          واجهة الإدارة للتسجيل المباشر
        </h2>

        <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-8 font-medium">
          تم تصميم واجهة الإدارة بأسلوب <span className="text-[#2563EB] font-bold">Mobile-First</span> لتسمح للمسؤولين بتسجيل وتوثيق الالتزام والغياب اليومي للمشرفين والأعضاء بسرعة ودقة متناهية.
        </p>
      </div>

      {/* Phone Frame */}
      <div className="flex justify-center">
        <div className="w-[350px] bg-[#0B1F3A] rounded-[48px] p-4 shadow-2xl border-4 border-slate-800">
          
          <div className="bg-[#F7F9FC] rounded-[36px] overflow-hidden min-h-[680px] flex flex-col justify-between border border-slate-200">

            {/* Header inside Phone */}
            <div>
              <div className="bg-[#0B1F3A] text-white p-6 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2563EB] bg-[#2563EB]/10 px-3 py-1 rounded-full">
                    إدارة TALORA
                  </span>
                  <span className="text-xs text-slate-400">اليوم</span>
                </div>

                <h3 className="text-2xl font-black mt-3 text-white">
                  تسجيل الغياب والالتزام
                </h3>
              </div>

              {/* Members List */}
              <div className="p-4 space-y-4">
                {members.map((member) => {
                  const currentStatus = memberStatuses[member.id];

                  return (
                    <div
                      key={member.id}
                      className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 transition-all"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-bold text-base text-[#0B1F3A]">
                            {member.name}
                          </h4>
                        </div>

                        {/* Status Badge */}
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-sm font-bold">
                          {currentStatus === "present" && "✅"}
                          {currentStatus === "absent" && "❌"}
                          {currentStatus === "late" && "⏳"}
                        </div>
                      </div>

                      {/* Action Buttons for Admin */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleStatusChange(member.id, "present")}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                            currentStatus === "present"
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                          }`}
                        >
                          حاضر
                        </button>

                        <button
                          onClick={() => handleStatusChange(member.id, "absent")}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                            currentStatus === "absent"
                              ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                              : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}
                        >
                          غائب
                        </button>

                        <button
                          onClick={() => handleStatusChange(member.id, "late")}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                            currentStatus === "late"
                              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          متأخر
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer inside Phone */}
            <div className="p-4 bg-white border-t border-slate-100 text-center">
              <button className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-3 rounded-2xl font-bold text-sm shadow-md transition">
                حفظ وترحيل السجل
              </button>
            </div>

          </div>

        </div>
      </div>

    </section>
  );
}