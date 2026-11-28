// 自分の試合と比べる。マッチ ID からブラウザで Deadlock API を読み、選んだ選手の1分あたりの数字を
// 同じヒーローの大会での平均と並べる。API は CORS で直接読める（access-control-allow-origin: *）
import { useEffect, useState, type FormEvent } from "react"
import { HeroIcon, Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { useQueryState } from "@/components/report/filters"
import { fmt } from "@/lib/report"
import { allMaps, heroPath, pct } from "@/lib/stats"
import { durationSec } from "@/lib/trends"
import { cn } from "@/lib/utils"

const API = "https://api.deadlock-api.com/v1"

interface ApiPlayer {
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
  const [matchParam, setMatchParam] = useQueryState<string>("match", "", (v) => /^\d{1,12}$/.test(v))
  const [slotParam, setSlotParam] = useQueryState<string>("slot", "", (v) => /^\d{1,2}$/.test(v))
  const [input, setInput] = useState(matchParam)
  const [match, setMatch] = useState<Match | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = Number(matchParam)
    if (!matchParam || !Number.isInteger(id) || id <= 0) return
    let stale = false
    setLoading(true)
    setError("")
    loadMatch(id)
      .then((m) => !stale && setMatch(m))
      .catch((e: Error) => !stale && (setMatch(null), setError(e.message === "Failed to fetch" ? "Deadlock API に接続できませんでした。" : e.message)))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [matchParam])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const id = input.trim().replace(/\D/g, "")
    if (!id) return setError("マッチ ID（数字）を入れてください。")
    setSlotParam("")
    setMatchParam(id)
  }

  const me = match?.players.find((p) => String(p.player_slot) === slotParam)

  return (
    <>
      <SiteBar current="compare" />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="font-num text-[26px] leading-tight font-bold">自分の試合と比べる</h1>
            <p className="m-0 mt-1 text-mute">
              マッチ ID を入れて自分を選ぶと、同じヒーローの大会での平均と並べます。試合の長さが違うので、1分（K/D/A は10分）あたりで比べます。
              マッチ ID はゲーム内の試合履歴か、statlocker.gg などで見られます。
            </p>
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-line px-4 py-3">
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
        </Panel>

        {match && (
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
                      onClick={() => setSlotParam(String(p.player_slot))}
                      aria-pressed={me === p}
                      className={cn(
                        "flex min-h-11 w-full cursor-pointer items-center gap-2 px-2 text-left hover:bg-cellhover",
                        me === p && "bg-hi font-bold"
                      )}
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
        )}

        {match && me && <Result match={match} me={me} />}
      </main>
      <SiteFoot />
    </>
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
