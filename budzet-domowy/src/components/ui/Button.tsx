import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "warning";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 active:scale-[0.97] hover:scale-[1.02] shadow-sm disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      primary:
        "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
      danger:
        "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30",
      warning:
        "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30",
      ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-none border border-transparent",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-6 text-base",
    };

    const widthClass = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
