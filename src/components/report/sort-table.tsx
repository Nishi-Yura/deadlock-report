// 見出しを押すと並べ替えられる表。数字の列は大きい順から、文字の列は A→Z から
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  label: ReactNode
  /** 並べ替えに使う値。省略するとその列では並べ替えない */
  sort?: (row: T) => number | string
  render: (row: T) => ReactNode
  /** 既定は右揃え（数字）。"left" は文字の列 */
  align?: "left" | "right" | "center"
  className?: string
  /** 375px 幅で隠す列 */
  hideOnMobile?: boolean
}

export function SortTable<T>({
  rows, columns, rowKey, initialSort, minWidth = 0, caption,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  initialSort: { key: string; desc: boolean }
  minWidth?: number
  caption?: string
}) {
  const [sort, setSort] = useState(initialSort)
  const col = columns.find((c) => c.key === sort.key)
  const first = columns[0]
  const sorted = [...rows].sort((a, b) => {
    if (!col?.sort) return 0
    const x = col.sort(a)
    const y = col.sort(b)
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
    if (c !== 0) return sort.desc ? -c : c
    // 同じなら最初の列（名前）の順
    return first.sort ? String(first.sort(a)).localeCompare(String(first.sort(b))) : 0
  })
  const click = (c: Column<T>) => {
    if (!c.sort) return
    if (c.key === sort.key) setSort({ key: c.key, desc: !sort.desc })
    else {
      const sample = rows[0] ? c.sort(rows[0]) : 0
      setSort({ key: c.key, desc: typeof sample === "number" })
    }
  }
  const align = (c: Column<T>) => (c.align === "left" ? "text-left" : c.align === "center" ? "text-center" : "text-right")

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-separate border-spacing-x-0 border-spacing-y-0 text-[13px]" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={c.key === sort.key ? (sort.desc ? "descending" : "ascending") : undefined}
                className={cn(
                  "h-9 border-b border-line px-1.5 text-[11px] font-semibold whitespace-nowrap text-mute",
                  align(c),
                  i === 0 && "sticky left-0 z-10 bg-panel pl-4",
                  i === columns.length - 1 && "pr-4",
                  c.hideOnMobile && "max-sm:hidden",
                  c.className
                )}
              >
                {c.sort ? (
                  <button
                    type="button"
                    onClick={() => click(c)}
                    className={cn("inline-flex min-h-9 cursor-pointer items-center gap-0.5 hover:text-ink", c.key === sort.key && "font-bold text-ink")}
                  >
                    {c.label}
                    <span aria-hidden className={cn("w-2 text-[9px]", c.key !== sort.key && "invisible")}>{sort.desc ? "▼" : "▲"}</span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="group">
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    "border-b border-line px-1.5 py-1.5 whitespace-nowrap num group-last:border-0 group-hover:bg-cellhover",
                    align(c),
                    i === 0 && "sticky left-0 z-10 bg-panel pl-4",
                    i === columns.length - 1 && "pr-4",
                    c.hideOnMobile && "max-sm:hidden",
                    c.className
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 0〜100% の細い帯（色はデータにだけ使う） */
export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <span className="inline-block h-1.5 w-14 bg-cell align-middle max-sm:w-8" aria-hidden>
      <span className={cn("block h-full bg-ink", className)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  )
}
