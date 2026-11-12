"use client"

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStore } from "./store"

export function DemoStateMenu() {
  const { flags, setFlags, simulateLoading, resetDemo, guard } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const activeCount = [flags.failNextSave, flags.conflictNextSave, flags.failNextSync, flags.emptyMatrix].filter(Boolean).length

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="lg" className="gap-1.5" aria-label="デモ状態を切り替える">
              <FlaskConical className="size-4" />
              <span className="hidden sm:inline">デモ状態</span>
              {activeCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>次回の操作で発生させる状態</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={flags.failNextSave} onCheckedChange={(v) => setFlags({ failNextSave: !!v })}>
              権限保存を失敗させる
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={flags.conflictNextSave} onCheckedChange={(v) => setFlags({ conflictNextSave: !!v })}>
              権限保存で更新競合を起こす
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={flags.failNextSync} onCheckedChange={(v) => setFlags({ failNextSync: !!v })}>
              ポータル同期を失敗させる
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>表示状態</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={flags.emptyMatrix} onCheckedChange={(v) => setFlags({ emptyMatrix: !!v })}>
              権限一覧をデータなしで表示
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onClick={simulateLoading}>読み込み中の表示を確認</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => guard("デモデータを初期化", () => setConfirmReset(true))}>
            デモデータを初期化
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>デモデータを初期化しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              保存したメンバー・権限・申請・履歴・通知をすべて初期状態に戻します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await resetDemo()
                setConfirmReset(false)
              }}
            >
              初期化する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
