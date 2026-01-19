
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---

// 1. URL DO PROJETO (Extraída da sua string de conexão)
// Esta URL aponta para a API do seu projeto Supabase
const SUPABASE_URL = 'https://lhqrnlxjokwcwfrrqzhx.supabase.co'; 

// 2. CHAVE PÚBLICA (ANON KEY)
// ATENÇÃO: Você precisa pegar esta chave no painel do Supabase:
// Vá em: Project Settings (Engrenagem) -> API -> Project API keys -> anon / public
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocXJubHhqb2t3Y3dmcnJxemh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDA2MTAsImV4cCI6MjA4MDgxNjYxMH0.bncbC9V8EOY_Lq2YAOU61N8QOp_6ypRLBOsz5wCNIjo';

// Verificação simples para garantir que a chave foi configurada
const isConfigured = 
    SUPABASE_URL.includes('supabase.co') && 
    SUPABASE_ANON_KEY.length > 20 && 
    !SUPABASE_ANON_KEY.includes('COLE_SUA_CHAVE');

export const supabase = isConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// Helper para verificar se está ativo
export const isSupabaseEnabled = () => !!supabase;
