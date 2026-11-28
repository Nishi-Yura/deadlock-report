// 自分の試合と比べる。マッチ ID からブラウザで Deadlock API を読み、選んだ選手の1分あたりの数字を
// 同じヒーローの大会での平均と並べる。API は CORS で直接読める（access-control-allow-origin: *）
import { useEffect, useState, type FormEvent } from "react"
import { HeroIcon, Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { Segmented, useQueryState } from "@/components/report/filters"
import { fmt } from "@/lib/report"
import { allMaps, heroPath, pct } from "@/lib/stats"
import { durationSec } from "@/lib/trends"
import { cn } from "@/lib/utils"

const API = "https://api.deadlock-api.com/v1"

interface ApiPlayer {
  account_id: number
  player_slot: number
  team: number
  hero_id: number
  kills: number
  deaths: number
  assists: number
  net_worth: number
  stats: { player_damage?: number; player_healing?: number }[]
}

interface Match {
  id: number
  duration: number
  winner: number
  players: (ApiPlayer & { hero: string })[]
}

/** 比べる数字。per は「何秒あたり」か */
const METRICS = [
  { key: "souls", label: "ソウル", per: 60, unit: "/分", better: "high" },
  { key: "dmg", label: "ダメージ", per: 60, unit: "/分", better: "high" },
  { key: "heal", label: "回復", per: 60, unit: "/分", better: "high" },
  { key: "k", label: "キル", per: 600, unit: "/10分", better: "high" },
  { key: "d", label: "デス", per: 600, unit: "/10分", better: "low" },
  { key: "a", label: "アシスト", per: 600, unit: "/10分", better: "high" },
] as const

type Key = (typeof METRICS)[number]["key"]
type Totals = Record<Key, number> & { sec: number; n: number }

const empty = (): Totals => ({ souls: 0, dmg: 0, heal: 0, k: 0, d: 0, a: 0, sec: 0, n: 0 })
const norm = (h: string) => h.replace(/^The /, "")

/** 大会のマップから、ヒーローごと（と全体）の合計 */
function proTotals() {
  const by = new Map<string, Totals>()
  const all = empty()
  for (const { map } of allMaps) {
    const sec = durationSec(map)
    for (const t of map.teams) {
      for (const [, hero, k, d, a, souls, dmg, heal] of t.players) {
        for (const x of [by.get(hero) ?? by.set(hero, empty()).get(hero)!, all]) {
          x.k += k; x.d += d; x.a += a; x.souls += souls; x.dmg += dmg; x.heal += heal; x.sec += sec; x.n++
        }
      }
    }
  }
  return { by, all }
}

const rate = (t: Totals, key: Key, per: number) => (t.sec ? (t[key] / t.sec) * per : 0)

let heroNames: Promise<Map<number, string>> | undefined
function loadHeroes() {
  heroNames ??= fetch(`${API}/assets/heroes`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((xs: { id: number; name: string }[]) => new Map(xs.map((h) => [h.id, norm(h.name)])))
  return heroNames
}

async function loadMatch(id: number): Promise<Match> {
  const [names, res] = await Promise.all([loadHeroes(), fetch(`${API}/matches/${id}/metadata`)])
  if (res.status === 404) throw new Error("そのマッチ ID の試合が見つかりません。終わったばかりの試合は、API に入るまで少し時間がかかることがあります。")
  // 存在しない ID でも 503 が返ることがあるので、ID の確認と再試行の両方を案内する
  if (!res.ok) throw new Error(`試合を読み込めませんでした（${res.status}）。マッチ ID が合っているか確かめて、少し待ってからもう一度試してください。`)
  const info = (await res.json()).match_info
  return {
    id,
    duration: info.duration_s,
    winner: info.winning_team,
    players: (info.players as ApiPlayer[]).map((p) => ({ ...p, hero: names.get(p.hero_id) ?? `#${p.hero_id}` })),
  }
}

export function ComparePage() {
  const [mode, setMode] = useQueryState<"match" | "recent">("mode", "match", ["match", "recent"])
  return (
    <>
      <SiteBar current="compare" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-1">
            <h1 className="font-num text-[26px] leading-tight font-bold">自分の試合と比べる</h1>
            <p className="m-0 mt-1 text-mute">
              自分の数字を、同じヒーローの大会での平均と並べます。試合の長さが違うので、1分（K/D/A は10分）あたりで比べます。
            </p>
          </div>
          <div className="border-b border-line px-4">
            <Segmented
              label="比べる"
              value={mode}
              options={[{ value: "match", label: "1試合" }, { value: "recent", label: "直近の試合" }]}
              onChange={setMode}
            />
          </div>
          {mode === "match" ? <SingleForm /> : <RecentForm />}
        </Panel>
        {mode === "match" ? <SingleResult /> : <RecentResult />}
      </main>
      <SiteFoot />
    </>
  )
}

// 入力欄と結果を別のパネルに出すため、状態は URL（?match= など）とモジュール内のストアで共有する
type Listener = () => void
function store<T>(initial: T) {
  let v = initial
  const ls = new Set<Listener>()
  return {
    get: () => v,
    set: (x: T) => {
      v = x
      ls.forEach((l) => l())
    },
    use(): T {
      const [, force] = useState(0)
      useEffect(() => {
        const l = () => force((n) => n + 1)
        ls.add(l)
        return () => void ls.delete(l)
      }, [])
      return v
    },
  }
}

const single = store<{ match: Match | null; error: string; loading: boolean }>({ match: null, error: "", loading: false })

function SingleForm() {
  const [matchParam, setMatchParam] = useQueryState<string>("match", "", (v) => /^\d{1,12}$/.test(v))
  const [, setSlotParam] = useQueryState<string>("slot", "", (v) => /^\d{1,2}$/.test(v))
  const [input, setInput] = useState(matchParam)
  const { error, loading } = single.use()

  useEffect(() => {
    const id = Number(matchParam)
    if (!matchParam || !Number.isInteger(id) || id <= 0) return
    let stale = false
    single.set({ match: null, error: "", loading: true })
    loadMatch(id)
      .then((m) => !stale && single.set({ match: m, error: "", loading: false }))
      .catch((e: Error) => !stale && single.set({ match: null, error: e.message === "Failed to fetch" ? "Deadlock API に接続できませんでした。" : e.message, loading: false }))
    return () => {
      stale = true
    }
  }, [matchParam])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const id = input.trim().replace(/\D/g, "")
    if (!id) return single.set({ ...single.get(), error: "マッチ ID（数字）を入れてください。" })
    setSlotParam("")
    setMatchParam(id)
  }

  return (
    <>
      <p className="m-0 px-4 pt-3 text-[12px] text-mute">マッチ ID はゲーム内の試合履歴か、statlocker.gg などで見られます。</p>
      <form onSubmit={submit} className="flex gap-2 px-4 py-3">
        <label htmlFor="match" className="sr-only">マッチ ID</label>
        <input
          id="match"
          inputMode="numeric"
          autoComplete="off"
          placeholder="マッチ ID（例：144508467）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="h-11 min-w-0 flex-1 border border-line bg-cell px-3 font-num text-[16px] text-ink outline-none focus:border-ink"
        />
        <button type="submit" disabled={loading} className="h-11 shrink-0 cursor-pointer bg-ink px-4 text-[13px] font-bold text-panel disabled:opacity-60">
          {loading ? "読み込み中" : "読み込む"}
        </button>
      </form>
      {error && <p role="alert" className="m-0 border-t border-line px-4 py-3 text-lose">{error}</p>}
    </>
  )
}

function SingleResult() {
  const [slotParam, setSlotParam] = useQueryState<string>("slot", "", (v) => /^\d{1,2}$/.test(v))
  const [account] = useQueryState<string>("account", "", (v) => /^\d{1,12}$/.test(v))
  const { match } = single.use()
  // 直近の試合の一覧から来たとき（?account=）は、その人を最初から選んでおく
  useEffect(() => {
    if (!match || slotParam || !account) return
    const p = match.players.find((x) => String(x.account_id) === account)
    if (p) setSlotParam(String(p.player_slot))
  }, [match, slotParam, account, setSlotParam])
  if (!match) return null
  const me = match.players.find((p) => String(p.player_slot) === slotParam)
  return (
    <>
      <MatchPicker match={match} me={me} pick={(p) => setSlotParam(String(p.player_slot))} />
      {me && <Result match={match} me={me} />}
    </>
  )
}

function MatchPicker({ match, me, pick }: { match: Match; me?: Match["players"][number]; pick: (p: Match["players"][number]) => void }) {
  return (
    <Panel>
      <Label>自分を選ぶ（{Math.floor(match.duration / 60)}分{match.duration % 60}秒の試合）</Label>
      <div className="grid grid-cols-2 gap-x-3 px-4 pt-2 pb-3 max-sm:grid-cols-1">
        {[0, 1].map((team) => (
          <div key={team}>
            <div className={cn("pb-1 text-[11px] font-bold", match.winner === team ? "text-win" : "text-lose")}>
              {team === 0 ? "チーム A" : "チーム B"}・{match.winner === team ? "勝ち" : "負け"}
            </div>
            {match.players.filter((p) => p.team === team).map((p) => (
              <button
                key={p.player_slot}
                type="button"
                onClick={() => pick(p)}
                aria-pressed={me === p}
                className={cn("flex min-h-11 w-full cursor-pointer items-center gap-2 px-2 text-left hover:bg-cellhover", me === p && "bg-hi font-bold")}
              >
                <HeroIcon hero={p.hero} size={26} />
                <span className="flex-1 truncate">{p.hero}</span>
                <span className="num text-[12px] text-mute">{p.kills}/{p.deaths}/{p.assists}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function Result({ match, me }: { match: Match; me: Match["players"][number] }) {
  const { by, all } = proTotals()
  const pro = by.get(me.hero)
  const last = me.stats[me.stats.length - 1] ?? {}
  const mine: Totals = {
    souls: me.net_worth, dmg: last.player_damage ?? 0, heal: last.player_healing ?? 0,
    k: me.kills, d: me.deaths, a: me.assists, sec: match.duration, n: 1,
  }
  const show = (v: number, per: number) => (per === 60 ? fmt(Math.round(v)) : v.toFixed(1))

  return (
    <Panel>
      <Label>
        <span className="inline-flex items-center gap-2 normal-case">
          <HeroIcon hero={me.hero} size={22} /> {me.hero} の比較
        </span>
      </Label>
      <p className="m-0 px-4 pt-1 text-[12px] text-mute">
        {pro ? (
          <>大会で {me.hero} が使われた <span className="num">{pro.n}</span> マップの平均。<a href={heroPath(me.hero)}>{me.hero} の大会データ</a></>
        ) : (
          <>{me.hero} は大会でまだ使われていないので、全ヒーローの平均（{all.n} 人分）と比べます。</>
        )}
      </p>
      <div className="overflow-x-auto pt-1 pb-2">
        <table className="w-full min-w-[420px] text-[13px]">
          <thead>
            <tr className="text-[11px] text-mute">
              <th className="py-1 pl-4 text-left font-semibold"></th>
              <th className="px-2 text-right font-semibold">あなた</th>
              <th className="px-2 text-right font-semibold">{pro ? `大会の ${me.hero}` : "大会の全体"}</th>
              <th className="px-2 text-right font-semibold">差</th>
              {pro && <th className="py-1 pr-4 text-right font-semibold">大会の全体</th>}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const ref = pro ?? all
              const a = rate(mine, m.key, m.per)
              const b = rate(ref, m.key, m.per)
              const d = b ? pct(a - b, b) : 0
              const good = m.better === "high" ? d > 0 : d < 0
              return (
                <tr key={m.key} className="border-t border-line">
                  <td className="py-2 pl-4 whitespace-nowrap">{m.label}<span className="text-[11px] text-mute">{m.unit}</span></td>
                  <td className="num px-2 text-right font-semibold">{show(a, m.per)}</td>
                  <td className="num px-2 text-right">{show(b, m.per)}</td>
                  <td className={cn("num px-2 text-right font-semibold", d !== 0 && (good ? "text-win" : "text-lose"), d === 0 && "text-mute")}>
                    {b ? `${d > 0 ? "+" : ""}${d}%` : "–"}
                  </td>
                  {pro && <td className="num py-2 pr-4 text-right text-mute">{show(rate(all, m.key, m.per), m.per)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="m-0 border-t border-line px-4 py-2.5 text-[12px] text-mute">
        デスは少ないほうが緑。大会は役割分担がはっきりしているので、サポート寄りのヒーローはダメージが低めに出ます。
      </p>
    </Panel>
  )
}

// ---- 直近の試合 ----

interface HistoryRow {
  match_id: number
  hero_id: number
  start_time: number
  game_mode: number
  player_team: number
  player_kills: number
  player_deaths: number
  player_assists: number
  net_worth: number
  match_duration_s: number
  match_result: number
}

interface Game {
  id: number
  hero: string
  start: number
  win: boolean
  k: number
  d: number
  a: number
  souls: number
  sec: number
}

const RECENT = 20
const STEAM64 = 76561197960265728n

/** 入力（アカウント ID・SteamID64・プロフィール URL）→ アカウント ID。分からなければ理由 */
function parseAccount(text: string): { id?: string; error?: string } {
  const t = text.trim()
  if (/steamcommunity\.com\/id\//i.test(t)) {
    return { error: "「/id/名前」の形のプロフィール URL からは ID を調べられません。statlocker.gg などに出ている数字の ID か、「/profiles/数字」の URL を入れてください。" }
  }
  const m = t.match(/(\d{5,20})/)
  if (!m) return { error: "アカウント ID（数字）か Steam のプロフィール URL を入れてください。" }
  const n = BigInt(m[1])
  return { id: String(n >= STEAM64 ? n - STEAM64 : n) }
}

const recent = store<{ account: string; games: Game[] | null; error: string; loading: boolean }>({ account: "", games: null, error: "", loading: false })

async function loadRecent(account: string): Promise<Game[]> {
  const [names, res] = await Promise.all([loadHeroes(), fetch(`${API}/players/${account}/match-history`)])
  if (!res.ok) throw new Error(`試合履歴を読み込めませんでした（${res.status}）。ID が合っているか確かめて、少し待ってからもう一度試してください。`)
  const rows = (await res.json()) as HistoryRow[]
  return rows
    .filter((r) => r.game_mode === 1 && r.match_duration_s > 0)
    .sort((a, b) => b.start_time - a.start_time)
    .slice(0, RECENT)
    .map((r) => ({
      id: r.match_id,
      hero: names.get(r.hero_id) ?? `#${r.hero_id}`,
      start: r.start_time,
      win: r.match_result === r.player_team,
      k: r.player_kills,
      d: r.player_deaths,
      a: r.player_assists,
      souls: r.net_worth,
      sec: r.match_duration_s,
    }))
}

function RecentForm() {
  const [account, setAccount] = useQueryState<string>("account", "", (v) => /^\d{1,12}$/.test(v))
  const [input, setInput] = useState(account)
  const { error, loading } = recent.use()

  useEffect(() => {
    if (!account) return
    let stale = false
    recent.set({ account, games: null, error: "", loading: true })
    loadRecent(account)
      .then((g) => !stale && recent.set({ account, games: g, error: g.length ? "" : "通常の試合が見つかりませんでした。", loading: false }))
      .catch((e: Error) => !stale && recent.set({ account, games: null, error: e.message === "Failed to fetch" ? "Deadlock API に接続できませんでした。" : e.message, loading: false }))
    return () => {
      stale = true
    }
  }, [account])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = parseAccount(input)
    if (r.error) return recent.set({ ...recent.get(), error: r.error })
    setAccount(r.id!)
  }

  return (
    <>
      <p className="m-0 px-4 pt-3 text-[12px] text-mute">
        Steam のアカウント ID か、数字の入ったプロフィール URL（steamcommunity.com/profiles/…）を入れると、直近 {RECENT} 試合（通常モード）をまとめて比べます。
      </p>
      <form onSubmit={submit} className="flex gap-2 px-4 py-3">
        <label htmlFor="account" className="sr-only">アカウント ID</label>
        <input
          id="account"
          autoComplete="off"
          placeholder="アカウント ID か プロフィール URL"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="h-11 min-w-0 flex-1 border border-line bg-cell px-3 font-num text-[16px] text-ink outline-none focus:border-ink"
        />
        <button type="submit" disabled={loading} className="h-11 shrink-0 cursor-pointer bg-ink px-4 text-[13px] font-bold text-panel disabled:opacity-60">
          {loading ? "読み込み中" : "読み込む"}
        </button>
      </form>
      {error && <p role="alert" className="m-0 border-t border-line px-4 py-3 text-lose">{error}</p>}
    </>
  )
}

const totalsOf = (gs: Game[]): Totals => {
  const t = empty()
  for (const g of gs) {
    t.k += g.k; t.d += g.d; t.a += g.a; t.souls += g.souls; t.sec += g.sec; t.n++
  }
  return t
}

/** 試合履歴にはダメージと回復がないので、ソウルと K/D/A だけ比べる */
const RECENT_METRICS = METRICS.filter((m) => m.key !== "dmg" && m.key !== "heal")

function Diff({ a, b, better }: { a: number; b: number; better: "high" | "low" }) {
  if (!b) return <span className="text-mute">–</span>
  const d = pct(a - b, b)
  const good = better === "high" ? d > 0 : d < 0
  return <span className={cn("font-semibold", d !== 0 && (good ? "text-win" : "text-lose"), d === 0 && "text-mute")}>{d > 0 ? "+" : ""}{d}%</span>
}

function RecentResult() {
  // アカウントは URL ではなく、読み込んだときの値を使う（このパネルは入力より先に作られるので）
  const { games, account } = recent.use()
  if (!games?.length) return null
  const { by, all } = proTotals()
  const mine = totalsOf(games)
  const wins = games.filter((g) => g.win).length
  const heroes = [...new Set(games.map((g) => g.hero))]
    .map((hero) => ({ hero, gs: games.filter((g) => g.hero === hero) }))
    .sort((a, b) => b.gs.length - a.gs.length)
  const show = (v: number, per: number) => (per === 60 ? fmt(Math.round(v)) : v.toFixed(1))

  return (
    <>
      <Panel>
        <Label>直近 {games.length} 試合の平均</Label>
        <p className="m-0 px-4 pt-1 text-[12px] text-mute">
          <span className="num">{wins}</span> 勝 <span className="num">{games.length - wins}</span> 敗。
          右の列は大会の全選手の平均（ヒーロー別はこの下）。試合履歴にはダメージと回復が入っていないので、1試合ずつ開くと見られます。
        </p>
        <div className="overflow-x-auto pt-1 pb-2">
          <table className="w-full min-w-[360px] text-[13px]">
            <thead>
              <tr className="text-[11px] text-mute">
                <th className="py-1 pl-4 text-left font-semibold"></th>
                <th className="px-2 text-right font-semibold">あなた</th>
                <th className="px-2 text-right font-semibold">大会の全体</th>
                <th className="py-1 pr-4 text-right font-semibold">差</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_METRICS.map((m) => (
                <tr key={m.key} className="border-t border-line">
                  <td className="py-2 pl-4 whitespace-nowrap">{m.label}<span className="text-[11px] text-mute">{m.unit}</span></td>
                  <td className="num px-2 text-right font-semibold">{show(rate(mine, m.key, m.per), m.per)}</td>
                  <td className="num px-2 text-right">{show(rate(all, m.key, m.per), m.per)}</td>
                  <td className="num py-2 pr-4 text-right"><Diff a={rate(mine, m.key, m.per)} b={rate(all, m.key, m.per)} better={m.better} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <Label>ヒーローごと（大会の同じヒーローと比べた差）</Label>
        <div className="overflow-x-auto pt-1 pb-2">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="text-[11px] text-mute">
                <th className="py-1 pl-4 text-left font-semibold">ヒーロー</th>
                <th className="px-2 text-right font-semibold">勝敗</th>
                {RECENT_METRICS.map((m) => <th key={m.key} className="px-2 text-right font-semibold">{m.label}</th>)}
                <th className="py-1 pr-4 text-right font-semibold">大会</th>
              </tr>
            </thead>
            <tbody>
              {heroes.map(({ hero, gs }) => {
                const t = totalsOf(gs)
                const pro = by.get(hero)
                const w = gs.filter((g) => g.win).length
                return (
                  <tr key={hero} className="border-t border-line">
                    <td className="py-1.5 pl-4">
                      <span className="flex items-center gap-2"><HeroIcon hero={hero} size={22} /><span className="truncate">{hero}</span></span>
                    </td>
                    <td className="num px-2 text-right whitespace-nowrap">{w}-{gs.length - w}</td>
                    {RECENT_METRICS.map((m) => (
                      <td key={m.key} className="num px-2 text-right">
                        {pro ? <Diff a={rate(t, m.key, m.per)} b={rate(pro, m.key, m.per)} better={m.better} /> : <span className="text-mute">{show(rate(t, m.key, m.per), m.per)}</span>}
                      </td>
                    ))}
                    <td className="num py-1.5 pr-4 text-right text-[12px] text-mute">
                      {pro ? <a href={heroPath(hero)}>{pro.n}回</a> : "なし"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="m-0 border-t border-line px-4 py-2.5 text-[12px] text-mute">
          大会で使われていないヒーローは比べる相手がないので、自分の数字（ソウル/分・10分あたりの K/D/A）をそのまま出しています。
        </p>
      </Panel>

      <Panel>
        <Label>試合ごと（押すとその試合を詳しく比べる）</Label>
        <ul className="m-0 list-none p-0 pt-1 pb-1">
          {games.map((g) => (
            <li key={g.id} className="border-t border-line first:border-0">
              <a
                href={`/deadlock-report/compare/?match=${g.id}&account=${account}`}
                className="grid grid-cols-[52px_22px_1fr_auto_auto] items-center gap-2 px-4 py-2 text-ink hover:bg-cellhover hover:no-underline max-sm:grid-cols-[22px_1fr_auto]"
              >
                <span className="num text-[12px] text-mute max-sm:hidden">{new Date(g.start * 1000).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span>
                <HeroIcon hero={g.hero} size={22} />
                <span className="truncate">
                  {g.hero} <b className={cn("text-[11px]", g.win ? "text-win" : "text-lose")}>{g.win ? "勝ち" : "負け"}</b>
                </span>
                <span className="num text-[12px]">{g.k}/{g.d}/{g.a}</span>
                <span className="num text-[12px] text-mute max-sm:hidden">{fmt(Math.round(g.souls / (g.sec / 60)))}/分</span>
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
