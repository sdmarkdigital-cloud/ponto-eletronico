import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: any = null;
let connectionError: string | null = null;

// Verificação robusta para garantir que as variáveis não são apenas strings vazias ou os placeholders
if (!supabaseUrl || !supabaseKey) {
  connectionError = "As variáveis de ambiente do Supabase não foram configuradas. Por favor, edite o arquivo .env.local na raiz do projeto com suas credenciais.";
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
