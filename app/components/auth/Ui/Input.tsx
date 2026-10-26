import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export default function Input({
  className = "",
  type = "text",
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      {...props}
      className={`
        w-full bg-[#F7F9FC] dark:bg-slate-800
        border border-slate-200 dark:border-slate-700
        rounded-2xl px-5 h-14
        text-slate-800 dark:text-white font-medium text-sm
        placeholder-slate-400 dark:placeholder-slate-500
        outline-none transition duration-200
        focus:border-[#14B8A6] focus:ring-4 focus:ring-teal-500/10
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    />
  );
}