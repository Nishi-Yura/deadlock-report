// ヒーロー名のカタカナ（サイト内検索で「ビリー」などでも見つかるように）。
// 公式の日本語名ではなく、英語名の読み。新ヒーローが増えたら1行足す
export const HERO_KANA: Record<string, string[]> = {
  Abrams: ["アブラムス"],
  Apollo: ["アポロ"],
  Baba: ["ババ"],
  Bebop: ["ビバップ", "ベボップ"],
  Billy: ["ビリー"],
  Calico: ["キャリコ", "カリコ"],
  Celeste: ["セレスト"],
  "Deadman Danny": ["デッドマンダニー", "ダニー"],
  Doorman: ["ドアマン"],
  "The Doorman": ["ドアマン"],
  Drifter: ["ドリフター"],
  Dynamo: ["ダイナモ"],
  Graves: ["グレイヴス", "グレイブス"],
  "Grey Talon": ["グレイタロン", "タロン"],
  Haze: ["ヘイズ"],
  Holliday: ["ホリデイ", "ホリデー"],
  Infernus: ["インファーナス", "インフェルヌス"],
  Ivy: ["アイビー", "アイヴィー"],
  Kelvin: ["ケルビン", "ケルヴィン"],
  "Lady Geist": ["レディガイスト", "ガイスト"],
  Lash: ["ラッシュ"],
  McGinnis: ["マクギニス"],
  Mina: ["ミナ"],
  Mirage: ["ミラージュ"],
  "Mo & Krill": ["モーアンドクリル", "モークリル", "クリル"],
  "Nurse Harrow": ["ナースハロウ", "ハロウ"],
  Paige: ["ペイジ"],
  Paradox: ["パラドックス"],
  Pocket: ["ポケット"],
  "Rat King": ["ラットキング"],
  Rem: ["レム"],
  Seven: ["セブン", "セヴン"],
  Shiv: ["シヴ", "シブ"],
  Silver: ["シルバー", "シルヴァー"],
  Sinclair: ["シンクレア"],
  Solomon: ["ソロモン"],
  Venator: ["ヴェネイター", "ベネイター", "ヴェナトル"],
  Victor: ["ヴィクター", "ビクター"],
  Vindicta: ["ヴィンディクタ", "ビンディクタ"],
  Violet: ["バイオレット", "ヴァイオレット"],
  Viscous: ["ヴィスカス", "ビスカス"],
  Vyper: ["ヴァイパー", "バイパー"],
  Warden: ["ウォーデン"],
  Wraith: ["レイス"],
  Yamato: ["ヤマト"],
}

/** 検索用に文字をそろえる：全角半角・大文字小文字・ひらがな→カタカナ・ヴ行→バ行・長音や空白を消す */
export function normKana(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/ヴァ/g, "バ").replace(/ヴィ/g, "ビ").replace(/ヴェ/g, "ベ").replace(/ヴォ/g, "ボ").replace(/ヴ/g, "ブ")
    .replace(/[\s_\-・#ー＆&]/g, "")
}
