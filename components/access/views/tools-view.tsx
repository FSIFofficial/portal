"use client"

import { useState } from "react"
import { Pencil, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { portalAddSample, portalToggleEnabled, syncFromPortal } from "@/lib/access/commands"
import { formatDateTime } from "@/lib/access/format"
import { fetchPortalCatalog } from "@/lib/access/live"
import { SAMPLE_PORTAL_TOOL } from "@/lib/access/portal"
import type { Tool } from "@/lib/access/types"
import { toolStatus, hasFullAccess } from "@/lib/access/rules"
import { Callout, IntegrationBadge, PageHeader, Panel, Tag } from "../shared"
import { useStore } from "../store"
import { ToolSettingsDialog } from "./tool-settings-dialog"

export function ToolsView() {
  const { data, actor, run, flags, setFlags, live, portalToken } = useStore()
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState<Tool | null>(null)
  const rep = hasFullAccess(data, actor.id)
  const sampleAdded = data.portalCatalog.some((p) => p.id === SAMPLE_PORTAL_TOOL.id)

  const sync = async () => {
    setSyncing(true)
    const fail = !live && flags.failNextSync
    let summary = ""
    // 本番：ポータルのツール一覧を読んでから同期する（役割・連携状態は権限管理で定義したものを引き継ぐ）
    let catalog: typeof data.portalCatalog | null = null
    if (live) {
      try {
        catalog = await fetchPortalCatalog(portalToken, data)
      } catch (e) {
        setSyncing(false)
        const { toast } = await import("sonner")
        toast.error(`ポータルのツール一覧を読み込めませんでした：${e instanceof Error ? e.message : ""}`)
        return
      }
    }
    const ok = await run("ポータル同期", (d) => {
      const { data: next, result } = syncFromPortal(catalog ? { ...d, portalCatalog: catalog } : d, { fail })
      summary = `同期しました（追加${result.added.length}・更新${result.updated.length}・無効化${result.disabled.length}・自動付与${result.autoGranted}件）`
      return next
    })
    if (fail) setFlags({ failNextSync: false })
    setSyncing(false)
    if (ok && summary && !fail) {
      const { toast } = await import("sonner")
      toast.success(summary)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="ツール・同期"
        description="ツールの一覧はFSIFポータルの「ツール」から同期します（ツール自体の追加・編集はポータルの管理画面で行います）。ツール内の役割と連携状態は、この画面で定義します。"
        actions={
          rep && (
            <Button size="lg" onClick={sync} disabled={syncing}>
              <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
              {syncing ? "同期中…" : "ポータルから同期"}
            </Button>
          )
        }
      />
      <Panel className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
        <span>
          最終同期：<span className="font-medium">{formatDateTime(data.sync.lastSuccessAt)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          状態：
          {data.sync.lastStatus === "error" ? <Tag tone="danger">失敗</Tag> : data.sync.lastStatus === "success" ? <Tag>成功</Tag> : <Tag tone="outline">未実行</Tag>}
        </span>
        {data.sync.lastStatus === "error" && <span className="w-full text-xs text-destructive">{data.sync.message} 前回同期時のデータを表示しています。</span>}
      </Panel>

      {data.tools.length > 0 && (
        <Panel>
          <ul className="divide-y">
            {data.tools.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{t.name}</span>
                  <IntegrationBadge status={toolStatus(t)} />
                  {!t.enabled && <Tag tone="danger">無効</Tag>}
                  {t.demoRoleDefinition && <Tag tone="outline">デモ用役割定義</Tag>}
                  {rep && (
                    <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditing(t)}>
                      <Pencil className="size-3.5" />
                      役割・連携を設定
                    </Button>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t.description} ／ ID {t.id} ／ 同期 {formatDateTime(t.lastSyncedAt)}
                </p>
                {t.roles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">権限定義待ち：「役割・連携を設定」で役割を定義すると付与できるようになります。</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5" aria-label={`${t.name} の内部役割`}>
                    {[...t.roles]
                      .sort((a, b) => a.rank - b.rank)
                      .map((r) => (
                        <li key={r.roleKey}>
                          <Tag tone={r.roleKey === t.defaultRoleKey ? "primary" : "default"}>
                            {r.label}
                            {r.assignableBy === "representative" && "・代表のみ"}
                          </Tag>
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {data.tools.length === 0 && (
        <Panel className="p-4">
          <p className="text-sm text-muted-foreground">ツールがまだありません。{rep ? "「ポータルから同期」でポータルのツール一覧を取り込んでください。" : ""}</p>
        </Panel>
      )}

      {editing && <ToolSettingsDialog tool={editing} onClose={() => setEditing(null)} />}

      {rep && !live && (
        <Panel className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-bold">ポータル側の模擬操作（デモ）</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              実際のポータルの代わりです。ここで変更したあと「ポータルから同期」を押すと反映されます。
            </p>
          </div>
          <Callout tone="neutral">新規ツールは同期時、所属テンプレートの初期役割があれば自動付与されます。</Callout>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={sampleAdded}
              onClick={() => run("ポータル操作", (d) => portalAddSample(d, SAMPLE_PORTAL_TOOL), `ポータルに「${SAMPLE_PORTAL_TOOL.name}」を追加しました`)}
            >
              {sampleAdded ? `「${SAMPLE_PORTAL_TOOL.name}」追加済み` : `ポータルに「${SAMPLE_PORTAL_TOOL.name}」を追加`}
            </Button>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {data.portalCatalog.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{p.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => run("ポータル操作", (d) => portalToggleEnabled(d, p.id), `ポータルで「${p.name}」を${p.enabled ? "無効" : "有効"}にしました`)}
                >
                  {p.enabled ? "ポータルで無効化" : "ポータルで有効化"}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
