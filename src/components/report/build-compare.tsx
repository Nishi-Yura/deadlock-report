// 「比べる」の1試合：自分が買ったアイテムの順番を、大会で同じヒーローを使った選手の買い方と並べる
import { useEffect, useState } from "react"
import { Label, Note, Panel } from "./parts"
import { ItemIcon, loadItemData, proItems, type Item, type ItemData } from "./hero-items"
import { allMaps } from "@/lib/stats"
import { mmss } from "@/lib/trends"
import { cn } from "@/lib/utils"

const API = "https://api.deadlock-api.com/v1"

export interface Purchase {
  game_time_s: number
  item_id: number
}

interface ApiItem {
  id: number
  type: string
  name: string
  item_tier?: number
  item_slot_type?: string
  cost?: number
  shop_image_small?: string
  shop_image?: string
  image?: string
}

const SLOT: Record<string, string> = { weapon: "weapon", vitality: "vitality", armor: "vitality", spirit: "spirit", tech: "spirit" }

let apiCatalog: Promise<Map<number, Item>> | undefined
/** API のアイテム一覧（大会では買われていないアイテムの名前も出すため） */
function loadApiCatalog() {
  apiCatalog ??= fetch(`${API}/assets/items`)
    .then((r) => (r.ok ? r.json() : []))
    .then(
      (xs: ApiItem[]) =>
        new Map(
          xs
            .filter((i) => i.type === "upgrade")
            .map((i) => [
              i.id,
              {
                name: i.name,
                tier: i.item_tier ?? 0,
                slot: SLOT[i.item_slot_type ?? ""] ?? "",
                cost: i.cost ?? 0,
                img: i.shop_image_small ?? i.shop_image ?? i.image ?? "",
              },
            ])
        )
    )
    .catch(() => new Map<number, Item>())
  return apiCatalog
}

const POPULAR = 0.5 // 「大会ではよく買う」の線（半分以上の試合で買った）

export function BuildCompare({ hero, purchases }: { hero: string; purchases: Purchase[] }) {
  const [state, setState] = useState<{ data: ItemData; api: Map<number, Item> } | null>(null)
  useEffect(() => {
    Promise.all([loadItemData(), loadApiCatalog()]).then(([data, api]) => setState({ data, api }))
  }, [])
  if (!state) {
    return (
      <Panel>
        <Label>アイテムの買い方</Label>
        <p className="m-0 px-4 py-3 text-mute">読み込み中…</p>
      </Panel>
    )
  }
  const { data, api } = state
  const itemOf = (id: number): Item | undefined => data.cat[id] ?? api.get(id)

  // 自分：アイテム（upgrade）だけ、売って買い直したものは最初の1回
  const seen = new Set<number>()
  const mine = [...purchases]
    .filter((p) => p.game_time_s >= 0 && itemOf(p.item_id))
    .sort((a, b) => a.game_time_s - b.game_time_s)
    .filter((p) => (seen.has(p.item_id) ? false : (seen.add(p.item_id), true)))
  const mineIds = new Set(mine.map((p) => p.item_id))

  const maps = allMaps.filter((x) => x.map.teams.some((t) => t.picks.includes(hero)))
  const pro = proItems(data, hero, maps)
  const proOpen = new Set(pro.opening.map((r) => r.id))
  const missing = pro.rows
    .filter((r) => r.n / pro.runs >= POPULAR && !mineIds.has(r.id))
    .sort((a, b) => b.n - a.n || a.avgT - b.avgT)
    .slice(0, 5)

  return (
    <Panel>
      <Label>アイテムの買い方</Label>
      {!pro.runs ? (
        <p className="m-0 px-4 pt-1 text-[13px] text-mute">{hero} は大会でまだ使われていないので、この試合で買った順番だけ出します。</p>
      ) : (
        <Note label="この数字の読み方" className="mt-2">
          大会で {hero} を使った {pro.runs} 回の買い方と並べます。<b className="font-semibold text-win">✓</b> は大会で最初によく買うものにも入っているもの。
        </Note>
      )}
      <div className="grid gap-x-6 px-4 pt-3 pb-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[14px] font-bold">あなたの最初の6つ</div>
          {mine.length ? (
            <ol className="m-0 list-none p-0">
              {mine.slice(0, 6).map((p, i) => {
                const item = itemOf(p.item_id)!
                const match = proOpen.has(p.item_id)
                return (
                  <li key={p.item_id} className="flex min-h-8 items-center gap-2">
                    <span className="num w-3 text-right text-[11px] text-mute">{i + 1}</span>
                    <ItemIcon item={item} />
                    <span className={cn("min-w-0 flex-1 truncate", match && "font-semibold")}>{item.name}</span>
                    {match && <b className="text-win" aria-label="大会で最初によく買うものにも入っている">✓</b>}
                    <span className="num text-[13px] text-mute">{mmss(p.game_time_s)}</span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="m-0 text-mute">この試合の購入データがありません。</p>
          )}
        </div>
        {pro.runs > 0 && (
          <div className="max-sm:mt-3">
            <div className="mb-1.5 text-[14px] font-bold">大会で最初によく買うもの（買う順）</div>
            <ol className="m-0 list-none p-0">
              {pro.opening.map((r, i) => (
                <li key={r.id} className="flex min-h-8 items-center gap-2">
                  <span className="num w-3 text-right text-[11px] text-mute">{i + 1}</span>
                  <ItemIcon item={r.item} />
                  <span className={cn("min-w-0 flex-1 truncate", mineIds.has(r.id) && "font-semibold")}>{r.item.name}</span>
                  <span className="num text-[13px] text-mute">{mmss(r.avgT)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {missing.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <div className="mb-1.5 text-[14px] font-bold">大会ではよく買う（{Math.round(POPULAR * 100)}% 以上）のに、この試合で買っていないもの</div>
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0">
            {missing.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5">
                <ItemIcon item={r.item} />
                <span>{r.item.name}</span>
                <span className="num text-[13px] text-mute">{Math.round((r.n / pro.runs) * 100)}%・平均 {mmss(r.avgT)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
