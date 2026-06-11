import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="p-12 text-center flex flex-col items-center justify-center flex-1 w-full min-h-[300px]">
      <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-border">
        <Icon size={32} className="text-muted-foreground opacity-60" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm font-medium text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
