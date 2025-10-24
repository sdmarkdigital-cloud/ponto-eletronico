import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: any = null;
let connectionError: string | null = null;

console.log("supabaseUrl", supabaseUrl)
console.log("supabaseKey", supabaseKey)

if (!supabaseUrl || !supabaseKey) {
  connectionError = "As variáveis de ambiente SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não foram definidas.";
  console.error(connectionError);
} else {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  } catch (e: any) {
    connectionError = `Falha ao criar o cliente Supabase: ${e.message}`;
    console.error(connectionError);
  }
}

export const supabase = supabaseInstance;
export const supabaseError = connectionError;
