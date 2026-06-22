import React from 'react';
import { Tab, UserRole } from '../types';
import { Calendar, Trophy, ShieldCheck, Table2, Activity, Sparkles, Clapperboard, MessageSquare } from 'lucide-react';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  userRole: UserRole;
}

const NavButton: React.FC<{
  tab: Tab;
  activeTab: Tab;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ tab, activeTab, onClick, icon, label }) => {
  const isActive = activeTab === tab;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-2.5 sm:py-3 gap-1 transition-colors ${isActive ? 'text-brand-green font-black' : 'text-slate-500 hover:text-slate-300'}`}
    >
      {isActive && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-brand-green rounded-full" />
      )}
      {icon}
      {/* clamp() scales the label with viewport width so 6 tabs never overflow
          on narrow phones (≤360px) while keeping the spaced look on wider screens.
          truncate is a final safety net; tracking is relaxed on mobile to fit. */}
      <span className="w-full text-center truncate leading-none uppercase font-black text-[clamp(8px,2.4vw,10px)] tracking-normal sm:text-[10px] sm:tracking-widest">
        {label}
      </span>
    </button>
  );
};

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, userRole }) => {
  return (
    // Sobe o conteúdo do nav: mínimo de 10px sempre, e o recorte da safe area
    // (notch/home indicator) em telas curvas. Antes usava `pb-safe`, que não
    // existe neste projeto (Tailwind via CDN) → ficava sem padding e os labels
    // ("Jogos"/"Stats") encostavam na borda curva.
    <nav
      className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      <div className="max-w-2xl mx-auto flex justify-around">
        <NavButton
          tab="matches"
          activeTab={activeTab}
          onClick={() => setActiveTab('matches')}
          icon={<Calendar size={20} strokeWidth={activeTab === 'matches' ? 3 : 2} />}
          label="Jogos"
        />
        <NavButton
          tab="tournament"
          activeTab={activeTab}
          onClick={() => setActiveTab('tournament')}
          icon={<Table2 size={20} strokeWidth={activeTab === 'tournament' ? 3 : 2} />}
          label="Tabela"
        />
        {userRole !== 'ADMIN' && (
          <NavButton
            tab="specials"
            activeTab={activeTab}
            onClick={() => setActiveTab('specials')}
            icon={<Sparkles size={20} strokeWidth={activeTab === 'specials' ? 3 : 2} />}
            label="Especiais"
          />
        )}
        {userRole !== 'ADMIN' && (
          <NavButton
            tab="leaderboard"
            activeTab={activeTab}
            onClick={() => setActiveTab('leaderboard')}
            icon={<Trophy size={20} strokeWidth={activeTab === 'leaderboard' ? 3 : 2} />}
            label="Rank"
          />
        )}
        {userRole !== 'ADMIN' && (
          <NavButton
            tab="stats"
            activeTab={activeTab}
            onClick={() => setActiveTab('stats')}
            icon={<Activity size={20} strokeWidth={activeTab === 'stats' ? 3 : 2} />}
            label="Stats"
          />
        )}
        {userRole === 'ADMIN' && (
          <NavButton
            tab="animations"
            activeTab={activeTab}
            onClick={() => setActiveTab('animations')}
            icon={<Clapperboard size={20} strokeWidth={activeTab === 'animations' ? 3 : 2} />}
            label="Animações"
          />
        )}
        {userRole === 'ADMIN' && (
          <NavButton
            tab="polls"
            activeTab={activeTab}
            onClick={() => setActiveTab('polls')}
            icon={<MessageSquare size={20} strokeWidth={activeTab === 'polls' ? 3 : 2} />}
            label="Enquetes"
          />
        )}
        {userRole === 'ADMIN' && (
          <NavButton
            tab="admin"
            activeTab={activeTab}
            onClick={() => setActiveTab('admin')}
            icon={<ShieldCheck size={20} strokeWidth={activeTab === 'admin' ? 3 : 2} />}
            label="Admin"
          />
        )}
      </div>
    </nav>
  );
};

export default BottomNav;