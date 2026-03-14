interface TabsProps<T extends string> {
  tabs: { key: T; label: string }[]
  active: T
  onChange: (key: T) => void
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 rounded-lg border border-[#E5E4E0] bg-[#F0EFEB] p-1 w-max">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              active === key
                ? "bg-[#111110] text-white"
                : "text-[#68685F] hover:text-[#111110] hover:bg-[#F0EFEB]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
