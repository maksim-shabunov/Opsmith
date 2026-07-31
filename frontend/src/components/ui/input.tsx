import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "placeholder:text-muted-foreground/75",
        "hover:border-input/80",
        "focus-visible:outline-none focus-visible:border-primary/55 focus-visible:ring-[3px] focus-visible:ring-ring/18",
        "disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
