'use client'

// 表示モード（ライト／ダーク／端末に合わせる）。選んだものはこのブラウザに保存する
import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ThemeMode = 'light' | 'dark' | 'system'
const KEY = 'fsif-portal-theme'

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('system')
  useEffect(() => {
    try {
      setMode((localStorage.getItem(KEY) as ThemeMode) || 'system')
    } catch {
      // 保存できない環境では端末に合わせる
    }
  }, [])
  useEffect(() => {
    apply(mode)
    if (mode !== 'system') return
    // 端末の設定が変わったら追従する
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])
  const change = (m: ThemeMode) => {
    setMode(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      // noop
    }
  }
  return { mode, change }
}

export function ThemeSwitcher() {
  const { mode, change } = useTheme()
  const options: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'ライト', icon: Sun },
    { id: 'dark', label: 'ダーク', icon: Moon },
    { id: 'system', label: '端末に合わせる', icon: Monitor },
  ]
  return (
    <div className="px-3 py-2">
      <p className="mb-1.5 text-[11px] font-bold text-[#5b6b7c]">表示モード</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#f1f4f8] p-1" role="radiogroup" aria-label="表示モード">
        {options.map((o) => {
          const Icon = o.icon
          return (
            <button key={o.id} role="radio" aria-checked={mode === o.id} onClick={() => change(o.id)} className={cn('flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-semibold', mode === o.id ? 'bg-white text-[var(--brand-fg)] shadow-sm' : 'text-[#4f5f70] hover:text-[#1b304b]')}>
              <Icon size={14} />{o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
