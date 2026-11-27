import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HeroIcon, Label, Panel, Score, SiteBar, SiteFoot } from "@/components/report/parts"
import { MapDetail } from "@/components/report/map-detail"
import { Bracket } from "@/components/report/bracket"
import { useState } from "react"
import {
  banCounts, draftMapCount, formatDate, heroRecords, isFinal, kills, reportPath,
  seriesByRegion, seriesKey, seriesKills, seriesMaps, stageOf,
} from "@/lib/report"
import type { Report, Series } from "@/types"
import { cn } from "@/lib/utils"

export function ReportPage({ report: r }: { report: Report }) {
  const base = reportPath(r.id)
  const heroes = heroRecords(r)
  const bans = banCounts(r)
  const banMaps = draftMapCount(r)
  const maxPlays = Math.max(...heroes.map((h) => h.win + h.lose))
  const groups = seriesByRegion(r)
  // タブも勝ち上がり表と同じ 予選 → チャレンジャー → 決勝 の順。最初に開くのは最初の決勝
  const ordered = groups.flatMap((g) => g.series)
  const [tab, setTab] = useState(seriesKey(ordered.find(isFinal) ?? ordered[0]))
  const pick = (key: string) => {
    setTab(key)
    document.getElementById("maps")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      <SiteBar />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        {/* 1. スコア */}
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-4">
            <a href="/deadlock-report/" className="py-3 font-semibold">{r.event}</a>
            <span className="py-3 text-[12px] text-mute">{formatDate(r.date)} ・ レポート #{r.id}</span>
          </div>
          <h1 className="px-4 pt-4 text-[17px] leading-snug font-bold">{r.headline}</h1>
          {groups.map(({ region, series }) => (
            <div key={region} className="border-b border-line pb-4 last:border-0">
              {series.filter(isFinal).map((s) => <FinalBlock key={seriesKey(s)} r={r} s={s} />)}
              {series.length > 1 && (
                <div className="mx-4 mt-4 border-t border-line pt-3">
                  <div className="lab mb-1">{region} の勝ち上がり</div>
                  <Bracket series={series} onPick={pick} />
                </div>
              )}
            </div>
          ))}
        </Panel>

        {/* 2. マップ別（シリーズごと） */}
        <Tabs id="maps" value={tab} onValueChange={(v) => setTab(String(v))} className="min-w-0 scroll-mt-3 gap-3">
          <Panel>
            <TabsList variant="line" className="h-auto! w-full justify-start gap-0 overflow-x-auto px-2 [scrollbar-width:none]">
              {ordered.map((s) => (
                <TabsTrigger key={seriesKey(s)} value={seriesKey(s)} className={tabClass}>
                  {s.region} {stageOf(s)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Panel>
          {ordered.map((s) => {
            const maps = seriesMaps(r, s)
            return (
              <TabsContent key={seriesKey(s)} value={seriesKey(s)} className="min-w-0 text-[13px]">
                {maps.length === 0 ? (
                  <Panel>
                    <p className="m-0 px-4 py-3">
                      <b className="font-semibold">{s.teams[0]} {s.score[0]}-{s.score[1]} {s.teams[1]}</b>
                    </p>
                    {s.note && <p className="m-0 border-t border-line px-4 py-3 text-[12px] text-mute">{s.note}</p>}
                  </Panel>
                ) : maps.length === 1 ? (
                  <MapDetail map={maps[0]} base={base} />
                ) : (
                  <Tabs defaultValue={maps[0].id} className="min-w-0 gap-3">
                    <Panel>
                      <TabsList variant="line" className="h-auto! w-full justify-start gap-0 overflow-x-auto px-2 [scrollbar-width:none]">
                        <span className="self-center px-2 text-[11px] whitespace-nowrap text-mute max-sm:hidden">{s.teams[0]} vs {s.teams[1]}</span>
                        {maps.map((m) => (
                          <TabsTrigger key={m.id} value={m.id} className={tabClass}>Map {m.no}</TabsTrigger>
                        ))}
                      </TabsList>
                    </Panel>
                    {maps.map((m) => (
                      <TabsContent key={m.id} value={m.id} className="min-w-0">
                        <MapDetail map={m} base={base} />
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </TabsContent>
            )
          })}
        </Tabs>

        {/* 3. 集計 */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          <Panel>
            <Label>ヒーロー別の勝敗（{r.maps.length}マップ）</Label>
            <div className="pt-2 pb-2">
              {heroes.map((h) => (
                <div key={h.hero} className="grid grid-cols-[26px_88px_1fr_40px] items-center gap-2 px-4 py-[5px] even:bg-cellhover">
                  <HeroIcon hero={h.hero} />
                  <span className="truncate">{h.hero}</span>
                  <span className="flex h-2.5 gap-[2px]" style={{ width: `${((h.win + h.lose) / maxPlays) * 100}%` }}>
                    {Array.from({ length: h.win }, (_, i) => <i key={"w" + i} className="flex-1 bg-win" />)}
                    {Array.from({ length: h.lose }, (_, i) => <i key={"l" + i} className="flex-1 bg-[#d4d4d0] dark:bg-[#4a4a47]" />)}
                  </span>
                  <span className="num text-right font-semibold">{h.win}-{h.lose}</span>
                </div>
              ))}
            </div>
            {r.heroNote && <p className="border-t border-line px-4 py-3 text-[12px] text-mute">{r.heroNote}</p>}
          </Panel>
          <Panel>
            <Label>{banMaps < r.maps.length ? `BAN されたマップ数（配信のあった${banMaps}マップ）` : "BAN されたマップ数"}</Label>
            <div className="pt-2 pb-2">
              {bans.map((b) => (
                <div key={b.hero} className="grid grid-cols-[26px_88px_1fr_40px] items-center gap-2 px-4 py-[5px] even:bg-cellhover">
                  <HeroIcon hero={b.hero} />
                  <span className="truncate">{b.hero}</span>
                  <span className="flex h-2.5 gap-[2px]">
                    {Array.from({ length: banMaps }, (_, i) => (
                      <i key={i} className={cn("flex-1", i < b.maps ? "bg-ink" : "bg-cell")} />
                    ))}
                  </span>
                  <span className="num text-right font-semibold">{b.maps}/{banMaps}</span>
                </div>
              ))}
            </div>
            {r.banNote && <p className="border-t border-line px-4 py-3 text-[12px] text-mute">{r.banNote}</p>}
          </Panel>
        </div>

        {/* 4. 持ち帰り */}
        <Panel>
          <Label>自分の試合に持ち帰ること</Label>
          <ol className="m-0 list-none px-4 pt-2 pb-1">
            {r.takeaways.map((t, i) => (
              <li key={i} className="grid grid-cols-[22px_1fr] gap-2 border-b border-line py-2.5 last:border-0">
                <span className="num font-num text-[16px] leading-6 font-bold text-mute">{i + 1}</span>
                <div>
                  <div className="font-bold">{t.title}</div>
                  <p className="m-0 text-mute">{t.body}</p>
                </div>
              </li>
            ))}
          </ol>
          {r.practice && (
            <div className="border-t border-line bg-cellhover px-4 py-3">
              <div className="lab mb-1">直近10戦で数えること</div>
              <ul className="m-0 list-disc pl-5">
                {r.practice.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}
        </Panel>

        {/* 5. 出典 */}
        <Panel>
          <Label>出典</Label>
          <ul className="m-0 grid list-none gap-x-4 px-4 pt-1 pb-3 sm:grid-cols-2">
            {r.sources.map((s) => (
              <li key={s.url}><a href={s.url} className="block py-2.5 text-[12px]" rel="noopener">{s.label}</a></li>
            ))}
          </ul>
        </Panel>
      </main>
      <SiteFoot />
    </>
  )
}

const tabClass = "h-11 flex-none px-3 text-[12px] font-normal text-ink hover:bg-cellhover data-active:font-bold after:bottom-0! after:bg-ink"

function FinalBlock({ r, s }: { r: Report; s: Series }) {
  const maps = seriesMaps(r, s)
  const [ka, kb] = seriesKills(r, s)
  const winA = s.score[0] > s.score[1]
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-5 pb-4">
        <div className="text-right">
          <div className="font-num text-[22px] leading-tight font-semibold max-sm:text-[17px]">{s.teams[0]}</div>
          <div className="text-[11px] text-mute">{s.region} {stageOf(s)}</div>
        </div>
        <div className="text-center font-num leading-none font-bold">
          <div className="text-[40px] max-sm:text-[32px]">
            <Score value={s.score[0]} className={winA ? "text-win" : ""} />
            <span className="px-1 text-mute/50">:</span>
            <Score value={s.score[1]} className={!winA ? "text-win" : ""} />
          </div>
          <div className="mt-1 text-[11px] tracking-[.1em] text-mute">FINAL</div>
        </div>
        <div>
          <div className="font-num text-[22px] leading-tight font-semibold max-sm:text-[17px]">{s.teams[1]}</div>
          <div className="text-[11px] text-mute">キル合計 <span className="num">{ka}-{kb}</span></div>
        </div>
      </div>
      {s.note && <p className="px-4 pb-2 text-center text-[12px] text-mute">{s.note}</p>}
      <div className="flex flex-wrap gap-1 px-4">
        {maps.map((m) => {
          const [k0, k1] = kills(m)
          const wk = m.teams[0].name === m.winner ? [k0, k1] : [k1, k0]
          return (
            <div key={m.id} className="flex min-w-[150px] flex-1 items-center justify-between gap-2 bg-cell px-2.5 py-1.5 text-[12px] max-sm:basis-full">
              <b className="font-semibold whitespace-nowrap">Map {m.no}</b>
              <span className="font-bold text-win">{m.winner}</span>
              <span className="num whitespace-nowrap">{wk[0]}-{wk[1]}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
