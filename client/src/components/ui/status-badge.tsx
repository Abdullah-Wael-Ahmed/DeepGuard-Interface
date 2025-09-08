import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        critical: "bg-critical text-critical-foreground",
        high: "bg-high text-high-foreground", 
        medium: "bg-medium text-medium-foreground",
        low: "bg-low text-low-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        info: "bg-info text-info-foreground",
        enabled: "bg-success text-success-foreground",
        disabled: "bg-muted text-muted-foreground",
        active: "bg-primary text-primary-foreground",
        resolved: "bg-success text-success-foreground",
        investigating: "bg-warning text-warning-foreground",
        acknowledged: "bg-muted text-muted-foreground",
        new: "bg-info text-info-foreground",
        allow: "bg-success text-success-foreground",
        deny: "bg-critical text-critical-foreground",
        operational: "bg-success text-success-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function StatusBadge({ className, variant, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { StatusBadge, badgeVariants };