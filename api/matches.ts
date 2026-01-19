
/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/matches.ts
 */

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = 'https://api.football-data.org/v4';
  
  // O código 'WC' é para a Copa do Mundo. 
  // Nota: Se a API retornar 404, pode ser que os jogos de 2026 ainda não foram inseridos no sistema deles.
  const COMPETITION_CODE = 'WC'; 
  const targetUrl = `${BASE_URL}/competitions/${COMPETITION_CODE}/matches`;

  if (!API_TOKEN) {
    return new Response(
      JSON.stringify({ 
        error: 'Configuração Incompleta', 
        message: 'A variável FOOTBALL_DATA_TOKEN não foi encontrada no ambiente da Vercel.' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log(`[PROXY] Consultando: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-Auth-Token': API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    // Se a API externa retornar 404 ou 403 (comum no plano gratuito para certas ligas)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[PROXY] Erro da API Football-Data:`, response.status, errorData);
      
      return new Response(
        JSON.stringify({ 
          error: `Erro na API externa (${response.status})`, 
          message: errorData.message || 'Recurso não encontrado ou acesso negado.',
          hint: 'Verifique se os jogos da Copa 2026 já estão disponíveis no seu plano da Football-Data.org'
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[PROXY] Erro interno:`, error);
    return new Response(
      JSON.stringify({ error: 'Erro de conexão', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
