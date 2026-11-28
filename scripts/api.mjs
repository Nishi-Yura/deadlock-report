// Deadlock API（api.deadlock-api.com）の読み込み。取ったものは .cache/ に保存して、2回目からはそれを使う。
// validate.mjs --api と timeline.mjs が使う。
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const cache = join(root, ".cache")

async function cached(name, url) {
  const file = join(cache, name)
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const json = await res.json()
  mkdirSync(cache, { recursive: true })
  writeFileSync(file, JSON.stringify(json))
  return json
}

/** ヒーロー名をそろえる（API は "The Doorman"、レポートは "Doorman" のことがある） */
export const heroKey = (name) => name.replace(/^The /, "").toLowerCase()

let heroes
export async function heroNames() {
  heroes ??= new Map((await cached("heroes.json", "https://api.deadlock-api.com/v1/assets/heroes")).map((h) => [h.id, h.name]))
  return heroes
}

export async function matchInfo(id) {
  return (await cached(`match-${id}.json`, `https://api.deadlock-api.com/v1/matches/${id}/metadata`)).match_info
}

export function loadReports() {
  return readdirSync(join(root, "reports"))
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => ({ file: `reports/${f}`, r: JSON.parse(readFileSync(join(root, "reports", f), "utf8")) }))
    .sort((a, b) => a.r.id - b.r.id)
}

/**
 * API の team（0/1）がレポートの teams[0]/teams[1] のどちらかを、使ったヒーローで決める。
 * 返り値 side[apiTeam] = レポートの teams の添字。合わなければ null
 */
export async function sides(map, info) {
  const names = await heroNames()
  const set = (team) => info.players.filter((p) => p.team === team).map((p) => heroKey(names.get(p.hero_id) ?? "?")).sort().join()
  const mine = map.teams.map((t) => t.players.map((p) => heroKey(p[1])).sort().join())
  if (set(0) === mine[0] && set(1) === mine[1]) return [0, 1]
  if (set(0) === mine[1] && set(1) === mine[0]) return [1, 0]
  return null
}
