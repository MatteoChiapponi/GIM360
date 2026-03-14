import { Input } from "./Input"
import { Select } from "./Select"
import { Button } from "./Button"

interface SortOption {
  value: string
  label: string
}

interface SearchToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  placeholder: string
  sortOptions: SortOption[]
  sortKey: string
  onSortKeyChange: (k: string) => void
  sortDir: "asc" | "desc"
  onSortDirToggle: () => void
  searchWidth?: string
}

export function SearchToolbar({
  search,
  onSearchChange,
  placeholder,
  sortOptions,
  sortKey,
  onSortKeyChange,
  sortDir,
  onSortDirToggle,
  searchWidth = "sm:w-64",
}: SearchToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative">
        <Input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-8 pr-3 ${searchWidth}`}
        />
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A5A49D]"
          fill="none"
          viewBox="0 0 16 16"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 14l-3.5-3.5M11 6.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          />
        </svg>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value)}
          className="text-[#68685F]"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          onClick={onSortDirToggle}
          className="px-3 py-2.5"
        >
          {sortDir === "asc" ? "\u2191" : "\u2193"}
        </Button>
      </div>
    </div>
  )
}
