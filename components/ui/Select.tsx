import { forwardRef } from "react"
import { cn } from "@/lib/utils"

const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "rounded-lg border border-[#E5E4E0] bg-white px-3 py-2.5 text-sm text-[#111110] focus:border-[#111110] focus:outline-none transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = "Select"

export { Select }
