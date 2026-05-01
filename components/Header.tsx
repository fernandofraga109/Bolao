import React from "react";
import { User } from "../types";
import { Trophy, Shield, Star } from "lucide-react";
import AvatarWithFallback from "./ui/AvatarWithFallback";

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateAvatar?: (url: string) => Promise<{ success: boolean; message?: string }>;
  userPoints?: number;
  userRank?: number;
}

const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onUpdateAvatar,
  userPoints = 0,
  userRank = 0,
}) => {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = React.useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = React.useState(currentUser.avatar || "");
  const [isUpdatingAvatar, setIsUpdatingAvatar] = React.useState(false);

  const handleSaveAvatar = async () => {
    if (!onUpdateAvatar || !newAvatarUrl) return;
    setIsUpdatingAvatar(true);
    await onUpdateAvatar(newAvatarUrl);
    setIsUpdatingAvatar(false);
    setIsAvatarModalOpen(false);
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
                onClick={() => { setNewAvatarUrl(currentUser.avatar || ""); setIsAvatarModalOpen(true); }}
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
            <h2 className="text-2xl font-black mb-6 text-white tracking-tight">FOTO DE PERFIL</h2>
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
            <div className="mb-8">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">URL da Imagem</label>
              <input
                type="text"
                value={newAvatarUrl}
                onChange={(e) => setNewAvatarUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-green transition-all"
                placeholder="https://..."
              />
              <p className="text-[10px] text-slate-600 mt-3 font-bold uppercase tracking-tighter">
                DICA: Use URLs de imagens públicas (Discord, GitHub, etc).
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
                disabled={isUpdatingAvatar}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveAvatar()}
                disabled={isUpdatingAvatar || !newAvatarUrl}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-brand-green text-brand-dark hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isUpdatingAvatar ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
