import type { Metadata } from 'next'
import { asset } from '@/lib/config'
import { LegalPage, List, Section, helpUrl } from '@/components/portal/legal-page'

export const metadata: Metadata = { title: '利用規約 | FSIF Portal' }

export default function TermsPage() {
  return (
    <LegalPage
      title="利用規約"
      updated="制定日：2026年11月12日"
      intro={
        <p>
          この利用規約（以下「本規約」）は、未来宇宙産業フォーラム（以下「FSIF」）が提供する、FSIFメンバー向けポータル「FSIF
          Portal」と、ポータルから利用するツール（以下あわせて「本サービス」）の利用条件を定めるものです。本サービスを利用した時点で、本規約に同意したものとみなします。
        </p>
      }
    >
      <Section title="第1条（利用できる人）">
        <List
          items={[
            '本サービスを利用できるのは、FSIF のメンバーなど、管理者がアカウントを登録した人に限ります。',
            '利用には Google アカウントでのログインが必要です。登録されたメールアドレスの Google アカウントでログインしてください。',
            '利用できる範囲（ツール・資料・機能）は、管理者が設定したロール・権限によって決まります。',
          ]}
        />
      </Section>

      <Section title="第2条（アカウントの管理）">
        <List
          items={[
            '利用者は、自分の Google アカウントとログイン状態を自らの責任で管理し、他人に使わせてはいけません。',
            '共用のパソコンなどで利用したときは、利用後にログアウトしてください。',
            'アカウントが不正に使われたおそれがある場合は、すぐに管理者に連絡してください。',
          ]}
        />
      </Section>

      <Section title="第3条（情報・資料の取り扱い）">
        <List
          items={[
            '本サービスで閲覧できる資料・情報（団体・メンバーの情報、契約書の雛形、内部資料など）は、FSIF の活動のためだけに利用してください。',
            '公開範囲が限られた資料・情報を、許可なく外部に共有・転載・持ち出してはいけません。',
            'ツールで作成した文面・書類は、内容を確認したうえで、利用者の責任で使用してください。',
          ]}
        />
      </Section>

      <Section title="第4条（禁止事項）">
        <p>利用者は、次の行為をしてはいけません。</p>
        <List
          items={[
            '法令または公序良俗に反する行為',
            '他人のアカウントでのログイン、なりすまし',
            '与えられた権限を超えて情報を見ようとする行為、本サービスの仕組みを不正に操作する行為',
            '本サービスやその運営を妨げる行為（過度な負荷をかける、自動で大量に操作するなど）',
            '他の利用者や第三者の権利・利益・名誉を侵害する行為',
            'その他、管理者が不適切と判断する行為',
          ]}
        />
      </Section>

      <Section title="第5条（利用の停止）">
        <p>
          利用者が本規約に違反した場合、FSIF を退会した場合、その他管理者が必要と判断した場合は、事前の通知なく、アカウントの無効化や利用できる範囲の変更を行うことがあります。
        </p>
      </Section>

      <Section title="第6条（サービスの変更・停止）">
        <p>
          FSIF は、保守・障害対応・外部サービス（Google・GitHub など）の都合その他の理由により、事前の通知なく本サービスの内容を変更し、または提供を一時停止・終了することがあります。
        </p>
      </Section>

      <Section title="第7条（免責）">
        <List
          items={[
            'FSIF は、本サービスが常に利用できること、内容が正確・最新であること、特定の目的に適することを保証しません。',
            '本サービスの利用、または利用できなかったことにより利用者に生じた損害について、FSIF に故意または重大な過失がある場合を除き、責任を負いません。',
          ]}
        />
      </Section>

      <Section title="第8条（個人情報）">
        <p>
          本サービスにおける利用者の情報は、
          <a href={asset('/privacy/')} className="text-[var(--brand-fg)] underline underline-offset-2">
            プライバシーポリシー
          </a>
          に従って取り扱います。
        </p>
      </Section>

      <Section title="第9条（規約の変更）">
        <p>FSIF は、必要に応じて本規約を変更することがあります。変更後の規約は、このページに掲載した時点から適用します。大きな変更がある場合は、本サービスのお知らせでお知らせします。</p>
      </Section>

      <Section title="第10条（準拠法）">
        <p>本規約は日本法に準拠して解釈します。</p>
      </Section>

      <Section title="問い合わせ先">
        <p>
          未来宇宙産業フォーラム（FSIF）運営事務局
          <br />
          ポータルの
          <a href={helpUrl()} className="text-[var(--brand-fg)] underline underline-offset-2">
            「ヘルプ・問い合わせ」
          </a>
          に記載の窓口、または FSIF 運営事務局までご連絡ください。
        </p>
      </Section>
    </LegalPage>
  )
}
