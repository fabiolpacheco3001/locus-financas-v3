import React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Page title (required) */
  title: string;
  /** Optional description text below title */
  description?: string;
  /** Month picker or date control to render centered */
  monthControl?: React.ReactNode;
  /** Action buttons to render on the right side */
  actions?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * Standardized PageHeader component for all pages.
 * 
 * Layout:
 * - Left: Title (and optional description)
 * - Center: Month picker (if provided) - absolute positioned for true center on desktop
 * - Right: Actions (buttons, etc.)
 * 
 * Typography: text-2xl sm:text-3xl font-bold tracking-tight text-foreground
 */
export function PageHeader({ 
  title, 
  description, 
  monthControl,
  actions,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      {/* Row 1: Title | Center MonthPicker | Actions */}
      <div className="relative flex items-center justify-between gap-4">
        {/* Left: Title */}
        <div className="min-w-0 flex-1 sm:flex-initial">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Center: Month Picker (absolute positioned for true center on desktop) */}
        {monthControl && (
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 sm:flex">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {monthControl}
          </div>
        )}

        {/* Right: Actions (or spacer for centering) - HIDDEN on mobile, FAB handles actions */}
        {actions ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div>
        ) : monthControl ? (
          /* Spacer for centering when no actions but has month control */
          <div className="hidden w-24 sm:block" />
        ) : null}
      </div>

      {/* Mobile: Month Picker below title (centered) */}
      {monthControl && (
        <div className="mt-3 flex items-center justify-center gap-1.5 sm:hidden">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {monthControl}
        </div>
      )}
    </div>
  );
}
