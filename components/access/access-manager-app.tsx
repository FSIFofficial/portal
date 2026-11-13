"use client"

import { Ban, LogIn, ShieldAlert, TriangleAlert } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AppShell } from "./app-shell"
import { AccessStoreProvider, useStore, type GateState } from "./store"
import { portalHomeUrl } from "@/lib/access/live"
import { UserSwitcher } from "./user-switcher"
import { MatrixView } from "./views/matrix-view"
import { MembersView } from "./views/members-view"
import { DepartmentsView } from "./views/departments-view"
import { ManagementView } from "./views/management-view"
import { RequestsView } from "./views/requests-view"
import { ToolsView } from "./views/tools-view"
import { HistoryView } from "./views/history-view"
import { MyAccessView } from "./views/my-access-view"
import { NotificationsView } from "./views/notifications-view"
import { PortalRolesView } from "./views/portal-roles-view"
import { PortalAccountsProvider } from "./portal-accounts"

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="読み込み中">
      <div className="hidden w-56 flex-col gap-3 border-r bg-card p-3 md:flex">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-[60vh] w-full" />
        <p className="sr-only">データを読み込んでいます</p>
      </div>
    </div>
  )
}

function GuardDialog() {
  const { pendingGuard, resolveGuard, draftCount, saving } = useStore()
  return (
    <AlertDialog open={!!pendingGuard} onOpenChange={(o) => !o && resolveGuard("back")}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>未保存の変更が{draftCount}件あります</AlertDialogTitle>
          <AlertDialogDescription>
            「{pendingGuard?.label}」の前に、権限一覧の変更をどうするか選んでください。保存すると履歴と通知が作成されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => resolveGuard("back")} disabled={saving}>
            戻る
          </Button>
          <Button variant="destructive" onClick={() => resolveGuard("discard")} disabled={saving}>
            破棄して続行
          </Button>
          <Button onClick={() => resolveGuard("save")} disabled={saving}>
            {saving ? "保存中…" : "保存して続行"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ConflictDialog() {
  const { conflict, resolveConflict } = useStore()
  return (
    <AlertDialog open={!!conflict}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>他の管理者が先に更新しました</AlertDialogTitle>
          <AlertDialogDescription>
            編集を始めた後に、別の管理者がデータを保存しています。最新データを再取得し、あなたの下書きのうち最新状態と異なる変更だけを残します。差分を確認してから再度保存してください。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={resolveConflict}>最新データを再取得</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** 本番で画面を開けないとき（未ログイン・全権管理者ではない・読み込み失敗） */
function GateScreen({ state }: { state: GateState }) {
  const content =
    state.kind === "signedOut"
      ? {
          icon: <LogIn className="size-6" aria-hidden />,
          title: "ポータルにログインしてください",
          body: "アクセス権限管理は FSIF Portal と同じログインで使います。ポータルでログインしてから、もう一度開いてください。",
        }
      : state.kind === "forbidden"
        ? {
            icon: <ShieldAlert className="size-6" aria-hidden />,
            title: "この画面はポータルの全権管理者だけが使えます",
            body: state.message,
          }
        : {
            icon: <TriangleAlert className="size-6" aria-hidden />,
            title: "読み込めませんでした",
            body: state.message,
          }
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">{content.icon}</div>
        <h1 className="text-lg font-bold">{content.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{content.body}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <a href={portalHomeUrl()} className={buttonVariants({ size: "lg" })}>
            ポータルを開く
          </a>
          {state.kind === "error" && (
            <Button size="lg" variant="outline" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}

function WithdrawnScreen() {
  const { actor, live } = useStore()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <span className="text-sm font-bold">FSIF Access Manager</span>
        {!live && <UserSwitcher />}
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
            <Ban className="size-6" aria-hidden />
          </div>
          <h1 className="text-lg font-bold">アカウントは停止されています</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {actor.name} さんは退会済みのため、この管理画面とすべてのツールを利用できません。再加入の手続きは代表へお問い合わせください。
          </p>
          {!live && <p className="text-xs text-muted-foreground">デモ：右上から別のユーザーへ切り替えられます</p>}
        </div>
      </main>
    </div>
  )
}

function CurrentView() {
  const { view } = useStore()
  switch (view) {
    case "matrix":
      return <MatrixView />
    case "members":
      return <MembersView />
    case "departments":
      return <DepartmentsView />
    case "management":
      return <ManagementView />
    case "requests":
      return <RequestsView />
    case "tools":
      return <ToolsView />
    case "history":
      return <HistoryView />
    case "me":
      return <MyAccessView />
    case "notifications":
      return <NotificationsView />
    case "portalRoles":
      return <PortalRolesView />
  }
}

function Root() {
  const { actor } = useStore()
  if (actor.status === "withdrawn") return <WithdrawnScreen />
  return (
    <>
      <PortalAccountsProvider>
        <AppShell>
          <CurrentView />
        </AppShell>
      </PortalAccountsProvider>
      <GuardDialog />
      <ConflictDialog />
    </>
  )
}

export function AccessManagerApp() {
  return (
    <AccessStoreProvider fallback={<LoadingScreen />} gate={(g) => <GateScreen state={g} />}>
      <Root />
    </AccessStoreProvider>
  )
}
