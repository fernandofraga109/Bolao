
import React, { useState } from 'react';
import { Users, PlusCircle, ArrowRight, Hash, LogOut } from 'lucide-react';
import { User } from '../types';

interface GroupSelectionProps {
  user: User;
  onCreateGroup: (name: string) => void;
  onJoinGroup: (code: string) => void;
  onLogout: () => void;
  error?: string | null;
}

const GroupSelection: React.FC<GroupSelectionProps> = ({ user, onCreateGroup, onJoinGroup, onLogout, error }) => {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = () => {
    if (!inputVal.trim()) return;
    
    if (mode === 'create') {
      onCreateGroup(inputVal);
    } else {
      onJoinGroup(inputVal);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 text-center animate-fadeIn relative">
        
        {/* Logout Button */}
        <button 
            onClick={onLogout}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-full transition-colors"
            title="Sair / Logout"
        >
            <LogOut size={20} />
        </button>

        <div className="flex justify-center mb-6">
          <div className="relative">
            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full border-2 border-brand-green" />
            <div className="absolute -bottom-2 -right-2 bg-brand-green text-brand-dark p-1.5 rounded-full">
                <Users size={16} />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Bem-vindo, {user.name.split(' ')[0]}!</h1>
        <p className="text-slate-400 mb-8 text-sm">Para começar, você precisa fazer parte de um bolão.</p>

        {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 text-sm px-4 py-2 rounded-lg mb-6">
                {error}
            </div>
        )}

        {mode === 'menu' && (
          <div className="space-y-4">
            <button 
              onClick={() => setMode('create')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg">
                    <PlusCircle size={24} />
                </div>
                <div className="text-left">
                    <span className="block">Criar Novo Grupo</span>
                    <span className="text-xs font-normal text-indigo-200">Seja o admin e convide amigos</span>
                </div>
              </div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button 
              onClick={() => setMode('join')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg">
                    <Hash size={24} />
                </div>
                <div className="text-left">
                    <span className="block">Entrar com Código</span>
                    <span className="text-xs font-normal text-slate-400">Já tem um convite?</span>
                </div>
              </div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        )}

        {mode !== 'menu' && (
          <div className="animate-slideIn">
            <div className="text-left mb-2">
                <label className="text-xs font-bold text-slate-400 uppercase">
                    {mode === 'create' ? 'Nome do Grupo' : 'Código do Grupo'}
                </label>
            </div>
            
            <input 
                type="text"
                autoFocus
                value={inputVal}
                onChange={(e) => setInputVal(mode === 'join' ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={mode === 'create' ? "Ex: Bolão da Família" : "Ex: COPA26"}
                className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green mb-6 text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />

            <button 
                onClick={handleSubmit}
                disabled={!inputVal.trim()}
                className="w-full bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {mode === 'create' ? 'Criar Grupo' : 'Entrar no Grupo'}
                <ArrowRight size={18} />
            </button>
            
            <button 
                onClick={() => { setMode('menu'); setInputVal(''); }}
                className="mt-4 text-slate-500 hover:text-slate-300 text-sm"
            >
                Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupSelection;
