// 対戦カード。?a=チーム&b=チーム の2チームの直接の対戦と、それぞれの傾向を並べる
import { HeroIcon, Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { useQueryState } from "@/components/report/filters"
import { kills, reportPath, stageOf } from "@/lib/report"
import { heroPath, heroUsage, mapLink, mapShort, pct, seriesDate, teamPath, teamStats, wins, type TeamStat } from "@/lib/stats"
import { cn } from "@/lib/utils"

export const vsPath = (a: string, b: string) => `/deadlock-report/vs/?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`

export function VsPage() {
  const teams = teamStats()
  const names = teams.map((t) => t.name).sort((x, y) => x.localeCompare(y))
  // 初期値を "" にして、選んだチームは必ず URL に残す（共有したリンクが既定値の変化で変わらないように）
  const [qa, setA] = useQueryState<string>("a", "", names)
  const [qb, setB] = useQueryState<string>("b", "", names)
  const a = qa || names[0] || ""
  const b = qb || names.find((n) => n !== a) || ""
  const ta = teams.find((t) => t.name === a)
  const tb = teams.find((t) => t.name === b)

  return (
    <>
      <SiteBar current="teams" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="text-[20px] leading-snug font-bold max-sm:text-[18px]">対戦カード</h1>
            <p className="m-0 mt-1 text-[14px] text-mute">2チームの直接の対戦成績と、それぞれがよく使う・よく BAN するヒーロー。</p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line px-4 py-3">
            <TeamSelect id="vs-a" label="チーム1" value={a} names={names} onChange={setA} />
            <span className="font-num text-[15px] font-bold text-mute">vs</span>
            <TeamSelect id="vs-b" label="チーム2" value={b} names={names} onChange={setB} />
          </div>
        </Panel>
        {ta && tb && a !== b ? <Versus a={ta} b={tb} /> : (
          <Panel><p className="m-0 px-4 py-3 text-mute">違う2チームを選んでください。</p></Panel>
        )}
      </main>
      <SiteFoot />
    </>
  )
}

function TeamSelect({ id, label, value, names, onChange }: { id: string; label: string; value: string; names: string[]; onChange: (v: string) => void }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full min-w-0 cursor-pointer border border-line bg-cell px-2 font-num text-[16px] font-semibold text-ink outline-none focus:border-ink"
      >
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </>
  )
}

function Versus({ a, b }: { a: TeamStat; b: TeamStat }) {
  const series = a.series.filter((s) => s.opponent === b.name)
  const maps = a.maps.filter((m) => m.opponent === b.name)
  const sw = wins(series)
  const mw = wins(maps)
  const killsA = maps.reduce((s, m) => s + kills(m.ctx.map)[m.side], 0)
  const killsB = maps.reduce((s, m) => s + kills(m.ctx.map)[1 - m.side], 0)

  return (
    <>
      <Panel>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-5 pb-4">
          <a href={teamPath(a.name)} className="text-right font-num text-[22px] font-semibold text-ink max-sm:text-[17px]">{a.name}</a>
          <div className="text-center font-num leading-none font-bold">
            <div className="text-[40px] max-sm:text-[32px]">
              <span className={cn(sw > series.length - sw && "text-win")}>{sw}</span>
              <span className="px-1 text-mute/50">:</span>
              <span className={cn(series.length - sw > sw && "text-win")}>{series.length - sw}</span>
            </div>
            <div className="mt-1 text-[11px] tracking-[.1em] text-mute">シリーズ</div>
          </div>
          <a href={teamPath(b.name)} className="font-num text-[22px] font-semibold text-ink max-sm:text-[17px]">{b.name}</a>
        </div>
        {series.length ? (
          <p className="m-0 border-t border-line px-4 py-2.5 text-center text-[13px] text-mute">
            マップ <b className="num text-ink">{mw}-{maps.length - mw}</b> ・ キル合計 <b className="num text-ink">{killsA}-{killsB}</b>
          </p>
        ) : (
          <p className="m-0 border-t border-line px-4 py-2.5 text-center text-[13px] text-mute">レポートの中では、まだ直接対戦していません。</p>
        )}
      </Panel>

      {series.length > 0 && (
        <Panel>
          <Label>直接の対戦</Label>
          <ul className="m-0 list-none p-0 pt-1">
            {series.map((x, i) => (
              <li key={i} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 border-b border-line px-4 py-2 last:border-0 max-sm:grid-cols-[1fr_auto]">
                <span className="num text-[13px] text-mute max-sm:hidden">{seriesDate(x.report, x.series).replaceAll("-", ".")}</span>
                <a href={reportPath(x.report.id)}>#{x.report.id} {x.series.region} {stageOf(x.series)}</a>
                <span className={cn("num font-num text-[17px] font-bold", x.win ? "text-win" : "text-lose")}>{x.score[0]}-{x.score[1]}</span>
              </li>
            ))}
          </ul>
          {maps.length > 0 && (
            <div className="overflow-x-auto border-t border-line pt-1">
              <table className="w-full min-w-[520px] text-[13px]">
                <tbody>
                  {maps.map((m) => {
                    const mine = m.ctx.map.teams[m.side]
                    const theirs = m.ctx.map.teams[1 - m.side]
                    return (
                      <tr key={m.ctx.report.id + m.ctx.map.id} className="border-b border-line last:border-0">
                        <td className="py-1.5 pl-4 whitespace-nowrap"><a href={mapLink(m.ctx)}>{mapShort(m.ctx.map)}</a></td>
                        <td className={cn("px-2 text-[13px] font-bold whitespace-nowrap", m.win ? "text-win" : "text-lose")}>{m.win ? a.name : b.name} 勝ち</td>
                        <td className="px-2"><span className="flex gap-0.5">{mine.picks.map((h) => <HeroIcon key={h} hero={h} size={20} />)}</span></td>
                        <td className="px-1 text-[11px] text-mute">vs</td>
                        <td className="py-1.5 pr-4"><span className="flex gap-0.5">{theirs.picks.map((h) => <HeroIcon key={h} hero={h} size={20} />)}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <TeamSide t={a} vsMaps={maps.map((m) => ({ ctx: m.ctx, side: m.side }))} />
        <TeamSide t={b} vsMaps={b.maps.filter((m) => m.opponent === a.name).map((m) => ({ ctx: m.ctx, side: m.side }))} />
      </div>
    </>
  )
}

function TeamSide({ t, vsMaps }: { t: TeamStat; vsMaps: { ctx: TeamStat["maps"][number]["ctx"]; side: 0 | 1 }[] }) {
  const picks = heroUsage(t.maps.flatMap((m) => m.ctx.map.teams[m.side].picks.map((hero) => ({ hero, win: m.win }))))
  const drafted = t.maps.filter((m) => !m.ctx.map.draftUnknown)
  const bannedBy = heroUsage(drafted.flatMap((m) => m.ctx.map.teams[m.side].bans.map((hero) => ({ hero, win: m.win }))))
  const bannedVs = heroUsage(drafted.flatMap((m) => m.ctx.map.teams[1 - m.side].bans.map((hero) => ({ hero, win: m.win }))))
  const h2hBans = heroUsage(vsMaps.filter((m) => !m.ctx.map.draftUnknown).flatMap((m) => m.ctx.map.teams[m.side].bans.map((hero) => ({ hero, win: false }))))
  return (
    <Panel>
      <div className="flex items-baseline justify-between px-4 pt-3.5">
        <a href={teamPath(t.name)} className="font-num text-[17px] font-semibold text-ink">{t.name}</a>
        <span className="num text-[13px] text-mute">全体 マップ {wins(t.maps)}-{t.maps.length - wins(t.maps)}（{pct(wins(t.maps), t.maps.length)}%）</span>
      </div>
      <Mini title={`よく使う（${t.maps.length}マップ）`} rows={picks.slice(0, 6)} record />
      <Mini title={`よく BAN する（${drafted.length}マップ）`} rows={bannedBy.slice(0, 5)} />
      <Mini title="よく BAN される" rows={bannedVs.slice(0, 5)} />
      {h2hBans.length > 0 && <Mini title="この相手に BAN したもの" rows={h2hBans.slice(0, 5)} />}
    </Panel>
  )
}

function Mini({ title, rows, record }: { title: string; rows: { hero: string; n: number; win: number }[]; record?: boolean }) {
  return (
    <div className="pt-2 pb-1">
      <div className="px-4 text-[11px] font-bold text-mute">{title}</div>
      {rows.length ? (
        rows.map((h) => (
          <div key={h.hero} className={cn("grid items-center gap-2 px-4 py-[3px]", record ? "grid-cols-[22px_1fr_24px_40px]" : "grid-cols-[22px_1fr_24px]")}>
            <HeroIcon hero={h.hero} size={22} />
            <a href={heroPath(h.hero)} className="truncate text-ink">{h.hero}</a>
            <span className="num text-right">{h.n}</span>
            {record && <span className="num text-right text-mute">{h.win}-{h.n - h.win}</span>}
          </div>
        ))
      ) : (
        <div className="px-4 py-1 text-mute">なし</div>
      )}
    </div>
  )
}
