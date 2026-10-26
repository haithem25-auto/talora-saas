import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
};

export default function Card({
  children,
  className = "",
  hoverEffect = false,
  ...props
}: CardProps) {

  return (
    <div
      {...props}
      className={`
        bg-white dark:bg-slate-900 
        rounded-3xl 
        border border-slate-100 dark:border-slate-800 
        shadow-sm p-6 
        transition-all duration-200
        ${hoverEffect ? "hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}