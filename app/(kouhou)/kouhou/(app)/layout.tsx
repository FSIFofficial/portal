import { AppShell } from '@/components/kouhou/shell/app-shell'

export default function KouhouAppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
