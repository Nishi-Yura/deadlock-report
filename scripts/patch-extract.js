// deadlock.wiki の Update:<日付> ページで実行して、パッチノートを JSON にするスニペット。
// （deadlock.wiki はスクリプトからの直接取得を Cloudflare で止めているので、ブラウザで開いたページから取り出す）
//
// 使い方：ブラウザでページを開く → F12 の Console にこのファイルの中身を貼って Enter
//         → 出てきた JSON を patch-src/YYYY-MM-DD.json に保存 → npm run patch-draft -- YYYY-MM-DD
// 出力：{ title, url, source, sections: [{ name, groups: [{ name, lines: [...] }] }] }
//   name が "" の group は見出しのない行（General など）。入れ子の箇条書きは "親: 子" の1行にする
;(() => {
  const root = document.querySelector(".mw-parser-output")
  const own = (li) =>
    [...li.childNodes]
      .filter((n) => !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName)))
      .map((n) => n.textContent)
      .join("")
      .replace(/\s+/g, " ")
      .trim()
  const flatten = (ul, prefix = "") =>
    [...ul.querySelectorAll(":scope > li")].flatMap((li) => {
      const text = own(li)
      const sub = li.querySelector(":scope > ul, :scope > ol")
      // wiki は空の <li class="mw-empty-elt"> を挟むので飛ばす
      if (!text && !sub) return []
      const full = prefix && text ? `${prefix}: ${text}` : prefix || text
      return sub ? flatten(sub, full) : [full]
    })
  const sections = []
  let sec = null
  let group = null
  // ヒーローのスキル名は、箇条書きの直前の短い段落（<p>スキル名</p>）に書かれている
  let label = ""
  for (const el of root.querySelectorAll("h2, h3, p, ul")) {
    if (el.closest("#toc, .toc")) continue
    if (/^(UL|P)$/.test(el.tagName) && el.parentElement.closest("ul, li")) continue
    if (el.tagName === "H2") {
      sec = { name: el.innerText.trim(), groups: [] }
      group = null
      label = ""
      if (sec.name !== "Contents") sections.push(sec)
    } else if (el.tagName === "H3" && sec) {
      group = { name: el.innerText.trim(), lines: [] }
      sec.groups.push(group)
      label = ""
    } else if (el.tagName === "P") {
      const t = el.innerText.replace(/\s+/g, " ").trim()
      label = t && t.length <= 40 && !/[.:]$/.test(t) && !/^Source:/.test(t) ? t : ""
    } else if (el.tagName === "UL" && sec) {
      if (!group) sec.groups.push((group = { name: "", lines: [] }))
      group.lines.push(...flatten(el, label))
      label = ""
    }
  }
  const source = [...root.querySelectorAll("p")].map((p) => p.innerText.trim()).find((t) => /^Source:/.test(t)) ?? ""
  const out = JSON.stringify({ title: document.title.replace(/ - The Deadlock Wiki$/, ""), url: location.href, source, sections }, null, 1)
  console.log(out)
  return out
})()
