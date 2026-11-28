import type { ReactNode } from "react"
import { HeroIcon, Label, Note, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { asFilter, FilterBar, useFilter } from "@/components/report/filters"
import { Bar } from "@/components/report/sort-table"
import { fmt } from "@/lib/report"
import { allMaps, filterMaps, heroPath, mapLink, mapShort, pct, teamPath, MIN_HERO } from "@/lib/stats"
import {
  bansBySide, comebacks, draftedCount, durations, firstMidBoss, firstPickRate, firstPicks, firstTo,
  leaderAt, mmss, pairs, pickOrder, withTimeline, type HeroCount, type Rate,
} from "@/lib/trends"
import { cn } from "@/lib/utils"
import { Glossed } from "@/components/report/term"

export function TrendsPage() {
  const f = useFilter()
  const maps = filterMaps(allMaps, asFilter(f))
  const tlMaps = withTimeline(maps)

  return (
    <>
      <SiteBar current="trends" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="text-[20px] leading-snug font-bold max-sm:text-[18px]">試合の傾向</h1>
            <p className="m-0 mt-1 text-[14px] text-mute">
              ソウル差・Mid-Boss・ドラフトが勝敗とどれくらい結びついているか。全レポートのマップから数えています。
            </p>
          </div>
          <FilterBar f={f} />
          <p className="m-0 px-4 py-3 text-[13px] text-mute">
            <span className="num">{maps.length}</span> マップ（ソウル推移があるのは <span className="num">{tlMaps}</span>、
            ドラフトが分かるのは <span className="num">{draftedCount(maps)}</span>）。マップ数が少ないうちは、1マップで数字が大きく動きます。
          </p>
        </Panel>
        {maps.length > 0 && (
          <>
            <Flow maps={maps} />
            <Draft maps={maps} />
          </>
        )}
      </main>
      <SiteFoot />
    </>
  )
}

function RateRow({ label, sub, r }: { label: ReactNode; sub?: ReactNode; r: Rate }) {
  const p = pct(r.win, r.n)
  // 回数が少ないときは色を付けない
  const small = r.n > 0 && r.n < MIN_HERO
  return (
    <div className="grid grid-cols-[1fr_auto_auto_44px] items-center gap-3 border-b border-line px-4 py-2 last:border-0 max-sm:grid-cols-[1fr_auto_44px]">
      <div className="min-w-0">
        <div>{typeof label === "string" ? <Glossed text={label} /> : label}</div>
        {sub && <div className="text-[11px] text-mute">{sub}</div>}
      </div>
      <span className="num text-[13px] text-mute">{r.n ? `${r.win}-${r.n - r.win}` : "–"}</span>
      <span className="max-sm:hidden"><Bar value={p} className={small ? "" : p > 50 ? "bg-win" : p < 50 ? "bg-lose" : ""} /></span>
      <b title={small ? `${MIN_HERO}回未満` : undefined} className={cn("num text-right text-[15px] font-semibold", !small && p > 50 && "text-win", !small && p < 50 && "text-lose", (!r.n || small) && "font-normal text-mute")}>
        {r.n ? `${p}%` : "–"}
      </b>
    </div>
  )
}

function Flow({ maps }: { maps: Parameters<typeof leaderAt>[0] }) {
  const mid = firstMidBoss(maps)
  const backs = comebacks(maps)
  const d = durations(maps)
  const leader = [10, 15, 20].map((m) => ({ m, r: leaderAt(maps, m) }))
  return (
    <>
      <Panel>
        <Label>試合展開と勝率</Label>
        <div className="pt-1 pb-1">
          {leader.map(({ m, r }) => (
            <RateRow
              key={m}
              label={`${m}分の時点でリードしていたチーム`}
              sub={[r.close && `差 1,000 未満の ${r.close} マップは除く`, r.ended && `${r.ended} マップはそれまでに終了`].filter(Boolean).join("・") || undefined}
              r={r}
            />
          ))}
          {[5000, 10000, 20000].map((x) => (
            <RateRow key={x} label={`先に ${fmt(x)} ソウル差をつけたチーム`} r={firstTo(maps, x)} />
          ))}
          <RateRow
            label="最初の Mid-Boss を取ったチーム"
            sub={mid.n ? `最初の Mid-Boss は平均 ${mmss(mid.avgT)}` : undefined}
            r={mid}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
        <Panel>
          <Label>逆転勝ち（3,000 差以上）</Label>
          {backs.length ? (
            <ol className="m-0 list-none p-0 pt-1 pb-1">
              {backs.slice(0, 6).map((c) => (
                <li key={c.ctx.report.id + c.ctx.map.id} className="grid grid-cols-[1fr_auto] gap-x-2 border-b border-line px-4 py-2 last:border-0">
                  <span className="min-w-0">
                    <a href={teamPath(c.ctx.map.winner)} className="font-semibold">{c.ctx.map.winner}</a>
                    <span className="text-mute"> が </span>
                    <span className="num">{mmss(c.at)}</span>
                    <span className="text-mute"> に</span>
                  </span>
                  <b className="num text-right font-semibold text-lose">−{fmt(c.deficit)}</b>
                  <a href={mapLink(c.ctx)} className="col-span-2 text-[11px]">#{c.ctx.report.id} {mapShort(c.ctx.map)}</a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 px-4 py-3 text-mute">なし</p>
          )}
        </Panel>
        <Panel>
          <Label>試合時間</Label>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 pt-2.5 pb-4">
            <dt className="text-mute">平均</dt>
            <dd className="num m-0 font-num text-[20px] font-semibold">{mmss(d.avg)}</dd>
            {d.shortest && (
              <>
                <dt className="text-mute">最短</dt>
                <dd className="m-0"><span className="num font-semibold">{d.shortest.ctx.map.duration}</span> <a href={mapLink(d.shortest.ctx)} className="text-[13px]">#{d.shortest.ctx.report.id} {mapShort(d.shortest.ctx.map)}</a></dd>
                <dt className="text-mute">最長</dt>
                <dd className="m-0"><span className="num font-semibold">{d.longest.ctx.map.duration}</span> <a href={mapLink(d.longest.ctx)} className="text-[13px]">#{d.longest.ctx.report.id} {mapShort(d.longest.ctx.map)}</a></dd>
              </>
            )}
          </dl>
        </Panel>
      </div>
    </>
  )
}

function Draft({ maps }: { maps: Parameters<typeof leaderAt>[0] }) {
  const n = draftedCount(maps)
  if (!n) return null
  const order = pickOrder(maps)
  return (
    <>
      <Panel>
        <Label>ドラフト（配信のあった {n} マップ）</Label>
        <div className="pt-1 pb-1">
          <RateRow label="先行ピックのチーム" r={firstPickRate(maps)} />
        </div>
      </Panel>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
        <Panel>
          <Label>最初のピック（勝敗は先行チーム）</Label>
          <Counts rows={firstPicks(maps)} />
        </Panel>
        <Panel>
          <Label>早く取られるヒーロー（3回以上）</Label>
          <Note label="この数字の読み方" className="mt-2">チームの中で何番目に取ったかの平均。「1・2番目」はその回数</Note>
          <div className="pt-1 pb-2">
            {order.slice(0, 12).map((h) => (
              <div key={h.hero} className="grid grid-cols-[22px_1fr_40px_44px] items-center gap-2 px-4 py-[4px] even:bg-cellhover">
                <HeroIcon hero={h.hero} size={22} />
                <a href={heroPath(h.hero)} className="truncate text-ink">{h.hero}</a>
                <span className="num text-right font-semibold">{h.avg.toFixed(1)}</span>
                <span className="num text-right text-[13px] text-mute">{h.early}/{h.n}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <Label>先行チームの BAN</Label>
          <Counts rows={bansBySide(maps, 0)} plain />
        </Panel>
        <Panel>
          <Label>後攻チームの BAN</Label>
          <Counts rows={bansBySide(maps, 1)} plain />
        </Panel>
      </div>
      <Pairs maps={maps} />
    </>
  )
}

function Pairs({ maps }: { maps: Parameters<typeof pairs>[0] }) {
  const rows = pairs(maps, 3).slice(0, 12)
  return (
    <Panel>
      <Label>よく一緒にピックされる2体（3回以上）</Label>
      <Note label="この数字の読み方" className="mt-2">同じチームで一緒に使われた回数と、そのときの勝敗。配信のないマップも含む。</Note>
      {rows.length ? (
        <div className="grid grid-cols-2 gap-x-2 pt-1 pb-2 max-sm:grid-cols-1">
          {rows.map((p) => {
            const rate = pct(p.win, p.n)
            return (
              <div key={p.a + p.b} className="grid grid-cols-[48px_1fr_24px_36px_38px] items-center gap-2 px-4 py-[5px] odd:bg-cellhover">
                <span className="flex gap-0.5"><HeroIcon hero={p.a} size={22} /><HeroIcon hero={p.b} size={22} /></span>
                <span className="min-w-0 truncate text-[13px]">
                  <a href={heroPath(p.a)} className="text-ink">{p.a}</a> + <a href={heroPath(p.b)} className="text-ink">{p.b}</a>
                </span>
                <span className="num text-right">{p.n}</span>
                <span className="num text-right text-mute">{p.win}-{p.n - p.win}</span>
                <b className={cn("num text-right font-semibold", rate > 50 && "text-win", rate < 50 && "text-lose")}>{rate}%</b>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="m-0 px-4 py-3 text-mute">3回以上一緒に使われた組み合わせはまだありません。</p>
      )}
    </Panel>
  )
}

function Counts({ rows, plain }: { rows: HeroCount[]; plain?: boolean }) {
  if (!rows.length) return <p className="m-0 px-4 py-3 text-mute">なし</p>
  return (
    <div className="pt-1 pb-2">
      {rows.slice(0, 10).map((h) => (
        <div key={h.hero} className={cn("grid items-center gap-2 px-4 py-[4px] even:bg-cellhover", plain ? "grid-cols-[22px_1fr_28px]" : "grid-cols-[22px_1fr_28px_44px]")}>
          <HeroIcon hero={h.hero} size={22} />
          <a href={heroPath(h.hero)} className="truncate text-ink">{h.hero}</a>
          <span className="num text-right">{h.n}</span>
          {!plain && <span className="num text-right text-mute">{h.win}-{h.n - h.win}</span>}
        </div>
      ))}
    </div>
  )
}
