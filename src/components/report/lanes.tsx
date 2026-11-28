// レーン戦（9:00 時点のソウル）。ヒーローページの「レーン戦」と、/trends/ の「レーン戦に強いヒーロー」
import { useState } from "react"
import { HeroIcon, Label, Note, Panel } from "./parts"
import { Term } from "./term"
import { fmt } from "@/lib/report"
import { heroPath, mapLink, mapShort, MIN_HERO, pct, type MapCtx } from "@/lib/stats"
import { LANE_MIN, laneMatches, laneStats } from "@/lib/trends"
import { cn } from "@/lib/utils"

/** +1,234 / −1,234。0 は ±0 */
export function SoulDiff({ v, className }: { v: number; className?: string }) {
  return (
    <span className={cn("num font-semibold", v > 0 && "text-win", v < 0 && "text-lose", !v && "text-mute", className)}>
      {v > 0 ? "+" : v < 0 ? "−" : "±"}{fmt(Math.abs(v))}
    </span>
  )
}

const TOP = 10

function More({ total, open, onToggle, unit }: { total: number; open: boolean; onToggle: () => void; unit: string }) {
  if (total <= TOP) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-11 w-full cursor-pointer items-center justify-center border-t border-line text-[13px] font-semibold text-link hover:bg-cellhover focus-visible:bg-cellhover focus-visible:outline-none"
    >
      {open ? `${TOP} ${unit}だけ表示` : `すべて表示（あと ${total - TOP} ${unit}）`}
    </button>
  )
}

/** レーン勝ちの割合。回数が少ないときは色を付けない */
function LaneRate({ win, n }: { win: number; n: number }) {
  const p = pct(win, n)
  if (n < MIN_HERO) return <span className="num text-mute" title={`${MIN_HERO}回未満`}>{p}%</span>
  return <b className={cn("num font-semibold", p > 50 && "text-win", p < 50 && "text-lose")}>{p}%</b>
}

const readNote = (
  <>
    {LANE_MIN}:00 の時点で、同じレーンの2人のソウルの合計が相手の2人より多ければ「レーン勝ち」。
    「差」はそのヒーロー1人のソウルと、相手2人の平均との差（マップごとの平均）。
    レーンの外で稼いだソウルも入るので、レーンの強さだけを表す数字ではありません。
  </>
)

/** ヒーローページ：このヒーローのレーン戦 */
export function HeroLanes({ hero, maps }: { hero: string; maps: MapCtx[] }) {
  const [open, setOpen] = useState(false)
  const xs = laneMatches(maps).filter((x) => x.hero === hero)
  if (!xs.length) return null
  const won = xs.filter((x) => x.laneWin).length
  const avg = Math.round(xs.reduce((s, x) => s + x.diff, 0) / xs.length)
  // 向き合った相手
  const opp = new Map<string, { hero: string; n: number; laneWin: number }>()
  for (const x of xs) {
    for (const h of x.opp) {
      const r = opp.get(h) ?? { hero: h, n: 0, laneWin: 0 }
      r.n++
      if (x.laneWin) r.laneWin++
      opp.set(h, r)
    }
  }
  const opps = [...opp.values()].sort((a, b) => b.n - a.n || a.hero.localeCompare(b.hero))
  return (
    <Panel>
      <Label><Term k="lane">レーン戦</Term>（{LANE_MIN}:00 時点・{xs.length} マップ）</Label>
      <dl className="m-0 flex flex-wrap gap-x-8 gap-y-1 px-4 pt-2 pb-3">
        <div>
          <dt className="text-[13px] text-mute">レーン勝ち</dt>
          <dd className="m-0 text-[20px]"><LaneRate win={won} n={xs.length} /> <span className="num text-[13px] text-mute">{won}-{xs.length - won}</span></dd>
        </div>
        <div>
          <dt className="text-[13px] text-mute">相手との差（平均）</dt>
          <dd className="m-0 text-[20px]"><SoulDiff v={avg} /></dd>
        </div>
      </dl>
      <div className="overflow-x-auto border-t border-line pt-1">
        <table className="w-full text-[13px]">
          <caption className="sr-only">マップごとのレーン戦</caption>
          <thead>
            <tr className="text-[11px] text-mute">
              <th className="py-1 pl-4 text-left font-semibold">マップ</th>
              <th className="px-2 text-left font-semibold">味方</th>
              <th className="px-2 text-left font-semibold">相手</th>
              <th className="py-1 pr-4 text-right font-semibold">レーン・差</th>
            </tr>
          </thead>
          <tbody>
            {(open ? xs : xs.slice(0, TOP)).map((x) => (
              <tr key={x.ctx.report.id + x.ctx.map.id + x.side} className="border-t border-line">
                <td className="py-1.5 pl-4"><a href={mapLink(x.ctx)}>#{x.ctx.report.id} {mapShort(x.ctx.map)}</a></td>
                <td className="px-2"><HeroIcon hero={x.mate} size={22} /></td>
                <td className="px-2"><span className="flex gap-0.5">{x.opp.map((h) => <HeroIcon key={h} hero={h} size={22} />)}</span></td>
                <td className="py-1.5 pr-4 text-right whitespace-nowrap">
                  <b className={cn("mr-2 font-bold max-sm:mr-0 max-sm:block", x.laneWin ? "text-win" : "text-lose")}>{x.laneWin ? "勝ち" : "負け"}</b>
                  <SoulDiff v={x.diff} className="font-normal" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <More total={xs.length} open={open} onToggle={() => setOpen(!open)} unit="マップ" />
      <div className="border-t border-line px-4 pt-2 pb-2">
        <div className="text-[11px] font-bold text-mute">レーンで向き合った相手（回数・そのときのレーン勝敗）</div>
        <div className="grid grid-cols-2 gap-x-2 pt-1 max-sm:grid-cols-1">
          {opps.slice(0, 10).map((o) => (
            <div key={o.hero} className="grid grid-cols-[22px_1fr_24px_40px] items-center gap-2 py-[3px]">
              <HeroIcon hero={o.hero} size={22} />
              <a href={heroPath(o.hero)} className="truncate text-ink">{o.hero}</a>
              <span className="num text-right">{o.n}</span>
              <span className="num text-right text-mute">{o.laneWin}-{o.n - o.laneWin}</span>
            </div>
          ))}
        </div>
      </div>
      <Note>{readNote}</Note>
    </Panel>
  )
}

/** /trends/：レーン戦に強いヒーロー（3回以上） */
export function LaneTable({ maps, min = 3 }: { maps: MapCtx[]; min?: number }) {
  const [open, setOpen] = useState(false)
  const all = laneStats(maps)
  if (!all.length) return null
  const rows = all.filter((r) => r.n >= min).sort((a, b) => b.avgDiff - a.avgDiff || b.n - a.n)
  const shown = open ? rows : rows.slice(0, TOP)
  return (
    <Panel>
      <Label><Term k="lane">レーン戦</Term>に強いヒーロー（{LANE_MIN}:00 時点・{min}回以上）</Label>
      {rows.length ? (
        <div className="overflow-x-auto pt-1 pb-1">
          <table className="w-full text-[13px]">
            <caption className="sr-only">ヒーローごとのレーン戦</caption>
            <thead>
              <tr className="text-[11px] text-mute">
                <th className="py-1 pl-4 text-left font-semibold">ヒーロー</th>
                <th className="px-2 text-right font-semibold">回数</th>
                <th className="px-2 text-right font-semibold max-sm:hidden">レーン勝敗</th>
                <th className="px-2 text-right font-semibold">レーン勝ち</th>
                <th className="py-1 pr-4 text-right font-semibold">相手との差</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.hero} className="border-t border-line">
                  <td className="py-1 pl-4">
                    <span className="flex items-center gap-2">
                      <HeroIcon hero={r.hero} size={22} />
                      <a href={heroPath(r.hero)} className="truncate text-ink">{r.hero}</a>
                    </span>
                  </td>
                  <td className="num px-2 text-right">{r.n}</td>
                  <td className="num px-2 text-right text-mute max-sm:hidden">{r.laneWin}-{r.n - r.laneWin}</td>
                  <td className="px-2 text-right"><LaneRate win={r.laneWin} n={r.n} /></td>
                  <td className="py-1 pr-4 text-right"><SoulDiff v={r.avgDiff} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 px-4 py-3 text-mute">{min}回以上レーンに出たヒーローはまだいません。</p>
      )}
      <More total={rows.length} open={open} onToggle={() => setOpen(!open)} unit="体" />
      <Note>{readNote} 「相手との差」の大きい順。</Note>
    </Panel>
  )
}
