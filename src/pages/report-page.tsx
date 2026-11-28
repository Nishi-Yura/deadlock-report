import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Fold, HeroIcon, Label, Panel, Score, SiteBar, SiteFoot } from "@/components/report/parts"
import { MapDetail } from "@/components/report/map-detail"
import { Bracket } from "@/components/report/bracket"
import { useEffect, useState } from "react"
import {
  banCounts, draftMapCount, formatDate, heroRecords, isFinal, kills, reportPath,
  seriesByRegion, seriesKey, seriesKills, seriesMaps, stageOf,
} from "@/lib/report"
import type { Report, Series } from "@/types"
import { cn } from "@/lib/utils"
import { Glossed } from "@/components/report/term"

export function ReportPage({ report: r }: { report: Report }) {
  const base = reportPath(r.id)
  const heroes = heroRecords(r)
  const bans = banCounts(r)
  const banMaps = draftMapCount(r)
  const maxPlays = Math.max(...heroes.map((h) => h.win + h.lose))
  const groups = seriesByRegion(r)
  const bracketGroups = groups.filter((g) => g.series.length > 1)
  // 切り替えの並びも勝ち上がり表と同じ 予選 → チャレンジャー → 決勝。最初に開くのは最初の決勝
  const ordered = groups.flatMap((g) => g.series)
  // #マップID（チーム・選手ページからのリンク）で来たら、そのマップを開く
  const [hashMap] = useState(() => r.maps.find((m) => "#" + m.id === location.hash))
  const hashSeries = hashMap && ordered.find((s) => s.region === hashMap.region && stageOf(s) === stageOf(hashMap))
  const [tab, setTab] = useState(seriesKey(hashSeries ?? ordered.find(isFinal) ?? ordered[0]))
  const current = ordered.find((s) => seriesKey(s) === tab) ?? ordered[0]
  const maps = seriesMaps(r, current)
  const [mapId, setMapId] = useState(hashMap?.id ?? maps[0]?.id ?? "")
  const shownMap = maps.find((m) => m.id === mapId) ?? maps[0]
  const [showAllHeroes, setShowAllHeroes] = useState(false)
  const [showAllBans, setShowAllBans] = useState(false)
  useEffect(() => {
    if (hashMap) document.getElementById("maps")?.scrollIntoView({ block: "start" })
  }, [hashMap])
  const pickSeries = (key: string, scroll = false) => {
    setTab(key)
    const s = ordered.find((x) => seriesKey(x) === key)
    setMapId(s ? (seriesMaps(r, s)[0]?.id ?? "") : "")
    if (scroll) document.getElementById("maps")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  /** スコア下のマップ帯から、そのマップを開く */
  const pickMap = (key: string, id: string) => {
    setTab(key)
    setMapId(id)
    document.getElementById("maps")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const topHero = heroes[0]
  const topBan = bans[0]

  return (
    <>
      <SiteBar />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3 max-sm:px-3">
        {/* 1. スコア：大会名・日付 → 見出し文 → シリーズのスコア → マップの勝敗帯（DESIGN.md 5章） */}
        <Panel>
          <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-4 text-[13px] text-mute">
            <a href="/deadlock-report/" className="font-semibold">{r.event}</a>
            <span>{formatDate(r.date)}</span>
            <span>レポート #{r.id}</span>
          </div>
          <h1 className="px-4 pt-1.5 text-[20px] leading-normal font-bold max-sm:text-[18px]">{r.headline}</h1>
          {groups.map(({ region, series }) => (
            <div key={region} className="border-b border-line pb-4 last:border-0">
              {series.filter(isFinal).map((s) => <FinalBlock key={seriesKey(s)} r={r} s={s} onPick={(id) => pickMap(seriesKey(s), id)} />)}
            </div>
          ))}
        </Panel>

        {bracketGroups.length > 0 && (
          <Fold title="勝ち上がり" hint={bracketGroups.map((g) => `${g.region} ${g.series.length} シリーズ`).join(" ・ ")}>
            <div className="grid gap-4 px-4 pb-4">
              {bracketGroups.map(({ region, series }) => (
                <div key={region}>
                  {groups.length > 1 && <div className="mb-1 text-[13px] font-bold">{region}</div>}
                  <Bracket series={series} onPick={(k) => pickSeries(k, true)} />
                </div>
              ))}
            </div>
          </Fold>
        )}

        {/* 2. マップ別。タブは1段だけ：シリーズはセレクト、マップはタブ */}
        <div id="maps" className="grid min-w-0 scroll-mt-3 grid-cols-[minmax(0,1fr)] gap-3">
          <Panel>
            <div className="flex min-w-0 items-stretch max-sm:flex-col">
              {ordered.length > 1 && (
                <label className="flex min-w-0 shrink items-center border-r border-line pr-1 pl-3 max-sm:border-r-0 max-sm:border-b max-sm:pr-3">
                  <span className="sr-only">シリーズ</span>
                  <select
                    value={tab}
                    onChange={(e) => pickSeries(e.target.value)}
                    className="h-11 min-w-0 cursor-pointer bg-transparent max-sm:w-full text-[14px] font-semibold text-ink hover:text-link focus-visible:outline-2 focus-visible:outline-link"
                  >
                    {ordered.map((s) => (
                      <option key={seriesKey(s)} value={seriesKey(s)}>
                        {groups.length > 1 ? `${s.region} ` : ""}{stageOf(s)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {maps.length > 0 && (
                <Tabs value={shownMap.id} onValueChange={(v) => setMapId(String(v))} className="min-w-0 flex-1">
                  <TabsList variant="line" className="h-auto! w-full justify-start gap-0 overflow-x-auto px-1 [scrollbar-width:none]">
                    {maps.map((m) => (
                      <TabsTrigger key={m.id} value={m.id} className={tabClass}>
                        Map {m.no}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </div>
          </Panel>
          {maps.length === 0 ? (
            <Panel>
              <p className="m-0 px-4 py-3">
                <b className="font-num text-[16px] font-semibold">{current.teams[0]} {current.score[0]}-{current.score[1]} {current.teams[1]}</b>
                <span className="ml-2 text-[13px] text-mute">配信・マッチデータのないシリーズ</span>
              </p>
              {current.note && <p className="m-0 border-t border-line px-4 py-3 text-[13px] text-mute">{current.note}</p>}
            </Panel>
          ) : (
            <MapDetail key={shownMap.id} map={shownMap} base={base} />
          )}
        </div>

        {/* 3. 持ち帰り（開いておく） */}
        <div id="takeaways" className="scroll-mt-3">
          <Panel>
            <Label>自分の試合に持ち帰ること</Label>
            <ol className="m-0 list-none px-4 pt-1 pb-1">
              {r.takeaways.map((t, i) => (
                <li key={i} className="grid grid-cols-[24px_1fr] gap-2 border-b border-line py-3 last:border-0">
                  <span className="num font-num text-[18px] leading-6 font-bold text-mute">{i + 1}</span>
                  <div>
                    <div className="font-bold">{t.title}</div>
                    <p className="m-0 mt-0.5"><Glossed text={t.body} /></p>
                  </div>
                </li>
              ))}
            </ol>
            {r.practice && (
              <div className="border-t border-line bg-cellhover px-4 py-3">
                <div className="mb-1 font-bold">直近10戦で数えること</div>
                <ul className="m-0 list-disc pl-5">
                  {r.practice.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        {/* 4. 集計・出典（たたむ。長くなるので上位だけ出し、残りはボタンで開く） */}
        <Fold id="heroes" title={`ヒーロー別の勝敗（${r.maps.length}マップ）`} hint={topHero && `最多勝 ${topHero.hero}（${topHero.win}勝${topHero.lose}敗）`}>
          <div className="pb-2">
            {(showAllHeroes ? heroes : heroes.slice(0, TOP)).map((h) => (
              <div key={h.hero} className="grid grid-cols-[26px_100px_1fr_40px] items-center gap-2 px-4 py-[5px] even:bg-cellhover">
                <HeroIcon hero={h.hero} />
                <span className="truncate">{h.hero}</span>
                <span className="flex h-2.5 gap-[2px]" style={{ width: `${((h.win + h.lose) / maxPlays) * 100}%` }}>
                  {Array.from({ length: h.win }, (_, i) => <i key={"w" + i} className="flex-1 bg-win" />)}
                  {Array.from({ length: h.lose }, (_, i) => <i key={"l" + i} className="flex-1 bg-[#d4d4d0] dark:bg-[#4a4a47]" />)}
                </span>
                <span className="num text-right font-num font-semibold">{h.win}-{h.lose}</span>
              </div>
            ))}
          </div>
          <MoreButton total={heroes.length} open={showAllHeroes} onToggle={() => setShowAllHeroes((v) => !v)} unit="体" />
          {r.heroNote && <p className="m-0 border-t border-line px-4 py-3 text-[13px] text-mute">{r.heroNote}</p>}
        </Fold>
        <Fold
          title={`BAN されたマップ数${banMaps < r.maps.length ? `（配信のあった${banMaps}マップ）` : ""}`}
          hint={topBan && `いちばん多い ${topBan.hero}（${banMaps}マップ中 ${topBan.maps}）`}
        >
          <div className="pb-2">
            {(showAllBans ? bans : bans.slice(0, TOP)).map((b) => (
              <div key={b.hero} className="grid grid-cols-[26px_100px_1fr_40px] items-center gap-2 px-4 py-[5px] even:bg-cellhover">
                <HeroIcon hero={b.hero} />
                <span className="truncate">{b.hero}</span>
                <span className="flex h-2.5 gap-[2px]">
                  {Array.from({ length: banMaps }, (_, i) => (
                    <i key={i} className={cn("flex-1", i < b.maps ? "bg-ink" : "bg-cell")} />
                  ))}
                </span>
                <span className="num text-right font-num font-semibold">{b.maps}/{banMaps}</span>
              </div>
            ))}
          </div>
          <MoreButton total={bans.length} open={showAllBans} onToggle={() => setShowAllBans((v) => !v)} unit="体" />
          {r.banNote && <p className="m-0 border-t border-line px-4 py-3 text-[13px] text-mute">{r.banNote}</p>}
        </Fold>
        <Fold id="sources" title="出典" hint={`${r.sources.length} 件`}>
          <ul className="m-0 grid list-none gap-x-4 px-4 pb-3 sm:grid-cols-2">
            {r.sources.map((s) => (
              <li key={s.url}><a href={s.url} className="block py-2.5 text-[13px]" rel="noopener">{s.label}</a></li>
            ))}
          </ul>
        </Fold>
      </main>
      <SiteFoot />
    </>
  )
}

const tabClass = "h-11 flex-none px-3 text-[14px] font-normal text-ink hover:bg-cellhover data-active:font-bold after:bottom-0! after:bg-ink"

function FinalBlock({ r, s, onPick }: { r: Report; s: Series; onPick: (mapId: string) => void }) {
  const maps = seriesMaps(r, s)
  const [ka, kb] = seriesKills(r, s)
  const winA = s.score[0] > s.score[1]
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-5 pb-4">
        <div className="text-right">
          <div className={cn("font-num text-[22px] leading-tight font-semibold max-sm:text-[18px]", !winA && "text-mute")}>{s.teams[0]}</div>
          <div className="text-[13px] text-mute">{s.region} {stageOf(s)}</div>
        </div>
        <div className="text-center font-num leading-none font-bold">
          <div className="text-[40px] max-sm:text-[32px]">
            <Score value={s.score[0]} className={winA ? "text-win" : ""} />
            <span className="px-1 text-mute/50">:</span>
            <Score value={s.score[1]} className={!winA ? "text-win" : ""} />
          </div>
          <div className="lab mt-1 tracking-[.1em]">FINAL</div>
        </div>
        <div>
          <div className={cn("font-num text-[22px] leading-tight font-semibold max-sm:text-[18px]", winA && "text-mute")}>{s.teams[1]}</div>
          <div className="text-[13px] text-mute">キル <span className="num">{ka}-{kb}</span></div>
        </div>
      </div>
      {s.note && <p className="px-4 pb-3 text-center text-[13px] text-mute">{s.note}</p>}
      <div className="flex flex-wrap gap-1 px-4">
        {maps.map((m) => {
          const [k0, k1] = kills(m)
          const wk = m.teams[0].name === m.winner ? [k0, k1] : [k1, k0]
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              aria-label={`Map ${m.no}（${m.winner} の勝ち）を開く`}
              className="flex min-h-11 min-w-[150px] flex-1 cursor-pointer items-center justify-between gap-2 bg-cell px-3 py-2 font-num text-[15px] hover:brightness-[.96] focus-visible:outline-2 focus-visible:outline-link dark:hover:brightness-125 max-sm:basis-full"
            >
              <b className="font-semibold whitespace-nowrap">Map {m.no}</b>
              <span className="font-bold text-win">{m.winner}</span>
              <span className="num whitespace-nowrap">{wk[0]}-{wk[1]}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

/** 集計の一覧で最初に出す数 */
const TOP = 8

/** 「すべて表示（あと n 体）」。上位 TOP 件より多いときだけ出す */
function MoreButton({ total, open, onToggle, unit }: { total: number; open: boolean; onToggle: () => void; unit: string }) {
  if (total <= TOP) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-11 w-full cursor-pointer items-center justify-center border-t border-line text-[13px] font-semibold text-link hover:bg-cellhover focus-visible:bg-cellhover focus-visible:outline-none"
    >
      {open ? `上位 ${TOP} ${unit}だけ表示` : `すべて表示（あと ${total - TOP} ${unit}）`}
    </button>
  )
}
