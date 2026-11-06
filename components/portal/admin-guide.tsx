'use client'

// 管理画面の使い方ガイド（自分の権限で使える項目だけを表示する）
import type { ReactNode } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { can, type Me, type Permission } from '@/lib/types'
import { SectionHeader } from './admin-shared'
import type { Navigate } from './router'

interface Topic {
  title: string
  /** 表示に必要な権限（'*' は全権管理者のみ、null は全員） */
  perm: Permission | null
  link?: { label: string; path: string }
  body: ReactNode
}

const TOPICS: Topic[] = [
  {
    title: 'まず知っておくこと',
    perm: null,
    body: (
      <ul>
        <li>ポータルのデータ（ツール・資料・お知らせ・アカウントなど）は、すべてこの管理画面から変更します。<b>スプレッドシートは直接編集しないでください</b>（列がずれると動かなくなります）。</li>
        <li>同じ項目を2人が同時に編集した場合、後から保存した人の保存は止まり、「他の人が先に更新しました」と表示されます。最新の内容を確認してから編集し直してください。</li>
        <li>削除したものは<b>ゴミ箱</b>に30日間残り、元に戻せます。</li>
        <li>変更はすべて「変更履歴」に記録されます（変更履歴の閲覧権限がある人のみ見られます）。</li>
      </ul>
    ),
  },
  {
    title: 'ツールを追加・並べ替える',
    perm: 'tools.manage',
    link: { label: 'ツール管理を開く', path: '/admin/tools' },
    body: (
      <ol>
        <li>「ツール管理」→「新規追加」で、名前・説明・接続先URLを入力します。状態が「稼働中」のときだけ「開く」ボタンが押せます。</li>
        <li>アイコンは一覧から選ぶか、「画像をアップロード」で画像にできます。</li>
        <li>特定の人だけに見せたいときは「公開範囲」でロールを選びます（未選択なら全員に表示）。</li>
        <li>並び順は「ツール」画面の「並べ替え」で変更します。ホームには上から6件が表示されます（各自が☆を付けたお気に入りが優先されます）。</li>
      </ol>
    ),
  },
  {
    title: '資料を追加する（Google Drive）',
    perm: 'documents.manage',
    link: { label: '資料管理を開く', path: '/admin/documents' },
    body: (
      <ol>
        <li>「資料管理」→「新規追加」で、「ファイルをアップロード」を押すか、Driveで「リンクをコピー」したURLを貼り付けます。</li>
        <li>関連ツールを選ぶと、そのツールの「使い方」ボタンから表示されます。「ピックアップ」にすると資料館の先頭に大きく表示されます。</li>
        <li>資料館では「プレビュー」でポータルの中で中身を見られます。「ダウンロード」はドキュメント・スライドはPDF、スプレッドシートはExcel形式になります。</li>
        <li>公開範囲が「全員」の資料を新しく追加すると、設定されていればDiscordにも通知されます（追加画面のチェックを外すと通知しません）。</li>
      </ol>
    ),
  },
  {
    title: '「Driveの共有を公開範囲に合わせる」とは',
    perm: 'documents.manage',
    body: (
      <ul>
        <li>ポータルで限定公開にしても、Driveの共有が「リンクを知っている全員」だと、リンクを知る人は誰でも開けてしまいます。</li>
        <li>この設定をオンにすると、その資料を見られるアカウントをDriveの閲覧者に自動で追加し、見られなくなった人は外します。アカウントやロールを変えたときも自動で合わせ直します。</li>
        <li>外すのはポータルが追加した人だけです。手動で共有した相手には触れません。</li>
        <li>「警告：リンク共有がオン」と出たら、資料の編集画面の「リンク共有をオフにする」で閉じられます。「エラー」と出たら、GASを動かしているアカウントにそのファイルの編集権限があるか確認してください。</li>
      </ul>
    ),
  },
  {
    title: 'リンク集を整える',
    perm: 'links.manage',
    link: { label: 'リンク管理を開く', path: '/admin/links' },
    body: (
      <ol>
        <li>「リンク管理」→「新規追加」で、リンク名・URL・説明・カテゴリを入力します。同じカテゴリのリンクはリンク集でまとめて表示されます。</li>
        <li>並び順は一覧の矢印で変えられます（押すとすぐ保存されます）。</li>
        <li>特定の人だけに見せたいときは「公開範囲」でロールを選びます。</li>
        <li>どのリンクがよく使われているかは「利用状況」の「リンク」で確認できます。</li>
      </ol>
    ),
  },
  {
    title: 'お知らせを出す',
    perm: 'announcements.manage',
    link: { label: 'お知らせを開く', path: '/admin/announcements' },
    body: (
      <ol>
        <li>「お知らせ」→「新規追加」。「重要」にすると赤く表示されます。表示開始日・終了日で掲載期間を決められます。</li>
        <li>必ず読んでほしいものは「確認を求める」をオンにします。「確認しました」を押すまで消えず、一覧の「◯人が確認」から未確認の人を確認できます。</li>
        <li>公開範囲が「全員」の新しいお知らせはDiscordに通知されます。表示開始日を先にした場合は、その日の朝に通知されます。</li>
        <li>ヘルプ・問い合わせページの内容は「ヘルプ編集」で変更できます。</li>
      </ol>
    ),
  },
  {
    title: 'メンバーを登録する・権限を決める',
    perm: '*',
    link: { label: 'アカウントを開く', path: '/admin/users' },
    body: (
      <ol>
        <li>「ロールと権限」で、役割ごとのロール（例：契約担当、広報チーム）と、そのロールができる操作を決めます。</li>
        <li>「アカウント」でGoogleアカウントのメールアドレスを登録し、ロールを割り当てます。大人数は「一括登録」でスプレッドシートから貼り付けられます。</li>
        <li>ツール・資料・お知らせの「公開範囲」でロールを選ぶと、そのロールを持つ人にだけ表示されます。</li>
        <li>退会した人は「しばらくログインなし」で90日以上ログインしていない人を絞り込み、まとめて無効にできます。無効にした人はすぐにログインできなくなります。</li>
      </ol>
    ),
  },
  {
    title: '設定・運用',
    perm: '*',
    link: { label: '設定を開く', path: '/admin/settings' },
    body: (
      <ul>
        <li><b>ポータル名・ロゴ・色</b>：ヘッダーやボタンの色を変えられます。</li>
        <li><b>Discordへの新着通知</b>：Webhook URLを登録すると、新しい資料・お知らせを通知します（限定公開のものは送りません）。</li>
        <li><b>エラー通知メール</b>：想定外のエラーがあった日だけ、毎朝 全権管理者にメールします。</li>
        <li><b>バックアップ</b>：スプレッドシートのコピーを毎週Driveに保存します（10世代）。</li>
        <li>GASを更新したら「バージョン確認」ですべて ✓ になっているか確認してください。画面とGASの版がずれていると、管理者の画面上部に赤い帯が出ます。</li>
      </ul>
    ),
  },
  {
    title: 'どれくらい使われているかを見る',
    perm: 'logs.view',
    link: { label: '利用状況を開く', path: '/admin/stats' },
    body: (
      <ul>
        <li>「利用状況」で、ツールの「開く」や資料の「開く」「プレビュー」「ダウンロード」が押された回数を月ごとに見られます。</li>
        <li>直近3か月で一度も使われていないものには「利用なし」が付きます。整理の目安にしてください。</li>
      </ul>
    ),
  },
]

export function AdminGuide({ section, me, navigate }: { section: { label: string; description: string }; me: Me; navigate: Navigate }) {
  const topics = TOPICS.filter((t) => !t.perm || can(me, t.perm))
  return (
    <>
      <SectionHeader section={section} loading={false} onReload={() => {}} />
      <div className="flex flex-col gap-2 p-5">
        {topics.map((t, i) => (
          <details key={t.title} open={i === 0} className="group rounded-xl border border-[#e4e9f0]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-bold text-[#1b304b]">
              <span className="flex-1">{t.title}</span>
              <ChevronDown size={16} className="text-[#9aa7b5] transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-[#eef1f4] px-4 py-3 text-[13px] leading-7 text-[#38536f] [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              {t.body}
              {t.link && (
                <button onClick={() => navigate(t.link!.path)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--brand)] hover:underline">
                  {t.link.label}<ArrowRight size={13} />
                </button>
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  )
}
