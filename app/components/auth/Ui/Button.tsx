import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "outline";
  className?: string;
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {

  const variants = {
    primary:
      "bg-[#14B8A6] hover:bg-[#0D9488] text-white shadow-sm active:scale-95",

    secondary:
      "bg-[#0B1F3A] hover:bg-[#08172C] text-white shadow-sm active:scale-95",

    outline:
      "bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 active:scale-95",

    danger:
      "bg-red-500 hover:bg-red-600 text-white shadow-sm active:scale-95",
  };

  return (
    <button
      {...props}
      className={`
        px-6 py-4 rounded-2xl font-bold transition duration-200
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}