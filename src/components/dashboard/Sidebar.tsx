'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, List, Camera, MessageCircle, LogOut, CreditCard, Target, FileSpreadsheet, TrendingDown, BarChart3, Upload } from 'lucide-react'
import Image from 'next/image'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/transactions', icon: List, label: 'Transacciones' },
  { href: '/dashboard/prestamos', icon: TrendingDown, label: 'Préstamos & TC' },
  { href: '/dashboard/cards', icon: CreditCard, label: 'Tarjetas' },
  { href: '/dashboard/goals', icon: Target, label: 'Objetivos' },
  { href: '/dashboard/eecc', icon: Upload, label: 'Importar EECC' },
  { href: '/dashboard/ocr', icon: Camera, label: 'Escanear Recibo' },
  { href: '/dashboard/chat', icon: MessageCircle, label: 'Copiloto IA' },
]

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  return (
    <aside className="w-60 flex-shrink-0 h-screen bg-slate-900 flex flex-col border-r border-slate-800">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">CF</div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Copiloto</p>
            <p className="text-slate-400 text-xs">Financiero</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                active
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0"/>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2">
          {user.image ? (
            <Image src={user.image} alt="avatar" width={32} height={32} className="rounded-full"/>
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {(user.name || user.email || 'U')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user.name || 'Usuario'}</p>
            <p className="text-slate-500 text-xs truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="mt-1 w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors text-sm">
          <LogOut className="w-4 h-4"/>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
