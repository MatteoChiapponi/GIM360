import { Label } from "./Label"

interface FormFieldProps {
  label: string
  required?: boolean
  hideOptional?: boolean
  children: React.ReactNode
}

export function FormField({ label, required, hideOptional = false, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && " *"}
        {!required && !hideOptional && (
          <span className="ml-1 normal-case tracking-normal text-[#A5A49D] font-normal" style={{ fontSize: "9px" }}>
            (opcional)
          </span>
        )}
      </Label>
      {children}
    </div>
  )
}
