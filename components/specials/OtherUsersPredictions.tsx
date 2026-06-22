import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useDatabase } from '../../contexts/DatabaseContext';

interface OtherUsersPredictionsProps {
    currentUserId?: string;
    currentGroupId: string;
    ruleset: string;
    isLocked: boolean;
}

/**
 * Collapsible table showing every other group member's tournament predictions.
 * Values stay hidden ("Oculto") until the special-predictions deadline locks.
 */
export const OtherUsersPredictions: React.FC<OtherUsersPredictionsProps> = ({
    currentUserId,
    currentGroupId,
    ruleset,
    isLocked,
}) => {
    const db = useDatabase();
    const [isOpen, setIsOpen] = useState(false);

    const otherPredictions = useMemo(() => {
        return db.tournamentPredictions.filter(
            (tp) => tp.groupId === currentGroupId && tp.userId !== currentUserId
        );
    }, [db.tournamentPredictions, currentGroupId, currentUserId]);

    const getUserName = (userId: string) => {
        const user = db.users.find((u) => u.id === userId);
        return user?.name || 'Anônimo';
    };

    const getTeamCode = (teamId?: string) => {
        if (!teamId) return '—';
        const team = db.teams.find((t) => t.id === teamId);
        return team?.code || team?.name || '—';
    };

    const getTeamFlag = (teamId?: string) => {
        if (!teamId) return null;
        const team = db.teams.find((t) => t.id === teamId);
        return team?.flag || null;
    };

    const getPlayerName = (playerId?: string) => {
        if (!playerId) return '—';
        return db.players.find((p) => p.id === playerId)?.name || `#${playerId.slice(0, 6)}`;
    };

    return (
        <div className="mt-4 border border-slate-700 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
            >
                <div className="flex items-center gap-2 text-slate-300">
                    <Users size={14} />
                    <span className="text-xs font-bold uppercase tracking-wide">
                        Palpites do Grupo ({otherPredictions.length})
                    </span>
                </div>
                {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
            </button>

            {isOpen && (
                otherPredictions.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                        Nenhum outro participante fez palpites neste grupo ainda.
                    </div>
                ) : (
                    <div className="overflow-x-auto animate-fadeIn">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-900/40 text-slate-400 border-t border-slate-700">
                                    <th className="px-3 py-2 text-left font-medium">Participante</th>
                                    <th className="px-2 py-2 text-center font-medium">Campeã</th>
                                    <th className="px-2 py-2 text-center font-medium">Artilheiro</th>
                                    {ruleset === 'regulamento_2' ? (
                                        <>
                                            <th className="px-2 py-2 text-center font-medium">+Gols</th>
                                            <th className="px-2 py-2 text-center font-medium">+Sofridos</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-2 py-2 text-center font-medium">Gols</th>
                                            <th className="px-2 py-2 text-center font-medium">Mel. Jogador</th>
                                            <th className="px-2 py-2 text-center font-medium">Mel. Goleiro</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {otherPredictions.map((tp) => (
                                    <tr key={tp.userId} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-3 py-2 font-semibold text-slate-200 whitespace-nowrap">
                                            {getUserName(tp.userId)}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {isLocked ? (
                                                    <>
                                                        {getTeamFlag(tp.championTeamId) && (
                                                            <img src={getTeamFlag(tp.championTeamId)!} alt="" className="w-4 h-3 object-cover rounded-sm" />
                                                        )}
                                                        <span className="text-slate-300">{getTeamCode(tp.championTeamId)}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-500 italic">Oculto</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-center text-slate-300 whitespace-nowrap">
                                            {isLocked ? (tp.topScorerPlayerId ? getPlayerName(tp.topScorerPlayerId) : '—') : 'Oculto'}
                                        </td>
                                        {ruleset === 'regulamento_2' ? (
                                            <>
                                                <td className="px-2 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {isLocked ? (
                                                            <>
                                                                {getTeamFlag(tp.mostGoalsTeamId) && (
                                                                    <img src={getTeamFlag(tp.mostGoalsTeamId)!} alt="" className="w-4 h-3 object-cover rounded-sm" />
                                                                )}
                                                                <span className="text-slate-300">{getTeamCode(tp.mostGoalsTeamId)}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-500 italic">Oculto</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {isLocked ? (
                                                            <>
                                                                {getTeamFlag(tp.mostConcededTeamId) && (
                                                                    <img src={getTeamFlag(tp.mostConcededTeamId)!} alt="" className="w-4 h-3 object-cover rounded-sm" />
                                                                )}
                                                                <span className="text-slate-300">{getTeamCode(tp.mostConcededTeamId)}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-500 italic">Oculto</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-2 py-2 text-center text-slate-300 whitespace-nowrap">
                                                    {isLocked ? (tp.topScorerGoals != null ? tp.topScorerGoals : '—') : 'Oculto'}
                                                </td>
                                                <td className="px-2 py-2 text-center text-slate-300 whitespace-nowrap">
                                                    {isLocked ? (tp.bestPlayerId ? getPlayerName(tp.bestPlayerId) : '—') : 'Oculto'}
                                                </td>
                                                <td className="px-2 py-2 text-center text-slate-300 whitespace-nowrap">
                                                    {isLocked ? (tp.bestGoalkeeperId ? getPlayerName(tp.bestGoalkeeperId) : '—') : 'Oculto'}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </div>
    );
};

export default OtherUsersPredictions;
