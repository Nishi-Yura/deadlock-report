// マップごとの API データを取り、画面が使う JSON を書く。新しいレポートを足したら1回実行して、一緒にコミットする。
//   npm run timeline
//   src/timelines.json   … ソウル差の推移と Mid-Boss（マップ詳細のグラフ、/trends/）
//                          API のスナップショットは序盤3分・15分以降5分ごと＋試合終了時
//   src/items.json       … 各選手のアイテム購入（時刻・アイテム）。ヒーローページの「プロのアイテム」
//   src/item-catalog.json … 上に出てくるアイテムの名前・ティア・種類・値段・画像
// npm run validate は、どちらかにないマップがあるとエラーにする（入れ忘れ防止）
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { root, loadReports, matchInfo, sides, heroNames, heroKey, cached } from "./api.mjs"
import { heroAssets, itemAssets } from "./assets.mjs"

const names = await heroNames()
const catalog = new Map(
  (await cached("items.json", "https://api.deadlock-api.com/v1/assets/items"))
    .filter((i) => i.type === "upgrade")
    .map((i) => [i.id, i])
)

// API の team_objective_id → 種類（g Guardian / w Walker / b Base Guardian / s Shrine / p Patron / c Patron の最後）
const OBJ = { 0: "c", 1: "g", 2: "g", 3: "g", 4: "g", 5: "w", 6: "w", 7: "w", 8: "w", 9: "p", 10: "s", 11: "s", 12: "b", 13: "b", 14: "b", 15: "b" }

const timelines = {}
const items = {}
const used = new Set()
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
    // キル：倒した選手のチームのキルとして数える（[秒, レポートの teams の添字]）。
    // 敵に倒されていないデス（落下・自滅など）はスコアボードのキルにも入らないので除く
    const teamOfSlot = new Map(info.players.map((p) => [p.player_slot, p.team]))
    const kills = info.players
      .flatMap((p) =>
        (p.death_details ?? [])
          .filter((dd) => teamOfSlot.has(dd.killer_player_slot) && teamOfSlot.get(dd.killer_player_slot) !== p.team)
          .map((dd) => [dd.game_time_s, side[teamOfSlot.get(dd.killer_player_slot)]])
      )
      .sort((a, b) => a[0] - b[0])
    // オブジェクト：API の team は「壊された側」。壊した側を記録する（[秒, 壊したチームの添字, 種類]）
    const objs = (info.objectives ?? [])
      .filter((o) => o.destroyed_time_s > 0 && OBJ[o.team_objective_id])
      .map((o) => [o.destroyed_time_s, 1 - side[o.team], OBJ[o.team_objective_id]])
      .sort((a, b) => a[0] - b[0])
    timelines[m.matchId] = {
      t,
      lead: t.map((x) => lead.get(x)),
      mid: (info.mid_boss ?? [])
        .filter((b) => b.destroyed_time_s)
        .map((b) => ({ t: b.destroyed_time_s, team: side[b.team_claimed] })),
      kills,
      objs,
    }

    // アイテム：ヒーロー名（レポートの綴り）→ [[買った秒, アイテム ID], ...]
    const byHero = {}
    for (const p of info.players) {
      const t = m.teams[side[p.team]]
      const hero = t.players.find((x) => heroKey(x[1]) === heroKey(names.get(p.hero_id) ?? ""))?.[1]
      if (!hero) continue
      byHero[hero] = p.items
        .filter((i) => catalog.has(i.item_id) && i.game_time_s >= 0)
        .map((i) => {
          used.add(i.item_id)
          return [i.game_time_s, i.item_id]
        })
        // 同じアイテムを売って買い直したときは最初の1回だけ
        .filter(([, id], k, xs) => xs.findIndex((x) => x[1] === id) === k)
    }
    items[m.matchId] = byHero
  }
}

const SLOT = { weapon: "weapon", vitality: "vitality", armor: "vitality", spirit: "spirit", tech: "spirit" }
const cat = {}
for (const id of [...used].sort((a, b) => a - b)) {
  const i = catalog.get(id)
  cat[id] = {
    name: i.name,
    tier: i.item_tier ?? 0,
    slot: SLOT[i.item_slot_type] ?? i.item_slot_type ?? "",
    cost: i.cost ?? 0,
    // ショップの絵の WebP（PNG の半分以下の大きさ）
    img: i.shop_image_webp ?? i.shop_image ?? i.image ?? "",
  }
}

// アイテムの画像をこのサイトに取り込み、img をサイトのパスにする（scripts/assets.mjs）
const got = await itemAssets(cat)
const heroes = await heroAssets()

const lines = (o) => JSON.stringify(o).replace(/},"/g, '},\n"').replace(/\]\],"/g, ']],\n"') + "\n"
writeFileSync(join(root, "src", "timelines.json"), lines(timelines))
writeFileSync(join(root, "src", "items.json"), lines(items))
writeFileSync(join(root, "src", "item-catalog.json"), lines(cat))
console.log(`画像：アイテム新しく ${got.added}・ヒーロー新しく ${heroes.added}（public/deadlock-report/img/）`)
console.log(
  `timeline: ${Object.keys(timelines).length} マップ${skipped ? `（${skipped} マップはとばした）` : ""}` +
    ` → src/timelines.json、src/items.json、src/item-catalog.json（アイテム ${used.size} 種類）`
)
