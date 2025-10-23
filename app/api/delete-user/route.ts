// app/api/delete-user/route.ts
import { supabase } from '@/services/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { userId } = await req.json()

  const { error } = await supabase.auth.admin.deleteUser(userId)

  if (error) return NextResponse.json({ error }, { status: 400 })

  return NextResponse.json({ success: true })
}
