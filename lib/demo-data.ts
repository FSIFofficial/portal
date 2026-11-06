// デモモード（GAS未接続）で使う架空のサンプルデータ。実際の組織データは含めないこと（このファイルはGitHubで公開される）。

import type { Announcement, BackupStatus, Branding, PortalLink, DiscordStatus, ErrorDigestStatus, HelpContent, PortalDocument, Role, Settings, Tool, User } from './types'

export interface DemoDb {
  users: User[]
  roles: Role[]
  tools: Tool[]
  documents: PortalDocument[]
  announcements: Announcement[]
  settings: Settings
  logs: { timestamp: string; email: string; action: string; target: string; detail: string }[]
  help: HelpContent
  stats: Record<string, { month: string; kind: string; itemId: string; count: number; lastAt: string }>
  backup: BackupStatus
  acks: { announcementId: string; email: string; ackAt: string }[]
  errorDigest: ErrorDigestStatus
  discord: DiscordStatus
  trash: { key: string; sheet: 'Tools' | 'Documents' | 'Announcements' | 'Links' | 'Users'; itemKey: string; title: string; data: unknown; deletedAt: string; deletedBy: string }[]
  branding: Branding
  links: PortalLink[]
}

// 日付は開いた日を基準にする（NEW表示が分かるよう、一部だけ最近更新したことにする）
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const t = daysAgo(30)

export function createDemoDb(): DemoDb {
  const tool = (id: string, name: string, description: string, category: string, icon: string, tone: string, status: Tool['status'], order: number, visibleRoles: string[] = []): Tool => ({
    id, name, description, category, icon, tone, status, url: '', visibleRoles, order, updatedAt: t, iconUrl: '',
  })
  const doc = (id: string, title: string, type: string, toolName: string, date: string, description: string, keywords: string, tags: string[], extra: Partial<PortalDocument> = {}): PortalDocument => ({
    id, title, type, tool: toolName, description, keywords, tags, driveUrl: '', downloadUrl: '', thumbnailUrl: '', date, pinned: false, visibleRoles: [], updatedAt: t, ...extra,
  })
  return {
    roles: [
      { id: 'superadmin', name: '全権管理者', description: 'すべての操作とアカウント・権限の管理ができます', permissions: ['*'], builtin: true },
      { id: 'editor', name: '掲載担当者', description: 'ツール・資料・お知らせを編集できます', permissions: ['tools.manage', 'documents.manage', 'announcements.manage', 'links.manage', 'logs.view'], builtin: true },
      { id: 'member', name: 'メンバー', description: '公開されているツールと資料を閲覧できます', permissions: [], builtin: true },
      { id: 'contract', name: '契約担当', description: '契約関連のツール・資料を閲覧できます', permissions: [], builtin: false },
    ],
    users: [
      { email: 'admin@example.com', name: '管理 太郎', roles: ['superadmin'], active: true, note: 'デモ用', createdAt: t, updatedAt: t, lastLoginAt: '' },
      { email: 'editor@example.com', name: '掲載 花子', roles: ['editor'], active: true, note: 'デモ用', createdAt: t, updatedAt: t, lastLoginAt: '' },
      { email: 'member@example.com', name: 'メンバー 一郎', roles: ['member'], active: true, note: 'デモ用', createdAt: t, updatedAt: t, lastLoginAt: '' },
      { email: 'contract@example.com', name: '契約 美咲', roles: ['member', 'contract'], active: true, note: 'デモ用', createdAt: t, updatedAt: t, lastLoginAt: '' },
    ],
    tools: [
      tool('t1', 'サンプルツールA', 'タスク管理のサンプル', '組織運営', 'ClipboardList', 'blue', '稼働中', 1),
      tool('t2', 'サンプルツールB', '資料作成のサンプル', '資料作成', 'Sparkles', 'violet', '稼働中', 2),
      tool('t3', 'サンプルツールC', '学習・クイズのサンプル', '学習', 'CircleHelp', 'amber', '稼働中', 3),
      tool('t4', 'サンプルツールD', 'ダッシュボードのサンプル', '分析', 'LayoutDashboard', 'cyan', '稼働中', 4),
      { ...tool('t5', 'サンプルツールE', 'イベントページのサンプル', 'イベント', 'Zap', 'orange', '稼働中', 5), updatedAt: daysAgo(1) },
      tool('t6', '限定公開ツール（契約担当のみ）', '公開範囲の動作確認用', '契約管理', 'ShieldCheck', 'slate', '稼働中', 6, ['contract']),
      tool('t7', '準備中ツール', '準備中表示のサンプル', 'イベント', 'CalendarPlus', 'green', '準備中', 7),
    ],
    documents: [
      doc('d1', 'はじめにお読みください（サンプル）', 'オンボーディング', '共通', '2026-10-18', 'ピックアップ表示のサンプル資料です。', 'はじめて スタート', ['はじめに'], { pinned: true }),
      doc('d2', 'スタートガイド（サンプル）', 'オンボーディング', '共通', '2026-10-17', 'オンボーディング資料のサンプルです。', '新規 オンボーディング', ['はじめに']),
      doc('d3', 'ポータルの使い方（サンプル）', 'マニュアル', '共通', '2026-10-15', 'ツールの探し方、資料の見方、検索のコツ。', '検索 使い方', ['ポータル']),
      doc('d4', 'サンプルツールA マニュアル', 'マニュアル', 'サンプルツールA', '2026-10-12', 'ツールの「使い方」ボタンから表示される資料のサンプルです。', 'タスク', ['マニュアル']),
      doc('d5', 'サンプルツールB マニュアル', 'マニュアル', 'サンプルツールB', '2026-10-10', 'ツールに紐づく資料のサンプルです。', '資料作成', ['マニュアル']),
      doc('d6', 'ニュースレター（サンプル）', 'ニュース', '共通', '2026-07-02', 'タグ付き資料のサンプルです。', 'ニュース', ['ニュース'], { updatedAt: daysAgo(2) }),
      doc('d7', '契約担当向け資料（サンプル）', 'マニュアル', '限定公開ツール（契約担当のみ）', '2026-09-26', '契約担当ロールにだけ表示される資料のサンプルです。', '契約', ['限定'], { visibleRoles: ['contract'] }),
    ],
    announcements: [
      { id: 'a1', title: 'デモ環境のお知らせ', body: 'これはサンプルのお知らせです。管理画面の「お知らせ」から編集できます。', level: 'info', active: true, startDate: '', endDate: '', visibleRoles: [], updatedAt: t },
      { id: 'a2', title: '利用規約を確認してください（サンプル）', body: '「確認しました」を押すと、管理画面で誰が確認したかが分かります。', level: 'important', active: true, startDate: '', endDate: '', visibleRoles: [], updatedAt: t, requireAck: true },
    ],
    settings: { allowUnregistered: false, defaultRoles: ['member'], allowedDomains: [] },
    logs: [],
    help: {
      intro: 'ポータルの使い方で困ったときは、まず資料館の「ポータルの使い方」をご覧ください。解決しない場合は下記までご連絡ください。',
      contacts: [
        { label: 'ポータル管理担当', value: 'portal-admin@example.com' },
        { label: '問い合わせフォーム', value: 'https://example.com/form' },
      ],
      faqs: [
        { q: 'ログインできません', a: '登録されたGoogleアカウントでログインしているか確認してください。未登録の場合は全権管理者に登録を依頼してください。' },
        { q: '資料が開けません', a: '資料はGoogle Driveにあります。Drive側の共有設定が必要な場合があるので、管理者にお問い合わせください。' },
      ],
    },
    stats: {},
    backup: { enabled: false, lastAt: '', lastUrl: '', lastError: '', keep: 10, folderUrl: '' },
    acks: [],
    errorDigest: { enabled: false, lastSentAt: '', recipients: 1 },
    trash: [],
    links: [
      { id: 'l1', title: '公式ウェブサイト（サンプル）', url: 'https://example.com/', description: '団体の公式サイト', category: '公式', visibleRoles: [], order: 1, updatedAt: t },
      { id: 'l2', title: '活動報告ブログ（サンプル）', url: 'https://example.org/blog', description: '活動の記録をまとめたブログ', category: '公式', visibleRoles: [], order: 2, updatedAt: daysAgo(1) },
      { id: 'l3', title: '公式SNS（サンプル）', url: 'https://example.net/sns', description: '最新情報はこちら', category: '広報', visibleRoles: [], order: 3, updatedAt: t },
      { id: 'l4', title: '経費精算フォーム（サンプル）', url: 'https://example.com/form', description: '立て替えた経費の申請', category: '事務手続き', visibleRoles: [], order: 4, updatedAt: t },
      { id: 'l5', title: '契約書テンプレート置き場（サンプル）', url: 'https://example.com/contracts', description: '契約担当のみ', category: '事務手続き', visibleRoles: ['contract'], order: 5, updatedAt: t },
    ],
    branding: { portalName: 'FSIF Portal', tagline: 'CONNECT THE DOTS', logoUrl: '', primaryColor: '#1f6fba' },
    discord: { configured: false, webhookHint: '', notifyDocuments: true, notifyAnnouncements: true, portalUrl: 'https://fsifofficial.github.io/portal/' },
  }
}
