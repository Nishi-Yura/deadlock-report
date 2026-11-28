# Deadlock レポートの作り方

`https://nishi-yura.github.io/deadlock-report/`（目次）と `/deadlock-report/N/`（各レポート）、それに全レポートをまたぐ `/stats/`（ヒーロー統計）・`/hero/<名前>/`・`/trends/`（試合展開とドラフトの傾向）・`/teams/`・`/team/<名前>/`・`/vs/`（対戦カード）・`/players/`・`/player/<名前>/`・`/compare/`（自分の試合と比べる：1試合・直近の試合）を作るリポジトリです。上のバーにはサイト内検索（`/` キーでも開く）、一番下には表示の切り替え（自動 / ライト / ダーク。選んだものはブラウザの localStorage の `theme` に残り、パッチまとめのページでも同じものを使う）があります。
`/compare/` だけはブラウザから Deadlock API を直接読みます（大会側の平均はビルド時のデータ）。

**レポートを足したときに自動で更新されるもの**：ヒーロー統計・傾向・ヒーロー/チーム/選手のページ・対戦カード・検索・カード画像・RSS は、`reports/*.json` から毎回ビルドで作り直すので、JSON を足して push するだけで全部に反映されます。
**手で1回実行するもの**：`npm run timeline`（ソウル推移・Mid-Boss・キル・オブジェクト破壊・アイテム購入を API から取って `src/*.json` に書く）。忘れると `npm run validate`（＝ build）がエラーで止めます。パッチまとめは `src/patches.json` に足したときだけ反映されます。
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
  src/patches.json          ← パッチまとめの一覧（目次・ヒーロー統計のパッチ前後・RSS が使う）
  src/timelines.json        ← 各マップのソウル差の推移・Mid-Boss・キル・オブジェクト破壊（npm run timeline が作る）
  src/items.json            ← 各選手のアイテム購入（npm run timeline が作る。ヒーローページを開いたときだけ読む）
  src/item-catalog.json     ← アイテムの名前・ティア・画像（npm run timeline が作る）
  patch-src/                ← パッチまとめの下書きの元（deadlock.wiki から取り出した英語の JSON）
  scripts/                  ← ビルド用のスクリプト
  design/                   ← DESIGN.md、参考サイトのスクショ、比較した3案
```

`main` に push すると、GitHub Actions が `npm run build` を実行して公開します（反映まで1〜2分。進み具合はリポジトリの Actions タブで見られる）。
`npm run build` がやること：
0. `scripts/validate.mjs` で `reports/*.json` を確かめる。エラーがあればここで止まる（下の ④）
1. `reports/*.json` を全部読んで、目次とレポートのページを作る（Discord や X に貼ったときのカード用のタグも入る）
   - カードの画像（1200×630、スコアと見出し）も `scripts/og.mjs` が自動で作る。統計・傾向・チーム・選手・ヒーローの各ページの分も作る（全部で130枚ほど、40秒くらいかかる）。見た目を確認したいときは `npm run og` を実行して `public/deadlock-report/N/og.png` や `public/deadlock-report/team/<名前>/og.png` を開く
   - Discord は一度読んだカードをしばらく覚えているので、公開後に直した内容はすぐには反映されないことがある
   - 更新フィード `feed.xml`（レポートとパッチまとめ）も書く
   - チーム・選手のページは JSON に出てくる名前から自動で作る。名前の綴りがレポートごとに違うと別人・別チームになるので、前のレポートと同じ綴りで書く
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
まずマッチ ID から下書きを作ります（地域:ステージ:マッチID をシリーズごとに。マップ番号は書いた順）：
```powershell
npm run fill -- 5 EU:決勝:145000001,145000002 EU:チャレンジャー:145000000 NA:決勝:145000010,145000011
```
- チーム名・選手・ヒーロー・K/D/A・ソウル・ダメージ・回復・時間・勝者・シリーズのスコアが入る。マップごとの要点（10分・20分のソウル差、Mid-Boss、KDA 最高の選手）も表示されるので `flow` を書くときに使う
- 前のレポートで見た選手はアカウントから同じ名前とチームになる。初めての選手は Steam 名に `?` を付けて仮に入れ、知らないチームは `?チームA` / `?チームB` になる。EDL.GG のスコアボードを見て置き換える：
  ```powershell
  npm run fill -- 5 "?チームB=EGO" "van3k?=vanek"
  ```
  `?` が残っていると `npm run validate` がエラーにする。手で直した名前は、もう一度 `fill` しても消えない
- **ピック順・BAN・先行ピック（`teams[0]`）・`firstPick` は入らない**（API にない）。配信を見て書く。`picks` は使ったヒーローが順不同で入っているので、ピック順に並べ替える
- あとから `npm run fill -- 5` だけ実行すると、JSON にあるマップを API の値で埋め直す（書いたピック順・BAN・flow は残る）

残りは手で書きます。`reports/1.json`（決勝だけ）と `reports/2.json`（予選・チャレンジャーも入り）が完成例です。項目の意味は `src/types.ts` に書いてあります。

- **決勝以外のシリーズ**：`series` と `maps` に `stage`（"チャレンジャー"、"予選" など）を付ける。付けないと決勝扱い。大会当日以外の試合は `series[].date` も書く。決勝のスコアは大きく出て、その下に地域ごとの勝ち上がり表（予選 → チャレンジャー → 決勝）が自動で描かれる。マップのタブも同じ順でシリーズごとにまとまる。
- **配信がないマップ**（予選など）：`draftUnknown: true`、`firstPick: ""`、`bans: []`、`picks` には使ったヒーローを順不同で書く。BAN の集計からは外れる。
- **マッチ ID が分からないシリーズ**（EDL.GG に試合ページがない予選など）：`series` にだけ書き、`maps` には入れない。勝ち上がり表には出て、そのタブには `note` の文が表示される。`reports/3.json` の APAC 予選が例。

- **`headline`**：このレポートで一番言いたいことを1文で。目次にもそのまま出ます。
- **`maps[].teams[0]`**：先行ピックのチームを先に書く。`picks` はピック順。
- **`players`**：`[選手名, ヒーロー, キル, デス, アシスト, ソウル, ダメージ, 回復]` の順。
- **ヒーロー名**は `src/heroes.ts` にある綴りで書く（アイコンがそこから出ます）。新ヒーローが増えたら `src/heroes.ts` に1行足す。
- キル数・シリーズのキル合計・ヒーロー別の勝敗・BAN の集計は**自動で計算**されます。手で書かない。
- **`takeaways`**：3〜5個。「何が起きたか」の事実と、自分の試合で何をするかをセットで。

### ④ 確かめる・ソウル推移とアイテムを取る
```powershell
npm run validate -- --api   # JSON の中身を Deadlock API と照らし合わせる
npm run timeline            # ソウル推移・Mid-Boss・キル・オブジェクト・アイテム購入を src/timelines.json と src/items.json に足す
npm run dev
```
`validate` が拾うもの：ヒーロー名の綴り（`The Doorman` ではなく `Doorman` など）、BAN したヒーローが同じマップでピックされている（BAN の読み違い）、ピックと選手のヒーローのずれ、先行ピックと `teams[0]` のずれ、シリーズのスコアとマップの勝者のずれ。`--api` を付けると勝者・時間・K/D/A・ソウル・ダメージ・回復も API と比べる。API の結果は `.cache/` に保存される（コミットしない）。

表示された URL の `/deadlock-report/N/` を開いて確認します。スマホ幅（375px）でも見る。

### ⑤ 公開する
```powershell
npm run build   # 手元でエラーが出ないか確かめるだけ（dist は push されない）
git add -A   # src/timelines.json も入る
git commit -m "Add Deadlock report N"
git push
```

---

## 2.5 パッチまとめを足す手順

公式のアップデートが出るたびに、日本語のまとめページを1枚足します。試合レポートの JSON とは別の、ただの HTML です。

1. 中身を取る：<https://deadlock.wiki/Updates> で最新の日付を見て、`https://deadlock.wiki/Update:<Month>_<D>,_<YYYY>` をブラウザで開く（公式フォーラムの Changelog と同じ内容）。
   deadlock.wiki はスクリプトからの直接取得を止めているので、開いたページで F12 → Console に `scripts/patch-extract.js` の中身を貼って Enter。出てきた JSON を `patch-src/YYYY-MM-DD.json` に保存する。
2. 下書きを作る：
   ```powershell
   npm run patch-draft -- YYYY-MM-DD
   ```
   `public/deadlock-report/patch/YYYY-MM-DD/index.html` ができる。見た目は一番新しいパッチページと同じで、変更点は英語のまま（黄色）入る。ヒーローの区分（強化/弱体/調整/修正）は英語の言葉から仮に付けてあるので、訳しながら直す。「最近の流れ」には今回の行が先頭に入る。
   日本語に直して、見出し・概要・「まずはここだけ」を書き、`下書き: 未翻訳`・`[EN] `・`class="en"` を全部消す。残っていると `npm run validate`（＝ build）がエラーで止める。
   - 構成：概要 → まずはここだけ（6項目前後）→ 全体の変更 → モード → アイテム表 → ヒーロー（強化/弱体/調整/修正）→ 最近の流れ → 出典
   - 数値は「前 → 後」で書く。ヒーロー数などの数は、表示された件数と合わせる。
   - 非公開（Undocumented）の小修正だけの日はページを作らない。
3. `src/patches.json` に1件足す（`date` は `YYYY-MM-DD`。並びは自動で新しい順）。リンクを貼ったときのカード画像（`patch/YYYY-MM-DD/og.png`：タイトル・概要・変更ヒーロー数・強化/弱体の数・変更アイテム数）は `npm run build` が自動で作る。ページの `<head>` には `og:image` のタグが要る（下書きを使えば前のページから引き継がれる。ないと validate がエラーにする）。前のページの「最近の流れ」はそのままでよい。ヒーロー統計の「パッチ前・後」は、ここにある一番新しいパッチの日付で自動的に区切られる。
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
