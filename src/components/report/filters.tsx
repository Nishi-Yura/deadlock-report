// 期間・地域の切り替え。選んだ値は URL の ?period=&region= に残す（そのまま共有できる）
import { useEffect, useState } from "react"
import { latestPatch, regions, shortDate, type Filter, type Period } from "@/lib/stats"
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

export function useFilter(extraPeriods: string[] = []) {
  const [period, setPeriod] = useQueryState<string>("period", "all", ["all", "post", "pre", ...extraPeriods])
  const [region, setRegion] = useQueryState<string>("region", "", ["", ...regions])
  return { period, setPeriod, region, setRegion }
}

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

export function periodOptions(compare = false): { value: string; label: string }[] {
  if (!latestPatch) return [{ value: "all", label: "全期間" }]
  const d = shortDate(latestPatch.date)
  return [
    { value: "all", label: "全期間" },
    { value: "post", label: `${d} パッチ後` },
    { value: "pre", label: `${d} パッチ前` },
    ...(compare ? [{ value: "compare", label: "前後を比較" }] : []),
  ]
}

export const regionOptions = [{ value: "", label: "全地域" }, ...regions.map((r) => ({ value: r, label: r }))]

export function FilterBar({
  period, setPeriod, region, setRegion, compare,
}: ReturnType<typeof useFilter> & { compare?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 border-b border-line px-4">
      <Segmented label="期間" value={period} options={periodOptions(compare)} onChange={setPeriod} />
      <Segmented label="地域" value={region} options={regionOptions} onChange={setRegion} />
    </div>
  )
}

export const asFilter = (period: string, region: string): Filter => ({
  period: (period === "compare" ? "all" : period) as Period,
  region,
})
