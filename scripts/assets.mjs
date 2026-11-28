// ヒーローとアイテムのアイコンを、deadlock-api の画像サーバーからこのサイトに取り込む。
//   npm run assets
// public/deadlock-report/img/heroes/ と img/items/ に保存する（もうあるものはとばす）。
// 画面はここから読むので、向こうのサーバーが止まってもアイコンが出る。
// npm run timeline の最後でも、新しいアイテムの分だけ自動で実行される。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname, extname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
export const IMG_DIR = join(root, "public", "deadlock-report", "img")
export const HERO_BASE = "https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/"

async function download(url, file) {
  if (existsSync(file)) return "skip"
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return "new"
}

/** src/heroes.ts の FILES にあるヒーローのアイコン */
export async function heroAssets() {
  const ts = readFileSync(join(root, "src", "heroes.ts"), "utf8")
  const files = [...new Set([...ts.slice(ts.indexOf("FILES")).matchAll(/:\s*"([^"]+\.(?:webp|png))"/g)].map((m) => m[1]))]
  let added = 0
  for (const f of files) if ((await download(HERO_BASE + f, join(IMG_DIR, "heroes", f))) === "new") added++
  return { total: files.length, added }
}

/** アイテムの画像を取り込み、catalog の img をこのサイトのパスに書き換える（catalog は id → {img, ...}） */
export async function itemAssets(catalog) {
  let added = 0
  for (const [id, item] of Object.entries(catalog)) {
    if (!item.img || item.img.startsWith("/")) continue
    const ext = extname(new URL(item.img).pathname) || ".png"
    const local = `/deadlock-report/img/items/${id}${ext}`
    try {
      if ((await download(item.img, join(IMG_DIR, "items", `${id}${ext}`))) === "new") added++
      item.img = local
    } catch (e) {
      console.log(`とばす item ${id}: ${e.message}（向こうの画像のまま）`)
    }
  }
  return { total: Object.keys(catalog).length, added }
}

// npm run assets として直接実行したとき
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const h = await heroAssets()
  const catFile = join(root, "src", "item-catalog.json")
  const cat = JSON.parse(readFileSync(catFile, "utf8"))
  const i = await itemAssets(cat)
  writeFileSync(catFile, JSON.stringify(cat).replace(/},"/g, '},\n"') + "\n")
  console.log(`assets: ヒーロー ${h.total}（新しく ${h.added}）・アイテム ${i.total}（新しく ${i.added}）→ public/deadlock-report/img/`)
}
