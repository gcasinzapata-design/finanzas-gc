// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServiceClient } from '@/lib/supabase'

const TABLE = 'user_tasks'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const sb = createServiceClient()
  const { data } = await sb.from(TABLE).select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
  return NextResponse.json({ tasks: data || [] })
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json()
  const sb = createServiceClient()
  const { data, error } = await sb.from(TABLE).insert({ user_id: session.user.id, title: body.title, category: body.category || 'Personal', priority: body.priority || 'medium', status: 'pending', notes: body.notes || null, due_date: body.due_date || null }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json()
  const sb = createServiceClient()
  const updates: any = {}
  if (body.status !== undefined) updates.status = body.status
  if (body.title !== undefined) updates.title = body.title
  if (body.priority !== undefined) updates.priority = body.priority
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.status === 'done') updates.completed_at = new Date().toISOString()
  if (body.status === 'pending') updates.completed_at = null
  const { data, error } = await sb.from(TABLE).update(updates).eq('id', body.id).eq('user_id', session.user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await req.json()
  await createServiceClient().from(TABLE).delete().eq('id', id).eq('user_id', session.user.id)
  return NextResponse.json({ success: true })
}
