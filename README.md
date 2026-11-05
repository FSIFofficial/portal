# FSIF Portal

FSIF（未来宇宙産業フォーラム）メンバー向けポータルサイト。

| 役割 | 使うもの |
| --- | --- |
| 画面 | Next.js（静的書き出し）→ **GitHub Pages** |
| 裏側（API） | **Google Apps Script**（コードは**このリポジトリには置かず**、管理者が別途保管） |
| データ | **Googleスプレッドシート**（GASが管理。**直接編集しない**） |
| 資料 | **Google Drive**（資料館からリンクで開く／ダウンロード） |
| ログイン | **Googleでログイン**（Google Identity Services） |

ツール・資料・お知らせ・アカウント・ロール（権限）の追加や変更は、すべてポータルの「管理画面」から行います。

---

## 画面と権限

- **ホーム / ツール / 資料館 / 検索**：ログインした人が、自分のロールで見られるものだけ表示されます。
- **管理画面**：ロールに付けた権限に応じてメニューが出ます。

| ロール（初期） | できること |
| --- | --- |
| 全権管理者 `superadmin` | すべて。**アカウント追加・ロール作成・権限設定・設定変更**はこのロールだけ |
| 掲載担当者 `editor` | ツール・資料・お知らせの編集、変更履歴の閲覧 |
| メンバー `member` | 閲覧のみ |

全権管理者は「管理画面 > ロールと権限」で新しいロール（例：契約担当、広報チーム）を作り、
「アカウント」でユーザーに割り当てます。ツール・資料・お知らせの「公開範囲」でロールを選ぶと、
そのロールを持つ人にだけ表示されます（未選択なら全員に表示）。

閲覧範囲のチェックはGAS側（サーバー）で行っているので、権限のないデータはブラウザに送られません。

> 資料館の資料はGoogle Driveにあります。ポータルの公開範囲とは別に、**Drive側の共有設定**も必要です。

---

## セットアップ手順

### 1. スプレッドシートとGAS

1. Googleスプレッドシートを新規作成する（名前は自由。例：`FSIF Portal DB`）
2. メニュー「拡張機能 > Apps Script」を開く
3. 管理者から受け取った `Code.gs` の中身をエディタの `コード.gs` に貼り付ける
4. 「プロジェクトの設定（⚙）」で「`appsscript.json` マニフェスト ファイルをエディタで表示する」をオンにし、受け取った `appsscript.json` の中身で上書きする
5. 「プロジェクトの設定 > スクリプト プロパティ」に追加：
   | プロパティ | 値 |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | 手順2で作るクライアントID |
   | `SUPER_ADMIN_EMAILS` | 最初の全権管理者のGmail（カンマ区切りで複数可） |
6. エディタで関数 `setup` を選んで「実行」→ 権限を承認する。シート（Users / Roles / Tools / Documents / Announcements / Settings / Logs）と初期データが作られます
7. 「デプロイ > 新しいデプロイ > 種類：ウェブアプリ」
   - 次のユーザーとして実行：**自分**
   - アクセスできるユーザー：**全員**
   - 発行された `https://script.google.com/macros/s/…/exec` のURLを控える

> ログインしていない人や登録されていない人からのリクエストは、GAS側でIDトークンを検証して拒否します。
> コードを更新したときは「デプロイを管理 > 編集 > バージョン：新バージョン」で同じURLのまま更新できます。

### 2. Googleログイン用のクライアントID

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（GASと同じアカウントでOK）
2. 「APIとサービス > OAuth同意画面」を設定（外部 / 内部はご利用のアカウントに合わせて）
3. 「認証情報 > 認証情報を作成 > OAuthクライアントID」
   - 種類：**ウェブアプリケーション**
   - 承認済みの JavaScript 生成元：`https://fsifofficial.github.io`（ローカル確認用に `http://localhost:3000` も追加可）
4. 発行されたクライアントIDを、GASのスクリプトプロパティ `GOOGLE_CLIENT_ID` と、次のGitHub変数の両方に設定

### 3. GitHub Pages

1. リポジトリの「Settings > Pages > Build and deployment > Source」を **GitHub Actions** にする
2. 「Settings > Secrets and variables > Actions > Variables」に追加：
   | 変数 | 値 |
   | --- | --- |
   | `GAS_URL` | 手順1-7のウェブアプリURL |
   | `GOOGLE_CLIENT_ID` | 手順2のクライアントID |
3. `main` ブランチにpushすると `.github/workflows/deploy.yml` が動き、`https://fsifofficial.github.io/portal/` に公開されます

### 4. 初回ログイン後

`SUPER_ADMIN_EMAILS` のアカウントでログイン → 管理画面から
1. 「ロールと権限」で必要なロールを作成
2. 「アカウント」でメンバーのGoogleアカウントを登録してロールを割り当て
3. 「ツール管理」「資料管理」「お知らせ」で掲載内容を登録

---

## 開発

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

`GAS_URL` を設定しない場合は **デモモード** で動きます（ログイン画面でサンプルユーザーを選択、データはブラウザの localStorage に保存）。
GASにつないで確認する場合は `.env.local` を作成：

```
NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/xxxx/exec
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

### ディレクトリ

```
app/                      ページ（中身は components/portal/）
components/portal/
  portal-app.tsx          全体レイアウト・ヘッダー・ルーティング（#/tools など）
  views.tsx               ホーム / ツール / 資料館 / 検索
  admin-view.tsx          管理画面（ツール・資料・お知らせ・アカウント・ロール・設定・変更履歴）
  login-screen.tsx        Googleログイン（デモモード時はユーザー選択）
  auth-provider.tsx       ログイン状態とAPI呼び出し
lib/
  api.ts                  GAS呼び出し＋デモ用バックエンド
  drive.ts                Driveリンク → 閲覧/ダウンロード/サムネイルURL変換
  types.ts                データ型（GASの SCHEMA と対応）
  config.ts               環境設定・GASの期待版名（EXPECTED_GAS_VERSION）
```

### GASコードの扱い

- GASコード（`Code.gs` / `appsscript.json`）と組織の内部データは **GitHubに上げません**。`gas/` フォルダは `.gitignore` 済みです。
- GASコードの1行目に版名 `GAS_VERSION` があります。画面側の期待値は `lib/config.ts` の `EXPECTED_GAS_VERSION` です。
- 「管理画面 > バージョン確認」で、版名・シートの列構成・スクリプトプロパティが合っているかを確認できます。GASのデータ形式を変えたら両方の版名を上げてください。

項目を追加するときは `lib/types.ts` とGASコードの `SCHEMA` を両方更新してください。シートの列は位置で読むので、新しい項目は **各シートの `fields` の末尾に追加** し、`setup()` を再実行してヘッダー行を更新してください。
