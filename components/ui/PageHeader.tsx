interface PageHeaderProps {
  title: string
  subtitle: string
  action?: React.ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[#111110]">{title}</h1>
        <p className="mt-0.5 text-sm text-[#68685F]">{subtitle}</p>
      </div>
      {action && <div className="self-start">{action}</div>}
    </div>
  )
}
