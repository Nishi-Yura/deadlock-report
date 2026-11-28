// 各マップのソウル差の推移を Deadlock API から取り、src/timelines.json に書く（マップ詳細のグラフ用）。
//   npm run timeline
// 新しいレポートを足したら1回実行して、src/timelines.json も一緒にコミットする。
// API のスナップショットは3分ごと＋試合終了時。
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { root, loadReports, matchInfo, sides } from "./api.mjs"

const out = {}
let skipped = 0
for (const { file, r } of loadReports()) {
  for (const m of r.maps) {
    let info
    try {
      info = await matchInfo(m.matchId)
    } catch (e) {
      console.log(`とばす ${file} ${m.id}: ${e.message}`)
      skipped++
      continue
    }
    const side = await sides(m, info)
    if (!side) {
      console.log(`とばす ${file} ${m.id}: ヒーローの組み合わせが API と合わない（npm run validate -- --api で確認）`)
      skipped++
      continue
    }
    // 時刻ごとに、レポートの teams[0] − teams[1] のソウル
    const lead = new Map([[0, 0]])
    for (const p of info.players) {
      const sign = side[p.team] === 0 ? 1 : -1
      for (const s of p.stats) lead.set(s.time_stamp_s, (lead.get(s.time_stamp_s) ?? 0) + sign * s.net_worth)
    }
    const t = [...lead.keys()].sort((a, b) => a - b)
    out[m.matchId] = {
      t,
      lead: t.map((x) => lead.get(x)),
      mid: (info.mid_boss ?? [])
        .filter((b) => b.destroyed_time_s)
        .map((b) => ({ t: b.destroyed_time_s, team: side[b.team_claimed] })),
    }
  }
}
writeFileSync(join(root, "src", "timelines.json"), JSON.stringify(out, null, 0).replace(/},"/g, '},\n"') + "\n")
console.log(`timeline: ${Object.keys(out).length} マップ${skipped ? `（${skipped} マップはとばした）` : ""} → src/timelines.json`)
