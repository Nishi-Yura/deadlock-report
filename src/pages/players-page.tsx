import { HeroIcon, Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { asFilter, FilterBar, useFilter } from "@/components/report/filters"
import { SortTable, type Column } from "@/components/report/sort-table"
import { HeroList, Stat } from "@/pages/teams-page"
import { HeroItems } from "@/components/report/hero-items"
import { fmt } from "@/lib/report"
import {
  filterMaps, heroUsage, mapLink, mapShort, pct, playerPath, playerStats, playerTotals, slug, teamPath,
  type PlayerStat, type PlayerTotals,
} from "@/lib/stats"
import { cn } from "@/lib/utils"

type Row = PlayerStat & { t: PlayerTotals }

export function PlayersPage() {
  const f = useFilter()
  const filter = asFilter(f.period, f.region)
  const rows: Row[] = playerStats()
    .map((p) => {
      const maps = p.maps.filter((m) => filterMaps([m.ctx], filter).length > 0)
      return { ...p, maps, t: playerTotals(maps) }
    })
    .filter((p) => p.maps.length)

  const avg = (n: number, r: Row) => (n / r.t.maps).toFixed(1)
  const columns: Column<Row>[] = [
    {
      key: "name", label: "選手", align: "left", sort: (r) => r.name.toLowerCase(),
      render: (r) => (
        <span className="block leading-tight">
          <a href={playerPath(r.name)} className="block max-w-[120px] truncate font-semibold">{r.name}</a>
          <span className="block max-w-[120px] truncate text-[11px] text-mute">{r.teams.join(" / ")}</span>
        </span>
      ),
    },
    { key: "maps", label: "マップ", sort: (r) => r.t.maps, render: (r) => r.t.maps },
    { key: "wr", label: "勝率", sort: (r) => r.t.wins / r.t.maps, render: (r) => <WinPct w={r.t.wins} n={r.t.maps} /> },
    { key: "kda", label: "KDA", sort: (r) => r.t.kda, render: (r) => <b className="font-semibold">{r.t.kda.toFixed(2)}</b> },
    { key: "k", label: "K", sort: (r) => r.t.k / r.t.maps, render: (r) => avg(r.t.k, r) },
    { key: "d", label: "D", sort: (r) => r.t.d / r.t.maps, render: (r) => avg(r.t.d, r) },
    { key: "a", label: "A", sort: (r) => r.t.a / r.t.maps, render: (r) => avg(r.t.a, r) },
    { key: "souls", label: "ソウル", sort: (r) => r.t.souls, render: (r) => fmt(r.t.souls) },
    { key: "dmg", label: "ダメージ", sort: (r) => r.t.dmg, render: (r) => fmt(r.t.dmg) },
    { key: "heal", label: "回復", sort: (r) => r.t.heal, render: (r) => fmt(r.t.heal) },
    {
      key: "heroes", label: "ヒーロー", align: "left",
      render: (r) => (
        <span className="flex gap-0.5">
          {heroUsage(r.maps).slice(0, 3).map((h) => <HeroIcon key={h.hero} hero={h.hero} size={20} />)}
        </span>
      ),
    },
  ]

  return (
    <>
      <SiteBar current="players" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="font-num text-[26px] leading-tight font-bold">選手</h1>
            <p className="m-0 mt-1 text-mute">
              レポートのマップに出た選手。K・D・A・ソウル・ダメージ・回復は1マップ平均、KDA は (K+A)/D。
            </p>
          </div>
          <FilterBar {...f} />
          {rows.length ? (
            <SortTable rows={rows} columns={columns} rowKey={(r) => r.name} initialSort={{ key: "kda", desc: true }} minWidth={720} caption="選手の成績" />
          ) : (
            <p className="m-0 px-4 py-4 text-mute">この条件のマップはまだありません。</p>
          )}
        </Panel>
      </main>
      <SiteFoot />
    </>
  )
}

function WinPct({ w, n }: { w: number; n: number }) {
  const p = pct(w, n)
  return <span className={cn("font-semibold", p > 50 && "text-win", p < 50 && "text-lose")}>{p}%</span>
}

export function PlayerPage({ slug: s }: { slug: string }) {
  const p = playerStats().find((x) => slug(x.name) === s)
  if (!p) throw new Error(`選手 ${s} がいません`)
  const t = playerTotals(p.maps)
  const avg = (n: number) => (n / t.maps).toFixed(1)
  const heroes = heroUsage(p.maps)

  return (
    <>
      <SiteBar current="players" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-4">
            <a href="/deadlock-report/players/" className="py-3 font-semibold">選手一覧</a>
            <span className="py-3 text-[12px]">
              {p.teams.map((name, i) => (
                <span key={name}>{i > 0 && " / "}<a href={teamPath(name)}>{name}</a></span>
              ))}
            </span>
          </div>
          <div className="px-4 pt-4 pb-4">
            <h1 className="font-num text-[32px] leading-none font-bold">{p.name}</h1>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              <Stat label="マップ" value={`${t.wins}-${t.maps - t.wins}`} />
              <Stat label="K / D / A" value={`${avg(t.k)} / ${avg(t.d)} / ${avg(t.a)}`} />
              <Stat label="KDA" value={t.kda.toFixed(2)} />
              <Stat label="ソウル" value={fmt(t.souls)} />
            </dl>
          </div>
        </Panel>

        <Panel>
          <Label>使ったヒーロー</Label>
          <HeroList rows={heroes} />
        </Panel>

        {/* よく使ったヒーロー（3体まで）ごとのアイテム。1マップでヒーローは1人なので、その選手のマップだけ渡せばその選手のビルドになる */}
        {heroes.slice(0, 3).map((h) => (
          <HeroItems
            key={h.hero}
            hero={h.hero}
            maps={p.maps.filter((m) => m.hero === h.hero).map((m) => m.ctx)}
            title={`${h.hero} のアイテム`}
            note={`${p.name} が大会で ${h.hero} を使ったときに買ったアイテム（大会全体の平均は ${h.hero} のページ）。`}
            limit={8}
          />
        ))}

        <Panel>
          <Label>マップごと</Label>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead>
                <tr className="text-[11px] text-mute">
                  <th className="py-1 pl-4 text-left font-semibold">日付</th>
                  <th className="px-2 text-left font-semibold">マップ</th>
                  <th className="px-2 text-left font-semibold">相手</th>
                  <th className="px-2 text-left font-semibold">ヒーロー</th>
                  <th className="px-2 text-right font-semibold">K / D / A</th>
                  <th className="px-2 text-right font-semibold">ソウル</th>
                  <th className="px-2 text-right font-semibold">ダメージ</th>
                  <th className="py-1 pr-4 text-right font-semibold">回復</th>
                </tr>
              </thead>
              <tbody>
                {p.maps.map((m) => (
                  <tr key={m.ctx.report.id + m.ctx.map.id} className="border-t border-line hover:bg-cellhover">
                    <td className="num py-1.5 pl-4 text-[12px] whitespace-nowrap text-mute">{m.ctx.date.slice(5).replace("-", "/")}</td>
                    <td className="px-2 whitespace-nowrap">
                      <a href={mapLink(m.ctx)}>{mapShort(m.ctx.map)}</a>{" "}
                      <b className={cn("text-[11px]", m.win ? "text-win" : "text-lose")}>{m.win ? "勝ち" : "負け"}</b>
                    </td>
                    <td className="px-2 whitespace-nowrap"><a href={teamPath(m.opponent)}>{m.opponent}</a></td>
                    <td className="px-2">
                      <span className="flex items-center gap-1.5 whitespace-nowrap"><HeroIcon hero={m.hero} size={20} />{m.hero}</span>
                    </td>
                    <td className="num px-2 text-right whitespace-nowrap">{m.k} / {m.d} / {m.a}</td>
                    <td className="num px-2 text-right">{fmt(m.souls)}</td>
                    <td className="num px-2 text-right">{fmt(m.dmg)}</td>
                    <td className="num py-1.5 pr-4 text-right">{fmt(m.heal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
      <SiteFoot />
    </>
  )
}
