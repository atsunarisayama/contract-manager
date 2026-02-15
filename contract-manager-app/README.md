# Contract Manager - AIサブスク管理システム

## 概要
Gemini AIを使った契約・サブスクリプション管理アプリケーション

### 特徴
- 🤖 AI相談機能（Gemini API統合）
- 💾 データはブラウザのlocalStorageに保存（プライバシー重視）
- 🎨 シンプルで直感的なUI
- 📊 月額費用の自動計算
- 🔍 リアルタイム検索

## セットアップ

### 必要なもの
- Node.js 18以上
- Gemini API キー（無料で取得可能）

### インストール

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開く

### Gemini APIキーの取得

1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. 「Create API Key」をクリック
3. アプリ起動時にAPIキーを入力

## 使い方

### 手動で契約を追加
左パネルの「新規追加」ボタンから入力

### AIに相談して追加
右のチャットで「Netflixを追加して」などと依頼

### 契約の削除
各契約カードの × ボタンから削除

### 検索
上部の検索バーで契約名・カテゴリでフィルタリング

## デプロイ

### Vercel
```bash
# Vercelにデプロイ
npm run build
# Vercelダッシュボードからリポジトリを連携
```

## ライセンス
MIT

## 今後の拡張予定
- Google Drive連携（OAuth実装）
- エクスポート/インポート機能
- カテゴリ別分析グラフ
