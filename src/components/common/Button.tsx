import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "action" | "md" | "lg";
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  disabled,
  ...props
}) => {
  // Sizing is single-source here (G-40): padding, label size, and the
  // icon→label gap (gap-1.5 for compact sizes, gap-2 for md/lg per the
  // global spacing rule) all live in this map — never per-instance.
  const sizeStyles = {
    sm: "px-2 py-1 text-[11px] gap-1.5",
    // Ghost action-row buttons (NOW cockpit, Add Task): same padding as sm
    // with a full-size label.
    action: "px-2 py-1 text-sm gap-1.5",
    md: "px-3 py-1.5 text-xs gap-2",
    lg: "px-4 py-2 text-sm gap-2",
  };

  const variantClass = `btn-${variant}`;

  return (
    <button
      className={`${variantClass} ${sizeStyles[size]} whitespace-nowrap ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0 inline-flex items-center leading-none">{icon}</span>}
      {children}
    </button>
  );
};
