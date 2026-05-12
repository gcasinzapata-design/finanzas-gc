'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, List, Camera, MessageCircle, LogOut, CreditCard, Target, Zap, FileSpreadsheet } from 'lucide-react'
import Image from 'next/image'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/transactions', icon: List, label: 'Transacciones' },
  { href: '/dashboard/eecc', icon: FileSpreadsheet, label: 'Importar EECC' },
  { href: '/dashboard/cards', icon: CreditCard, label: 'Tarjetas y Deudas' },
  { href: '/dashboard/goals', icon: Target, label: 'Objetivos' },
  { href: '/dashboard/ocr', icon: Camera, label: 'Escanear Recibo' },
  { href: '/dashboard/chat', icon: MessageCircle, label: 'Copiloto IA' },
]

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-screen flex-shrink-0">
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-base block leading-none">Copiloto</span>
            <span className="text-emerald-400 text-xs font-medium">Financiero</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${active ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 mb-3">
          {user.image && <Image src={user.image} alt="" width={32} height={32} className="rounded-full" />}
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-medium truncate">{user.name}</p>
            <p className="text-slate-500 text-xs truncate">{user.email}</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors text-sm">
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
