
import { Match, MatchStatus } from '../types';

/**
 * SERVIÇO DE PLACARES AO VIVO (SEGURO)
 */

export interface ExternalMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { name: string; tla: string; } | null;
  awayTeam: { name: string; tla: string; } | null;
  score?: {
    fullTime?: { home: number; away: number; };
  };
}

export const fetchExternalMatches = async (): Promise<ExternalMatch[]> => {
  // Rota interna segura que oculta seu Token
  const internalApiUrl = '/api/matches';
  
  try {
    const response = await fetch(internalApiUrl);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Se der 404, explicamos que pode ser ausência de dados para 2026
        if (response.status === 404) {
            console.warn("[LIVE SCORE] A API da Football-Data ainda não possui jogos para a Copa de 2026.");
        } else {
            console.error(`[LIVE SCORE] Erro no Proxy (${response.status}):`, errorData.message || errorData.error);
        }
        return [];
    }

    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("[LIVE SCORE] Falha na comunicação com o servidor local/Vercel:", error);
    return [];
  }
};

export const mapExternalStatusToInternal = (status: string): MatchStatus => {
    if (['IN_PLAY', 'PAUSED'].includes(status)) return MatchStatus.LIVE;
    if (['FINISHED', 'AWARDED'].includes(status)) return MatchStatus.FINISHED;
    return MatchStatus.SCHEDULED;
};

export const findInternalMatch = (externalMatch: ExternalMatch, internalMatches: Match[]): Match | undefined => {
    if (!externalMatch.homeTeam || !externalMatch.awayTeam) return undefined;
    
    const homeCode = externalMatch.homeTeam.tla;
    const awayCode = externalMatch.awayTeam.tla;
    
    if (!homeCode || !awayCode) return undefined;

    return internalMatches.find(m => {
        return (m.homeTeam.code === homeCode && m.awayTeam.code === awayCode);
    });
};
