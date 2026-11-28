// 「比べる」の結果を画像（PNG）にする。Discord や X に貼る用。
// サイトと同じ見た目（灰色の地に白いパネル、Barlow Semi Condensed と IBM Plex Sans JP）で、色はライトのまま固定
const C = { page: "#cfcfcb", panel: "#ffffff", cell: "#f1f1ef", ink: "#2b2b2b", mute: "#6b6b6b", line: "#ececec", win: "#237a35", lose: "#c92a2a" }
const NUM = '"Barlow Semi Condensed", "IBM Plex Sans JP", sans-serif'
const JP = '"IBM Plex Sans JP", sans-serif'

export interface ShareRow {
  label: string
  mine: string
  pro: string
  diff: string
  /** 差が良い方向なら true、悪い方向なら false、なしは null */
  good: boolean | null
}

export interface ShareCard {
  kicker: string
  title: string
  sub: string
  proLabel: string
  rows: ShareRow[]
}

const W = 1200

export async function drawShareCard(card: ShareCard): Promise<Blob> {
  // ページのフォントが読み込まれてから描く（まだなら代わりのフォントになる）
  await Promise.all([`700 40px ${NUM}`, `700 20px ${JP}`, `500 20px ${JP}`].map((f) => document.fonts.load(f).catch(() => null)))
  const rowH = 64
  const M0 = 36
  // 表の下端（見出しの下 224px から行が並ぶ）＋余白 60＋下の枠
  const H = M0 + 224 + card.rows.length * rowH + 60 + M0
  const scale = 1
  const cv = document.createElement("canvas")
  cv.width = W * scale
  cv.height = H * scale
  const g = cv.getContext("2d")!
  g.scale(scale, scale)

  g.fillStyle = C.page
  g.fillRect(0, 0, W, H)
  const M = 36
  g.fillStyle = C.panel
  g.fillRect(M, M, W - M * 2, H - M * 2)
  const X = M + 52
  const R = W - M - 52

  g.textBaseline = "alphabetic"
  g.fillStyle = C.mute
  g.font = `700 22px ${JP}`
  g.fillText(card.kicker, X, M + 56)
  g.fillStyle = C.ink
  g.font = `700 52px ${NUM}`
  g.fillText(card.title, X, M + 118)
  g.fillStyle = C.mute
  g.font = `500 24px ${JP}`
  g.fillText(card.sub, X, M + 158)

  // 表
  const cols = [X, R - 560, R - 360, R - 160]
  let y = M + 210
  g.font = `700 20px ${JP}`
  g.fillStyle = C.mute
  g.textAlign = "right"
  g.fillText("あなた", cols[1] + 120, y)
  g.fillText(card.proLabel, cols[2] + 140, y)
  g.fillText("差", R, y)
  g.textAlign = "left"
  y += 14
  for (const r of card.rows) {
    g.fillStyle = C.line
    g.fillRect(X, y, R - X, 2)
    const base = y + rowH / 2 + 12
    g.fillStyle = C.ink
    g.font = `500 26px ${JP}`
    g.fillText(r.label, X, base)
    g.textAlign = "right"
    g.font = `700 34px ${NUM}`
    g.fillText(r.mine, cols[1] + 120, base)
    g.fillStyle = C.mute
    g.fillText(r.pro, cols[2] + 140, base)
    g.fillStyle = r.good === null ? C.mute : r.good ? C.win : C.lose
    g.fillText(r.diff, R, base)
    g.textAlign = "left"
    y += rowH
  }
  g.fillStyle = C.mute
  g.font = `500 20px ${JP}`
  g.fillText("Deadlock レポート ・ nishi-yura.github.io/deadlock-report/compare/", X, H - M - 24)

  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error("画像を作れませんでした"))), "image/png"))
}

/** 共有できる端末（主にスマホ）なら共有シート、できなければ PNG を保存 */
export async function shareOrSave(blob: Blob, filename: string): Promise<"shared" | "saved"> {
  const file = new File([blob], filename, { type: "image/png" })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file] })
      return "shared"
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared"
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return "saved"
}
