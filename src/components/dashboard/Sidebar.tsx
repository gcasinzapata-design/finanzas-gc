'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, ArrowLeftRight, TrendingDown, Tag, BarChart2, MessageSquareText, Upload, Target, ScanLine, LogOut, Zap } from 'lucide-react'
import Image from 'next/image'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/transactions', icon: ArrowLeftRight, label: 'Transacciones' },
  { href: '/dashboard/categorias', icon: Tag, label: 'Categorías' },
  { href: '/dashboard/analisis', icon: BarChart2, label: 'Análisis' },
  { href: '/dashboard/prestamos', icon: TrendingDown, label: 'Préstamos & TC' },
  { href: '/dashboard/goals', icon: Target, label: 'Objetivos' },
  { href: '/dashboard/eecc', icon: Upload, label: 'Importar EECC' },
  { href: '/dashboard/ocr', icon: ScanLine, label: 'Escanear Recibo' },
  { href: '/dashboard/chat', icon: MessageSquareText, label: 'Copiloto IA' },
]

export default function Sidebar({ user, onClose }: { user: any; onClose?: () => void }) {
  const pathname = usePathname()
  return (
    <aside className="w-56 flex-shrink-0 h-full md:h-screen flex flex-col" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
            <Zap size={14} className="text-white"/>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Copiloto</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Financiero v2</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm font-medium"
              style={{
                background: active ? 'var(--blue-glow)' : 'transparent',
                color: active ? '#93c5fd' : 'var(--text-2)',
                borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
              }}>
              <Icon size={15} className="flex-shrink-0" style={{ color: active ? '#3b82f6' : 'var(--text-3)' }}/>
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-base)' }}>
          {user?.image
            ? <Image src={user.image} alt="" width={28} height={28} className="rounded-full flex-shrink-0"/>
            : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--blue)' }}>
                {(user?.name||user?.email||'G')[0].toUpperCase()}
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name?.split(' ')[0]||'Gian'}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>Pro</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/' })}
          className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-xs"
          style={{ color: 'var(--text-3)' }}>
          <LogOut size={12}/> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
