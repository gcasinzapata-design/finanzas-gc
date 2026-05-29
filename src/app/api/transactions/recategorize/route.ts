// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const CATEGORIES = [
  'Sueldo','Restaurantes','Delivery','Supermercados','Transporte','Gasolina',
  'Entretenimiento','Suscripciones','Servicios','Alquiler','Seguros','Ahorro',
  'Mascotas','Viajes','Hospedaje','Compras','Moda','Salud','Tecnología',
  'Educación','Deudas','Cuotas Préstamos','Transferencias','Transferencias Recibidas',
  'Transferencias Propias','Pago Tarjeta','Retiro Efectivo','Impuestos',
  'Intereses','Comisiones','Hogar','Otros',
]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { merchant, newCategory, applyToAll, txId } = await req.json()
  if (!newCategory) return NextResponse.json({ error: 'newCategory requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const uid = session.user.id

  if (applyToAll && merchant) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ category: newCategory })
      .eq('user_id', uid)
      .eq('merchant', merchant)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, updated: data?.length || 0, scope: 'all_months' })
  }

  if (txId) {
    const { error } = await supabase.from('transactions').update({ category: newCategory }).eq('id', txId).eq('user_id', uid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, updated: 1, scope: 'single' })
  }

  return NextResponse.json({ error: 'Falta txId o merchant' }, { status: 400 })
}

export async function GET() {
  return NextResponse.json({ categories: CATEGORIES })
}
