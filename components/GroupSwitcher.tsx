import React, { useState } from 'react';
import { Group } from '../types';
import { Check, PlusCircle, Hash, X, ArrowRight, Copy } from 'lucide-react';

interface GroupSwitcherProps {
  myGroups: Group[];
  activeGroupId?: string;
  onSwitch: (groupId: string) => void;
  onCreate: (name: string) => void;
  onJoin: (code: string) => void;
  onClose: () => void;
  error?: string | null;
}

type ViewMode = 'list' | 'create' | 'join';

const GroupSwitcher: React.FC<GroupSwitcherProps> = ({ 
    myGroups, 
    activeGroupId, 
    onSwitch, 
    onCreate, 
    onJoin, 
    onClose,
    error 
}) => {
  const [mode, setMode] = useState<ViewMode>('list');
  const [inputVal, setInputVal] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAction = () => {
      if (!inputVal.trim()) return;
      if (mode === 'create') onCreate(inputVal);
      if (mode === 'join') onJoin(inputVal);
  };

  const handleCopy = (code: string, groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-800 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="font-bold text-white text-lg">
                {mode === 'list' && 'Meus Grupos'}
                {mode === 'create' && 'Criar Novo Grupo'}
                {mode === 'join' && 'Entrar em Grupo'}
            </h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700 text-slate-400 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="p-4">
            {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-200 text-sm px-3 py-2 rounded">
                    {error}
                </div>
            )}

            {mode === 'list' && (
                <div className="space-y-4">
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {myGroups.length === 0 && (
                            <p className="text-slate-500 text-center py-4 text-sm">Você não está em nenhum grupo.</p>
                        )}
                        {myGroups.map(group => {
                            const isActive = activeGroupId === group.id;
                            const isCopied = copiedId === group.id;

                            return (
                                <div
                                    key={group.id}
                                    className={`w-full flex items-center justify-between p-2 pl-3 pr-2 rounded-xl border transition-all ${
                                        isActive 
                                        ? 'bg-brand-green/10 border-brand-green ring-1 ring-brand-green' 
                                        : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700/80'
                                    }`}
                                >
                                    <button 
                                        onClick={() => onSwitch(group.id)}
                                        className="flex-1 text-left flex flex-col justify-center h-full py-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`font-semibold ${isActive ? 'text-brand-green' : 'text-slate-200'}`}>
                                                {group.name}
                                            </span>
                                            {isActive && (
                                                <span className="bg-brand-green text-slate-900 text-[10px] font-bold px-1.5 rounded">ATIVO</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500 font-mono tracking-wider mt-0.5">#{group.code}</span>
                                    </button>

                                    <button
                                        onClick={(e) => handleCopy(group.code, group.id, e)}
                                        className={`p-2 rounded-lg border transition-colors ml-2 flex-shrink-0 ${
                                            isCopied 
                                                ? 'bg-brand-green text-slate-900 border-brand-green'
                                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Copiar código do grupo"
                                    >
                                        {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="border-t border-slate-700 pt-4 grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setMode('create')}
                            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                        >
                            <PlusCircle size={24} />
                            <span className="text-xs font-bold">Criar Novo</span>
                        </button>
                        <button 
                             onClick={() => setMode('join')}
                             className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                        >
                            <Hash size={24} />
                            <span className="text-xs font-bold">Entrar c/ Código</span>
                        </button>
                    </div>
                </div>
            )}

            {mode !== 'list' && (
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
                            {mode === 'create' ? 'Nome do Grupo' : 'Código do Grupo'}
                        </label>
                        <input 
                            type="text"
                            autoFocus
                            value={inputVal}
                            onChange={(e) => setInputVal(mode === 'join' ? e.target.value.toUpperCase() : e.target.value)}
                            placeholder={mode === 'create' ? "Ex: Bolão da Firma" : "Ex: COPA26"}
                            className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
                            onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                        />
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setMode('list'); setInputVal(''); }}
                            className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm transition-colors"
                        >
                            Voltar
                        </button>
                        <button 
                            onClick={handleAction}
                            disabled={!inputVal.trim()}
                            className="flex-1 py-3 rounded-lg bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mode === 'create' ? 'Criar' : 'Entrar'}
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default GroupSwitcher;