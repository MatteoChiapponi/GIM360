import { forwardRef, type ChangeEvent } from "react"
import { cn } from "@/lib/utils"

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onChange"> {
  /** If true, only allows integers (no decimal separator) */
  integer?: boolean
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Numeric input that accepts both comma and dot as decimal separator.
 * Renders as type="text" with inputMode="decimal" so mobile keyboards
 * show the numeric pad and both separators work across all locales.
 * The onChange value is always normalized with dot as decimal separator.
 */
const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, integer, onChange, value, ...props }, ref) => {
    function normalize(v: string): string {
      // Replace comma with dot
      let raw = v.replace(",", ".")
      // Remove anything that isn't digit, dot, or minus
      raw = raw.replace(/[^\d.\-]/g, "")
      // Ensure only one dot
      const parts = raw.split(".")
      if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("")
      // Ensure minus only at start
      if (raw.indexOf("-") > 0) raw = raw.replace(/-/g, "")
      // For integers, remove dot entirely
      if (integer) raw = raw.replace(/\./g, "")
      return raw
    }

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      const cleaned = normalize(e.target.value)
      // Set the cleaned value on the input so the parent sees it via e.target.value
      e.target.value = cleaned
      if (onChange) onChange(e)
    }

    return (
      <input
        ref={ref}
        {...props}
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        value={value}
        className={cn(
          "rounded-lg border border-[#E5E4E0] bg-white px-3 py-2.5 text-sm text-[#111110] focus:border-[#111110] focus:outline-none transition-colors",
          className,
        )}
        onChange={handleChange}
      />
    )
  },
)
NumberInput.displayName = "NumberInput"

export { NumberInput }
