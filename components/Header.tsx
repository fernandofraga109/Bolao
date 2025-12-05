import React from 'react';
import { User } from '../types';
import { Trophy, Zap, Shield } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  onSimulate: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, onSimulate }) => {
  return (
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
              <span className="text-xs font-bold text-white">{currentUser.name}</span>
              <span className={`text-[10px] ${currentUser.role === 'ADMIN' ? 'text-brand-blue font-bold flex items-center gap-1' : 'text-slate-400'}`}>
                  {currentUser.role === 'ADMIN' ? <><Shield size={10} /> Admin</> : 'Participante'}
              </span>
            </div>
            <img src={currentUser.avatar} alt="Me" className={`w-8 h-8 rounded-full border ${currentUser.role === 'ADMIN' ? 'border-brand-blue' : 'border-slate-600'}`} />
            <button onClick={onLogout} className="text-xs text-red-400 hover:text-red-300 ml-2">Sair</button>
            
            {/* Sim Button */}
            <button 
              onClick={onSimulate}
              className="ml-2 text-slate-600 hover:text-brand-green"
              title="Simular"
            >
              <Zap size={14} />
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;