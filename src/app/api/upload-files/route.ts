
import { supabase } from '@/src/services/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { fileBase64, path } = await req.json()

  // converter base64 para Buffer
  const fileBuffer = Buffer.from(fileBase64, 'base64')
  const bucket = 'documents'

  const { data, error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    upsert: true,
  })

  if (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error }, { status: 400 })
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)

  return NextResponse.json({ success: true, publicUrl: urlData.publicUrl })
}
