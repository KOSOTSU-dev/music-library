# Music Library

好きな音楽を共有・整理できるコレクションアプリ。楽曲を棚で管理し、フレンドのギャラリーに「いいね」やコメントでリアクションできます。ダークテーマのモダンUIとドラッグ&ドロップで直感的に操作できます。

- デモ: https://music-library-rouge.vercel.app/
- ログイン: https://music-library-rouge.vercel.app/login

---

## スクリーンショット

![home](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4165993/967bfe3b-0096-4676-986f-2c76cc51ad50.png)

![modal](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4165993/10062d51-7903-4914-a66e-59ab59d0836b.png)

![player](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4165993/aa3e5411-33f2-4b8c-ae18-3758359f5845.png)

![add-track](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4165993/65011e00-bac7-446f-9109-d5d0913d4b5c.png)

![friends](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4165993/92d4a633-ca21-4ac3-9c25-a3807f8f7ff9.png)

![friend-modal](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4165993/161bf7b9-6ab0-452b-8a39-65cfa11f0780.png)

---

## 概要

- 楽曲カードのホバーで「再生/一時停止」「Spotifyで開く」「リンクをコピー」「削除」が表示
- カードクリックで詳細モーダル（曲名/アーティスト/アルバム/メモ/いいね・コメント一覧、前後ナビ）
- 棚のドラッグ&ドロップ並び替え、コンパクト表示
- コメントは「いいね数降順 → 新着順」表示、3行省略＋「全文を表示」
- いいね（自分が過去に押したハートは再入場時も赤色で保持）

---

## 使い方（ゲストで試す）

1. **Outlook にログインし、ゲストメールを受信できる状態にする**  
   [Outlook にログイン](https://www.microsoft.com/ja-jp/microsoft-365/outlook/email-and-calendar-software-microsoft-outlook)
2. **Spotify に以下のゲスト情報でログイン**
   - メール: `guest.kosotsu@outlook.jp`  
   - パスワード: `1234abcd!!`
3. **Outlook で受信した Spotify の認証メールを確認し、認証を完了**
4. **トップの「ログインページへ」から遷移し、「Spotifyでログイン」を実行**  
   https://music-library-rouge.vercel.app/

> 注意: 開発モード/デバイス状況により再生に失敗したり、反応が遅い場合があります。

---

## 画面とUI

- ダークテーマの配色例: `#000000`, `#1a1a1a`, `#333333`, `#4d4d4d`, `#666666`
- モーダル: タイトル位置/余白、水平線、フッターのボタン群、左右ナビ（ホバー `#999999`）
- 「いいね一覧」「コメント」モーダル: ユーザー名クリックで相手ギャラリーへ
- コメントモーダル: 幅約70%、下部固定入力、1行→2行自動拡張（スクロールバーなし）、ダブルEnter送信

---

## リアルタイム/永続化

- いいね/コメントは楽観的UI更新（即時反映）＋遅延再取得
- ハート状態の保持（自分が押した履歴を再入場時も反映）

---

## エラーハンドリング/UX

- モーダルの再生ボタンのみ、認証切れ時に「Spotifyに再ログインしてください」を表示
- 削除操作は共通の確認モーダルで統一
- `useSearchParams` を用いるページは React Suspense でラップ

---

## 技術スタック

| 分類 | 使用技術 |
|---|---|
| フロントエンド | Next.js (App Router), React, TypeScript, Tailwind CSS |
| UI/モーション | Radix UI (Dialog), framer-motion |
| DnD | dnd-kit |
| 認証/DB/ストレージ | Supabase（RLS, Server Actions, `@supabase/ssr`） |
| 外部API | Spotify Web API（再生・認証） |
| デプロイ | Vercel |
| 品質 | ESLint（本番ビルドでは一時的に無効化設定） |

---

## データモデル（主なテーブル）

| テーブル | 役割 |
|---|---|
| `shelves` | 棚 |
| `shelf_items` | 棚内の楽曲 |
| `likes` | 楽曲へのいいね |
| `comments` | コメント本体 |
| `comment_likes` | コメントへのいいね |
| `users` | プロフィール（`username`, `display_name`, `avatar_url` など） |

---

## 既知の制約 / 改善ポイント

- Spotify再生の初回/デバイス切替での遅延、401時の再認証導線
- Spotify開発者設定の制約（リダイレクトURI・ユーザー管理）
- フレンドギャラリー遷移のロード時間
- 将来的に並び替え（追加日/アーティスト/いいね数/コメント数など）を強化予定

---

## ローカル開発

```bash
# 依存関係
npm ci

# 環境変数（例）
# .env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 開発サーバ
npm run dev
```

---

## リンク

- サイト: https://music-library-rouge.vercel.app/
- Outlook: https://www.microsoft.com/ja-jp/microsoft-365/outlook/email-and-calendar-software-microsoft-outlook
- X (紹介ポスト): https://x.com/KOSOTSU_KUN/status/1986026350059364825

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
