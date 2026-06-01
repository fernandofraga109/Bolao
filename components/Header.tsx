import React from "react";
import { User } from "../types";
import { Trophy, Shield, Star, RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import AvatarWithFallback from "./ui/AvatarWithFallback";
import AvatarPicker from "./ui/AvatarPicker";

interface SyncInfo {
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  lastSuccess?: boolean;
  lastMessage?: string;
  isSyncing?: boolean;
}

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateProfile?: (name: string, url: string) => Promise<{ success: boolean; message?: string }>;
  userPoints?: number;
  userRank?: number;
  syncInfo?: SyncInfo;
  competitionLastSync?: string;
}

const formatRelative = (iso?: string): string => {
  if (!iso) return "Nunca";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
};

const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onUpdateProfile,
  userPoints = 0,
  userRank = 0,
  syncInfo,
  competitionLastSync,
}) => {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = React.useState(false);
  const [newName, setNewName] = React.useState(currentUser.name || "");
  const [newAvatarUrl, setNewAvatarUrl] = React.useState(currentUser.avatar || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [isFetchingGravatar, setIsFetchingGravatar] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  // SHA-256 hash for Gravatar support
  const getGravatarHash = async (email: string) => {
    const msgBuffer = new TextEncoder().encode(email.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const isGeneratedAvatar = (url: string) =>
    url.includes("ui-avatars.com/api/") || url.includes("api.dicebear.com");

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewName(val);

    // Se o avatar atual for gerado automaticamente, regenera com o novo nome
    if (!newAvatarUrl || isGeneratedAvatar(newAvatarUrl)) {
      setNewAvatarUrl(
        `https://ui-avatars.com/api/?name=${encodeURIComponent(val)}&background=random&color=fff&size=128`
      );
    }
  };

  const handleUseGravatar = async () => {
    if (!currentUser.email) return;
    setIsFetchingGravatar(true);
    try {
      const hash = await getGravatarHash(currentUser.email);
      // d=identicon generates a unique pattern if they don't have a gravatar account
      setNewAvatarUrl(`https://www.gravatar.com/avatar/${hash}?d=identicon&s=400`);
    } catch (e) {
      console.error("Erro ao gerar Gravatar:", e);
    } finally {
      setIsFetchingGravatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!onUpdateProfile) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setErrorMessage("O nome não pode ser vazio.");
      return;
    }
    setIsUpdatingProfile(true);
    setErrorMessage("");
    try {
      const res = await onUpdateProfile(trimmedName, newAvatarUrl.trim());
      if (res.success) {
        setIsAvatarModalOpen(false);
      } else {
        setErrorMessage(res.message || "Erro ao atualizar perfil.");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Erro ao atualizar perfil.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  
  return (
    <>
      <header className="sticky top-0 z-40 bg-brand-dark/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="max-w-2xl mx-auto px-5 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-green to-emerald-600 w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-green/20 rotate-3">
              <Trophy size={20} className="text-brand-dark" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-lg tracking-tighter text-white leading-none">BOLÃO</h1>
              <span className="text-[10px] font-black text-brand-green tracking-[0.2em] leading-none mt-1">2026</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {currentUser.role !== "ADMIN" && (
              <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-white/10">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pontos</span>
                  <span className="text-sm font-black text-brand-green leading-none">{userPoints}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rank</span>
                  <div className="flex items-center gap-1">
                    <Star size={10} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-black text-white leading-none">{userRank}º</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs font-black text-white tracking-tight leading-none">
                  {currentUser.name}
                </span>
                <span
                  className={`text-[9px] font-black uppercase tracking-widest mt-1 ${currentUser.role === "ADMIN" ? "text-brand-blue flex items-center gap-1" : "text-slate-500"}`}
                >
                  {currentUser.role === "ADMIN" ? (
                    <>
                      <Shield size={10} /> Admin
                    </>
                  ) : (
                    "Participante"
                  )}
                </span>
              </div>
              
              <button 
                onClick={() => { 
                  setNewName(currentUser.name || "");
                  setNewAvatarUrl(currentUser.avatar || ""); 
                  setErrorMessage("");
                  setIsAvatarModalOpen(true); 
                }}
                className="relative group focus:outline-none"
              >
                <AvatarWithFallback
                  src={currentUser.avatar}
                  alt="Me"
                  className={`w-10 h-10 rounded-2xl border-2 transition-all group-hover:scale-105 group-hover:rotate-3 ${currentUser.role === "ADMIN" ? "border-brand-blue shadow-lg shadow-brand-blue/20" : "border-slate-700 shadow-xl"}`}
                  fallbackClassName={`bg-slate-800 ${currentUser.role === "ADMIN" ? "text-brand-blue" : "text-slate-300"}`}
                  iconSize={18}
                />
                <div className="absolute inset-0 rounded-2xl bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Star size={12} className="text-white" />
                </div>
              </button>
            </div>
            
            <button
              onClick={onLogout}
              className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest ml-1 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-2xl font-black mb-6 text-white tracking-tight">EDITAR PERFIL</h2>

            {currentUser.role !== "ADMIN" && (
              <div className="flex items-center justify-center gap-8 mb-6 pb-6 border-b border-slate-800">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pontos</span>
                  <span className="text-2xl font-black text-brand-green">{userPoints}</span>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rank</span>
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-black text-white">{userRank}º</span>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-900/50 rounded-xl text-xs text-red-400 font-bold text-center">
                {errorMessage}
              </div>
            )}

            <div className="mb-8 flex justify-center">
               <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-brand-green/20 blur-xl animate-pulse"></div>
                  <AvatarWithFallback
                    src={newAvatarUrl}
                    alt="Preview"
                    className="relative w-24 h-24 rounded-full border-4 border-brand-green object-cover shadow-2xl"
                    fallbackClassName="bg-slate-800 text-slate-300"
                    iconSize={40}
                  />
               </div>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nome</label>
              <input
                type="text"
                value={newName}
                onChange={handleNameChange}
                disabled={isUpdatingProfile}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-green transition-all disabled:opacity-50"
                placeholder="Seu nome"
              />
            </div>

            <div className="mb-5">
              <AvatarPicker
                name={newName}
                selectedUrl={newAvatarUrl}
                onSelect={(url) => setNewAvatarUrl(url)}
              />
            </div>

            <div className="mb-8">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">URL da Imagem</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAvatarUrl}
                  onChange={(e) => setNewAvatarUrl(e.target.value)}
                  disabled={isUpdatingProfile}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-green transition-all disabled:opacity-50"
                  placeholder="https://..."
                />
              </div>
              <div className="mt-3 flex justify-between items-center">
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">
                  DICA: Cole o link ou use o Gravatar.
                </p>
                <button
                  onClick={handleUseGravatar}
                  disabled={isFetchingGravatar || isUpdatingProfile}
                  className="text-[10px] font-black text-brand-blue uppercase tracking-widest hover:text-blue-400 transition-colors disabled:opacity-50"
                >
                  {isFetchingGravatar ? "Buscando..." : "Usar Gravatar"}
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
                disabled={isUpdatingProfile}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveProfile()}
                disabled={isUpdatingProfile || !newName.trim() || !newAvatarUrl}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-brand-green text-brand-dark hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isUpdatingProfile ? "Salvando..." : "Confirmar"}
              </button>
            </div>

            {/* Sync Status Panel */}
            {(syncInfo || competitionLastSync) && (
              <div className="mt-6 border-t border-slate-800 pt-5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Clock size={10} />
                  Sincronização de Dados
                </p>
                <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-2.5">
                  {/* Last sync time */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold">Última atualização</span>
                    <span className="text-[11px] font-black text-slate-300">
                      {formatRelative(competitionLastSync || syncInfo?.lastSuccessAt)}
                    </span>
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold">Status</span>
                    <div className="flex items-center gap-1.5">
                      {syncInfo?.isSyncing ? (
                        <>
                          <RefreshCw size={11} className="text-brand-blue animate-spin" />
                          <span className="text-[11px] font-black text-brand-blue">Sincronizando</span>
                        </>
                      ) : syncInfo?.lastSuccess === true ? (
                        <>
                          <CheckCircle2 size={11} className="text-brand-green" />
                          <span className="text-[11px] font-black text-brand-green">Atualizado</span>
                        </>
                      ) : syncInfo?.lastSuccess === false ? (
                        <>
                          <AlertTriangle size={11} className="text-amber-400" />
                          <span className="text-[11px] font-black text-amber-400">Aguardando</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-slate-600" />
                          <span className="text-[11px] font-black text-slate-500">Sem dados</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Next sync info */}
                  <div className="flex items-center justify-between border-t border-slate-800/60 pt-2.5">
                    <span className="text-[11px] text-slate-500 font-bold">Próxima atualização</span>
                    <span className="text-[11px] font-black text-slate-400">Automático</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
