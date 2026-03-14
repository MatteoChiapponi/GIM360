import { cn } from "@/lib/utils"

type ButtonVariant = "primary" | "secondary" | "danger" | "link"

const variants: Record<ButtonVariant, string> = {
  primary:
    "rounded-lg bg-[#111110] px-3 py-2 text-sm font-medium text-white hover:bg-[#2A2A28] transition-colors disabled:opacity-50",
  secondary:
    "rounded-lg border border-[#E5E4E0] px-3 py-2 text-sm font-medium text-[#68685F] hover:text-[#111110] hover:bg-[#F0EFEB] transition-colors",
  danger:
    "text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors",
  link:
    "text-xs font-medium text-[#68685F] hover:text-[#111110] underline underline-offset-2 transition-colors",
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn(variants[variant], className)} {...props} />
}
