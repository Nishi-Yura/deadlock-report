import { HeroIcon, Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { asFilter, FilterBar, useFilter } from "@/components/report/filters"
import { SortTable, type Column } from "@/components/report/sort-table"
import { kills, reportPath, stageOf } from "@/lib/report"
import {
  filterMaps, heroPath, heroUsage, inDays, mapLink, mapShort, pct, playerPath, playerStats, playerTotals,
  MIN_MAPS, seriesDate, slug, teamPath, teamStats, wins, type Filter, type TeamStat,
} from "@/lib/stats"
import { cn } from "@/lib/utils"
import { vsPath } from "@/pages/vs-page"

/** 期間・地域で絞ったチームの戦績 */
function filtered(t: TeamStat, f: Filter): TeamStat {
  return {
    ...t,
    maps: t.maps.filter((m) => filterMaps([m.ctx], f).length > 0),
    series: t.series.filter((s) => inDays(seriesDate(s.report, s.series), f.days) && (!f.region || s.series.region === f.region)),
  }
}

export function TeamsPage() {
  const f = useFilter()
  const rows = teamStats()
    .map((t) => filtered(t, asFilter(f)))
    .filter((t) => t.series.length > 0)
    .map((t) => ({ ...t, titles: t.series.filter((s) => s.win && stageOf(s.series) === "決勝").length }))

  const columns: Column<TeamStat>[] = [
    {
      key: "name", label: "チーム", align: "left", sort: (t) => t.name,
      render: (t) => <a href={teamPath(t.name)} className="font-num text-[15px] font-semibold">{t.name}</a>,
    },
    { key: "region", label: "地域", align: "left", sort: (t) => t.regions.join(), render: (t) => <span className="text-mute">{t.regions.join(" / ")}</span> },
    { key: "titles", label: "優勝", sort: (t) => t.titles, render: (t) => (t.titles ? <b className="text-win">{t.titles}</b> : <span className="text-mute">0</span>) },
    { key: "series", label: "シリーズ", sort: (t) => wins(t.series) - (t.series.length - wins(t.series)) / 100, render: (t) => `${wins(t.series)}-${t.series.length - wins(t.series)}` },
    { key: "maps", label: "マップ", sort: (t) => wins(t.maps) - (t.maps.length - wins(t.maps)) / 100, render: (t) => (t.maps.length ? `${wins(t.maps)}-${t.maps.length - wins(t.maps)}` : <span className="text-mute">–</span>) },
    {
      key: "wr", label: "マップ勝率", sort: (t) => (t.maps.length ? wins(t.maps) / t.maps.length : -1),
      render: (t) => (t.maps.length ? <WinPct w={wins(t.maps)} n={t.maps.length} /> : <span className="text-mute">–</span>),
    },
    {
      key: "heroes", label: "よく使うヒーロー", align: "left", hideOnMobile: true,
      render: (t) => (
        <span className="flex gap-1">
          {teamHeroes(t).slice(0, 4).map((h) => <HeroIcon key={h.hero} hero={h.hero} size={22} />)}
        </span>
      ),
    },
  ]

  return (
    <>
      <SiteBar current="teams" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="text-[20px] leading-snug font-bold max-sm:text-[18px]">チーム</h1>
            <p className="m-0 mt-1 text-[14px] text-mute">レポートに出てきたチームの戦績。チーム名からそのチームのページへ。2チームを並べるなら<a href="/deadlock-report/vs/">対戦カード</a>。</p>
          </div>
          <FilterBar f={f} />
          {rows.length ? (
            <SortTable rows={rows} columns={columns} rowKey={(t) => t.name} initialSort={{ key: "titles", desc: true }} minWidth={440} caption="チームの戦績" />
          ) : (
            <p className="m-0 px-4 py-4 text-mute">この条件の試合はまだありません。</p>
          )}
        </Panel>
      </main>
      <SiteFoot />
    </>
  )
}

function WinPct({ w, n }: { w: number; n: number }) {
  const p = pct(w, n)
  // マップが少ないときは色を付けない（stats.ts の MIN_MAPS）
  if (n < MIN_MAPS) return <span className="text-mute" title={`${MIN_MAPS}マップ未満`}>{p}%</span>
  return <span className={cn("font-semibold", p > 50 && "text-win", p < 50 && "text-lose")}>{p}%</span>
}

function teamHeroes(t: TeamStat) {
  return heroUsage(t.maps.flatMap((m) => m.ctx.map.teams[m.side].picks.map((hero) => ({ hero, win: m.win }))))
}

function banUsage(t: TeamStat, by: "us" | "them") {
  const xs = t.maps
    .filter((m) => !m.ctx.map.draftUnknown)
    .flatMap((m) => m.ctx.map.teams[by === "us" ? m.side : 1 - m.side].bans.map((hero) => ({ hero, win: m.win })))
  return heroUsage(xs)
}

export function TeamPage({ slug: s }: { slug: string }) {
  const t = teamStats().find((x) => slug(x.name) === s)
  if (!t) throw new Error(`チーム ${s} がありません`)
  const draftMaps = t.maps.filter((m) => !m.ctx.map.draftUnknown).length
  const roster = playerStats()
    .map((p) => ({ ...p, maps: p.maps.filter((m) => m.team === t.name) }))
    .filter((p) => p.maps.length)
    .sort((a, b) => b.maps.length - a.maps.length || a.name.localeCompare(b.name))
  const heroes = teamHeroes(t)
  const bansUs = banUsage(t, "us")
  const bansThem = banUsage(t, "them")

  return (
    <>
      <SiteBar current="teams" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-4">
            <a href="/deadlock-report/teams/" className="py-3 font-semibold">チーム一覧</a>
            <span className="py-3 text-[13px] text-mute">{t.regions.join(" / ")}</span>
          </div>
          <div className="px-4 pt-4 pb-4">
            <h1 className="font-num text-[32px] leading-none font-bold">{t.name}</h1>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              <Stat label="優勝" value={t.titles} />
              <Stat label="シリーズ" value={`${wins(t.series)}-${t.series.length - wins(t.series)}`} />
              <Stat label="マップ" value={`${wins(t.maps)}-${t.maps.length - wins(t.maps)}`} />
              {t.maps.length > 0 && <Stat label="マップ勝率" value={`${pct(wins(t.maps), t.maps.length)}%`} />}
            </dl>
          </div>
        </Panel>

        <Panel>
          <Label>シリーズ</Label>
          <ul className="m-0 list-none p-0 pt-1">
            {t.series.map((x, i) => (
              <li key={i} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 border-b border-line px-4 py-2 last:border-0 max-sm:grid-cols-[1fr_auto]">
                <span className="num text-[13px] text-mute max-sm:col-span-2">{seriesDate(x.report, x.series).replaceAll("-", ".")}</span>
                <span className="min-w-0">
                  <a href={teamPath(x.opponent)} className="font-semibold">vs {x.opponent}</a>
                  <a href={reportPath(x.report.id)} className="ml-2 text-[13px] text-mute">#{x.report.id} {x.series.region} {stageOf(x.series)}</a>
                  <a href={vsPath(t.name, x.opponent)} className="ml-2 text-[13px]">対戦カード</a>
                </span>
                <span className={cn("num font-num text-[17px] font-bold", x.win ? "text-win" : "text-lose")}>
                  {x.score[0]}-{x.score[1]}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {t.maps.length > 0 && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              <Panel>
                <Label>ピックしたヒーロー（{t.maps.length}マップ）</Label>
                <HeroList rows={heroes} />
              </Panel>
              <Panel>
                <Label>BAN（配信のあった{draftMaps}マップ）</Label>
                {draftMaps ? (
                  <div className="grid grid-cols-2 gap-x-2 pt-1">
                    <div>
                      <div className="px-4 pt-1 text-[11px] text-mute">BAN した</div>
                      <HeroList rows={bansUs} plain />
                    </div>
                    <div>
                      <div className="px-4 pt-1 text-[11px] text-mute">BAN された</div>
                      <HeroList rows={bansThem} plain />
                    </div>
                  </div>
                ) : (
                  <p className="m-0 px-4 py-3 text-mute">ドラフトが分かるマップがありません。</p>
                )}
              </Panel>
            </div>

            <Panel>
              <Label>マップ</Label>
              <div className="overflow-x-auto pt-1">
                <table className="w-full min-w-[480px] text-[13px]">
                  <tbody>
                    {t.maps.map((m) => {
                      const [k0, k1] = kills(m.ctx.map)
                      const [ka, kb] = m.side === 0 ? [k0, k1] : [k1, k0]
                      return (
                        <tr key={m.ctx.map.id + m.ctx.report.id} className="border-b border-line last:border-0 hover:bg-cellhover">
                          <td className="num py-1.5 pl-4 text-[13px] whitespace-nowrap text-mute">{m.ctx.date.slice(5).replace("-", "/")}</td>
                          <td className="px-2 whitespace-nowrap"><a href={mapLink(m.ctx)}>{mapShort(m.ctx.map)}</a></td>
                          <td className="px-2 whitespace-nowrap">vs <a href={teamPath(m.opponent)}>{m.opponent}</a></td>
                          <td className={cn("px-2 font-bold", m.win ? "text-win" : "text-lose")}>{m.win ? "勝ち" : "負け"}</td>
                          <td className="num px-2 text-right">{ka}-{kb}</td>
                          <td className="num px-2 text-right text-mute">{m.ctx.map.duration}</td>
                          <td className="py-1.5 pr-4">
                            <span className="flex justify-end gap-0.5">
                              {m.ctx.map.teams[m.side].picks.map((h) => <HeroIcon key={h} hero={h} size={20} />)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel>
              <Label>選手</Label>
              <div className="overflow-x-auto pt-1">
                <table className="w-full min-w-[420px] text-[13px]">
                  <thead>
                    <tr className="text-[11px] text-mute">
                      <th className="py-1 pl-4 text-left font-semibold">選手</th>
                      <th className="px-2 text-right font-semibold">マップ</th>
                      <th className="px-2 text-right font-semibold">K / D / A（平均）</th>
                      <th className="py-1 pr-4 text-left font-semibold">ヒーロー</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((p) => {
                      const s = playerTotals(p.maps)
                      const avg = (n: number) => (n / s.maps).toFixed(1)
                      return (
                        <tr key={p.name} className="border-t border-line hover:bg-cellhover">
                          <td className="py-1.5 pl-4"><a href={playerPath(p.name)} className="font-semibold">{p.name}</a></td>
                          <td className="num px-2 text-right">{s.maps}</td>
                          <td className="num px-2 text-right whitespace-nowrap">{avg(s.k)} / {avg(s.d)} / {avg(s.a)}</td>
                          <td className="py-1.5 pr-4">
                            <span className="flex gap-0.5">
                              {heroUsage(p.maps).slice(0, 5).map((h) => <HeroIcon key={h.hero} hero={h.hero} size={20} />)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </main>
      <SiteFoot />
    </>
  )
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[13px] text-mute">{label}</dt>
      <dd className="num m-0 font-num text-[20px] font-semibold">{value}</dd>
    </div>
  )
}

/** ヒーロー・回数・勝敗の短い一覧 */
export function HeroList({ rows, plain }: { rows: { hero: string; n: number; win: number }[]; plain?: boolean }) {
  if (!rows.length) return <p className="m-0 px-4 py-2 text-mute">なし</p>
  return (
    <div className="pt-1 pb-2">
      {rows.map((h) => (
        <div key={h.hero} className={cn("grid items-center gap-2 px-4 py-[4px] even:bg-cellhover", plain ? "grid-cols-[22px_1fr_24px]" : "grid-cols-[22px_1fr_28px_44px]")}>
          <HeroIcon hero={h.hero} size={22} />
          <a href={heroPath(h.hero)} className="truncate text-ink">{h.hero}</a>
          <span className="num text-right">{h.n}</span>
          {!plain && <span className="num text-right text-mute">{h.win}-{h.n - h.win}</span>}
        </div>
      ))}
    </div>
  )
}

