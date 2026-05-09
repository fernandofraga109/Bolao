import React from "react";
import { Trophy } from "lucide-react";

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-brand-dark animate-fadeIn">
      <div className="relative">
        {/* Animated Rings */}
        <div className="absolute inset-0 rounded-2xl bg-brand-green/20 animate-ping scale-150"></div>
        <div className="absolute inset-0 rounded-2xl bg-brand-blue/10 animate-ping delay-300 scale-125"></div>
        
        {/* Logo Container */}
        <div className="relative bg-brand-green w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-green/40 animate-bounce-slow">
          <Trophy size={48} className="text-brand-dark" />
        </div>
      </div>
      
      <div className="mt-12 text-center">
        <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
          BOLÃO <span className="text-brand-green">2026</span>
        </h1>
        <div className="flex items-center gap-1.5 justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-bounce"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-bounce delay-150"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-bounce delay-300"></div>
        </div>
        <p className="mt-8 text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">
          Sincronizando placares...
        </p>
      </div>
      
      {/* Bottom info */}
      <div className="absolute bottom-10 text-slate-600 text-[10px] font-mono">
        PREMIUM EDITION • v2.0.0
      </div>
      
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
