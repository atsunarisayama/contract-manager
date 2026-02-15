# Vercel デプロイ手順（5分で完了）

## ステップ1: GitHubにリポジトリ作成

1. GitHubにログイン
2. 右上の `+` → `New repository`
3. リポジトリ名: `contract-manager` (任意の名前でOK)
4. Public または Private を選択
5. **「Add a README file」のチェックは外す**（既にあるため）
6. `Create repository` をクリック

## ステップ2: ローカルのコードをGitHubにプッシュ

このフォルダ（contract-manager-app）で以下のコマンドを実行：

```bash
# Gitリポジトリとして初期化
git init

# 全ファイルをステージング
git add .

# コミット
git commit -m "Initial commit: Contract Manager with Gemini AI"

# GitHubリポジトリと接続（URLは自分のものに置き換え）
git remote add origin https://github.com/YOUR_USERNAME/contract-manager.git

# プッシュ
git branch -M main
git push -u origin main
```

**⚠️ 注意**: `YOUR_USERNAME` を自分のGitHubユーザー名に置き換えてください

## ステップ3: Vercelでデプロイ

### 3-1. Vercelにアクセス
https://vercel.com にアクセス

### 3-2. GitHubでログイン
- `Continue with GitHub` をクリック
- GitHubの認証画面が出たら `Authorize Vercel` をクリック

### 3-3. プロジェクトをインポート
1. Vercelダッシュボードで `Add New...` → `Project` をクリック
2. `Import Git Repository` セクションで先ほど作成した `contract-manager` を探す
3. `Import` をクリック

### 3-4. デプロイ設定（自動認識されるので何も変更不要）
- **Framework Preset**: Vite （自動検出される）
- **Build Command**: `npm run build` （自動）
- **Output Directory**: `dist` （自動）

そのまま `Deploy` をクリック

### 3-5. 完了！
2-3分待つと、デプロイが完了します。

`https://contract-manager-xxxx.vercel.app` のようなURLが発行されます。

## ステップ4: アプリを使う

1. 発行されたURLにアクセス
2. 初回起動時に **Gemini API キー** を入力
   - 取得方法: https://makersuite.google.com/app/apikey
3. 完了！

## 更新方法

コードを変更したら、GitHubにプッシュするだけで自動的にVercelが再デプロイします：

```bash
git add .
git commit -m "Update: 機能追加"
git push
```

30秒ほどで変更が本番環境に反映されます。

## トラブルシューティング

### デプロイに失敗する場合
- Vercelのログを確認（詳細なエラーメッセージが表示される）
- `package.json` の依存関係を確認

### API キーのエラー
- Gemini API キーが正しいか確認
- API キーの利用制限を確認（無料枠: 1,500リクエスト/日）

### データが消える
- localStorageを使用しているため、ブラウザのキャッシュクリアでデータが消えます
- 将来的にGoogle Drive連携で永続化予定

## 次のステップ

### Google Drive連携を追加する場合
1. Google Cloud Consoleでプロジェクト作成
2. OAuth 2.0 認証情報作成
3. Vercelの本番URLをリダイレクトURIに登録
4. コードにOAuth実装を追加

詳細は別途ドキュメント化予定
