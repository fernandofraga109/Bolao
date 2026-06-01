import React, { useState } from "react";
import { User, Group } from "../types";
import {
  Shield,
  Trash2,
  CheckCircle,
  Copy,
  Plus,
  X,
  Users,
  Settings,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Search,
  Database,
  Download,
  CloudUpload,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  Award,
  Medal,
  Save,
  Trophy,
} from "lucide-react";
import { useDatabase } from "../contexts/DatabaseContext";
import { seedDatabase } from "../services/seeder";
import { syncTeamRankings } from "../api/sync-team-rankings";
import { isSupabaseEnabled } from "../services/supabase";
import { fetchExternalCompetitions } from "../services/liveScoreService";
import type { CompetitionSyncStatus } from "../hooks/useMatchSystem";
import ModalShell from "./ui/ModalShell";
import UserIdentity from "./ui/UserIdentity";
import DualActionButtons from "./ui/DualActionButtons";
import {
  COMPETITION_OPTIONS,
  DEFAULT_COMPETITION_CODE,
  getCompetitionByCode,
} from "../data/competitions";
import type { CompetitionDB } from "../types";
import AdminSpecialsOverrides from "./AdminSpecialsOverrides";

interface AdminDashboardProps {
  users: User[];
  groups: Group[];
  currentUser: User;
  onInvite: (email: string) => void;
  onUpdateRole: (userId: string, newRole: "ADMIN" | "USER") => void;
  onRemoveUser: (userId: string) => void;
  onCreateGroup: (name: string, competitionCode: string, ruleset?: "regulamento_1" | "regulamento_2") => void;
  onDeleteGroup: (id: string) => Promise<void>;
  onAddUserToGroup: (uid: string, gid: string) => Promise<void>;
  onRemoveUserFromGroup: (uid: string, gid: string) => Promise<void>;
  isSyncing: boolean;
  isAutoSyncEnabled: boolean;
  toggleAutoSync: () => void;
  syncStatusByCompetition: Record<string, CompetitionSyncStatus>;
  onManualSync?: (competitionCode: string) => Promise<void>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  groups,
  currentUser,
  onRemoveUser,
  onCreateGroup,
  onDeleteGroup,
  onAddUserToGroup,
  onRemoveUserFromGroup,
  isSyncing,
  isAutoSyncEnabled,
  toggleAutoSync,
  syncStatusByCompetition,
  onManualSync,
}) => {
  const db = useDatabase(); // Access raw DB tables and config

  const [activeView, setActiveView] = useState<"general" | "db_inspector">(
    "general",
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCompetitionCode, setNewGroupCompetitionCode] = useState(
    DEFAULT_COMPETITION_CODE,
  );
  const [newGroupRuleset, setNewGroupRuleset] = useState<"regulamento_1" | "regulamento_2">("regulamento_1");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // UI States
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [syncingCompetitionCode, setSyncingCompetitionCode] = useState<
    string | null
  >(null);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);

  // Tournament Awards States
  const [selectedCompetitionCode, setSelectedCompetitionCode] = useState<string | null>(null);
  const [championTeamId, setChampionTeamId] = useState<string>("");
  const [topScorerName, setTopScorerName] = useState<string>("");
  const [topScorerGoals, setTopScorerGoals] = useState<string>("");
  const [bestPlayerName, setBestPlayerName] = useState<string>("");
  const [bestGoalkeeperName, setBestGoalkeeperName] = useState<string>("");
  const [mostGoalsTeamId, setMostGoalsTeamId] = useState<string>("");
  const [mostConcededTeamId, setMostConcededTeamId] = useState<string>("");
  const [isSavingAwards, setIsSavingAwards] = useState(false);

  const activeCompetitions = React.useMemo(() => {
    const codes = Array.from(
      new Set(
        groups.map((g) =>
          (g.competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase(),
        ),
      ),
    );
    return codes.length > 0 ? codes : [DEFAULT_COMPETITION_CODE];
  }, [groups]);

  // Filter teams by selected competition
  const competitionTeams = React.useMemo(() => {
    if (!selectedCompetitionCode) return db.teams;
    
    // Get teams that have standings for this competition
    const teamIdsInCompetition = new Set(
      db.teamStandings
        .filter(ts => ts.competitionCode === selectedCompetitionCode)
        .map(ts => ts.teamId)
    );
    
    // Fallback: if no standings, use matches to determine teams
    if (teamIdsInCompetition.size === 0) {
      const teamIdsFromMatches = new Set(
        db.matches
          .filter(m => m.competitionCode === selectedCompetitionCode)
          .flatMap(m => [m.homeTeamId, m.awayTeamId])
      );
      return db.teams.filter(t => teamIdsFromMatches.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return db.teams.filter(t => teamIdsInCompetition.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCompetitionCode, db.teams, db.teamStandings, db.matches]);

  const handleTriggerManualSync = async (code: string) => {
    if (!onManualSync) return;
    await onManualSync(code);
  };

  const handleSyncCatalog = async () => {
    setIsSyncingCatalog(true);
    try {
      const competitions = await fetchExternalCompetitions();
      if (competitions.length > 0) {
        const catalogRows: CompetitionDB[] = competitions.map((c) => ({
          code: c.code,
          name: c.name,
          emblem: c.emblem,
          type: c.type,
        }));
        await db.upsertCompetitions(catalogRows);
        console.log(
          `✅ Catálogo atualizado: ${competitions.length} competições importadas.`,
        );
      }
    } catch (err) {
      console.error("Erro ao sincronizar catálogo:", err);
    } finally {
      setIsSyncingCatalog(false);
    }
  };

  const handleSaveAwards = async () => {
    if (!selectedCompetitionCode) return;
    
    setIsSavingAwards(true);
    try {
      await db.updateCompetitionAwards(selectedCompetitionCode, {
        championTeamId: championTeamId === "null" ? null : (championTeamId || undefined),
        topScorerName: topScorerName || undefined,
        topScorerGoals: topScorerGoals ? parseInt(topScorerGoals) : undefined,
        bestPlayerName: bestPlayerName || undefined,
        bestGoalkeeperName: bestGoalkeeperName || undefined,
        mostGoalsTeamId: mostGoalsTeamId === "null" ? null : (mostGoalsTeamId || undefined),
        mostConcededTeamId: mostConcededTeamId === "null" ? null : (mostConcededTeamId || undefined),
      });
      console.log("✅ Palpites especiais salvos com sucesso");
    } catch (err) {
      console.error("Erro ao salvar palpites especiais:", err);
      alert("Erro ao salvar palpites especiais");
    } finally {
      setIsSavingAwards(false);
    }
  };

  // Load existing awards when competition is selected
  React.useEffect(() => {
    if (selectedCompetitionCode) {
      const comp = db.competitions.find(c => c.code.toLowerCase() === selectedCompetitionCode.toLowerCase());
      if (comp) {
        setChampionTeamId(comp.championTeamId || "");
        setTopScorerName(comp.topScorerName || "");
        setTopScorerGoals(comp.topScorerGoals?.toString() || "");
        setBestPlayerName(comp.bestPlayerName || "");
        setBestGoalkeeperName(comp.bestGoalkeeperName || "");
        setMostGoalsTeamId(comp.mostGoalsTeamId || "");
        setMostConcededTeamId(comp.mostConcededTeamId || "");
      }
    } else {
      setChampionTeamId("");
      setTopScorerName("");
      setTopScorerGoals("");
      setBestPlayerName("");
      setBestGoalkeeperName("");
      setMostGoalsTeamId("");
      setMostConcededTeamId("");
    }
  }, [selectedCompetitionCode, db.competitions]);

  // Helper: resolve competition info from db.competitions first, then fallback to static
  const resolveCompetition = (
    code: string,
  ): { code: string; name: string; emblem: string } => {
    const fromDb = db.competitions.find(
      (c) => c.code.toUpperCase() === code.toUpperCase(),
    );
    if (fromDb) {
      return {
        code: fromDb.code,
        name: fromDb.name,
        emblem: fromDb.emblem || getCompetitionByCode(code).emblem,
      };
    }
    return getCompetitionByCode(code);
  };

  // Delete Modal States
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Remove Member Modal States
  const [memberToRemove, setMemberToRemove] = useState<{
    user: User;
    groupId: string;
  } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Loading States (Legacy for user removal system-wide)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedLogs, setSeedLogs] = useState<string[]>([]);

  // Ranking Sync States
  const [syncingRankings, setSyncingRankings] = useState(false);
  const [rankingSyncResult, setRankingSyncResult] = useState<{
    success: boolean;
    message: string;
    updated: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [showSyncRankingsModal, setShowSyncRankingsModal] = useState(false);

  const formatRelativeSyncTime = (isoDate?: string) => {
    if (!isoDate) return "nunca";
    const diffMs = Date.now() - new Date(isoDate).getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return "agora";

    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return `ha ${diffSeconds}s`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `ha ${diffMinutes} min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `ha ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    return `ha ${diffDays} d`;
  };

  // --- Actions ---

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName, newGroupCompetitionCode, newGroupRuleset);
    setNewGroupName("");
    setNewGroupCompetitionCode(DEFAULT_COMPETITION_CODE);
    setNewGroupRuleset("regulamento_1");
  };

  const handleRequestDeleteGroup = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    e.preventDefault();
    setGroupToDelete(group);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;

    setIsDeleting(true);
    try {
      await onDeleteGroup(groupToDelete.id);

      // Se deletou o grupo que estava sendo visualizado, volta para a lista
      if (selectedGroupId === groupToDelete.id) {
        setSelectedGroupId(null);
      }

      setGroupToDelete(null); // Fecha o modal
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao excluir grupo: ${error.message || "Erro desconhecido"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestRemoveMember = (
    e: React.MouseEvent,
    user: User,
    groupId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMemberToRemove({ user, groupId });
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    try {
      await onRemoveUserFromGroup(
        memberToRemove.user.id,
        memberToRemove.groupId,
      );
      setMemberToRemove(null); // Close Modal
    } catch (error: any) {
      console.error(error);
      alert("Erro ao remover membro");
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleRemoveUserSystem = async (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    e.preventDefault();

    if (
      window.confirm(
        `PERIGO: Remover ${user.name} do sistema apaga login, palpites e pontos.\nEsta ação é irreversível. Continuar?`,
      )
    ) {
      setDeletingUserId(user.id);
      try {
        await onRemoveUser(user.id);
      } catch (error) {
        console.error(error);
      } finally {
        setDeletingUserId(null);
      }
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedGroup(id);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  const handleUpdateInterval = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ms = parseInt(e.target.value);
    db.updateSystemConfig({ sync_interval_ms: ms });
  };

  const handleSeed = async () => {
    if (!isSupabaseEnabled()) {
      setSeedLogs([
        "Erro: Supabase não configurado. Adicione a URL e Key em services/supabase.ts",
      ]);
      return;
    }
    if (
      !window.confirm(
        "Isso tentará inserir todos os dados de exemplo no Supabase. Certifique-se de ter criado as tabelas antes (usando o script SQL). Continuar?",
      )
    )
      return;

    setSeeding(true);
    setSeedLogs(["Iniciando..."]);
    const result = await seedDatabase();
    setSeedLogs(result.logs);
    setSeeding(false);

    if (result.success) {
      alert(
        "Dados populados com sucesso! Atualize a página para ver os dados vindos do banco.",
      );
    }
  };

  const handleSyncTeamRankings = () => {
    setShowSyncRankingsModal(true);
  };

  const confirmSyncTeamRankings = async () => {
    setShowSyncRankingsModal(false);
    setSyncingRankings(true);
    setRankingSyncResult(null);

    try {
      const result = await syncTeamRankings();
      setRankingSyncResult(result);

      if (!result.success) {
        alert(`❌ Erro: ${result.message}`);
      }
    } catch (error: any) {
      setRankingSyncResult({
        success: false,
        message: "Erro desconhecido ao sincronizar rankings",
        updated: 0,
        failed: 0,
        errors: [error?.message || "Erro"],
      });
      alert("Erro ao sincronizar rankings");
    } finally {
      setSyncingRankings(false);
    }
  };

  const downloadJson = (filename: string, data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Render Helpers ---

  const renderDbInspector = () => {
    const isConnected = isSupabaseEnabled();

    return (
      <div className="space-y-6 pb-10">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setActiveView("general")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar
          </button>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="text-brand-green" />
            Ferramentas de Banco de Dados
          </h2>
        </div>

        {/* STATUS SECTION */}
        <div
          className={`p-4 rounded-xl border ${isConnected ? "bg-green-900/20 border-green-500/30" : "bg-red-900/20 border-red-500/30"}`}
        >
          <div className="flex items-center gap-3">
            {isConnected ? (
              <CheckCircle className="text-green-500" />
            ) : (
              <AlertTriangle className="text-red-500" />
            )}
            <div>
              <h3
                className={`font-bold ${isConnected ? "text-green-400" : "text-red-400"}`}
              >
                {isConnected ? "Supabase Conectado" : "Supabase Desconectado"}
              </h3>
              <p className="text-xs text-slate-400">
                {isConnected
                  ? "O aplicativo está lendo e gravando dados na nuvem."
                  : 'Edite o arquivo "services/supabase.ts" e adicione sua ANON KEY para conectar.'}
              </p>
            </div>
          </div>
        </div>

        {/* SEEDER SECTION */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
            <CloudUpload className="text-blue-400" />
            Popular Banco de Dados (Seed)
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Use esta ferramenta para enviar os dados locais (Times, Jogos,
            Usuários de teste) para o Supabase.
            <br />
            <span className="text-yellow-500 font-bold">Atenção:</span> As
            tabelas devem ter sido criadas previamente no Supabase SQL Editor
            usando o script SQL fornecido.
          </p>

          <button
            onClick={handleSeed}
            disabled={seeding || !isConnected}
            className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isConnected ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}
          >
            {seeding ? "Enviando..." : "Enviar Dados Locais para Nuvem"}
          </button>

          {seedLogs.length > 0 && (
            <div className="mt-4 bg-slate-950 p-4 rounded-lg font-mono text-xs text-green-400 border border-slate-700 max-h-40 overflow-y-auto">
              {seedLogs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          )}
        </div>

        {/* SYNC TEAM RANKINGS SECTION */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="text-yellow-400" />
            Sincronizar Rankings das Seleções
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Atualiza a coluna 'ranking' da tabela 'teams' no Supabase com base
            no arquivo team-ranking.json (rankings oficiais da FIFA).
            <br />
            <span className="text-blue-400 font-bold">Dica:</span> Execute esta
            operação quando quiser atualizar os rankings para cálculo do bônus
            de underdog.
          </p>

          <button
            onClick={handleSyncTeamRankings}
            disabled={syncingRankings || !isConnected}
            className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isConnected ? "bg-yellow-600 hover:bg-yellow-500 text-white" : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}
          >
            {syncingRankings ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Zap size={18} />
                Sincronizar Rankings
              </>
            )}
          </button>

          {rankingSyncResult && (
            <div
              className={`mt-4 p-4 rounded-lg border ${rankingSyncResult.success ? "bg-green-900/20 border-green-500/30" : "bg-red-900/20 border-red-500/30"}`}
            >
              <div className="flex items-start gap-3">
                {rankingSyncResult.success ? (
                  <Check className="text-green-400 mt-1" size={20} />
                ) : (
                  <AlertTriangle className="text-red-400 mt-1" size={20} />
                )}
                <div className="flex-1">
                  <p
                    className={`font-bold ${rankingSyncResult.success ? "text-green-300" : "text-red-300"}`}
                  >
                    {rankingSyncResult.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    ✅ Atualizados: {rankingSyncResult.updated} | ❌ Falhas:{" "}
                    {rankingSyncResult.failed}
                  </p>
                  {rankingSyncResult.errors.length > 0 && (
                    <>
                      <details className="mt-2">
                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                          Ver erros ({rankingSyncResult.errors.length})
                        </summary>
                        <ul className="mt-2 text-[10px] text-slate-400 space-y-1">
                          {rankingSyncResult.errors
                            .slice(0, 5)
                            .map((err, i) => (
                              <li key={i} className="ml-4">
                                • {err}
                              </li>
                            ))}
                          {rankingSyncResult.errors.length > 5 && (
                            <li className="ml-4 text-slate-500 italic">
                              ... e mais {rankingSyncResult.errors.length - 5}
                            </li>
                          )}
                        </ul>
                      </details>

                      {rankingSyncResult.errors.some((e) =>
                        e.includes("403"),
                      ) && (
                          <div className="mt-3 bg-yellow-900/30 border border-yellow-600/50 rounded p-3 text-[11px]">
                            <p className="text-yellow-300 font-bold mb-1">
                              ⚠️ Erro 403: Permissão Negada
                            </p>
                            <p className="text-yellow-200 mb-2">
                              Execute este script SQL no Supabase SQL Editor:
                            </p>
                            <div className="bg-slate-950 p-2 rounded border border-slate-700 font-mono text-[9px] text-green-400 overflow-x-auto">
                              <code>
                                GRANT UPDATE (ranking) ON public.teams TO
                                authenticated;
                              </code>
                            </div>
                            <p className="text-yellow-200 mt-2">
                              Ou execute o script:{" "}
                              <span className="font-mono text-blue-400">
                                database/sql/supabase_fix_team_ranking_update.sql
                              </span>
                            </p>
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <h3 className="font-bold text-slate-300 ml-1">
            Dados Atuais (Memória do App)
          </h3>
          {/* USERS TABLE */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-300">
                Tabela: Users ({db.users.length})
              </h3>
              <button
                onClick={() => downloadJson("users", db.users)}
                className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1"
              >
                <Download size={12} /> Baixar users.json
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-[10px] text-green-400 font-mono max-h-60 custom-scrollbar">
              {JSON.stringify(db.users, null, 2)}
            </pre>
          </div>
          {/* GROUPS TABLE */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-300">
                Tabela: Groups ({db.groups.length})
              </h3>
              <button
                onClick={() => downloadJson("groups", db.groups)}
                className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1"
              >
                <Download size={12} /> Baixar groups.json
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-[10px] text-green-400 font-mono max-h-60 custom-scrollbar">
              {JSON.stringify(db.groups, null, 2)}
            </pre>
          </div>
        </div>

        {/* MODAL: Confirm Sync Rankings */}
        {showSyncRankingsModal && (
          <ModalShell
            title="Sincronizar Rankings das Seleções"
            onClose={() => setShowSyncRankingsModal(false)}
            footer={
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowSyncRankingsModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-colors font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmSyncTeamRankings}
                  disabled={syncingRankings}
                  className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {syncingRankings ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Sincronizar
                    </>
                  )}
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <p className="text-slate-300">
                Deseja sincronizar os rankings das seleções do arquivo{" "}
                <span className="font-mono text-brand-green">
                  team-ranking.json
                </span>{" "}
                para o Supabase?
              </p>
              <p className="text-sm text-slate-400">
                Isso atualizará a coluna{" "}
                <span className="font-mono text-blue-400">ranking</span> da
                tabela <span className="font-mono text-blue-400">teams</span>{" "}
                com os rankings oficiais da FIFA.
              </p>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-200">
                ℹ️ Esta operação é segura e pode ser executada a qualquer
                momento para manter os dados atualizados.
              </div>
            </div>
          </ModalShell>
        )}
      </div>
    );
  };

  const renderMainView = () => (
    <div className="space-y-8 pb-10">
      {/* HEADER & SYNC PANEL */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-green/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-brand-green shadow-inner">
              <Shield size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Painel de Administração
              </h1>
              <p className="text-slate-400 text-sm">
                Controle total do sistema e sincronização
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* COMPETITIONS SYNC PANEL */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        {/* Header with Title and System Configurations (Dropdown & DB button) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/50 mb-6">
          <div className="flex items-center gap-3">
            <Zap className="text-brand-green shrink-0" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">
                Sincronização de Competições
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle de atualizações automáticas e manuais do sistema
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* SYNC WIDGET (Unified) */}
            <div className="relative z-20">
              <button
                onClick={() => setShowSyncMenu(!showSyncMenu)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all w-full sm:w-auto justify-between sm:justify-start ${isAutoSyncEnabled
                    ? "bg-slate-800 border-green-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-full ${isAutoSyncEnabled ? "bg-green-500/20 text-green-500" : "bg-slate-700 text-slate-400"}`}
                  >
                    <RefreshCw
                      size={16}
                      className={isSyncing ? "animate-spin" : ""}
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Sincronização
                    </div>
                    <div
                      className={`text-xs font-bold ${isAutoSyncEnabled ? "text-white" : "text-slate-400"}`}
                    >
                      {isAutoSyncEnabled ? "Automática: ON" : "Manual / Parada"}
                    </div>
                  </div>
                </div>
                {showSyncMenu ? (
                  <ChevronUp size={16} className="text-slate-500 ml-2" />
                ) : (
                  <ChevronDown size={16} className="text-slate-500 ml-2" />
                )}
              </button>

              {/* Dropdown Menu */}
              {showSyncMenu && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                  <div className="p-4 space-y-4">
                    {/* Toggle Area */}
                    <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                      <div className="flex flex-col">
                        <span className="text-sm text-white font-bold">
                          Atualização em Tempo Real
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Puxa placares da API oficial
                        </span>
                      </div>
                      <button
                        onClick={toggleAutoSync}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${isAutoSyncEnabled ? "bg-green-600" : "bg-slate-600"}`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isAutoSyncEnabled ? "translate-x-6" : "translate-x-0"}`}
                        ></div>
                      </button>
                    </div>

                    {/* Interval Settings */}
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2">
                        <Clock size={12} /> Intervalo de Busca
                      </label>
                      <select
                        value={db.systemConfig.sync_interval_ms}
                        onChange={handleUpdateInterval}
                        className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-green"
                      >
                        <option value={15000}>15 segundos (Rápido)</option>
                        <option value={30000}>30 segundos</option>
                        <option value={60000}>1 minuto (Recomendado)</option>
                        <option value={180000}>3 minutos</option>
                        <option value={300000}>5 minutos</option>
                        <option value={600000}>10 minutos</option>
                      </select>
                    </div>

                    {/* Note */}
                    <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20 flex gap-2">
                      <div className="mt-0.5">
                        <Clock size={12} className="text-indigo-400" />
                      </div>
                      <p className="text-[10px] text-indigo-200 leading-relaxed">
                        A atualização consome cotas da API. Use "15 segundos"
                        apenas durante jogos importantes.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                        Última sincronização por competição
                      </label>

                      {Object.keys(syncStatusByCompetition).length === 0 ? (
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-[11px] text-slate-400">
                          Nenhuma sincronização registrada ainda.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                          {Object.values(syncStatusByCompetition)
                            .sort((a, b) => {
                              const aTime = a.lastAttemptAt
                                ? new Date(a.lastAttemptAt).getTime()
                                : 0;
                              const bTime = b.lastAttemptAt
                                ? new Date(b.lastAttemptAt).getTime()
                                : 0;
                              return bTime - aTime;
                            })
                            .map((status) => (
                              <div
                                key={status.competitionCode}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-mono text-brand-green">
                                    {status.competitionCode}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border ${status.lastSuccess ? "text-green-300 bg-green-900/20 border-green-700/50" : "text-amber-300 bg-amber-900/20 border-amber-700/50"}`}
                                  >
                                    {status.lastSuccess ? "ok" : "atenção"}
                                  </span>
                                </div>
                                <div className="mt-1 text-[10px] text-slate-400">
                                  {status.lastSuccess
                                    ? `sincronizado ${formatRelativeSyncTime(status.lastSuccessAt)}`
                                    : `última tentativa ${formatRelativeSyncTime(status.lastAttemptAt)}`}
                                </div>
                                {status.lastMessage && (
                                  <p className="mt-1 text-[10px] text-slate-500 line-clamp-2">
                                    {status.lastMessage}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DB Inspector Button */}
            <button
              onClick={() => setActiveView("db_inspector")}
              className={`flex items-center gap-2 border px-3 py-2 rounded-lg font-bold text-xs transition-all shadow-sm ${isSupabaseEnabled() ? "bg-slate-800 hover:bg-slate-700 text-brand-green border-brand-green/30" : "bg-red-900/20 border-red-500/50 text-red-300"}`}
            >
              <Database size={14} />
              {isSupabaseEnabled() ? "Banco de Dados" : "Configurar BD"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {activeCompetitions.map((code) => {
            const comp = resolveCompetition(code);
            const status = syncStatusByCompetition[code];
            const isThisSyncing = status?.isSyncing;
            const compRow = db.competitions.find(
              (c) => c.code.toUpperCase() === code.toUpperCase(),
            );
            const autoSyncEnabled = compRow?.autoSyncEnabled !== false;
            return (
              <div
                key={code}
                className={`bg-slate-900 border rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-all shadow-sm gap-4 ${
                  autoSyncEnabled
                    ? "border-slate-700 hover:border-slate-500"
                    : "border-amber-700/40 bg-amber-900/5"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full border border-slate-700 bg-white p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    <img
                      src={comp.emblem}
                      alt={comp.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm">
                        {comp.name}
                      </h3>
                      {!autoSyncEnabled && (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Pausada
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded border border-brand-green/20 w-fit mt-0.5">
                      {code}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  {/* Auto-sync toggle (por competição) */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">
                      Auto-sync
                    </span>
                    <button
                      onClick={() =>
                        void db.updateCompetitionAutoSync(code, !autoSyncEnabled)
                      }
                      title={
                        autoSyncEnabled
                          ? `Desativar auto-sync para ${comp.name}`
                          : `Ativar auto-sync para ${comp.name}`
                      }
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
                        autoSyncEnabled ? "bg-green-600" : "bg-slate-600"
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          autoSyncEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></div>
                    </button>
                  </div>

                  <div className="text-[10px] text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg flex flex-col border border-slate-700/50 min-w-[140px]">
                    <span className="uppercase font-bold tracking-wider mb-0.5">
                      Última Atualização
                    </span>
                    <span
                      className={`font-medium ${status?.lastSuccess ? "text-green-400" : "text-amber-400"}`}
                    >
                      {status?.lastSuccessAt
                        ? formatRelativeSyncTime(status.lastSuccessAt)
                        : "Nunca"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTriggerManualSync(code)}
                    disabled={isThisSyncing}
                    className="bg-brand-green hover:bg-emerald-400 text-slate-900 px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-md shadow-brand-green/10 shrink-0"
                    title={`Sincronizar ${comp.name} (manual)`}
                  >
                    {isThisSyncing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    <span className="hidden sm:inline">Sincronizar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sync Catalog Button */}
        <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Atualize o catálogo para importar logos oficiais e tipos de
            competição.
          </p>
          <button
            onClick={() => void handleSyncCatalog()}
            disabled={isSyncingCatalog}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 shrink-0"
          >
            {isSyncingCatalog ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Atualizar Catálogo
          </button>
        </div>
      </div>

      {/* TOURNAMENT AWARDS PANEL */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Award className="text-yellow-400" />
          Palpites Especiais (Resultados Oficiais)
        </h2>
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Competition Selector */}
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                Competição
              </label>
              <select
                value={selectedCompetitionCode || ""}
                onChange={(e) => setSelectedCompetitionCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
              >
                <option value="">Selecione uma competição...</option>
                {activeCompetitions.map((code) => {
                  const comp = resolveCompetition(code);
                  return (
                    <option key={code} value={code}>
                      {comp.name} ({code})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {selectedCompetitionCode && (
            <div className="space-y-4 animate-fadeIn">
              {/* Champion */}
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <label className="block text-xs font-bold text-yellow-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Trophy size={14} />
                  Seleção Campeã
                </label>
                <select
                  value={championTeamId || ""}
                  onChange={(e) => setChampionTeamId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
                >
                  <option value="">Selecione a campeã...</option>
                  <option value="null">Nenhum</option>
                  {competitionTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Scorer Name */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <Medal size={14} />
                    Artilheiro (Nome)
                  </label>
                  <input
                    type="text"
                    value={topScorerName || ""}
                    onChange={(e) => setTopScorerName(e.target.value)}
                    placeholder="Nome do artilheiro"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                  />
                </div>

                {/* Top Scorer Goals */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <Medal size={14} />
                    Artilheiro (Gols)
                  </label>
                  <input
                    type="number"
                    value={topScorerGoals || ""}
                    onChange={(e) => setTopScorerGoals(e.target.value)}
                    placeholder="Número de gols"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Best Player */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-yellow-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <Award size={14} />
                    Melhor Jogador
                  </label>
                  <input
                    type="text"
                    value={bestPlayerName || ""}
                    onChange={(e) => setBestPlayerName(e.target.value)}
                    placeholder="Nome do melhor jogador"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none placeholder:text-slate-600"
                  />
                </div>

                {/* Best Goalkeeper */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-blue-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={14} />
                    Melhor Goleiro
                  </label>
                  <input
                    type="text"
                    value={bestGoalkeeperName || ""}
                    onChange={(e) => setBestGoalkeeperName(e.target.value)}
                    placeholder="Nome do melhor goleiro"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Most Goals Team */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <Zap size={14} />
                    Mais Gols (Seleção)
                  </label>
                  <select
                    value={mostGoalsTeamId || ""}
                    onChange={(e) => setMostGoalsTeamId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Selecione a seleção...</option>
                    <option value="null">Nenhum</option>
                    {competitionTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Most Conceded Team */}
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-rose-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={14} />
                    Mais Gols Sofridos (Seleção)
                  </label>
                  <select
                    value={mostConcededTeamId || ""}
                    onChange={(e) => setMostConcededTeamId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                  >
                    <option value="">Selecione a seleção...</option>
                    <option value="null">Nenhum</option>
                    {competitionTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedCompetitionCode && (
            <div className="flex justify-end">
              <button
                onClick={handleSaveAwards}
                disabled={isSavingAwards}
                className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingAwards ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Salvar Resultados
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SPECIALS OVERRIDES PANEL (Classificados, Maior Diferença de Gols) */}
      <AdminSpecialsOverrides selectedCompetitionCode={selectedCompetitionCode} />


      {/* ZEBRA BONUS CONFIG */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Zap className="text-amber-400" />
          Configuração do Bônus Zebra
        </h2>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Define o mínimo de diferença no ranking FIFA entre as duas seleções de
          um jogo para que o palpite no time mais fraco (zebra) ative o bônus de
          underdog. Vale como padrão global para todos os grupos.
        </p>
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <label className="text-xs font-bold text-amber-400 uppercase tracking-wider shrink-0">
            Mínimo de Ranking
          </label>
          <div className="flex items-center gap-3 flex-1">
            <input
              type="number"
              min={1}
              max={100}
              value={db.systemConfig.underdog_min_rank_diff ?? 10}
              onChange={(e) =>
                db.updateSystemConfig({
                  underdog_min_rank_diff: Number(e.target.value),
                })
              }
              className="w-24 px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white text-center outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-xs text-slate-400">
              posições de diferença no ranking FIFA para ativar o bônus zebra.
            </span>
          </div>
        </div>
      </div>

      {/* GROUPS MANAGEMENT */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Settings className="text-brand-green" />
          Gerenciar Grupos
        </h2>

        {/* Create Group */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-300">Criar Novo Grupo</h3>
          <div className="grid gap-3 sm:grid-cols-12 items-end">
            <div className="sm:col-span-4">
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Nome do Grupo</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Bolão do Mesa 2026"
                className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-brand-green"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Competição</label>
              <select
                id="group-competition-select"
                value={newGroupCompetitionCode}
                onChange={(e) => setNewGroupCompetitionCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-brand-green"
              >
                {(db.competitions.length > 0
                  ? db.competitions
                  : COMPETITION_OPTIONS
                ).map((competition) => (
                  <option key={competition.code} value={competition.code}>
                    {competition.code} - {competition.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Regulamento</label>
              <select
                value={newGroupRuleset}
                onChange={(e) => setNewGroupRuleset(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-brand-green"
              >
                <option value="regulamento_1">Regulamento 1 (Padrão)</option>
                <option value="regulamento_2">Regulamento 2 (Mesa 2026)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="w-full bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus size={18} /> Criar
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed pl-2 border-l border-brand-green/30">
            {newGroupRuleset === "regulamento_1" 
              ? "Regras tradicionais: Exato (10 pts), Saldo (7 pts), Vencedor (5 pts), com Bônus Underdog."
              : "Regras especiais: Exato (15-22 pts), Saldo (13-19 pts), Vencedor (10-16 pts), Empate sem bônus saldo, Placar Sozinho (+5 pts) e palpites divididos."}
          </p>
        </div>

        {/* List Groups */}
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.length === 0 ? (
            <div className="col-span-2 text-center text-slate-500 py-4 italic border border-dashed border-slate-700 rounded-lg">
              Nenhum grupo encontrado no banco de dados.
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="bg-slate-900 border border-slate-600 rounded-lg p-4 relative group hover:border-slate-500 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white text-lg">
                    {group.name}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSelectedGroupId(group.id)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors text-xs font-bold flex items-center gap-1"
                      title="Gerenciar Membros"
                    >
                      <Settings size={14} />
                      Editar
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-sm text-brand-green tracking-wider">
                    {group.code}
                  </div>
                  <button
                    onClick={() => handleCopy(group.code, group.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedGroup === group.id ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>

                <div className="text-xs text-slate-400 mb-3">
                  Competicao:
                  <span className="font-mono text-slate-200 ml-1">
                    {(
                      group.competitionCode || DEFAULT_COMPETITION_CODE
                    ).toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
                  <Users size={14} />
                  {
                    users.filter((u) => u.groupIds.includes(group.id)).length
                  }{" "}
                  participantes
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* GLOBAL USERS MANAGEMENT */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Users className="text-blue-400" />
          Todos os Usuários
        </h2>

        <div className="space-y-4">
          {users
            .filter((u) => u.role !== "ADMIN")
            .map((user) => (
              <div
                key={user.id}
                className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <UserIdentity
                    avatarSrc={user.avatar}
                    avatarAlt={user.name}
                    avatarClassName="w-8 h-8 rounded-full"
                    avatarFallbackClassName="bg-slate-700 text-slate-300"
                    avatarIconSize={14}
                    name={user.name}
                    subtitle={user.email}
                    nameClassName="font-bold text-sm text-white"
                    subtitleClassName="text-[10px] text-slate-400"
                  />
                </div>
                <button
                  onClick={(e) => handleRemoveUserSystem(e, user)}
                  disabled={deletingUserId === user.id}
                  className={`p-2 transition-colors ${deletingUserId === user.id ? "text-red-300" : "text-slate-600 hover:text-red-400"}`}
                  title="Excluir do Sistema"
                >
                  {deletingUserId === user.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          {users.filter((u) => u.role !== "ADMIN").length === 0 && (
            <p className="text-slate-500 text-sm italic text-center">
              Nenhum usuário cadastrado além do admin.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderGroupDetailView = () => {
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group)
      return <div className="p-4 text-center">Grupo não encontrado</div>;

    const members = users.filter((u) => u.groupIds.includes(group.id));
    const nonMembers = users.filter(
      (u) => !u.groupIds.includes(group.id) && u.role !== "ADMIN",
    );

    return (
      <div className="space-y-6 pb-10">
        {/* Header / Back */}
        <button
          onClick={() => setSelectedGroupId(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          Voltar ao Painel
        </button>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex justify-between items-start border-b border-slate-700 pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {group.name}
              </h1>
              <div className="flex items-center gap-3">
                <span className="font-mono text-brand-green bg-slate-900 px-2 py-1 rounded text-sm border border-slate-700">
                  {group.code}
                </span>
                <span className="text-sm text-slate-400">
                  {members.length} membros
                </span>
              </div>
            </div>
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
              <Users size={24} className="text-brand-blue" />
            </div>
          </div>

          {/* Add Member Section */}
          <div className="bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-lg mb-8">
            <h3 className="text-sm font-bold text-indigo-300 uppercase mb-3 flex items-center gap-2">
              <UserPlus size={16} />
              Adicionar Participante
            </h3>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-green"
                onChange={(e) => {
                  if (e.target.value) {
                    onAddUserToGroup(e.target.value, group.id);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione um usuário para adicionar...
                </option>
                {nonMembers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
                {nonMembers.length === 0 && (
                  <option disabled>
                    Todos os usuários já estão neste grupo
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Members List */}
          <div className="mb-8">
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg font-bold text-white">Membros do Grupo</h3>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2 top-2 text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Buscar membro..."
                  className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white focus:outline-none focus:border-slate-500"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {members
                .filter((m) =>
                  m.name.toLowerCase().includes(userSearch.toLowerCase()),
                )
                .map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <UserIdentity
                        avatarSrc={member.avatar}
                        avatarAlt={member.name}
                        avatarClassName="w-9 h-9 rounded-full bg-slate-800"
                        avatarFallbackClassName="bg-slate-700 text-slate-300"
                        avatarIconSize={16}
                        name={
                          <>
                            {member.name}
                            {member.role === "ADMIN" && (
                              <Shield size={12} className="text-brand-blue" />
                            )}
                            {member.id === currentUser.id && (
                              <span className="text-[10px] bg-slate-700 px-1 rounded text-slate-300">
                                VOCÊ
                              </span>
                            )}
                          </>
                        }
                        subtitle={member.email}
                        nameClassName="font-semibold text-sm text-white flex items-center gap-2"
                        subtitleClassName="text-xs text-slate-500"
                      />
                    </div>

                    {member.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={(e) =>
                          handleRequestRemoveMember(e, member, group.id)
                        }
                        className="text-slate-500 hover:text-red-400 hover:bg-red-900/20 p-2 rounded transition-all cursor-pointer z-10"
                        title="Remover do Grupo"
                      >
                        <UserMinus size={18} />
                      </button>
                    )}
                  </div>
                ))}

              {members.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nenhum membro neste grupo.
                </div>
              )}
            </div>
          </div>

          {/* Zebra Bonus Override */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Zap size={16} className="text-amber-400" /> Bônus Zebra
            </h3>
            <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-3">
                Override do mínimo de diferença de ranking FIFA para ativar o bônus zebra neste grupo.
                Deixe vazio para usar o padrão global ({db.systemConfig.underdog_min_rank_diff ?? 10}).
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder={String(db.systemConfig.underdog_min_rank_diff ?? 10)}
                  value={group.underdog_min_rank_diff ?? ""}
                  onChange={async (e) => {
                    const val = e.target.value === "" ? null : Number(e.target.value);
                    await db.updateGroup(group.id, { underdog_min_rank_diff: val });
                  }}
                  className="w-24 px-2 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white text-center outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400">posições de diferença no ranking FIFA</span>
              </div>
            </div>
          </div>

          {/* DANGER ZONE */}
          <div className="mt-8 pt-6 border-t border-slate-700">
            <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              <AlertTriangle size={16} /> Zona de Perigo
            </h3>
            <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-white font-bold text-sm">
                  Excluir este grupo permanentemente
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Esta ação não pode ser desfeita. Todos os palpites e dados
                  deste grupo serão perdidos.
                </p>
              </div>
              <button
                onClick={(e) => handleRequestDeleteGroup(e, group)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Trash2 size={16} />
                Excluir Grupo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {activeView === "db_inspector"
        ? renderDbInspector()
        : selectedGroupId
          ? renderGroupDetailView()
          : renderMainView()}

      {/* DELETE GROUP CONFIRMATION MODAL */}
      {groupToDelete && (
        <ModalShell
          title={
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={24} />
              Excluir Grupo?
            </span>
          }
          onClose={() => setGroupToDelete(null)}
          maxWidthClassName="max-w-md"
          panelClassName="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl"
          contentClassName="p-6"
          footer={
            <DualActionButtons
              secondaryLabel="Cancelar"
              primaryLabel={
                <span className="inline-flex items-center justify-center gap-2">
                  {isDeleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Confirmar Exclusão
                </span>
              }
              onSecondary={() => setGroupToDelete(null)}
              onPrimary={confirmDeleteGroup}
              secondaryDisabled={isDeleting}
              primaryDisabled={isDeleting}
              primaryClassName="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          }
          footerClassName="px-6 pb-6"
        >
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            Confirmação
          </h3>

          <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-red-200 font-bold text-sm text-center">
              Você está prestes a apagar: "{groupToDelete.name}"
            </p>
          </div>

          <ul className="text-slate-300 text-sm mb-6 space-y-2 list-disc list-inside">
            <li>O grupo será apagado permanentemente.</li>
            <li>Todos os usuários serão removidos dele.</li>
            <li>
              O histórico de palpites vinculado a este grupo será perdido.
            </li>
          </ul>
        </ModalShell>
      )}

      {/* REMOVE MEMBER CONFIRMATION MODAL */}
      {memberToRemove && (
        <ModalShell
          title={
            <span className="inline-flex items-center gap-2">
              <UserMinus className="text-orange-500" size={24} />
              Remover Membro?
            </span>
          }
          onClose={() => setMemberToRemove(null)}
          maxWidthClassName="max-w-md"
          panelClassName="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl"
          contentClassName="p-6"
          footer={
            <DualActionButtons
              secondaryLabel="Cancelar"
              primaryLabel={
                <span className="inline-flex items-center justify-center gap-2">
                  {isRemovingMember ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Confirmar Remoção"
                  )}
                </span>
              }
              onSecondary={() => setMemberToRemove(null)}
              onPrimary={confirmRemoveMember}
              secondaryDisabled={isRemovingMember}
              primaryDisabled={isRemovingMember}
              primaryClassName="flex-1 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          }
          footerClassName="px-6 pb-6"
        >
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            Confirmação
          </h3>

          <div className="bg-orange-900/20 border border-orange-500/20 rounded-lg p-4 mb-4 flex items-center gap-3">
            <UserIdentity
              avatarSrc={memberToRemove.user.avatar}
              avatarAlt={memberToRemove.user.name}
              avatarClassName="w-10 h-10 rounded-full"
              avatarFallbackClassName="bg-slate-700 text-orange-200"
              avatarIconSize={18}
              name={memberToRemove.user.name}
              subtitle={memberToRemove.user.email}
              nameClassName="text-orange-200 font-bold text-sm"
              subtitleClassName="text-xs text-orange-200/70"
            />
          </div>

          <p className="text-slate-300 text-sm mb-6">
            Este usuário perderá o acesso a este grupo e seus palpites neste
            contexto não serão mais contabilizados para o ranking do grupo.
          </p>
        </ModalShell>
      )}
    </>
  );
};

export default AdminDashboard;
