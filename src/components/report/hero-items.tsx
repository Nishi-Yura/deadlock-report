// ヒーローページの「プロのアイテム」。src/items.json（npm run timeline が作る）は大きいので、
// ヒーローページを開いたときだけ読み込む（他のページの JS を重くしない）
import { useEffect, useState } from "react"
import { Label, Panel } from "./parts"
import { pct, type MapCtx } from "@/lib/stats"
import { mmss } from "@/lib/trends"
import { cn } from "@/lib/utils"

interface Item {
  name: string
  tier: number
  slot: string
  cost: number
  img: string
}
type Buys = Record<string, Record<string, [number, number][]>>

const SLOT: Record<string, string> = { weapon: "武器", vitality: "体力", spirit: "スピリット" }
const EARLY = 10 * 60

interface Row {
  id: number
  item: Item
  n: number
  avgT: number
  early: number
  first: number
}

export function HeroItems({
  hero, maps, title = "プロのアイテム", note, limit = 14,
}: {
  hero: string
  maps: MapCtx[]
  title?: string
  /** 表の上の説明。省略するとヒーローページ用の文 */
  note?: string
  /** 「よく買われたアイテム」の行数 */
  limit?: number
}) {
  const [data, setData] = useState<{ buys: Buys; cat: Record<string, Item> } | null>(null)
  useEffect(() => {
    Promise.all([import("@/items.json"), import("@/item-catalog.json")]).then(([b, c]) =>
      setData({ buys: b.default as unknown as Buys, cat: c.default as unknown as Record<string, Item> })
    )
  }, [])
  if (!data) {
    return (
      <Panel>
        <Label>{title}</Label>
        <p className="m-0 px-4 py-3 text-mute">読み込み中…</p>
      </Panel>
    )
  }

  const runs = maps.map((x) => data.buys[x.map.matchId]?.[hero]).filter((r): r is [number, number][] => !!r && r.length > 0)
  if (!runs.length) return null
  const by = new Map<number, { n: number; t: number; early: number; first: number }>()
  for (const run of runs) {
    const sorted = [...run].sort((a, b) => a[0] - b[0])
    sorted.forEach(([t, id], i) => {
      const r = by.get(id) ?? { n: 0, t: 0, early: 0, first: 0 }
      r.n++
      r.t += t
      if (t < EARLY) r.early++
      if (i < 5) r.first++
      by.set(id, r)
    })
  }
  const rows: Row[] = [...by.entries()]
    .filter(([id]) => data.cat[id])
    .map(([id, r]) => ({ id, item: data.cat[id], n: r.n, avgT: r.t / r.n, early: r.early, first: r.first }))
  const popular = [...rows].sort((a, b) => b.n - a.n || a.avgT - b.avgT).slice(0, limit)
  // 1回しか使っていないときは、その試合で最初に買った5つをそのまま出す
  const minFirst = runs.length === 1 ? 1 : Math.max(2, runs.length * 0.3)
  const opening = [...rows].filter((r) => r.first >= minFirst).sort((a, b) => a.avgT - b.avgT).slice(0, 6)

  return (
    <Panel>
      <Label>{title}（{runs.length} 回分）</Label>
      <p className="m-0 px-4 pt-1 text-[12px] text-mute">
        {note ?? "大会でこのヒーローを使った選手が買ったアイテム。"}
        「購入率」は何回のうち何回買ったか、時刻は買った時間の平均（売って買い直した分は最初の1回）。
      </p>
      {opening.length > 0 && (
        <div className="px-4 pt-3">
          <div className="lab mb-1.5">最初の5つによく入るもの（買う順）</div>
          <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-2 p-0">
            {opening.map((r, i) => (
              <li key={r.id} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="px-0.5 text-mute">→</span>}
                <ItemIcon item={r.item} />
                <span className="text-[12px]">
                  {r.item.name}
                  <span className="num ml-1 text-mute">{mmss(r.avgT)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="overflow-x-auto pt-3 pb-2">
        <table className="w-full min-w-[460px] text-[13px]">
          <thead>
            <tr className="text-[11px] text-mute">
              <th className="py-1 pl-4 text-left font-semibold">よく買われたアイテム</th>
              <th className="px-2 text-left font-semibold">種類</th>
              <th className="px-2 text-right font-semibold">購入率</th>
              <th className="px-2 text-right font-semibold">平均時刻</th>
              <th className="py-1 pr-4 text-right font-semibold">10分まで</th>
            </tr>
          </thead>
          <tbody>
            {popular.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-1 pl-4">
                  <span className="flex items-center gap-2">
                    <ItemIcon item={r.item} />
                    <span className="truncate">{r.item.name}</span>
                  </span>
                </td>
                <td className="px-2 text-[12px] whitespace-nowrap text-mute">
                  {SLOT[r.item.slot] ?? r.item.slot} T{r.item.tier}
                </td>
                <td className="num px-2 text-right">
                  <b className="font-semibold">{pct(r.n, runs.length)}%</b> <span className="text-mute">{r.n}</span>
                </td>
                <td className="num px-2 text-right">{mmss(r.avgT)}</td>
                <td className={cn("num py-1 pr-4 text-right", !r.early && "text-mute")}>{r.early ? `${pct(r.early, r.n)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function ItemIcon({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="inline-grid size-6 shrink-0 place-items-center overflow-hidden bg-[#3a3a3a]" title={item.name}>
      {item.img && !failed ? (
        <img src={item.img} alt="" width={24} height={24} loading="lazy" onError={() => setFailed(true)} className="size-full object-contain" />
      ) : (
        <span className="text-[9px] font-bold text-white">T{item.tier}</span>
      )}
    </span>
  )
}
