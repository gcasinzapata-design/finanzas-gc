'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, ArrowLeftRight, TrendingDown, Tag, BarChart2, MessageSquareText, Upload, Target, ScanLine, LogOut, Zap, Brain, CreditCard, Calendar } from 'lucide-react'
import Image from 'next/image'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'main' },
  { href: '/dashboard/transactions', icon: ArrowLeftRight, label: 'Transacciones', group: 'main' },
  { href: '/dashboard/categorias', icon: Tag, label: 'Categorías', group: 'main' },
  { href: '/dashboard/analisis', icon: BarChart2, label: 'Análisis', group: 'main' },
  { href: '/dashboard/deuda', icon: TrendingDown, label: 'Plan Deuda', group: 'smart', badge: 'NEW' },
  { href: '/dashboard/inteligencia', icon: Brain, label: 'Inteligencia IA', group: 'smart', badge: 'NEW' },
  { href: '/dashboard/prestamos', icon: CreditCard, label: 'Préstamos & TC', group: 'smart' },
  { href: '/dashboard/goals', icon: Target, label: 'Objetivos', group: 'tools' },
  { href: '/dashboard/eecc', icon: Upload, label: 'Importar EECC', group: 'tools' },
  { href: '/dashboard/ocr', icon: ScanLine, label: 'Escanear Recibo', group: 'tools' },
  { href: '/dashboard/chat', icon: MessageSquareText, label: 'Copiloto IA', group: 'tools' },
]

const GROUPS = [
  { key: 'main', label: '' },
  { key: 'smart', label: 'INTELIGENTE' },
  { key: 'tools', label: 'HERRAMIENTAS' },
]

export default function Sidebar({ user, onClose }: { user: any; onClose?: () => void }) {
  const pathname = usePathname()
  return (
    <aside className="w-56 flex-shrink-0 h-full flex flex-col" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
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

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {GROUPS.map(g => {
          const items = NAV.filter(n => n.group === g.key)
          return (
            <div key={g.key} className="mb-1">
              {g.label && (
                <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest" style={{color:'var(--text-3)',fontSize:'9px'}}>{g.label}</p>
              )}
              {items.map(({ href, icon: Icon, label, badge }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm font-medium mb-0.5"
                    style={{ background: active ? 'var(--blue-glow)' : 'transparent', color: active ? '#93c5fd' : 'var(--text-2)', borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent' }}>
                    <Icon size={15} className="flex-shrink-0" style={{ color: active ? '#3b82f6' : 'var(--text-3)' }}/>
                    <span className="truncate flex-1">{label}</span>
                    {badge && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{background:'var(--blue)',color:'#fff',fontSize:'9px'}}>{badge}</span>}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1" style={{ background: 'var(--bg-base)' }}>
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
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-3)' }}>
          <LogOut size={12}/> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
