import React from 'react';
import { Tab, UserRole } from '../types';
import { Calendar, Trophy, ShieldCheck, Table2, Activity } from 'lucide-react';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  userRole: UserRole;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, userRole }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe z-40">
      <div className="max-w-2xl mx-auto flex justify-around">
        <button 
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center justify-center w-full py-3 gap-1 transition-colors ${activeTab === 'matches' ? 'text-brand-green font-black' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Calendar size={20} strokeWidth={activeTab === 'matches' ? 3 : 2} />
          <span className="text-[10px] uppercase tracking-widest font-black">Jogos</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('tournament')}
          className={`flex flex-col items-center justify-center w-full py-3 gap-1 transition-colors ${activeTab === 'tournament' ? 'text-brand-green font-black' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Table2 size={20} strokeWidth={activeTab === 'tournament' ? 3 : 2} />
          <span className="text-[10px] uppercase tracking-widest font-black">Tabela</span>
        </button>

        {userRole !== 'ADMIN' && (
          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`flex flex-col items-center justify-center w-full py-3 gap-1 transition-colors ${activeTab === 'leaderboard' ? 'text-brand-green font-black' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Trophy size={20} strokeWidth={activeTab === 'leaderboard' ? 3 : 2} />
            <span className="text-[10px] uppercase tracking-widest font-black">Rank</span>
          </button>
        )}

        {userRole !== 'ADMIN' && (
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center justify-center w-full py-3 gap-1 transition-colors ${activeTab === 'stats' ? 'text-brand-green font-black' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Activity size={20} strokeWidth={activeTab === 'stats' ? 3 : 2} />
            <span className="text-[10px] uppercase tracking-widest font-black">Stats</span>
          </button>
        )}

        {userRole === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center justify-center w-full py-3 gap-1 transition-colors ${activeTab === 'admin' ? 'text-brand-green font-black' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <ShieldCheck size={20} strokeWidth={activeTab === 'admin' ? 3 : 2} />
              <span className="text-[10px] uppercase tracking-widest font-black">Admin</span>
            </button>
        )}
      </div>
    </nav>
  );
};

export default BottomNav;