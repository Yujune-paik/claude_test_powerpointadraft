# Auto Speaker Notes — PowerPoint Web Add-in

PowerPoint のリハーサル中に発話を録音し、スライドごとに自動でスピーカーノートを生成・書き込む Office Web Add-in です。

## 概要

### 何ができるか

1. PowerPoint 内のタスクペインで「リハーサル開始」を押す
2. スライドショーを進めながら話す
3. スライドを送るたびに、そのスライドの音声を自動で区切る
4. リハーサル終了後、全スライドの音声を文字起こし → ノート生成 → スピーカーノート欄に自動書き込み

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| アドイン本体 | Office Web Add-in (HTML / CSS / JavaScript) |
| 音声録音 | MediaRecorder API |
| スライド操作 | Office.js / PowerPoint JavaScript API |
| 文字起こし | OpenAI Whisper API |
| ノート生成 | OpenAI GPT-4o |
| バックエンド | Vercel Serverless Functions (Python / FastAPI) |
| 認証 | サイトパスワード（HMAC比較） |

---

## プロジェクト構成

```
├── api/                          # Vercel Serverless Functions (Python)
│   ├── auth.py                   # パスワード認証 (POST /api/auth)
│   ├── transcribe.py             # Whisper 文字起こし (POST /api/transcribe)
│   ├── generate-notes.py         # GPT ノート生成 (POST /api/generate-notes)
│   ├── health.py                 # ヘルスチェック
│   ├── upload.py                 # (レガシー: Web版用)
│   └── export.py                 # (レガシー: Web版用)
│
├── frontend/                     # フロントエンド (React + Vite)
│   ├── public/
│   │   └── addin/                # ★ PowerPoint Add-in 本体
│   │       ├── manifest.xml      # アドインマニフェスト
│   │       ├── taskpane.html     # タスクペイン HTML
│   │       ├── taskpane.css      # タスクペイン スタイル
│   │       ├── taskpane.js       # タスクペイン ロジック
│   │       └── assets/           # アイコン (SVG)
│   │           ├── icon-16.svg
│   │           ├── icon-32.svg
│   │           └── icon-80.svg
│   ├── src/                      # (レガシー: Web版 React アプリ)
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                      # (レガシー: ローカル開発用 FastAPI サーバー)
│   ├── main.py
│   ├── routers/
│   └── services/
│
├── vercel.json                   # Vercel デプロイ設定
├── requirements.txt              # Python 依存パッケージ
└── README.md
```

> **レガシーについて**: `frontend/src/`（React Web アプリ）と `backend/` は、以前の Web 版実装です。現在の主要機能は PowerPoint Add-in（`frontend/public/addin/`）に移行しています。

---

## セットアップ

### 前提条件

- [Vercel](https://vercel.com/) アカウント
- [OpenAI](https://platform.openai.com/) API キー
- Microsoft 365 アカウント（PowerPoint デスクトップ版 または Web版）

### 1. Vercel にデプロイ

#### GitHub 連携（推奨）

1. このリポジトリを GitHub にプッシュ
2. [Vercel ダッシュボード](https://vercel.com/dashboard) で「New Project」→ GitHub リポジトリを選択
3. そのまま「Deploy」

> GitHub 連携済みの場合、以降は `git push` するだけで**自動デプロイ**されます。`vercel --prod` コマンドは不要です。

#### 手動デプロイ

```bash
npm i -g vercel
vercel --prod
```

### 2. 環境変数を設定

Vercel ダッシュボード → プロジェクト → **Settings** → **Environment Variables** で以下を追加:

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `OPENAI_API_KEY` | OpenAI の API キー | `sk-...` |
| `SITE_PASSWORD` | アドインのログインパスワード | 任意の文字列 |

> **セキュリティ**: API キーはサーバー側の環境変数で管理されるため、ユーザーに露出しません。

### 3. manifest.xml の URL を確認

`frontend/public/addin/manifest.xml` 内の URL がデプロイ先と一致していることを確認してください。

現在の設定:
```xml
<SourceLocation DefaultValue="https://speak-ad-raft.vercel.app/addin/taskpane.html" />
```

別のドメインにデプロイした場合は、ファイル内の `speak-ad-raft.vercel.app` を全て置換してください。

---

## PowerPoint にアドインをインストール

### manifest.xml を取得

ブラウザで以下の URL を開き、「名前を付けて保存」でダウンロードします:

```
https://speak-ad-raft.vercel.app/addin/manifest.xml
```

> ローカルにリポジトリをクローンする必要はありません。manifest.xml 1ファイルだけあれば OK です。

### デスクトップ版 PowerPoint（Windows / Mac）

1. PowerPoint を開く
2. **挿入** タブ → **アドインを取得**（または **マイ アドイン**）
3. **マイ アドイン** → **カスタム アドインのアップロード**
4. ダウンロードした `manifest.xml` を選択
5. **ホーム** タブに「**Auto Notes**」ボタンが出現

### Web版 PowerPoint（Microsoft 365 Online）

1. [office.com](https://www.office.com/) で PowerPoint Online を開く
2. **挿入** → **アドイン**（または **Office アドイン**）
3. **マイ アドインをアップロード**
4. `manifest.xml` を選択
5. タスクペインが開く

---

## 使い方

### 基本的な流れ

```
1. PowerPoint でプレゼンファイルを開く
2. ホームタブの「Auto Notes」ボタンをクリック → タスクペインが開く
3. パスワードを入力してログイン（初回のみ、セッション中は保持）
4. 「🎤 リハーサル開始」ボタンを押す
   → マイクの使用許可ダイアログが出るので「許可」
5. スライドショーを開始し、各スライドで話す
6. スライドを送ると、前のスライドの音声が自動で区切られる
7. 最後のスライドまで話し終えたら「■ リハーサル終了」を押す
8. 自動処理が開始:
   - 各スライドの音声 → Whisper で文字起こし
   - 文字起こし → GPT-4o でスピーカーノート生成
   - 生成されたノート → PowerPoint のスピーカーノート欄に書き込み
9. 完了！全スライドにノートが入った状態になる
```

### タスクペインの画面

| 画面 | 説明 |
|------|------|
| ログイン画面 | パスワード入力。環境変数 `SITE_PASSWORD` と照合 |
| 待機中 | 「リハーサル開始」ボタンが表示される |
| 録音中 | 現在のスライド番号と録音状態を表示。「リハーサル終了」ボタンあり |
| 処理中 | スライドごとの処理進捗（文字起こし中 → ノート生成中 → 書き込み中）を表示 |
| 完了 | 処理されたスライド数のサマリーを表示 |

---

## API エンドポイント

### POST `/api/auth`

パスワード認証。

```json
// Request
{ "password": "your-password" }

// Response (成功)
{ "ok": true }

// Response (失敗)
{ "ok": false, "error": "パスワードが違います" }
```

### POST `/api/transcribe`

音声ファイルを Whisper API で文字起こし。

```
// Request (multipart/form-data)
audio: <audio file (.webm)>
slide_index: 0
language: "ja"

// Response
{ "slideIndex": 0, "transcript": "こんにちは、本日のプレゼンでは..." }
```

### POST `/api/generate-notes`

文字起こしテキストからスピーカーノートを生成。

```json
// Request
{
  "slide_text": "",
  "transcript": "こんにちは、本日のプレゼンでは...",
  "model": "gpt-4o"
}

// Response
{ "note": "本日のプレゼンテーションでは..." }
```

### ノート生成のルール

GPT-4o は以下のルールに従ってノートを生成します:

- 「あー」「えーと」「まあ」などのフィラーを除去
- 論理的な流れに整理
- 発話の内容を忠実に反映（勝手に追加・変更しない）
- 箇条書きではなく、自然な話し言葉ベースのノート
- スピーカーノートとしてそのまま使える形式

---

## アーキテクチャ

```
┌─────────────────────────────────────────────┐
│           PowerPoint (デスクトップ/Web)        │
│  ┌───────────────────────────────────────┐   │
│  │        タスクペイン (taskpane.html)     │   │
│  │                                       │   │
│  │  ┌─────────┐   ┌──────────────────┐   │   │
│  │  │MediaRec.│   │   Office.js API   │   │   │
│  │  │ (録音)  │   │ (スライド検知/    │   │   │
│  │  │         │   │  ノート書き込み)  │   │   │
│  │  └────┬────┘   └──────────────────┘   │   │
│  │       │                               │   │
│  └───────┼───────────────────────────────┘   │
│          │                                    │
└──────────┼────────────────────────────────────┘
           │ HTTPS
           ▼
┌──────────────────────────────────────────────┐
│            Vercel Serverless Functions        │
│                                              │
│  /api/auth          パスワード認証            │
│  /api/transcribe    Whisper 文字起こし        │
│  /api/generate-notes GPT ノート生成           │
│                                              │
│  環境変数:                                    │
│    OPENAI_API_KEY   (サーバー側で安全に管理)   │
│    SITE_PASSWORD    (認証用)                  │
└──────────────────────────────────────────────┘
```

---

## ローカル開発

### フロントエンド

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 で起動
# → http://localhost:5173/addin/taskpane.html でアドイン画面
```

### API（Vercel CLI でローカル実行）

```bash
npm i -g vercel
vercel dev
# → http://localhost:3000 で API が起動
```

ローカル開発時は、`taskpane.js` の API ベース URL をクエリパラメータで上書きできます:

```
http://localhost:5173/addin/taskpane.html?api=http://localhost:3000
```

### ローカルで Office Add-in をテストする場合の注意

- Office Add-in は **HTTPS 必須**です
- ローカルでは `vite.config.ts` に以下を追加して HTTPS を有効化してください:

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    https: true,
  },
})
```

- または、Vercel にデプロイした状態で動作確認する方が簡単です

---

## トラブルシューティング

### アドインが PowerPoint に表示されない

- `manifest.xml` 内の URL が正しいか確認
- Vercel にデプロイ済みか確認（`https://speak-ad-raft.vercel.app/addin/taskpane.html` にブラウザでアクセスして確認）
- PowerPoint を再起動してみる

### マイクが使えない

- ブラウザ（タスクペイン内）のマイク許可ダイアログで「許可」を選択してください
- デスクトップ版の場合、OS のマイク設定で PowerPoint にマイク使用を許可する必要がある場合があります

### 「OPENAI_API_KEY not configured」エラー

- Vercel ダッシュボード → Settings → Environment Variables で `OPENAI_API_KEY` が設定されているか確認
- 設定後、再デプロイが必要な場合があります（Deployments → 最新を Redeploy）

### 「SITE_PASSWORD not configured」エラー

- 同様に Vercel の環境変数に `SITE_PASSWORD` を設定してください

### ノートが書き込まれない

- PowerPoint JavaScript API のバージョンが `notesSlide` をサポートしているか確認
- Web版 PowerPoint では一部の API が制限される場合があります
- デスクトップ版（Windows/Mac）での使用を推奨します

---

## 環境変数一覧

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `OPENAI_API_KEY` | はい | OpenAI API キー。Whisper と GPT-4o で使用 |
| `SITE_PASSWORD` | はい | アドインのログインパスワード |

---

## ライセンス

Private
