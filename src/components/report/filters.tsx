// 期間・地域の切り替え。選んだ値は URL の ?days=&cmp=&region= に残す（そのまま共有できる）
import { useEffect, useState } from "react"
import { DAY_OPTIONS, latestMatchDate, regions, shortDate, sinceDate, todayISO, type Filter } from "@/lib/stats"
import { cn } from "@/lib/utils"

/** allowed は使える値の一覧か、値を確かめる関数 */
export function useQueryState<T extends string>(key: string, initial: T, allowed: readonly T[] | ((v: string) => boolean)) {
  const read = () => {
    const v = new URLSearchParams(location.search).get(key) as T | null
    const ok = typeof allowed === "function" ? (x: string) => allowed(x) : (x: string) => allowed.includes(x as T)
    return v && ok(v) ? v : initial
  }
  const [value, setValue] = useState<T>(read)
  useEffect(() => {
    const url = new URL(location.href)
    if (value === initial) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    history.replaceState(null, "", url)
  }, [key, value, initial])
  return [value, setValue] as const
}

/** 期間（?days=7）・比べる（?cmp=1）・地域（?region=）。URL に残るのでそのまま共有できる */
export function useFilter() {
  const [daysStr, setDaysStr] = useQueryState<string>("days", "", ["", ...DAY_OPTIONS.map(String)])
  const [cmp, setCmp] = useQueryState<string>("cmp", "", ["", "1"])
  const [region, setRegion] = useQueryState<string>("region", "", ["", ...regions])
  const days = Number(daysStr) || 0
  return {
    days,
    setDays: (d: number) => setDaysStr(d ? String(d) : ""),
    compare: cmp === "1" && days > 0,
    setCompare: (v: boolean) => setCmp(v ? "1" : ""),
    region,
    setRegion,
  }
}

export type FilterState = ReturnType<typeof useFilter>

export function Segmented<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="lab shrink-0 pr-1">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex min-w-0 flex-wrap">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-11 shrink-0 cursor-pointer px-2.5 text-[12px] whitespace-nowrap text-ink hover:bg-cellhover",
              value === o.value && "font-bold after:absolute after:inset-x-2 after:bottom-1.5 after:h-0.5 after:bg-ink"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const dayOptions = [
  { value: "0", label: "全期間" },
  ...DAY_OPTIONS.map((d) => ({ value: String(d), label: `過去${d}日` })),
]

export const regionOptions = [{ value: "", label: "全地域" }, ...regions.map((r) => ({ value: r, label: r }))]

/** "11/22〜11/28" */
export function rangeLabel(days: number) {
  return `${shortDate(sinceDate(days))}〜${shortDate(todayISO())}`
}

export function FilterBar({ f, compare }: { f: FilterState; compare?: boolean }) {
  return (
    <div className="border-b border-line px-4">
      <div className="flex flex-wrap items-center gap-x-5">
        <Segmented label="期間" value={String(f.days)} options={dayOptions} onChange={(v) => f.setDays(Number(v))} />
        <Segmented label="地域" value={f.region} options={regionOptions} onChange={f.setRegion} />
      </div>
      {f.days > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 pb-2 text-[12px] text-mute">
          <span>
            今日から数えて過去 {f.days} 日（<span className="num">{rangeLabel(f.days)}</span>）の試合。
            一番新しい試合は <span className="num">{shortDate(latestMatchDate())}</span>。
          </span>
          {compare && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-ink">
              <input
                type="checkbox"
                checked={f.compare}
                onChange={(e) => f.setCompare(e.target.checked)}
                className="size-4 cursor-pointer accent-(--ink)"
              />
              それ以前と比べる
            </label>
          )}
        </div>
      )}
    </div>
  )
}

export const asFilter = (f: Pick<FilterState, "days" | "region">): Filter => ({ days: f.days, region: f.region })
