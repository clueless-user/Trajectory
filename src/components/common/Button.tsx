import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
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
  const sizeStyles = {
    sm: "px-2 py-1 text-[11px]",
    md: "px-3 py-1.5 text-xs",
    lg: "px-4 py-2 text-sm",
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
