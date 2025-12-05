import React from 'react';
import { Trophy } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  availableUsers: User[];
}

const Login: React.FC<LoginProps> = ({ onLogin, availableUsers }) => {
  // We simulate the Google Login by picking the 'me' user (Admin) by default,
  // but allow testing other users for development.

  const handleGoogleLogin = () => {
    // In a real app, this would trigger Google Auth Provider
    // For now, we log in as the main admin
    const admin = availableUsers.find(u => u.id === 'me') || availableUsers[0];
    onLogin(admin);
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 text-center">
        
        <div className="flex justify-center mb-6">
          <div className="bg-brand-green w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-green/20">
            <Trophy size={40} className="text-brand-dark" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Bolão Copa 2026</h1>
        <p className="text-slate-400 mb-8">Faça login para participar e gerenciar seus palpites.</p>

        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-white text-slate-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Entrar com Google
        </button>

        {/* Development Helper: Quick Login as other users */}
        <div className="border-t border-slate-700 pt-6 mt-6">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Modo de Teste: Entrar como</p>
          <div className="flex flex-wrap gap-2 justify-center">
             {availableUsers.filter(u => u.id !== 'me').map(u => (
                 <button
                    key={u.id}
                    onClick={() => onLogin(u)}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-full transition-colors"
                 >
                     {u.name} ({u.role})
                 </button>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;