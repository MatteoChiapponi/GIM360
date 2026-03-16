interface Column<T> {
  key: string
  header: string
  align?: "left" | "right"
  render: (item: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading: boolean
  error?: string | null
  emptyMessage: string
  emptyHint?: string
  minWidth?: string
  rowKey: (item: T) => string
  rowClassName?: (item: T, i: number) => string
  renderRow?: (item: T, i: number, defaultRow: React.ReactNode) => React.ReactNode
  onRowClick?: (item: T) => void
}

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  emptyMessage,
  emptyHint,
  minWidth = "560px",
  rowKey,
  rowClassName,
  renderRow,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
      {loading ? (
        <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando…</div>
      ) : error ? (
        <div className="py-20 text-center text-sm text-red-600">{error}</div>
      ) : data.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-[#68685F]">{emptyMessage}</p>
          {emptyHint && <p className="mt-1 text-xs text-[#A5A49D]">{emptyHint}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth }}>
            <thead>
              <tr className="border-b border-[#F0EFEB]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => {
                const cls = rowClassName
                  ? rowClassName(item, i)
                  : `transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}${onRowClick ? " cursor-pointer hover:bg-[#F0EFEB]" : " hover:bg-[#FAFAF9]"}`
                const defaultRow = (
                  <tr key={rowKey(item)} className={cls} onClick={onRowClick ? () => onRowClick(item) : undefined}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-5 py-4 ${col.align === "right" ? "text-right" : ""}`}
                      >
                        {col.render(item, i)}
                      </td>
                    ))}
                  </tr>
                )
                return renderRow ? renderRow(item, i, defaultRow) : defaultRow
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
