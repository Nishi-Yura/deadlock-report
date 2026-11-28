import { HeroIcon, Note, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { asFilter, FilterBar, useFilter } from "@/components/report/filters"
import { Bar, SortTable, type Column } from "@/components/report/sort-table"
import {
  allMaps, filterMaps, heroPath, heroTable, latestMatchDate, MIN_HERO, patches, pct, shortDate, sinceDate, type HeroStat, type HeroTable,
} from "@/lib/stats"
import { cn } from "@/lib/utils"
import { Term } from "@/components/report/term"

export function StatsPage() {
  const f = useFilter()
  const compare = f.compare
  const base = asFilter(f)
  const table = heroTable(filterMaps(allMaps, base))
  const reportsIn = new Set(filterMaps(allMaps, base).map((x) => x.report.id)).size
  // 期間内に出たパッチ（数字の変化の手がかり）
  const since = f.days ? sinceDate(f.days) : ""
  const patchesIn = patches.filter((p) => !since || p.date >= since)

  return (
    <>
      <SiteBar current="stats" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="text-[20px] leading-snug font-bold max-sm:text-[18px]">ヒーロー統計</h1>
            <p className="m-0 mt-1 text-[14px] text-mute">
              全レポートのマップを合わせたピック・勝敗・BAN。見出しを押すと並べ替えられます。
            </p>
          </div>
          <FilterBar f={f} compare />
          {compare ? (
            <Compare days={f.days} region={f.region} />
          ) : table.maps === 0 ? (
            <p className="m-0 px-4 py-4 text-mute">
              この期間のマップはありません（一番新しい試合は {shortDate(latestMatchDate())}）。期間を長くしてみてください。
            </p>
          ) : (
            <>
              <p className="m-0 px-4 pt-3 pb-1 text-[13px] text-mute">
                <span className="num">{table.maps}</span> マップ（レポート <span className="num">{reportsIn}</span> 本）。
                <Term k="ban-rate">BAN 率</Term>は配信でドラフトが見えた <span className="num">{table.draftMaps}</span> マップが分母。
              </p>
              <HeroStatsWithNote table={table} />
            </>
          )}
        </Panel>
        {patchesIn.length > 0 && (
          <Panel delay={0.05}>
            <p className="m-0 px-4 py-3 text-[13px] text-mute">
              {f.days ? `この期間に出たパッチ：` : "パッチ："}
              {patchesIn.slice(0, 5).map((p, i) => (
                <span key={p.path}>
                  {i > 0 && "、"}
                  <a href={p.path}>{p.title}</a>
                </span>
              ))}
            </p>
          </Panel>
        )}
      </main>
      <SiteFoot />
    </>
  )
}

const heroCol: Column<{ hero: string }> = {
  key: "hero",
  label: "ヒーロー",
  align: "left",
  sort: (r) => r.hero,
  render: (r) => (
    <span className="flex items-center gap-2">
      <HeroIcon hero={r.hero} size={24} />
      <a href={heroPath(r.hero)} className="max-w-[104px] truncate font-sans text-ink max-sm:max-w-[76px]">{r.hero}</a>
    </span>
  ),
}

/** 勝率。回数が少ない（MIN_HERO 未満）ときは色を付けず灰色にする（たまたまの 100% を強く見せない） */
function WinRate({ wins, n }: { wins: number; n: number }) {
  if (!n) return <span className="text-mute">–</span>
  const p = pct(wins, n)
  if (n < MIN_HERO) return <span className="text-mute" title={`${MIN_HERO}回未満`}>{p}%</span>
  return <span className={cn("font-semibold", p > 50 && "text-win", p < 50 && "text-lose")}>{p}%</span>
}

function SmallNote() {
  return <Note label="この数字の読み方">灰色の勝率はピック {MIN_HERO} 回未満。回数が少ないので参考程度に。</Note>
}

function HeroStatsTable({ table }: { table: HeroTable }) {
  const { maps, draftMaps } = table
  const columns: Column<HeroStat>[] = [
    heroCol,
    {
      key: "picks",
      label: "ピック",
      sort: (r) => r.picks,
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <Bar value={pct(r.picks, maps)} />
          <span className="inline-block w-8">{pct(r.picks, maps)}%</span>
          <span className="inline-block w-5 text-mute">{r.picks}</span>
        </span>
      ),
    },
    { key: "wl", label: "勝敗", sort: (r) => r.wins, render: (r) => (r.picks ? `${r.wins}-${r.picks - r.wins}` : <span className="text-mute">–</span>) },
    { key: "wr", label: "勝率", sort: (r) => (r.picks ? r.wins / r.picks : -1), render: (r) => <WinRate wins={r.wins} n={r.picks} /> },
    {
      key: "bans",
      label: "BAN",
      sort: (r) => r.bans,
      render: (r) =>
        r.bans ? (
          <span className="inline-flex items-center gap-2">
            <Bar value={pct(r.bans, draftMaps)} />
            <span className="inline-block w-8">{pct(r.bans, draftMaps)}%</span>
            <span className="inline-block w-5 text-mute">{r.bans}</span>
          </span>
        ) : (
          <span className="text-mute">–</span>
        ),
    },
  ]
  return (
    <SortTable
      rows={table.rows}
      columns={columns}
      rowKey={(r) => r.hero}
      initialSort={{ key: "picks", desc: true }}
      minWidth={520}
      caption="ヒーロー別のピック・勝敗・BAN"
    />
  )
}

function HeroStatsWithNote({ table }: { table: HeroTable }) {
  return (
    <>
      <HeroStatsTable table={table} />
      <SmallNote />
    </>
  )
}

interface CompareRow {
  hero: string
  pre?: HeroStat
  post?: HeroStat
}

/** 過去 N 日（post）と、それより前（pre）を比べる */
function Compare({ days, region }: { days: number; region: string }) {
  const pre = heroTable(filterMaps(allMaps, { days, region, older: true }))
  const post = heroTable(filterMaps(allMaps, { days, region }))
  if (!pre.maps || !post.maps) {
    return (
      <p className="m-0 px-4 py-4 text-mute">
        {!post.maps ? `過去 ${days} 日のマップがありません。` : `過去 ${days} 日より前のマップがありません。`}期間を変えてみてください。
      </p>
    )
  }
  const heroes = new Set([...pre.rows, ...post.rows].map((r) => r.hero))
  const rows: CompareRow[] = [...heroes].map((hero) => ({
    hero,
    pre: pre.rows.find((r) => r.hero === hero),
    post: post.rows.find((r) => r.hero === hero),
  }))
  const pickRate = (s: HeroStat | undefined, t: HeroTable) => pct(s?.picks ?? 0, t.maps)
  const banRate = (s: HeroStat | undefined, t: HeroTable) => pct(s?.bans ?? 0, t.draftMaps)
  const diff = (r: CompareRow) => pickRate(r.post, post) - pickRate(r.pre, pre)
  const banDiff = (r: CompareRow) => banRate(r.post, post) - banRate(r.pre, pre)
  const signed = (n: number) => (
    <span className={cn("font-semibold", n > 0 && "text-win", n < 0 && "text-lose", n === 0 && "text-mute")}>
      {n > 0 ? "+" : ""}{n}
    </span>
  )
  const columns: Column<CompareRow>[] = [
    heroCol,
    { key: "prePick", label: "以前 ピック", sort: (r) => pickRate(r.pre, pre), render: (r) => `${pickRate(r.pre, pre)}%` },
    { key: "postPick", label: "期間内 ピック", sort: (r) => pickRate(r.post, post), render: (r) => `${pickRate(r.post, post)}%` },
    { key: "diff", label: "差", sort: diff, render: (r) => signed(diff(r)) },
    { key: "preWr", label: "以前 勝率", sort: (r) => (r.pre?.picks ? r.pre.wins / r.pre.picks : -1), render: (r) => <WinRate wins={r.pre?.wins ?? 0} n={r.pre?.picks ?? 0} /> },
    { key: "postWr", label: "期間内 勝率", sort: (r) => (r.post?.picks ? r.post.wins / r.post.picks : -1), render: (r) => <WinRate wins={r.post?.wins ?? 0} n={r.post?.picks ?? 0} /> },
    { key: "banDiff", label: "BAN 率の差", sort: banDiff, render: (r) => (banRate(r.pre, pre) || banRate(r.post, post) ? <span>{banRate(r.pre, pre)}→{banRate(r.post, post)}% {signed(banDiff(r))}</span> : <span className="text-mute">–</span>) },
  ]
  return (
    <>
      <Note label="この数字の読み方" className="mt-2">
        過去 {days} 日 <span className="num">{post.maps}</span> マップ / それ以前 <span className="num">{pre.maps}</span> マップ。
        「差」はピック率の増減（ポイント）。マップ数が少ないうちは1マップで大きく動きます。
      </Note>
      <SortTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.hero}
        initialSort={{ key: "diff", desc: true }}
        minWidth={600}
        caption="過去の期間とそれ以前のピック率・勝率・BAN 率"
      />
      <SmallNote />
    </>
  )
}
