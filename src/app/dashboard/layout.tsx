'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import { Menu, X } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { if (status === 'unauthenticated') router.replace('/') }, [status, router])

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )
  if (!session) return null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar desktop */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar user={session.user as any}/>
      </div>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)}/>
          <div className="absolute left-0 top-0 h-full">
            <Sidebar user={session.user as any} onClose={() => setSidebarOpen(false)}/>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg" style={{ background: 'var(--bg-card2)' }}>
            <Menu size={18} style={{ color: 'var(--text-2)' }}/>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
              <span className="text-white font-bold" style={{ fontSize: 10 }}>CF</span>
            </div>
            <span className="text-sm font-bold text-white">Copiloto Financiero</span>
          </div>
          <div className="w-8"/>
        </div>

        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
