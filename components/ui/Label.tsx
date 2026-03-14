import { cn } from "@/lib/utils"

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode
}

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn("text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]", className)}
      {...props}
    >
      {children}
    </label>
  )
}
