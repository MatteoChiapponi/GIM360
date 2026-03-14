import { Label } from "./Label"

interface FormFieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({ label, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && " *"}
      </Label>
      {children}
    </div>
  )
}
