import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TournamentPredictions } from '../types';
import { Trophy, Lock, Save, Edit2, Medal, Award, Shield, ChevronDown, ChevronUp, Check, Users } from 'lucide-react';
import {
    POINTS_TOP_SCORER_GOALS,
    POINTS_TOP_SCORER_NAME,
    POINTS_CHAMPION,
    POINTS_BEST_PLAYER,
    POINTS_BEST_GOALKEEPER,
    calculateTournamentPoints
} from '../utils/scoring';
import { useDatabase } from '../contexts/DatabaseContext';

interface TopScorerCardProps {
    prediction?: TournamentPredictions;
    onPredict: (data: TournamentPredictions) => void;
    lockDate: Date;
    finalResult?: TournamentPredictions;
    allowedChampionTeamIds?: string[];
    ruleset?: "regulamento_1" | "regulamento_2";
    currentUserId?: string;
    currentGroupId?: string;
    defaultExpanded?: boolean;
}

// Sub-component: Other users' predictions accordion
const OtherUsersPredictions: React.FC<{
    db: ReturnType<typeof useDatabase>;
    currentUserId?: string;
    currentGroupId: string;
    ruleset: string;
    isLocked: boolean;
}> = ({ db, currentUserId, currentGroupId, ruleset, isLocked }) => {
    const [isOpen, setIsOpen] = useState(false);

    const otherPredictions = useMemo(() => {
        return db.tournamentPredictions.filter(
            (tp) => tp.groupId === currentGroupId && tp.userId !== currentUserId
        );
    }, [db.tournamentPredictions, currentGroupId, currentUserId]);

    const getUserName = (userId: string) => {
        const user = db.users.find((u) => u.id === userId);
        return user?.name || "Anônimo";
    };

    const getTeamCode = (teamId?: string) => {
        if (!teamId) return "—";
        const team = db.teams.find((t) => t.id === teamId);
        return team?.code || team?.name || "—";
    };

    const getTeamFlag = (teamId?: string) => {
        if (!teamId) return null;
        const team = db.teams.find((t) => t.id === teamId);
        return team?.flag || null;
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
                                {ruleset === "regulamento_2" ? (
                                    <>
                                        <th className="px-2 py-2 text-center font-medium">+Gols</th>
                                        <th className="px-2 py-2 text-center font-medium">+Sofridos</th>
                                    </>
                                ) : (
                                    <>
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
                                        {isLocked ? (tp.topScorerPlayer || "—") : "Oculto"}
                                    </td>
                                    {ruleset === "regulamento_2" ? (
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
                                                {isLocked ? (tp.bestPlayer || "—") : "Oculto"}
                                            </td>
                                            <td className="px-2 py-2 text-center text-slate-300 whitespace-nowrap">
                                                {isLocked ? (tp.bestGoalkeeper || "—") : "Oculto"}
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

const TopScorerCard: React.FC<TopScorerCardProps> = ({
    prediction,
    onPredict,
    lockDate,
    finalResult,
    allowedChampionTeamIds,
    ruleset = "regulamento_1",
    currentUserId,
    currentGroupId,
    defaultExpanded = false,
}) => {
    // Collapse State
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Form State
    const [championId, setChampionId] = useState(prediction?.championTeamId || '');
    const [tsPlayer, setTsPlayer] = useState(prediction?.topScorer?.player || '');
    const [tsGoals, setTsGoals] = useState(prediction?.topScorer?.goals?.toString() || '');
    const [bestPlayer, setBestPlayer] = useState(prediction?.bestPlayer || '');
    const [bestGk, setBestGk] = useState(prediction?.bestGoalkeeper || '');
    const [mostGoalsTeamId, setMostGoalsTeamId] = useState(prediction?.mostGoalsTeamId || '');
    const [mostConcededTeamId, setMostConcededTeamId] = useState(prediction?.mostConcededTeamId || '');

    // Custom Dropdown States
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [isMostGoalsOpen, setIsMostGoalsOpen] = useState(false);
    const mostGoalsRef = useRef<HTMLDivElement>(null);

    const [isMostConcededOpen, setIsMostConcededOpen] = useState(false);
    const mostConcededRef = useRef<HTMLDivElement>(null);

    const [isLocked, setIsLocked] = useState(false);

    // Sync prediction prop into form state when DB hydration arrives after mount
    useEffect(() => {
        setChampionId(prediction?.championTeamId || '');
        setTsPlayer(prediction?.topScorer?.player || '');
        setTsGoals(prediction?.topScorer?.goals?.toString() || '');
        setBestPlayer(prediction?.bestPlayer || '');
        setBestGk(prediction?.bestGoalkeeper || '');
        setMostGoalsTeamId(prediction?.mostGoalsTeamId || '');
        setMostConcededTeamId(prediction?.mostConcededTeamId || '');
    }, [prediction]);

    const hasSavedPredictions = !!(
        prediction?.championTeamId ||
        prediction?.topScorer?.player ||
        (ruleset !== "regulamento_2" && (prediction?.bestPlayer || prediction?.bestGoalkeeper)) ||
        (ruleset === "regulamento_2" && (prediction?.mostGoalsTeamId || prediction?.mostConcededTeamId))
    );

    const db = useDatabase();

    const championTeams = useMemo(() => {
        const filtered = db.teams.filter((team) => team.ranking != null);
        if (allowedChampionTeamIds && allowedChampionTeamIds.length > 0) {
            const allowedSet = new Set(allowedChampionTeamIds.map((id) => id.toLowerCase()));
            return filtered
                .filter((team) => allowedSet.has(team.id.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        }
        return filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [db.teams, allowedChampionTeamIds]);

    const selectedTeam = championId
        ? db.teams.find((team) => team.id === championId)
        : null;

    const selectedMostGoalsTeam = mostGoalsTeamId
        ? db.teams.find((team) => team.id === mostGoalsTeamId)
        : null;

    const selectedMostConcededTeam = mostConcededTeamId
        ? db.teams.find((team) => team.id === mostConcededTeamId)
        : null;

    // Handle click outside to close dropdowns
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (mostGoalsRef.current && !mostGoalsRef.current.contains(event.target as Node)) {
                setIsMostGoalsOpen(false);
            }
            if (mostConcededRef.current && !mostConcededRef.current.contains(event.target as Node)) {
                setIsMostConcededOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const checkLock = () => {
            const now = new Date();
            setIsLocked(now >= lockDate);
        };
        checkLock();
        const timer = setInterval(checkLock, 60000);
        return () => clearInterval(timer);
    }, [lockDate]);

    const handleSave = () => {
        onPredict({
            championTeamId: championId || undefined,
            topScorer: (tsPlayer || tsGoals) ? {
                player: tsPlayer,
                goals: tsGoals ? parseInt(tsGoals) : 0
            } : undefined,
            bestPlayer: ruleset !== "regulamento_2" ? (bestPlayer || undefined) : undefined,
            bestGoalkeeper: ruleset !== "regulamento_2" ? (bestGk || undefined) : undefined,
            mostGoalsTeamId: ruleset === "regulamento_2" ? (mostGoalsTeamId || undefined) : undefined,
            mostConcededTeamId: ruleset === "regulamento_2" ? (mostConcededTeamId || undefined) : undefined,
        });
        // Optional: collapse after save
        // setIsExpanded(false); 
    };

    // Helper to check correctness for UI Highlights
    const isChampionCorrect = finalResult?.championTeamId && championId === finalResult.championTeamId;
    const isTsNameCorrect = finalResult?.topScorer?.player && tsPlayer.toLowerCase() === finalResult.topScorer.player.toLowerCase();
    const isTsGoalsCorrect = finalResult?.topScorer?.goals && parseInt(tsGoals) === finalResult.topScorer.goals;
    const isBestPlayerCorrect = ruleset !== "regulamento_2" && finalResult?.bestPlayer && bestPlayer.toLowerCase() === finalResult.bestPlayer.toLowerCase();
    const isBestGkCorrect = ruleset !== "regulamento_2" && finalResult?.bestGoalkeeper && bestGk.toLowerCase() === finalResult.bestGoalkeeper.toLowerCase();
    const isMostGoalsCorrect = ruleset === "regulamento_2" && finalResult?.mostGoalsTeamId && mostGoalsTeamId === finalResult.mostGoalsTeamId;
    const isMostConcededCorrect = ruleset === "regulamento_2" && finalResult?.mostConcededTeamId && mostConcededTeamId === finalResult.mostConcededTeamId;

    const totalPoints = ruleset === "regulamento_2"
        ? 0 // Handled in-database for rateio
        : calculateTournamentPoints(
            { championTeamId: championId, topScorer: { player: tsPlayer, goals: parseInt(tsGoals) || 0 }, bestPlayer, bestGoalkeeper: bestGk },
            finalResult
        );

    // Approximate point display for Regulamento 2
    const r2PointsLabel = useMemo(() => {
        if (ruleset !== "regulamento_2") return "";
        let pts = 0;
        if (isMostGoalsCorrect) pts += 20;
        if (isMostConcededCorrect) pts += 20;

        let hasChampionSplit = isChampionCorrect;
        let hasTsSplit = isTsNameCorrect;

        if (pts === 0 && !hasChampionSplit && !hasTsSplit) return "";

        let labels = [];
        if (pts > 0) labels.push(`+${pts} pts garantidos`);
        if (hasChampionSplit) labels.push("Campeão correto (pontos divididos no grupo)");
        if (hasTsSplit) labels.push("Artilheiro correto (pontos divididos no grupo)");

        return labels.join(" e ");
    }, [ruleset, isMostGoalsCorrect, isMostConcededCorrect, isChampionCorrect, isTsNameCorrect]);

    return (
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden">

            {/* Header - Always Visible & Clickable */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full bg-gradient-to-r from-indigo-900/80 to-slate-900 px-4 py-3 flex justify-between items-center transition-colors hover:bg-slate-800 rounded-t-xl"
            >
                <div className="flex items-center gap-3 text-white">
                    <Trophy size={20} className="text-yellow-400" />
                    <div className="text-left">
                        <h3 className="tracking-wide text-sm font-bold uppercase">Palpites Especiais</h3>
                        <span className="text-[10px] text-slate-400 font-normal block">
                            {isLocked ? 'Encerrado (Início da Copa)' : `Encerra em: ${lockDate.toLocaleDateString('pt-BR')} às ${lockDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isLocked && (
                        <div className="flex items-center gap-1 text-xs font-bold text-orange-400 bg-orange-950/50 px-2 py-1 rounded border border-orange-500/30">
                            <Lock size={12} /> FECHADO
                        </div>
                    )}
                    {!isLocked && hasSavedPredictions && (
                        <div className="flex items-center gap-1 text-xs font-bold text-brand-green bg-brand-green/10 px-2 py-1 rounded border border-brand-green/30">
                            <Check size={12} /> Salvo
                        </div>
                    )}
                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </div>
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="p-4 space-y-4 animate-fadeIn">

                    {/* Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* 1. Champion (Custom Dropdown) */}
                        <div className={`bg-slate-900/50 p-3 rounded-lg border ${isChampionCorrect ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-slate-700'}`}>
                            <div className="flex items-center gap-2 mb-2 text-yellow-500">
                                <Trophy size={16} />
                                <label className="text-xs font-bold uppercase">Seleção Campeã</label>
                                <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">
                                    {ruleset === "regulamento_2" ? "Até 100 pts (Rateio)" : "100 pts"}
                                </span>
                            </div>

                            <div className="relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => !isLocked && setIsDropdownOpen(!isDropdownOpen)}
                                    disabled={isLocked}
                                    className={`w-full bg-slate-800 border ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} border-slate-600 rounded px-3 py-2 text-sm text-white flex items-center justify-between focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all`}
                                >
                                    {selectedTeam ? (
                                        <div className="flex items-center gap-2">
                                            <img src={selectedTeam.flag} alt={selectedTeam.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />
                                            <span>{selectedTeam.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400">Selecione...</span>
                                    )}
                                    {!isLocked && <ChevronDown size={14} className="text-slate-400" />}
                                </button>

                                {/* Dropdown Menu */}
                                {isDropdownOpen && !isLocked && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                        {championTeams.map((team) => (
                                            <button
                                                key={team.id}
                                                onClick={() => {
                                                    setChampionId(team.id);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-0"
                                            >
                                                <img src={team.flag} alt={team.name} className="w-6 h-4 object-cover rounded shadow-sm" />
                                                <span>{team.name}</span>
                                                {championId === team.id && <Check size={14} className="ml-auto text-brand-green" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {isChampionCorrect && (
                                <div className="text-yellow-400 text-xs font-bold mt-1 text-right">
                                    ✓ {ruleset === "regulamento_2" ? "Acertou! (Pontos divididos no grupo)" : "Acertou! +100 pts"}
                                </div>
                            )}
                        </div>

                        {/* 2. Top Scorer */}
                        <div className={`bg-slate-900/50 p-3 rounded-lg border ${(isTsNameCorrect || isTsGoalsCorrect) ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700'}`}>
                            <div className="flex items-center gap-2 mb-2 text-amber-500">
                                <Medal size={16} />
                                <label className="text-xs font-bold uppercase">Artilheiro</label>
                                <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">
                                    {ruleset === "regulamento_2" ? "Até 60 pts (Rateio)" : "100+100 pts"}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Nome do Artilheiro"
                                        value={tsPlayer}
                                        onChange={(e) => setTsPlayer(e.target.value)}
                                        disabled={isLocked}
                                        className={`w-full bg-slate-800 border ${isTsNameCorrect ? 'border-brand-green' : 'border-slate-600'} rounded px-3 py-2 text-sm text-white focus:border-amber-500 outline-none placeholder:text-slate-600`}
                                    />
                                </div>
                                {ruleset !== "regulamento_2" && (
                                    <div className="w-16">
                                        <input
                                            type="number"
                                            placeholder="Gols"
                                            value={tsGoals}
                                            onChange={(e) => setTsGoals(e.target.value)}
                                            disabled={isLocked}
                                            className={`w-full bg-slate-800 border ${isTsGoalsCorrect ? 'border-brand-green' : 'border-slate-600'} rounded px-2 py-2 text-sm text-white focus:border-amber-500 outline-none text-center`}
                                        />
                                    </div>
                                )}
                            </div>
                            {isTsNameCorrect && (
                                <div className="text-amber-400 text-xs font-bold mt-1 text-right">
                                    ✓ {ruleset === "regulamento_2" ? "Acertou! (Pontos divididos no grupo)" : "Artilheiro correto!"}
                                </div>
                            )}
                        </div>

                        {/* Ruleset specific fields */}
                        {ruleset === "regulamento_2" ? (
                            <>
                                {/* 3. Most Goals Team (R2) */}
                                <div className={`bg-slate-900/50 p-3 rounded-lg border ${isMostGoalsCorrect ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700'}`}>
                                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                                        <Award size={16} />
                                        <label className="text-xs font-bold uppercase">Mais Gols em Jogo Único</label>
                                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">20 pts</span>
                                    </div>
                                    <div className="relative" ref={mostGoalsRef}>
                                        <button
                                            type="button"
                                            onClick={() => !isLocked && setIsMostGoalsOpen(!isMostGoalsOpen)}
                                            disabled={isLocked}
                                            className={`w-full bg-slate-800 border ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} border-slate-600 rounded px-3 py-2 text-sm text-white flex items-center justify-between focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all`}
                                        >
                                            {selectedMostGoalsTeam ? (
                                                <div className="flex items-center gap-2">
                                                    <img src={selectedMostGoalsTeam.flag} alt={selectedMostGoalsTeam.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />
                                                    <span>{selectedMostGoalsTeam.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">Selecione a seleção...</span>
                                            )}
                                            {!isLocked && <ChevronDown size={14} className="text-slate-400" />}
                                        </button>

                                        {/* Dropdown Menu */}
                                        {isMostGoalsOpen && !isLocked && (
                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                                {championTeams.map((team) => (
                                                    <button
                                                        key={team.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setMostGoalsTeamId(team.id);
                                                            setIsMostGoalsOpen(false);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-0"
                                                    >
                                                        <img src={team.flag} alt={team.name} className="w-6 h-4 object-cover rounded shadow-sm" />
                                                        <span>{team.name}</span>
                                                        {mostGoalsTeamId === team.id && <Check size={14} className="ml-auto text-brand-green" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {isMostGoalsCorrect && <div className="text-emerald-400 text-xs font-bold mt-1 text-right">✓ Acertou! +20 pts</div>}
                                </div>

                                {/* 4. Most Conceded Team (R2) */}
                                <div className={`bg-slate-900/50 p-3 rounded-lg border ${isMostConcededCorrect ? 'border-rose-500/50 bg-rose-500/10' : 'border-slate-700'}`}>
                                    <div className="flex items-center gap-2 mb-2 text-rose-450">
                                        <Shield size={16} className="text-rose-450" />
                                        <label className="text-xs font-bold uppercase text-rose-400">Mais Gols Sofridos (Jogo único)</label>
                                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">20 pts</span>
                                    </div>
                                    <div className="relative" ref={mostConcededRef}>
                                        <button
                                            type="button"
                                            onClick={() => !isLocked && setIsMostConcededOpen(!isMostConcededOpen)}
                                            disabled={isLocked}
                                            className={`w-full bg-slate-800 border ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} border-slate-600 rounded px-3 py-2 text-sm text-white flex items-center justify-between focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all`}
                                        >
                                            {selectedMostConcededTeam ? (
                                                <div className="flex items-center gap-2">
                                                    <img src={selectedMostConcededTeam.flag} alt={selectedMostConcededTeam.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />
                                                    <span>{selectedMostConcededTeam.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">Selecione a seleção...</span>
                                            )}
                                            {!isLocked && <ChevronDown size={14} className="text-slate-400" />}
                                        </button>

                                        {/* Dropdown Menu */}
                                        {isMostConcededOpen && !isLocked && (
                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                                {championTeams.map((team) => (
                                                    <button
                                                        key={team.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setMostConcededTeamId(team.id);
                                                            setIsMostConcededOpen(false);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-0"
                                                    >
                                                        <img src={team.flag} alt={team.name} className="w-6 h-4 object-cover rounded shadow-sm" />
                                                        <span>{team.name}</span>
                                                        {mostConcededTeamId === team.id && <Check size={14} className="ml-auto text-brand-green" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {isMostConcededCorrect && <div className="text-rose-400 text-xs font-bold mt-1 text-right">✓ Acertou! +20 pts</div>}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* 3. Best Player (R1) */}
                                <div className={`bg-slate-900/50 p-3 rounded-lg border ${isBestPlayerCorrect ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-700'}`}>
                                    <div className="flex items-center gap-2 mb-2 text-blue-400">
                                        <Award size={16} />
                                        <label className="text-xs font-bold uppercase">Melhor Jogador</label>
                                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">100 pts</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Bola de Ouro da Copa"
                                        value={bestPlayer}
                                        onChange={(e) => setBestPlayer(e.target.value)}
                                        disabled={isLocked}
                                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none placeholder:text-slate-600"
                                    />
                                    {isBestPlayerCorrect && <div className="text-blue-400 text-xs font-bold mt-1 text-right">✓ Acertou! +100 pts</div>}
                                </div>

                                {/* 4. Best GK (R1) */}
                                <div className={`bg-slate-900/50 p-3 rounded-lg border ${isBestGkCorrect ? 'border-teal-500/50 bg-teal-500/10' : 'border-slate-700'}`}>
                                    <div className="flex items-center gap-2 mb-2 text-teal-400">
                                        <Shield size={16} />
                                        <label className="text-xs font-bold uppercase">Melhor Goleiro</label>
                                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">100 pts</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Luva de Ouro"
                                        value={bestGk}
                                        onChange={(e) => setBestGk(e.target.value)}
                                        disabled={isLocked}
                                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-teal-500 outline-none placeholder:text-slate-600"
                                    />
                                    {isBestGkCorrect && <div className="text-teal-400 text-xs font-bold mt-1 text-right">✓ Acertou! +100 pts</div>}
                                </div>
                            </>
                        )}

                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col gap-2 pt-2">

                        {ruleset === "regulamento_2" && r2PointsLabel && (
                            <div className="flex items-center gap-2 text-brand-green font-bold text-xs bg-brand-green/10 px-3 py-2 rounded-lg border border-brand-green/30 w-full justify-center text-center">
                                <Trophy size={14} className="shrink-0" />
                                Palpites Especiais: {r2PointsLabel}
                            </div>
                        )}

                        {ruleset !== "regulamento_2" && finalResult && totalPoints > 0 && (
                            <div className="flex items-center gap-2 text-brand-green font-bold text-sm bg-brand-green/10 px-3 py-1.5 rounded-full border border-brand-green/30 w-full justify-center">
                                <Trophy size={14} />
                                Você ganhou {totalPoints} pontos nestes palpites!
                            </div>
                        )}

                        {!isLocked && (
                            <button
                                onClick={handleSave}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-bold transition-colors shadow-lg ${hasSavedPredictions ? 'bg-slate-600 hover:bg-slate-500 shadow-slate-900/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'}`}
                            >
                                {hasSavedPredictions ? <Edit2 size={16} /> : <Save size={16} />}
                                {hasSavedPredictions ? 'Editar Palpites Especiais' : 'Salvar Palpites Especiais'}
                            </button>
                        )}
                    </div>

                    {/* Other Users' Predictions - Always visible, data hidden until lock */}
                    {currentGroupId && <OtherUsersPredictions db={db} currentUserId={currentUserId} currentGroupId={currentGroupId} ruleset={ruleset} isLocked={isLocked} />}

                </div>
            )}
        </div>
    );
};

export default TopScorerCard;