// ソウル差の推移（src/timelines.json、npm run timeline で作る）。上が teams[0] のリード、下が teams[1] のリード
import timelines from "@/timelines.json"
import { fmt } from "@/lib/report"
import type { MapData } from "@/types"

interface Timeline {
  t: number[]
  lead: number[]
  mid: { t: number; team: number }[]
}

const data = timelines as Record<string, Timeline>

const W = 680
const H = 180
const PL = 44 // 左の目盛りの幅
const PR = 8
const PT = 14
const PB = 22

const k = (n: number) => (Math.abs(n) >= 1000 ? `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.round(Math.abs(n) / 1000)}k` : String(n))

export function hasTimeline(map: MapData) {
  return !!data[map.matchId]
}

export function SoulGraph({ map }: { map: MapData }) {
  const tl = data[map.matchId]
  if (!tl) return null
  const [a, b] = map.teams
  const end = tl.t[tl.t.length - 1]
  const peak = Math.max(1000, ...tl.lead.map(Math.abs))
  // 目盛りは 5k / 10k / 20k 刻みのきりのいい値
  const step = [5000, 10000, 20000, 30000, 50000].find((s) => peak / s <= 3) ?? 50000
  const top = Math.ceil(peak / step) * step
  const x = (t: number) => PL + (t / end) * (W - PL - PR)
  const y = (v: number) => PT + ((top - v) / (2 * top)) * (H - PT - PB)
  const pts = tl.t.map((t, i) => [x(t), y(tl.lead[i])] as const)
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("")
  const area = `${line}L${x(end).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`
  const ticks: number[] = []
  for (let v = -top; v <= top; v += step) ticks.push(v)
  const minutes: number[] = []
  for (let m = 5; m * 60 < end - 60; m += 5) minutes.push(m)
  const last = tl.lead[tl.lead.length - 1]

  return (
    <figure className="m-0 px-4 pt-1 pb-3">
      <div className="mb-1 flex justify-between gap-3 text-[12px]">
        <span>↑ <b className="font-num font-semibold">{a.name}</b> がリード</span>
        <span>↓ <b className="font-num font-semibold">{b.name}</b> がリード</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`ソウル差の推移。終了時 ${last >= 0 ? a.name : b.name} が ${fmt(Math.abs(last))} リード`}
      >
        <defs>
          <clipPath id={`up-${map.matchId}`}><rect x={0} y={0} width={W} height={y(0)} /></clipPath>
          <clipPath id={`dn-${map.matchId}`}><rect x={0} y={y(0)} width={W} height={H} /></clipPath>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-mute" : "stroke-line"} strokeWidth={1} />
            <text x={PL - 6} y={y(v) + 3.5} textAnchor="end" className="fill-mute font-num text-[11px]">{v === 0 ? "0" : k(v)}</text>
          </g>
        ))}
        {minutes.map((m) => (
          <text key={m} x={x(m * 60)} y={H - 6} textAnchor="middle" className="fill-mute font-num text-[11px]">{m}分</text>
        ))}
        {/* 勝ったチームのリード側だけ緑、負けた側は灰色 */}
        <path d={area} clipPath={`url(#up-${map.matchId})`} className={a.name === map.winner ? "fill-win/20" : "fill-mute/20"} />
        <path d={area} clipPath={`url(#dn-${map.matchId})`} className={b.name === map.winner ? "fill-win/20" : "fill-mute/20"} />
        {tl.mid.map((mb, i) => (
          <g key={i}>
            <line x1={x(mb.t)} x2={x(mb.t)} y1={PT} y2={H - PB} className="stroke-ink" strokeWidth={1} strokeDasharray="3 3" />
            {/* 右端に近いものは線の左側に書いて、グラフの外にはみ出さないようにする */}
            <text
              x={x(mb.t) > W * 0.7 ? x(mb.t) - 4 : x(mb.t) + 4}
              y={mb.team === 0 ? PT + 10 : H - PB - 4}
              textAnchor={x(mb.t) > W * 0.7 ? "end" : "start"}
              className="fill-ink text-[11px] font-bold"
            >
              Mid-Boss {map.teams[mb.team]?.name}
            </text>
          </g>
        ))}
        <path d={line} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={i === 0 ? 0 : 2.5} className="fill-ink">
            <title>{`${Math.floor(tl.t[i] / 60)}:${String(tl.t[i] % 60).padStart(2, "0")}  ${tl.lead[i] >= 0 ? a.name : b.name} +${fmt(Math.abs(tl.lead[i]))}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 text-[12px] text-mute">
        Deadlock API のスナップショット（序盤は3分、15分以降は5分ごと）と試合終了時の値。終了時は {last >= 0 ? a.name : b.name} が{" "}
        <span className="num">{fmt(Math.abs(last))}</span> リード。
      </figcaption>
    </figure>
  )
}
