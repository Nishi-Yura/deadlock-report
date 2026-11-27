# Deadlock レポートの作り方

`https://nishi-yura.github.io/deadlock-report/`（目次）と `/deadlock-report/N/`（各レポート）を作るリポジトリです。
サイト本体の `Nishi-Yura.github.io` とは別のリポジトリで、リポジトリ名が `deadlock-report` なので URL もそのまま `/deadlock-report/` になります。

デザインの決まりは [design/DESIGN.md](design/DESIGN.md)。見た目を変えるときは、先にそちらを直してください。

---

## 1. 仕組み

```
deadlock-report/
  .github/workflows/deploy.yml   ← main に push するとビルドして公開する
  reports/1.json            ← レポートの中身（ここだけ書けばページになる）
  public/deadlock-report/1/img/   ← そのレポートで使う画像（配信のドラフト画面など）
  src/                      ← 画面の部品（React + shadcn/ui + Magic UI）
  scripts/                  ← ビルド用のスクリプト
  design/                   ← DESIGN.md、参考サイトのスクショ、比較した3案
```

`main` に push すると、GitHub Actions が `npm run build` を実行して公開します（反映まで1〜2分。進み具合はリポジトリの Actions タブで見られる）。
`npm run build` がやること：
1. `reports/*.json` を全部読んで、目次とレポートのページを作る（Discord や X に貼ったときのカード用のタグも入る）
   - カードの画像（1200×630、スコアと見出し）も `scripts/og.mjs` が自動で作る。見た目を確認したいときは `npm run og` を実行して `public/deadlock-report/N/og.png` を開く
   - Discord は一度読んだカードをしばらく覚えているので、公開後に直した内容はすぐには反映されないことがある
2. 公開するファイル一式（`index.html`、`1/`、`2/` …、`assets/`）を `dist/deadlock-report/` に書き出す。公開されるのはこのフォルダの中だけ
---

## 2. 新しいレポートを作る手順

### 準備（初回だけ）
学校のネットワークでは npm にプロキシが必要です（`HTTPS_PROXY` が設定されていれば自動で使われます）。

```powershell
cd "$env:USERPROFILE\OneDrive\デスクトップ\github\deadlock-report"
npm install
```

### ① ひな形を作る
```powershell
npm run new
```
`reports/N.json` と `public/deadlock-report/N/img/` ができます（N は自動で次の番号）。

### ② 材料を集める
| 欲しいもの | 取る場所 |
|---|---|
| 大会名・日付・シリーズのスコア・試合の流れ | EDL.GG の大会ニュースとシリーズのページ |
| 各マップのマッチ ID | EDL.GG のシリーズのページ |
| スコアボード（K/D/A・ソウル・ダメージ・回復）、試合時間 | マッチ ID から Deadlock API（api.deadlock-api.com）のマッチ情報 |
| ピック順・BAN | 配信アーカイブ（YouTube）のドラフト画面。スクショを `img/` に保存 |

### ③ `reports/N.json` を埋める
`reports/1.json`（決勝だけ）と `reports/2.json`（予選・チャレンジャーも入り）が完成例です。項目の意味は `src/types.ts` に書いてあります。

- **決勝以外のシリーズ**：`series` と `maps` に `stage`（"チャレンジャー"、"予選" など）を付ける。付けないと決勝扱い。大会当日以外の試合は `series[].date` も書く。決勝のスコアは大きく出て、その下に地域ごとの勝ち上がり表（予選 → チャレンジャー → 決勝）が自動で描かれる。マップのタブも同じ順でシリーズごとにまとまる。
- **配信がないマップ**（予選など）：`draftUnknown: true`、`firstPick: ""`、`bans: []`、`picks` には使ったヒーローを順不同で書く。BAN の集計からは外れる。
- **マッチ ID が分からないシリーズ**（EDL.GG に試合ページがない予選など）：`series` にだけ書き、`maps` には入れない。勝ち上がり表には出て、そのタブには `note` の文が表示される。`reports/3.json` の APAC 予選が例。

- **`headline`**：このレポートで一番言いたいことを1文で。目次にもそのまま出ます。
- **`maps[].teams[0]`**：先行ピックのチームを先に書く。`picks` はピック順。
- **`players`**：`[選手名, ヒーロー, キル, デス, アシスト, ソウル, ダメージ, 回復]` の順。
- **ヒーロー名**は `src/heroes.ts` にある綴りで書く（アイコンがそこから出ます）。新ヒーローが増えたら `src/heroes.ts` に1行足す。
- キル数・シリーズのキル合計・ヒーロー別の勝敗・BAN の集計は**自動で計算**されます。手で書かない。
- **`takeaways`**：3〜5個。「何が起きたか」の事実と、自分の試合で何をするかをセットで。

### ④ 確認する
```powershell
npm run dev
```
表示された URL の `/deadlock-report/N/` を開いて確認します。スマホ幅（375px）でも見る。

### ⑤ 公開する
```powershell
npm run build   # 手元でエラーが出ないか確かめるだけ（dist は push されない）
git add -A
git commit -m "Add Deadlock report N"
git push
```

---

## 2.5 パッチまとめを足す手順

公式のアップデートが出るたびに、日本語のまとめページを1枚足します。試合レポートの JSON とは別の、ただの HTML です。

1. 中身を取る：<https://deadlock.wiki/Updates> で最新の日付を見て、`https://deadlock.wiki/Update:<Month>_<D>,_<YYYY>` を開く（公式フォーラムの Changelog と同じ内容）。
2. `public/deadlock-report/patch/2026-11-26/index.html` をコピーして `patch/YYYY-MM-DD/index.html` を作り、中身を差し替える。CSS とヒーローのアイコン表（ファイル名は `src/heroes.ts` と同じ）はそのまま使う。
   - 構成：概要 → まずはここだけ（6項目前後）→ 全体の変更 → モード → アイテム表 → ヒーロー（強化/弱体/調整/修正）→ 最近の流れ → 出典
   - 数値は「前 → 後」で書く。ヒーロー数などの数は、表示された件数と合わせる。
   - 非公開（Undocumented）の小修正だけの日はページを作らない。
3. `src/pages/index-page.tsx` の `patches` の**先頭**に1件足す。前のページの「最近の流れ」はそのままでよい。
4. `npm run build` → commit → push（⑤と同じ）。

---

## 3. 書き方の決まり（前回「AI っぽい」と判断したものを避ける）

- 「このページに載せていないこと」のような予防線の節は作らない。
- 各セクションに言い訳の注意書きを付けない。サンプルが少ないなど本当に必要なことだけ `heroNote` に1回書く。
- 色の凡例で説明しない。勝ちは緑、負けは赤、で読めるようにする。
- 数字を盛らない。データにないことは書かない。
- 当たり前のことは書かない（例：「BAN は使われると困るヒーローを消す手」）。そのレポートのデータからしか言えないことだけを持ち帰りにする。言えることがなければ数を減らす。

## 4. 使っている部品

- **shadcn/ui**：Tabs（マップ切り替え）、Table（スコアボード）、Tooltip（ヒーロー名）、Separator。色と角丸は `src/index.css` で DESIGN.md の値に作り直してある。
- **Magic UI**：NumberTicker（シリーズのスコア）、BlurFade（パネルの出現）。`src/components/magicui/` にソースをそのまま置いている。端末で「視差効果を減らす」が有効なら動かない。
- フォント：Barlow Semi Condensed（数字・チーム名）、IBM Plex Sans JP（本文）。Inter は使わない。
