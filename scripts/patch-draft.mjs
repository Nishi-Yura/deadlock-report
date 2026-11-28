// パッチまとめページの下書きを作る。
//   1. deadlock.wiki の Update:<日付> ページをブラウザで開き、scripts/patch-extract.js を Console で実行
//   2. 出てきた JSON を patch-src/YYYY-MM-DD.json に保存
//   3. npm run patch-draft -- YYYY-MM-DD
// → public/deadlock-report/patch/YYYY-MM-DD/index.html ができる。
//   見た目（CSS・ヘッダー）は一番新しいパッチページのものを使う。変更点は英語のまま入り、
//   未翻訳の行は <span class="en"> で囲んである。日本語に直し、見出し・要約・「まずはここだけ」を書いて、
//   「下書き: 未翻訳」の印を消すまで npm run validate（＝ build）が止める。
//   ヒーローの区分（強化/弱体/調整/修正）は、英語の行の言葉から仮に決めてある。訳すときに見直す。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { root } from "./api.mjs"

const date = process.argv[2]
const srcArg = process.argv[3]
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error("使い方: npm run patch-draft -- YYYY-MM-DD [JSON のパス（省略時 patch-src/YYYY-MM-DD.json）]")
  process.exit(1)
}
const srcFile = srcArg ?? join(root, "patch-src", `${date}.json`)
if (!existsSync(srcFile)) {
  console.error(`${srcFile} がない。deadlock.wiki のページで scripts/patch-extract.js を実行して、出てきた JSON を保存する`)
  process.exit(1)
}
const src = JSON.parse(readFileSync(srcFile, "utf8"))
const outDir = join(root, "public", "deadlock-report", "patch", date)
const outFile = join(outDir, "index.html")
if (existsSync(outFile) && !process.argv.includes("--force")) {
  console.error(`${outFile} はもうある（上書きするなら --force）`)
  process.exit(1)
}

// 一番新しいパッチページをひな形にする
const patches = JSON.parse(readFileSync(join(root, "src", "patches.json"), "utf8")).sort((a, b) => b.date.localeCompare(a.date))
const prev = patches.find((p) => p.date < date) ?? patches[0]
const tpl = readFileSync(join(root, "public", "deadlock-report", "patch", prev.date, "index.html"), "utf8")

// ヒーロー名 → アイコンのファイル名（src/heroes.ts）
const heroesTs = readFileSync(join(root, "src", "heroes.ts"), "utf8")
const files = Object.fromEntries(
  [...heroesTs.slice(heroesTs.indexOf("FILES")).matchAll(/^\s+(?:"([^"]+)"|([A-Za-z]+)):\s*"([^"]+)"/gm)].map((m) => [m[1] ?? m[2], m[3]])
)

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const en = (s) => `<span class="en">${esc(s)}</span>`
const [y, mo, d] = date.split("-").map(Number)
const md = `${mo}/${d}`
const dotted = date.replaceAll("-", ".")
const kind = (src.source.match(/Source:\s*(.+?)\s*-\s*\d/) ?? [])[1] ?? "Update"
const SITE = "https://nishi-yura.github.io"
const path = `/deadlock-report/patch/${date}/`

// 英語の行から、強化/弱体/調整/修正 を仮に決める
function guess(lines) {
  let up = 0, down = 0
  for (const l of lines) {
    if (/^(.*: )?Fixed\b/i.test(l)) continue
    // クールダウン・コスト・溜め時間は「減る＝強化」なので逆に数える
    const inverse = /\b(cooldown|cost|cast time|charge time|delay|windup)\b/i.test(l)
    const inc = /\b(increased|faster|longer)\b/i.test(l)
    const dec = /\b(reduced|decreased|slower|shorter)\b/i.test(l)
    if ((inc && !inverse) || (dec && inverse)) up++
    else if ((dec && !inverse) || (inc && inverse)) down++
  }
  if (lines.every((l) => /^(.*: )?Fixed\b/i.test(l))) return "fix"
  if (up && !down) return "buff"
  if (down && !up) return "nerf"
  return "adj"
}

const sections = src.sections
const general = sections.filter((s) => !/^(Items|Heroes)$/i.test(s.name))
const items = sections.find((s) => /^Items$/i.test(s.name))?.groups ?? []
const heroes = sections.find((s) => /^Heroes$/i.test(s.name))?.groups ?? []

const list = (lines) => `  <ul class="list">\n${lines.map((l) => `    <li>${en(l)}</li>`).join("\n")}\n  </ul>`
const generalHtml = general
  .map((s) => {
    const body = s.groups
      .map((g) => (g.name ? `  <h3 class="sub">${en(g.name)}</h3>\n` : "") + list(g.lines))
      .join("\n\n")
    return `<section class="panel">\n  <h2 class="lab">${en(s.name)}</h2>\n${body}\n</section>`
  })
  .join("\n\n")

const itemRows = items
  .map((g) => `      <tr><td>${esc(g.name)}</td><td class="k adj">調整</td><td>${g.lines.map(en).join("<br>")}</td></tr>`)
  .join("\n")

const heroRows = heroes
  .map((g) => {
    const name = g.name.replace(/^The /, "") in files ? g.name.replace(/^The /, "") : g.name
    const file = files[g.name] ?? files[name] ?? ""
    if (!file) console.log(`注意: ${g.name} のアイコンが src/heroes.ts にない（新ヒーローなら足す）`)
    return ` ${JSON.stringify([name, file, guess(g.lines), g.lines.map((l) => "[EN] " + l)])}`
  })
  .join(",\n")

// 「最近の流れ」：前回の行の now を外して、今回を先頭に足す
const tl = (tpl.match(/<ol class="tl">([\s\S]*?)<\/ol>/) ?? [])[1] ?? ""
const tlRest = tl.replace(/ class="num now"/, ' class="num"').replace(/<span class="now">今回：/, "<span>")
const timeline = `<ol class="tl">
    <li><span class="num now">${dotted}</span><span class="now">今回：${en(kind)}（下書き: 未翻訳）</span></li>${tlRest.replace(/^\s*/, "\n    ")}</ol>`

const main = `<main>
<!-- 下書き: 未翻訳。日本語に直し、class="en" と [EN] と この印を消してから公開する -->
<section class="panel">
  <p class="crumb">パッチまとめ ・ ${dotted} ・ ${esc(kind)}</p>
  <h1>${md} アップデート（下書き: 未翻訳）</h1>
  <p class="lede">（下書き: 未翻訳）このパッチを一言で。</p>
  <div class="facts">
    <div><span class="lab">配信</span><b>${dotted}</b></div>
    <div><span class="lab">変更ヒーロー</span><b>${heroes.length} 体</b></div>
    <div><span class="lab">変更アイテム</span><b>${items.length} 個</b></div>
  </div>
</section>

<section class="panel">
  <h2 class="lab">まずはここだけ</h2>
  <ol class="tldr">
    <li><span class="n">1</span><span>（下書き: 未翻訳）一番大きい変更</span></li>
    <li><span class="n">2</span><span>（下書き: 未翻訳）</span></li>
    <li><span class="n">3</span><span>（下書き: 未翻訳）</span></li>
  </ol>
</section>

${generalHtml}

${items.length ? `<section class="panel">
  <h2 class="lab">アイテム</h2>
  <div class="tbl"><table>
    <thead><tr><th>アイテム</th><th>区分</th><th>変更内容</th></tr></thead>
    <tbody>
${itemRows}
    </tbody>
  </table></div>
</section>` : ""}

<section class="panel">
  <h2 class="lab">ヒーロー</h2>
  <p class="crumb">区分は主な変更の傾向で付けた目安です（公式の分類ではありません）。</p>
  <div class="filters" role="group" aria-label="区分で絞り込み">
    <button id="f-all" data-f="all" aria-pressed="true">すべて</button>
    <button id="f-buff" data-f="buff" aria-pressed="false">強化</button>
    <button id="f-nerf" data-f="nerf" aria-pressed="false">弱体</button>
    <button id="f-adj" data-f="adj" aria-pressed="false">調整</button>
    <button id="f-fix" data-f="fix" aria-pressed="false">修正のみ</button>
  </div>
  <ul class="heroes" id="heroes"></ul>
</section>

<section class="panel">
  <h2 class="lab">最近の流れ</h2>
  ${timeline}
</section>

<section class="panel">
  <h2 class="lab">出典</h2>
  <ul class="list">
    <li><a href="${esc(src.url)}">Deadlock Wiki – ${esc(src.title)}</a>（公式パッチノートの転載）</li>
    <li><a href="https://deadlock.wiki/Updates">Deadlock Wiki – Updates</a></li>
    <li><a href="https://forums.playdeadlock.com/forums/changelog.10/">公式フォーラム Changelog</a></li>
  </ul>
  <p class="crumb">${dotted} 時点。数値は英語のパッチノートから訳しています。</p>
</section>
</main>`

let html = tpl
  .replace(/<title>[^<]*<\/title>/, `<title>${md} アップデートまとめ | Deadlock レポート</title>`)
  .replace(/(<meta name="description" content=")[^"]*/, `$1Deadlock ${y}年${mo}月${d}日アップデートの変更点を日本語で整理したまとめ。`)
  .replaceAll(`${SITE}/deadlock-report/patch/${prev.date}/`, `${SITE}${path}`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1Deadlock ${md} アップデートまとめ`)
  .replace(/(<meta property="og:description" content=")[^"]*/, `$1（下書き: 未翻訳）`)
  .replace(/<main>[\s\S]*<\/main>/, main)
  .replace(/const H=\[[\s\S]*?\n\];/, `const H=[\n${heroRows}\n];`)

// 未翻訳の英語を少し目立たせる（訳し終わって class="en" が消えれば効かない）
html = html.replace("</style>", ".en{background:#fff3bf}\n</style>")

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, html)
console.log(`patch-draft: public/deadlock-report/patch/${date}/index.html（全体 ${general.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.lines.length, 0), 0)} 行・アイテム ${items.length}・ヒーロー ${heroes.length}）`)
console.log(`ひな形: ${prev.date} のページ`)
console.log("次: 英語の行を日本語に直す → 見出し・要約・「まずはここだけ」を書く → 「下書き: 未翻訳」「[EN]」「class=\"en\"」を全部消す → src/patches.json に1件足す → npm run build")
