import React, { useEffect, useState } from 'react';
import { Trophy, AlertTriangle } from 'lucide-react';
import { User } from '../types';

declare global {
    interface Window {
        google: any;
    }
}

interface LoginProps {
  onLogin: (user: User) => void;
  availableUsers: User[];
}

const Login: React.FC<LoginProps> = ({ onLogin, availableUsers }) => {
  const [error, setError] = useState<string | null>(null);

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER";

  // Helper to decode JWT without external libraries
  const parseJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
  };

  const handleCredentialResponse = (response: any) => {
      const payload = parseJwt(response.credential);
      
      if (payload) {
          const googleUser: User = {
              id: payload.sub,
              name: payload.name,
              email: payload.email,
              avatar: payload.picture,
              role: 'USER', // Default role
              status: 'ACTIVE',
              groupIds: [],
              activeGroupId: undefined,
              predictions: {},
              totalPoints: 0
          };
          onLogin(googleUser);
      } else {
          setError("Falha ao processar login do Google.");
      }
  };

  useEffect(() => {
    // Check if Google script is loaded
    if (window.google && window.google.accounts) {
        try {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleCredentialResponse
            });
            
            window.google.accounts.id.renderButton(
                document.getElementById("googleBtn"),
                { theme: "outline", size: "large", width: "100%", text: "signin_with" } 
            );
        } catch (e) {
            console.error("Google Sign-In Error", e);
            setError("Erro ao inicializar Google Sign-In. Verifique o Client ID.");
        }
    } else {
        // Fallback or wait logic could go here, usually script loads fast enough
        const interval = setInterval(() => {
            if (window.google && window.google.accounts) {
                clearInterval(interval);
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse
                });
                window.google.accounts.id.renderButton(
                    document.getElementById("googleBtn"),
                    { theme: "outline", size: "large", width: "100%", text: "signin_with" } 
                );
            }
        }, 500);
        return () => clearInterval(interval);
    }
  }, []);

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

        {/* Google Button Container */}
        <div className="w-full flex justify-center mb-6 min-h-[50px]">
            <div id="googleBtn" className="w-full"></div>
        </div>

        {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-200 text-sm px-4 py-2 rounded-lg flex items-center gap-2 justify-center">
                <AlertTriangle size={16} />
                {error}
            </div>
        )}

        {GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER" && (
             <p className="text-[10px] text-yellow-500 mb-4 bg-yellow-900/20 p-2 rounded border border-yellow-700/30">
                Aviso Dev: Configure <code>process.env.GOOGLE_CLIENT_ID</code> para o botão funcionar.
             </p>
        )}

        {/* Development Helper: Quick Login as other users */}
        <div className="border-t border-slate-700 pt-6 mt-6">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Modo de Teste (Dev Only)</p>
          <div className="flex flex-wrap gap-2 justify-center">
             {availableUsers.map(u => (
                 <button
                    key={u.id}
                    onClick={() => onLogin(u)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${u.role === 'ADMIN' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
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