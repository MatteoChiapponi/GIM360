export function StatusDot({
  dotColor,
  textColor,
  label,
}: {
  dotColor: string
  textColor: string
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className={`text-sm font-medium ${textColor}`}>{label}</span>
    </div>
  )
}
