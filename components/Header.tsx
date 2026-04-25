import React from "react";
import { User } from "../types";
import { Trophy, Zap, Shield, Loader2 } from "lucide-react";
import AvatarWithFallback from "./ui/AvatarWithFallback";

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateAvatar?: (url: string) => Promise<{ success: boolean; message?: string }>;
}

const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onUpdateAvatar,
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
      <header className="sticky top-0 z-40 bg-brand-dark/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-brand-green w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-brand-green/20">
            <Trophy size={18} className="text-brand-dark" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Bolão Copa 2026</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-white">
              {currentUser.name}
            </span>
            <span
              className={`text-[10px] ${currentUser.role === "ADMIN" ? "text-brand-blue font-bold flex items-center gap-1" : "text-slate-400"}`}
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
            className="hover:opacity-80 transition-opacity focus:outline-none rounded-full"
            title="Mudar foto de perfil"
          >
            <AvatarWithFallback
              src={currentUser.avatar}
              alt="Me"
              className={`w-8 h-8 rounded-full border ${currentUser.role === "ADMIN" ? "border-brand-blue" : "border-slate-600"}`}
              fallbackClassName={`bg-slate-800 ${currentUser.role === "ADMIN" ? "text-brand-blue" : "text-slate-300"}`}
              iconSize={14}
            />
          </button>
          <button
            onClick={onLogout}
            className="text-xs text-red-400 hover:text-red-300 ml-2"
          >
            Sair
          </button>
        </div>
        </div>
      </header>

      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4 text-white">Atualizar Foto de Perfil</h2>
            <div className="mb-6 flex justify-center">
               <AvatarWithFallback
                 src={newAvatarUrl}
                 alt="Preview"
                 className="w-20 h-20 rounded-full border-2 border-brand-green object-cover"
                 fallbackClassName="bg-slate-800 text-slate-300"
                 iconSize={32}
               />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 mb-1">URL da Imagem</label>
              <input
                type="text"
                value={newAvatarUrl}
                onChange={(e) => setNewAvatarUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-green"
                placeholder="https://exemplo.com/foto.jpg"
              />
              <p className="text-xs text-slate-500 mt-2">
                Você pode colar a URL de qualquer imagem pública.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="flex-1 py-2 rounded-lg font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                disabled={isUpdatingAvatar}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveAvatar()}
                disabled={isUpdatingAvatar || !newAvatarUrl}
                className="flex-1 py-2 rounded-lg font-bold bg-brand-green text-slate-900 hover:bg-emerald-400 transition-colors disabled:opacity-50"
              >
                {isUpdatingAvatar ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
