// 新しいレポート・パッチまとめを Discord に告知する。
//
// GitHub Actions（.github/workflows/deploy.yml の notify）が、公開が終わったあとに実行する：
//   node scripts/discord.mjs --base <前の commit> --head <今の commit>
// base と head を比べて「新しく足されたもの」だけを投稿する（既存のレポートの修正では投稿しない）
//   - reports/N.json が新しく足された        → レポートの告知
//   - src/patches.json に新しい日付が増えた  → パッチまとめの告知
// 投稿先は環境変数 DISCORD_WEBHOOK_URL（リポジトリの Secrets）。なければ何もせずに終わる。
//
// 手元で文面だけ確かめる（投稿はしない）：
//   npm run discord -- --report 4
//   npm run discord -- --patch 2026-11-27
//   npm run discord -- --base <commit> --head HEAD
// 手元から本当に投稿するときは --send を付け、環境変数 DISCORD_WEBHOOK_URL を設定しておく。
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const SITE = "https://nishi-yura.github.io"

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}
const inCI = !!process.env.GITHUB_ACTIONS
const send = inCI || args.includes("--send")
const webhook = process.env.DISCORD_WEBHOOK_URL ?? ""

// 古い commit には src/patches.json がないので、git のエラー表示は出さない
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
const gitOr = (fallback, ...a) => {
  try {
    return git(...a)
  } catch {
    return fallback
  }
}

const FINAL = "決勝"
const stageOf = (x) => x.stage ?? FINAL

// ---- 文面 ----

function reportMessage(r) {
  const finals = r.series.filter((s) => stageOf(s) === FINAL)
  const results = finals.map((s) => {
    const [a, b] = s.score[0] >= s.score[1] ? [0, 1] : [1, 0]
    return `${s.region} ${FINAL}：**${s.teams[a]}** ${s.score[a]}-${s.score[b]} ${s.teams[b]}`
  })
  return [
    `**新しいレポート #${r.id}：${r.title}**`,
    r.headline,
    ...results,
    `${SITE}/deadlock-report/${r.id}/`,
  ].join("\n")
}

function patchMessage(p) {
  return [`**パッチまとめ：${p.title}**`, p.summary, `${SITE}${p.path}`].join("\n")
}

// ---- 何が新しいか ----

function readJsonAt(commit, path) {
  const text = gitOr("", "show", `${commit}:${path}`)
  return text ? JSON.parse(text) : undefined
}

function newItems(base, head) {
  const reports = gitOr("", "diff", "--name-status", "--diff-filter=A", base, head, "--", "reports/")
    .split("\n")
    .map((l) => l.match(/^A\s+reports\/(\d+)\.json$/)?.[1])
    .filter(Boolean)
    .map((id) => readJsonAt(head, `reports/${id}.json`))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)
  const before = new Set((readJsonAt(base, "src/patches.json") ?? []).map((p) => p.date))
  const patches = (readJsonAt(head, "src/patches.json") ?? [])
    .filter((p) => !before.has(p.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { reports, patches }
}

// ---- 投稿 ----

async function post(content) {
  if (content.length > 2000) content = content.slice(0, 1990) + "…"
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // allowed_mentions を空にして、本文に @everyone などがあっても通知が飛ばないようにする
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  })
  if (res.status === 429) {
    const wait = Number((await res.json().catch(() => ({}))).retry_after ?? 2)
    await new Promise((r) => setTimeout(r, Math.ceil(wait * 1000)))
    return post(content)
  }
  if (!res.ok) throw new Error(`Discord への投稿に失敗（${res.status}）: ${(await res.text()).slice(0, 200)}`)
}

const messages = []
const reportArg = opt("report")
const patchArg = opt("patch")
if (reportArg) {
  const f = join(root, "reports", `${reportArg}.json`)
  if (!existsSync(f)) throw new Error(`reports/${reportArg}.json がない`)
  messages.push(reportMessage(JSON.parse(readFileSync(f, "utf8"))))
} else if (patchArg) {
  const p = JSON.parse(readFileSync(join(root, "src", "patches.json"), "utf8")).find((x) => x.date === patchArg)
  if (!p) throw new Error(`src/patches.json に ${patchArg} がない`)
  messages.push(patchMessage(p))
} else {
  const base = opt("base")
  const head = opt("head") ?? "HEAD"
  if (!base || /^0+$/.test(base)) {
    console.log("discord: 比べる前の commit がない（新しいブランチや手動実行）ので投稿しない")
    process.exit(0)
  }
  const { reports, patches } = newItems(base, head)
  messages.push(...reports.map(reportMessage), ...patches.map(patchMessage))
}

if (!messages.length) {
  console.log("discord: 新しいレポート・パッチまとめはないので投稿しない")
  process.exit(0)
}
for (const m of messages) console.log(`---\n${m}`)
console.log("---")
if (!send) {
  console.log(`discord: ${messages.length} 件（文面の確認だけ。投稿するなら --send）`)
  process.exit(0)
}
if (!webhook) {
  console.log("discord: DISCORD_WEBHOOK_URL が設定されていないので投稿しない（リポジトリの Secrets に登録する）")
  process.exit(0)
}
for (const m of messages) {
  await post(m)
  await new Promise((r) => setTimeout(r, 1000))
}
console.log(`discord: ${messages.length} 件を投稿した`)
