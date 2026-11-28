import { HeroIcon, Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { HeroItems } from "@/components/report/hero-items"
import { Stat } from "@/pages/teams-page"
import { fmt } from "@/lib/report"
import {
  allMaps, heroPath, heroTable, latestPatch, mapLink, mapShort, pct, periodOf, playerPath, shortDate, slug, teamPath,
  type MapCtx,
} from "@/lib/stats"
import { partners } from "@/lib/trends"
import { cn } from "@/lib/utils"
import type { PlayerRow } from "@/types"

interface Played {
  ctx: MapCtx
  team: string
  opponent: string
  win: boolean
  pick: number
  row?: PlayerRow
}

/** ピックか BAN で一度でも出てきたヒーロー名（entries.mjs と同じ範囲） */
export function heroesSeen(): string[] {
  return heroTable(allMaps).rows.map((r) => r.hero)
}

export function HeroPage({ slug: s }: { slug: string }) {
  const hero = heroesSeen().find((h) => slug(h) === s)
  if (!hero) throw new Error(`ヒーロー ${s} がいません`)

  const played: Played[] = []
  const banned: { ctx: MapCtx; by: string[] }[] = []
  for (const ctx of allMaps) {
    ctx.map.teams.forEach((t, i) => {
      const pick = t.picks.indexOf(hero)
      if (pick === -1) return
      played.push({
        ctx, team: t.name, opponent: ctx.map.teams[1 - i].name, win: t.name === ctx.map.winner,
        pick: ctx.map.draftUnknown ? 0 : pick + 1,
        row: t.players.find((p) => p[1] === hero),
      })
    })
    const by = ctx.map.teams.filter((t) => t.bans.includes(hero)).map((t) => t.name)
    if (by.length) banned.push({ ctx, by })
  }
  const all = heroTable(allMaps)
  const draftMaps = all.draftMaps
  const wins = played.filter((p) => p.win).length

  const periods = latestPatch
    ? (["pre", "post"] as const).map((per) => {
        const maps = allMaps.filter((x) => periodOf(x.date) === per)
        const t = heroTable(maps)
        const r = t.rows.find((x) => x.hero === hero)
        return { per, maps: t.maps, draftMaps: t.draftMaps, picks: r?.picks ?? 0, wins: r?.wins ?? 0, bans: r?.bans ?? 0 }
      })
    : []

  // 選手ごと
  const byPlayer = new Map<string, { name: string; team: string; n: number; win: number; k: number; d: number; a: number; souls: number }>()
  for (const p of played) {
    if (!p.row) continue
    const [name, , k, d, a, souls] = p.row
    const r = byPlayer.get(name) ?? { name, team: p.team, n: 0, win: 0, k: 0, d: 0, a: 0, souls: 0 }
    r.n++
    if (p.win) r.win++
    r.k += k; r.d += d; r.a += a; r.souls += souls
    byPlayer.set(name, r)
  }
  const players = [...byPlayer.values()].sort((a, b) => b.n - a.n || b.win - a.win || a.name.localeCompare(b.name))

  // BAN したチーム
  const banTeams = new Map<string, number>()
  for (const b of banned) for (const t of b.by) banTeams.set(t, (banTeams.get(t) ?? 0) + 1)
  const banList = [...banTeams.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const picksKnown = played.filter((p) => p.pick)
  const avgPick = picksKnown.length ? picksKnown.reduce((s, p) => s + p.pick, 0) / picksKnown.length : 0

  return (
    <>
      <SiteBar current="stats" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-4">
            <a href="/deadlock-report/stats/" className="py-3 font-semibold">ヒーロー統計</a>
            <span className="py-3 text-[12px] text-mute">全 {all.maps} マップ</span>
          </div>
          <div className="flex items-center gap-4 px-4 pt-4 pb-4">
            <HeroIcon hero={hero} size={64} />
            <div className="min-w-0">
              <h1 className="font-num text-[32px] leading-none font-bold">{hero}</h1>
              <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                <Stat label="ピック" value={`${played.length}（${pct(played.length, all.maps)}%）`} />
                <Stat label="勝敗" value={`${wins}-${played.length - wins}`} />
                <Stat label="BAN" value={`${banned.length}（${pct(banned.length, draftMaps)}%）`} />
                {avgPick > 0 && <Stat label="平均ピック順" value={avgPick.toFixed(1)} />}
              </dl>
            </div>
          </div>
        </Panel>

        {latestPatch && (
          <Panel>
            <Label>{shortDate(latestPatch.date)} パッチの前と後</Label>
            <div className="grid grid-cols-2 gap-px pt-2">
              {periods.map((p) => (
                <div key={p.per} className="px-4 pb-3">
                  <div className="text-[12px] text-mute">{p.per === "pre" ? "パッチ前" : "パッチ後"}（{p.maps} マップ）</div>
                  {p.maps ? (
                    <div className="mt-1 leading-7">
                      <div>ピック <b className="num">{pct(p.picks, p.maps)}%</b> <span className="num text-mute">{p.picks}</span></div>
                      <div>勝敗 <b className="num">{p.wins}-{p.picks - p.wins}</b></div>
                      <div>BAN <b className="num">{pct(p.bans, p.draftMaps)}%</b> <span className="num text-mute">{p.bans}</span></div>
                    </div>
                  ) : (
                    <div className="mt-1 text-mute">まだマップなし</div>
                  )}
                </div>
              ))}
            </div>
            <p className="m-0 border-t border-line px-4 py-2.5 text-[12px]"><a href={latestPatch.path}>{latestPatch.title} のまとめ</a></p>
          </Panel>
        )}

        {played.length > 0 && <HeroItems hero={hero} maps={played.map((p) => p.ctx)} />}

        {played.length > 0 && (
          <Panel>
            <Label>一緒にピックされたヒーロー</Label>
            <p className="m-0 px-4 pt-1 text-[12px] text-mute">同じチームで使われた回数と、そのときの勝敗。まだマップが少ないので、1〜2回の組み合わせは参考程度に。</p>
            <div className="grid grid-cols-2 gap-x-2 pt-1 pb-2 max-sm:grid-cols-1">
              {partners(allMaps, hero).slice(0, 10).map((h) => (
                <div key={h.hero} className="grid grid-cols-[22px_1fr_24px_40px] items-center gap-2 px-4 py-[4px] odd:bg-cellhover">
                  <HeroIcon hero={h.hero} size={22} />
                  <a href={heroPath(h.hero)} className="truncate text-ink">{h.hero}</a>
                  <span className="num text-right">{h.n}</span>
                  <span className="num text-right text-mute">{h.win}-{h.n - h.win}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel>
            <Label>使った選手</Label>
            {players.length ? (
              <div className="overflow-x-auto pt-1 pb-1">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] text-mute">
                      <th className="py-1 pl-4 text-left font-semibold">選手</th>
                      <th className="px-2 text-right font-semibold">勝敗</th>
                      <th className="py-1 pr-4 text-right font-semibold">K / D / A（平均）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.name} className="border-t border-line">
                        <td className="py-1.5 pl-4">
                          <a href={playerPath(p.name)} className="font-semibold">{p.name}</a>
                          <a href={teamPath(p.team)} className="ml-1.5 text-[11px] text-mute">{p.team}</a>
                        </td>
                        <td className="num px-2 text-right whitespace-nowrap">{p.win}-{p.n - p.win}</td>
                        <td className="num py-1.5 pr-4 text-right whitespace-nowrap">{(p.k / p.n).toFixed(1)} / {(p.d / p.n).toFixed(1)} / {(p.a / p.n).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="m-0 px-4 py-3 text-mute">ピックされたマップはまだありません。</p>
            )}
          </Panel>
          <Panel>
            <Label>BAN したチーム</Label>
            {banList.length ? (
              <div className="pt-1 pb-2">
                {banList.map(([team, n]) => (
                  <div key={team} className="grid grid-cols-[1fr_28px] px-4 py-[5px] even:bg-cellhover">
                    <a href={teamPath(team)}>{team}</a>
                    <span className="num text-right">{n}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 px-4 py-3 text-mute">なし</p>
            )}
          </Panel>
        </div>

        {played.length > 0 && (
          <Panel>
            <Label>ピックされたマップ</Label>
            <div className="overflow-x-auto pt-1">
              <table className="w-full min-w-[560px] text-[13px]">
                <tbody>
                  {played.map((p) => (
                    <tr key={p.ctx.report.id + p.ctx.map.id + p.team} className="border-b border-line last:border-0 hover:bg-cellhover">
                      <td className="num py-1.5 pl-4 text-[12px] whitespace-nowrap text-mute">{p.ctx.date.slice(5).replace("-", "/")}</td>
                      <td className="px-2 whitespace-nowrap"><a href={mapLink(p.ctx)}>{mapShort(p.ctx.map)}</a></td>
                      <td className="px-2 whitespace-nowrap">
                        <a href={teamPath(p.team)} className="font-semibold">{p.team}</a>
                        <span className="text-mute"> vs </span>
                        <a href={teamPath(p.opponent)}>{p.opponent}</a>
                      </td>
                      <td className={cn("px-2 font-bold", p.win ? "text-win" : "text-lose")}>{p.win ? "勝ち" : "負け"}</td>
                      <td className="num px-2 text-right text-[12px] text-mute">{p.pick ? `${p.pick}番目` : ""}</td>
                      <td className="px-2 whitespace-nowrap">{p.row && <a href={playerPath(p.row[0])}>{p.row[0]}</a>}</td>
                      <td className="num py-1.5 pr-4 text-right whitespace-nowrap">
                        {p.row && <>{p.row[2]} / {p.row[3]} / {p.row[4]} <span className="text-mute">・{fmt(p.row[5])}</span></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </main>
      <SiteFoot />
    </>
  )
}
