'use client'

import { mediaUrl } from '@/lib/kouhou/paths'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Lock,
  Paperclip,
  Plus,
  Redo2,
  Save,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import { runAction } from '@/lib/kouhou/store/store'
import { attachAssetToPost, saveTemplateCopy } from '@/lib/kouhou/domain/actions'
import { canEditDraft } from '@/lib/kouhou/domain/rules'
import type { Asset, TemplateEdit, TextLayer } from '@/lib/kouhou/domain/types'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { Field, Input, Notice, Panel, Segmented, Select, Textarea } from '@/components/kouhou/kit/primitives'
import { DisabledReason } from '@/components/kouhou/kit/primitives'
import { layerStyle } from '@/components/kouhou/domain/asset-thumb'
import { BrandTag, PostId, UserName } from '@/components/kouhou/domain/tags'
import { CommentsPanel } from '@/components/kouhou/domain/comments'
import { toast, toastResult } from '@/components/kouhou/kit/toast'
import { cn } from '@/lib/utils'

const SWATCHES = ['#ffffff', '#0f1f3d', '#cfe0ff', '#2f6fde', '#f5c84c', '#e5484d']
const SNAP = 1.5
const HISTORY_LIMIT = 50

function newLayer(index: number): TextLayer {
  return { id: `l-${Date.now().toString(36)}-${index}`, text: '新しい文字', x: 50, y: 50, fontSize: 64, color: '#ffffff', font: 'sans', align: 'center', weight: 700 }
}

function initialEdit(origin: Asset): TemplateEdit {
  if (origin.edit) return structuredClone(origin.edit)
  return { backgroundAssetId: origin.id, layers: [{ ...newLayer(0), text: 'タイトルを入力', y: 40 }] }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

type HistoryState = { past: TemplateEdit[]; present: TemplateEdit; future: TemplateEdit[] }

function useEditHistory(initial: TemplateEdit) {
  const [st, setSt] = useState<HistoryState>({ past: [], present: initial, future: [] })

  const commit = useCallback((fn: (p: TemplateEdit) => TemplateEdit) => {
    setSt((h) => {
      const next = fn(h.present)
      if (next === h.present) return h
      return { past: [...h.past.slice(-HISTORY_LIMIT + 1), h.present], present: next, future: [] }
    })
  }, [])
  /** ドラッグ中の連続更新。履歴への記録はドラッグ開始時の checkpoint で行う */
  const live = useCallback((fn: (p: TemplateEdit) => TemplateEdit) => setSt((h) => ({ ...h, present: fn(h.present) })), [])
  const checkpoint = useCallback(() => setSt((h) => ({ past: [...h.past.slice(-HISTORY_LIMIT + 1), h.present], present: h.present, future: [] })), [])
  const undo = useCallback(
    () =>
      setSt((h) => {
        if (!h.past.length) return h
        return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
      }),
    [],
  )
  const redo = useCallback(
    () =>
      setSt((h) => {
        if (!h.future.length) return h
        return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
      }),
    [],
  )
  return { edit: st.present, commit, live, checkpoint, undo, redo, canUndo: st.past.length > 0, canRedo: st.future.length > 0 }
}

export function TemplateEditor({ originId, postId }: { originId: string; postId?: string }) {
  const { s, user } = useScope()
  const router = useRouter()
  const origin = s.assets.find((a) => a.id === originId)

  if (!origin || !(origin.kind === 'background' || origin.edit)) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Notice tone="warning" title="編集できる素材ではありません">背景テンプレートか投稿用コピーを選んでください。</Notice>
        <Link href="/kouhou/assets" className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}>素材一覧へ戻る</Link>
      </div>
    )
  }
  return <EditorBody key={origin.id} origin={origin} postId={postId} onSaved={(id) => id !== origin.id && router.replace(`/kouhou/assets/editor?asset=${id}${postId ? `&post=${postId}` : ''}`)} userId={user?.id} />
}

function EditorBody({ origin, postId, onSaved, userId }: { origin: Asset; postId?: string; onSaved: (id: string) => void; userId?: string }) {
  const { s, user } = useScope()
  const isCopy = Boolean(origin.edit && origin.sourceAssetId)
  const h = useEditHistory(useMemo(() => initialEdit(origin), [origin]))
  const { edit } = h
  const [savedSnapshot, setSavedSnapshot] = useState(() => (isCopy ? JSON.stringify(origin.edit) : null))
  const [name, setName] = useState(() => (isCopy ? origin.name : `${origin.name.replace(/\s*背景.*$/, '')} 投稿用コピー`))
  const [selectedId, setSelectedId] = useState<string | null>(edit.layers[0]?.id ?? null)
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false })
  const [targetPost, setTargetPost] = useState(postId ?? '')
  const canvasRef = useRef<HTMLDivElement>(null)

  const selected = edit.layers.find((l) => l.id === selectedId) ?? null
  const backgrounds = s.assets.filter((a) => a.kind === 'background')
  const bg = s.assets.find((a) => a.id === edit.backgroundAssetId)
  const dirty = savedSnapshot !== JSON.stringify(edit) || (isCopy && name !== origin.name)
  const attachable = s.posts.filter((p) => canEditDraft(s, user, p).ok)

  const updateLayer = (id: string, patch: Partial<TextLayer>) => h.commit((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  const addLayer = () => {
    const l = newLayer(edit.layers.length)
    h.commit((p) => ({ ...p, layers: [...p.layers, l] }))
    setSelectedId(l.id)
  }
  const removeLayer = (id: string) => {
    h.commit((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) }))
    setSelectedId(null)
  }
  /** layers配列の末尾ほど前面に描画される */
  const reorder = (id: string, dir: 1 | -1) =>
    h.commit((p) => {
      const i = p.layers.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.layers.length) return p
      const layers = [...p.layers]
      ;[layers[i], layers[j]] = [layers[j], layers[i]]
      return { ...p, layers }
    })

  const startDrag = (e: React.PointerEvent, layer: TextLayer, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(layer.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    h.checkpoint()
    const start = { x: e.clientX, y: e.clientY, lx: layer.x, ly: layer.y, fs: layer.fontSize }
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.x) / rect.width) * 100
      const dy = ((ev.clientY - start.y) / rect.height) * 100
      if (mode === 'resize') {
        const fontSize = Math.round(clamp(start.fs + dy * 6, 16, 240))
        h.live((p) => ({ ...p, layers: p.layers.map((l) => (l.id === layer.id ? { ...l, fontSize } : l)) }))
        return
      }
      let x = clamp(start.lx + dx, 0, 100)
      let y = clamp(start.ly + dy, 0, 100)
      const snapV = Math.abs(x - 50) < SNAP
      const snapH = Math.abs(y - 50) < SNAP
      if (snapV) x = 50
      if (snapH) y = 50
      setGuides({ v: snapV, h: snapH })
      x = Math.round(x * 10) / 10
      y = Math.round(y * 10) / 10
      h.live((p) => ({ ...p, layers: p.layers.map((l) => (l.id === layer.id ? { ...l, x, y } : l)) }))
    }
    const onUp = () => {
      setGuides({ v: false, h: false })
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) h.redo()
        else h.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        h.redo()
        return
      }
      if (!selectedId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeLayer(selectedId)
        return
      }
      const step = e.shiftKey ? 5 : 1
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      const d = delta[e.key]
      if (!d) return
      e.preventDefault()
      h.commit((p) => ({ ...p, layers: p.layers.map((l) => (l.id === selectedId ? { ...l, x: clamp(l.x + d[0], 0, 100), y: clamp(l.y + d[1], 0, 100) } : l)) }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, h.undo, h.redo, h.commit])

  const save = () => {
    const r = runAction(saveTemplateCopy, { originId: origin.id, name, edit })
    toastResult(r)
    if (!r.ok || !r.id) return
    setSavedSnapshot(JSON.stringify(edit))
    onSaved(r.id)
  }

  const attach = () => {
    if (!targetPost) return toast('添付先の投稿を選んでください', false)
    const r = runAction(attachAssetToPost, targetPost, origin.id)
    toastResult(r)
  }

  const attachReason = !isCopy ? '先に「投稿用コピーを保存」してください' : dirty ? '未保存の変更があります。保存してから添付してください' : !targetPost ? '添付先の投稿を選んでください' : undefined

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <Link href="/kouhou/assets" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            素材・テンプレート
          </Link>
          <h1 className="text-xl font-semibold text-balance">画像テンプレート編集</h1>
          <p className="text-sm text-muted-foreground">
            {isCopy ? '投稿用コピーを編集中。保存するとこのコピーが更新されます。' : '背景テンプレートから投稿用コピーを作成します。元テンプレートは上書きされません。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={h.undo} disabled={!h.canUndo} aria-label="元に戻す" title="元に戻す（Ctrl+Z）">
            <Undo2 className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={h.redo} disabled={!h.canRedo} aria-label="やり直す" title="やり直す（Ctrl+Shift+Z）">
            <Redo2 className="size-4" aria-hidden />
          </Button>
          <Button onClick={save} className="gap-1">
            <Save className="size-4" aria-hidden />
            {isCopy ? 'コピーを保存' : '投稿用コピーを保存'}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <Panel
          title="レイヤー"
          actions={
            <Button size="sm" variant="outline" onClick={addLayer} className="gap-1">
              <Plus className="size-4" aria-hidden />
              文字
            </Button>
          }
          bodyClassName="p-2"
        >
          <ol className="flex flex-col gap-1" aria-label="レイヤー一覧（上ほど前面）">
            {[...edit.layers].reverse().map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  aria-pressed={l.id === selectedId}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
                    l.id === selectedId ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                  )}
                >
                  <Type className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{l.text || '（空）'}</span>
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" aria-hidden />
              <span className="truncate">背景（固定）</span>
            </li>
          </ol>
          {!edit.layers.length && <p className="px-2 pb-2 text-xs text-muted-foreground">文字レイヤーがありません。</p>}
        </Panel>

        <div className="flex flex-col gap-2">
          <div className="mx-auto w-full max-w-xl">
            <div
              ref={canvasRef}
              onPointerDown={() => setSelectedId(null)}
              className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-md border border-border bg-muted"
              style={{ containerType: 'inline-size' }}
              role="application"
              aria-label="キャンバス。文字をドラッグで移動、矢印キーで微調整、Deleteで削除"
            >
              {bg?.src && <img src={mediaUrl(bg.src)} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" draggable={false} />}
              {guides.v && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-primary" />}
              {guides.h && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-primary" />}
              {edit.layers.map((l) => {
                const isSel = l.id === selectedId
                return (
                  <div
                    key={l.id}
                    onPointerDown={(e) => startDrag(e, l, 'move')}
                    className={cn('absolute cursor-move', isSel ? 'outline-2 outline-primary outline-offset-2' : 'hover:outline-1 hover:outline-dashed hover:outline-primary/60')}
                    style={{ ...layerStyle(l), outlineStyle: isSel ? 'solid' : undefined }}
                  >
                    {l.text || ' '}
                    {isSel && (
                      <>
                        {(['-left-1.5 -top-1.5', '-right-1.5 -top-1.5', '-left-1.5 -bottom-1.5'] as const).map((pos) => (
                          <span key={pos} aria-hidden className={cn('pointer-events-none absolute size-2.5 rounded-sm border border-primary bg-card', pos)} />
                        ))}
                        <span
                          aria-hidden
                          onPointerDown={(e) => startDrag(e, l, 'resize')}
                          title="ドラッグでサイズ変更"
                          className="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-sm border border-primary bg-primary"
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            ドラッグで移動・右下のハンドルでサイズ変更。中央付近で自動的に揃います。矢印キーで1%（Shiftで5%）移動。
          </p>
          <Notice tone="muted">画像ファイルへの書き出しは未対応です。保存されるのは編集データとプレビューで、いつでも再編集できます。</Notice>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="文字のプロパティ">
            {selected ? (
              <LayerProps
                layer={selected}
                onChange={(patch) => updateLayer(selected.id, patch)}
                onRemove={() => removeLayer(selected.id)}
                onForward={() => reorder(selected.id, 1)}
                onBackward={() => reorder(selected.id, -1)}
                isFront={edit.layers[edit.layers.length - 1]?.id === selected.id}
                isBack={edit.layers[0]?.id === selected.id}
              />
            ) : (
              <p className="text-sm text-muted-foreground">キャンバスかレイヤー一覧で文字を選択してください。</p>
            )}
          </Panel>

          <Panel title="保存と添付">
            <div className="flex flex-col gap-3">
              <Field label="素材名" htmlFor="tpl-name" required>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="背景" htmlFor="tpl-bg" hint="背景は固定レイヤーで、編集はできません">
                <Select id="tpl-bg" value={edit.backgroundAssetId} onChange={(e) => h.commit((p) => ({ ...p, backgroundAssetId: e.target.value }))}>
                  {backgrounds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="添付先の投稿" htmlFor="tpl-post" hint="承認済みの投稿に添付すると内容の再承認が必要になります">
                <Select id="tpl-post" value={targetPost} onChange={(e) => setTargetPost(e.target.value)}>
                  <option value="">選択してください</option>
                  {attachable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id}　{p.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex flex-col gap-1">
                <Button variant="outline" onClick={attach} disabled={Boolean(attachReason)} className="gap-1">
                  <Paperclip className="size-4" aria-hidden />
                  この投稿に添付
                </Button>
                <DisabledReason reason={attachReason} />
              </div>
              {targetPost && (
                <Link href={`/kouhou/posts/detail?id=${targetPost}`} className="text-sm text-primary underline-offset-2 hover:underline">
                  投稿 <PostId id={targetPost} /> を開く
                </Link>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <dt>ブランド</dt>
                <dd>
                  <BrandTag brand={s.brands.find((b) => b.id === (bg?.brandId ?? origin.brandId))} />
                </dd>
                {isCopy && (
                  <>
                    <dt>最終更新</dt>
                    <dd>
                      <UserName s={s} id={origin.updatedBy} />　{formatDateTime(origin.updatedAt)}
                    </dd>
                  </>
                )}
                <dt>状態</dt>
                <dd>{dirty ? '未保存の変更あり' : '保存済み'}</dd>
              </dl>
            </div>
          </Panel>
        </div>
      </div>

      {isCopy && userId && (
        <Panel title="コメント">
          <CommentsPanel target={{ type: 'asset', id: origin.id }} />
        </Panel>
      )}
    </div>
  )
}

function LayerProps({
  layer,
  onChange,
  onRemove,
  onForward,
  onBackward,
  isFront,
  isBack,
}: {
  layer: TextLayer
  onChange: (patch: Partial<TextLayer>) => void
  onRemove: () => void
  onForward: () => void
  onBackward: () => void
  isFront: boolean
  isBack: boolean
}) {
  const [draft, setDraft] = useState(layer.text)
  useEffect(() => setDraft(layer.text), [layer.id, layer.text])

  return (
    <div className="flex flex-col gap-3">
      <Field label="文字" htmlFor="layer-text" hint="改行できます">
        <Textarea
          id="layer-text"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== layer.text && onChange({ text: draft })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="サイズ" htmlFor="layer-size" hint="1080px基準">
          <Input
            id="layer-size"
            type="number"
            min={16}
            max={240}
            value={layer.fontSize}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) onChange({ fontSize: clamp(Math.round(v), 16, 240) })
            }}
          />
        </Field>
        <Field label="フォント" htmlFor="layer-font">
          <Select id="layer-font" value={layer.font} onChange={(e) => onChange({ font: e.target.value as TextLayer['font'] })}>
            <option value="sans">ゴシック</option>
            <option value="serif">明朝</option>
            <option value="mono">等幅</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">色</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              aria-label={`色 ${c}`}
              aria-pressed={layer.color.toLowerCase() === c}
              className={cn('size-7 rounded-md border border-border', layer.color.toLowerCase() === c && 'ring-2 ring-primary ring-offset-1')}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value })} className="size-7 cursor-pointer rounded-md border border-border bg-card" />
            <span className="sr-only">任意の色</span>
            <span className="font-mono">{layer.color}</span>
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="揃え"
          size="sm"
          value={layer.align}
          onChange={(v) => onChange({ align: v })}
          items={[
            { value: 'left', label: <AlignLeft className="size-4" aria-label="左揃え" /> },
            { value: 'center', label: <AlignCenter className="size-4" aria-label="中央揃え" /> },
            { value: 'right', label: <AlignRight className="size-4" aria-label="右揃え" /> },
          ]}
        />
        <Segmented
          label="太さ"
          size="sm"
          value={String(layer.weight) as '400' | '700'}
          onChange={(v) => onChange({ weight: Number(v) as 400 | 700 })}
          items={[
            { value: '400', label: '標準' },
            { value: '700', label: '太字' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>X {layer.x}%</span>
        <span>Y {layer.y}%</span>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" onClick={onForward} disabled={isFront} className="gap-1">
          <ArrowUp className="size-4" aria-hidden />
          前面へ
        </Button>
        <Button size="sm" variant="outline" onClick={onBackward} disabled={isBack} className="gap-1">
          <ArrowDown className="size-4" aria-hidden />
          背面へ
        </Button>
        <Button size="sm" variant="outline" onClick={onRemove} className="gap-1 text-danger">
          <Trash2 className="size-4" aria-hidden />
          削除
        </Button>
      </div>
    </div>
  )
}
