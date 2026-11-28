// 用語の説明。ページの中では <Term>（点線の下線）で出し、/deadlock-report/glossary/ に一覧がある。
// 中身は deadlock.wiki（Cursed Apple・Rejuvenator のページ、2026-11-28 時点）と、このサイトのデータで確かめたもの。
// match は本文から自動で見つける綴り（長いものから先に探す）

export interface TermDef {
  key: string
  term: string
  /** 本文で見つける綴り。省略すると term だけ */
  match?: string[]
  text: string
  group: "マップと目標" | "試合の流れ" | "ドラフト" | "数字の見方" | "大会"
}

export const GLOSSARY: TermDef[] = [
  // マップと目標
  { key: "soul", term: "ソウル", group: "マップと目標", text: "Deadlock のお金。トルーパー・敵ヒーロー・Haunts・木箱などから手に入り、アイテムを買う。たまるとレベル（スキルの強化）も上がる。" },
  { key: "trooper", term: "トルーパー", match: ["トルーパー", "Trooper"], group: "マップと目標", text: "各レーンを自動で進む小兵。倒すとソウルが手に入る。" },
  { key: "haunts", term: "Haunts", group: "マップと目標", text: "レーンの外（ジャングル）にいる中立の敵。倒すとソウルが手に入る。" },
  { key: "guardian", term: "Guardian", group: "マップと目標", text: "各レーンで最初に立ちはだかる守り手。各チーム3体（レーンごとに1体）。" },
  { key: "walker", term: "Walker", group: "マップと目標", text: "Guardian の次にある大型の守り手。各チーム3体。" },
  { key: "base-guardian", term: "Base Guardian", group: "マップと目標", text: "本拠地の入口を守る守り手。各レーン2体、各チーム6体。" },
  { key: "shrine", term: "Shrine", group: "マップと目標", text: "本拠地にある2つの祠。両方壊すと Patron を攻撃できるようになる。" },
  { key: "patron", term: "Patron", group: "マップと目標", text: "本拠地の一番奥にある最後の目標。相手の Patron を倒したチームの勝ち。" },
  { key: "midboss", term: "Mid-Boss", match: ["Mid-Boss", "Midboss", "MB"], group: "マップと目標", text: "マップ中央（Broadway の地下）にいるボス。倒すと Rejuvenator の結晶が3つ出る。倒されてから7分・6分・5分…で復活する。グラフの「MB」はこれ。" },
  { key: "rejuv", term: "Rejuvenator", match: ["Rejuvenator", "Rejuv"], group: "マップと目標", text: "Mid-Boss が落とす緑の結晶。殴って取ったチームは3分間、倒されてもその場で3秒後に全回復で復活できる（結晶1つにつき1人）。" },

  // 試合の流れ
  { key: "lane", term: "レーン戦", match: ["レーン戦"], group: "試合の流れ", text: "試合の序盤、3本のレーンに2人ずつ分かれて相手の2人と向き合う時間。このサイトでは 9:00 の時点で、同じレーンの2人のソウルの合計が相手より多ければ「レーン勝ち」と数える。" },
  { key: "lead", term: "ソウル差", group: "試合の流れ", text: "2チームのソウルの合計の差。このサイトのグラフでは、上に行くほど片方のチームのリードが大きい。" },
  { key: "first-pick", term: "先行ピック", match: ["先行ピック", "先行"], group: "ドラフト", text: "ドラフトで先にヒーローを選んだチーム。このサイトでは、マップのチームの1番目に書いている。" },
  { key: "ban", term: "BAN", group: "ドラフト", text: "ドラフトで、その試合では誰も使えなくするヒーロー。このサイトの大会では各チーム3体。" },
  { key: "draft", term: "ドラフト", group: "ドラフト", text: "試合の前に、BAN とピック（使うヒーロー）を2チームが交互に決める手順。配信の画面から読み取っている。" },

  // 数字の見方
  { key: "pick-rate", term: "ピック率", group: "数字の見方", text: "そのヒーローが使われたマップの割合。" },
  { key: "ban-rate", term: "BAN 率", match: ["BAN 率", "BAN率"], group: "数字の見方", text: "そのヒーローが BAN されたマップの割合。配信でドラフトが見えたマップだけで数える。" },
  { key: "kda", term: "KDA", group: "数字の見方", text: "（キル＋アシスト）÷ デス。デスが0のときは キル＋アシスト。大きいほど倒されずに貢献している。" },
  { key: "tier", term: "ティア", match: ["ティア"], group: "数字の見方", text: "アイテムの段階。値段は T1 800、T2 1,600、T3 3,200、T4 6,400 ソウル。" },

  // 大会
  { key: "night-shift", term: "Night Shift", group: "大会", text: "EDL.GG で毎週開かれている Deadlock の大会。EU・NA・APAC の地域ごとにある。" },
  { key: "stages", term: "チャレンジャー", match: ["チャレンジャー"], group: "大会", text: "Night Shift の流れ：予選の勝者がチャレンジャーへ、チャレンジャーの勝者が決勝で前回の優勝チームと戦う。" },
]

export const termByKey = new Map(GLOSSARY.map((t) => [t.key, t]))

/** 本文から用語を見つけるための [綴り, 用語] の一覧（長い綴りから） */
export const TERM_MATCHES: [string, TermDef][] = GLOSSARY.flatMap((t) => (t.match ?? [t.term]).map((m) => [m, t] as [string, TermDef]))
  // 「MB」「先行」のような短い綴りは、本文の自動検出では誤爆しやすいので使わない
  .filter(([m]) => m.length >= 3 || /[ぁ-んァ-ン一-龥]{3,}/.test(m))
  .sort((a, b) => b[0].length - a[0].length)
