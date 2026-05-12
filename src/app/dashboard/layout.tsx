'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  useEffect(() => { if (status === 'unauthenticated') router.replace('/') }, [status, router])
  if (status === 'loading') return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-slate-400 text-sm">Cargando...</div></div>
  if (!session) return null
  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar user={session.user as { name?: string|null; email?: string|null; image?: string|null }} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
