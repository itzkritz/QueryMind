import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-violet-500/15 dark:bg-violet-500/20 text-black dark:text-violet-300 border-violet-500/30",
    success: "bg-emerald-500/15 dark:bg-emerald-500/20 text-black dark:text-emerald-300 border-emerald-500/30",
    error: "bg-red-500/15 dark:bg-red-500/20 text-black dark:text-red-300 border-red-500/30",
    warning: "bg-amber-500/15 dark:bg-amber-500/20 text-black dark:text-amber-300 border-amber-500/30",
    outline: "bg-transparent text-foreground dark:text-gray-300 border-border dark:border-white/10",
  }
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }
