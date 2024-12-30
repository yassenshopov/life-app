import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "purple" | "yellow" | "red" | "teal" | "orange" | "white";
  className?: string;
  label?: string;
}

export const LoadingSpinner = ({
  size = "md",
  color = "white",
  className,
  label,
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4 border-[2px]",
    md: "h-8 w-8 border-[3px]",
    lg: "h-16 w-16 border-[4px]",
  };

  const colorClasses = {
    purple: "border-purple-200/30 border-t-purple-500",
    yellow: "border-yellow-200/30 border-t-yellow-500",
    red: "border-red-200/30 border-t-red-500",
    teal: "border-teal-200/30 border-t-teal-500",
    orange: "border-orange-200/30 border-t-orange-500",
    white: "border-gray-400 border-t-gray-600 dark:border-white/20 dark:border-t-white",
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "border-solid rounded-full animate-spin",
          sizeClasses[size],
          colorClasses[color]
        )}
        style={{ borderStyle: "solid" }}
      />
      {label && (
        <span className="text-sm text-gray-700 dark:text-white/80">
          {label}
        </span>
      )}
    </div>
  );
}; 