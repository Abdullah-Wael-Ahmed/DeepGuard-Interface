import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  variant?: "default" | "critical" | "warning" | "success";
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = "default",
  trend,
  className 
}: MetricCardProps) {
  const variantClasses = {
    default: "border-border",
    critical: "border-l-4 border-l-critical",
    warning: "border-l-4 border-l-warning", 
    success: "border-l-4 border-l-success",
  };

  const iconColors = {
    default: "text-primary",
    critical: "text-critical",
    warning: "text-warning",
    success: "text-success",
  };

  return (
    <Card className={cn(
      "p-6 bg-card shadow-card hover:shadow-glow transition-all duration-300",
      variantClasses[variant],
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2 rounded-lg bg-muted/20", iconColors[variant])}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 text-xs text-muted-foreground">
          <span className={cn(
            "inline-flex items-center gap-1",
            trend === "up" && "text-success",
            trend === "down" && "text-critical"
          )}>
            {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"} 
            {trend === "up" ? "Increasing" : trend === "down" ? "Decreasing" : "Stable"}
          </span>
        </div>
      )}
    </Card>
  );
}