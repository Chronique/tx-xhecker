import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isLoading?: boolean;
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}

export function Button({ 
  children, 
  className = "", 
  isLoading = false, 
  variant = "primary", 
  size = "default", 
  ...props 
}: ButtonProps) {
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-border bg-transparent hover:bg-accent text-foreground",
    ghost: "bg-transparent hover:bg-accent text-foreground"
  };

  const sizes = {
    default: "py-3 px-6 w-full max-w-xs mx-auto block",
    sm: "py-2 px-4 text-sm",
    icon: "h-10 w-10 flex items-center justify-center"
  };

  return (
    <button
      className={`${variants[variant]} ${sizes[size]} rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
        </div>
      ) : (
        children
      )}
    </button>
  );
}