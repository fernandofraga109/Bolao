import React, { useState } from "react";
import {
  Trophy,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  Hash,
  LogIn,
  UserPlus,
} from "lucide-react";
import { User, Group } from "../types";
import { isSupabaseEnabled } from "../services/supabase";

interface LoginProps {
  onLogin: (user: User) => void;
  availableUsers: User[];
  onRegister: (
    name: string,
    email: string,
    pass: string,
    code: string,
  ) => Promise<{ success: boolean; message?: string }>;
  onAuth: (
    email: string,
    pass: string,
  ) => Promise<{ success: boolean; message?: string; user?: User }>;
}

type AuthMode = "LOGIN" | "REGISTER";

const Login: React.FC<LoginProps> = ({
  onLogin,
  availableUsers,
  onRegister,
  onAuth,
}) => {
  const isSupabaseAuthEnabled = isSupabaseEnabled();
  const [mode, setMode] = useState<AuthMode>("LOGIN");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login Form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  // Register Form
  const [regCode, setRegCode] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const resolved = await onAuth(loginEmail, loginPass);
    if (resolved.success && resolved.user) {
      onLogin(resolved.user);
      return;
    }

    setError(resolved.message || "Erro ao entrar.");
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);

    if (
      !regCode.trim() ||
      !regName.trim() ||
      !regEmail.trim() ||
      !regPass.trim()
    ) {
      setError("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    const result = await onRegister(regName, regEmail, regPass, regCode);
    if (result.success) {
      // Auto login happens inside onRegister wrapper usually, or we do nothing as App.tsx handles state
      return;
    }

    setError(result.message || "Erro ao cadastrar.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-green/20 to-brand-blue/20 p-8 text-center border-b border-slate-700">
          <div className="flex justify-center mb-4">
            <div className="bg-brand-green w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-brand-green/20">
              <Trophy size={32} className="text-brand-dark" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Bolão Copa 2026
          </h1>
          <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
            Faça sua aposta
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => {
              setMode("LOGIN");
              setError(null);
            }}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === "LOGIN" ? "text-brand-green bg-slate-800" : "text-slate-500 bg-slate-900/50 hover:bg-slate-800"}`}
          >
            <LogIn size={16} /> Entrar
          </button>
          <button
            onClick={() => {
              setMode("REGISTER");
              setError(null);
            }}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === "REGISTER" ? "text-brand-green bg-slate-800" : "text-slate-500 bg-slate-900/50 hover:bg-slate-800"}`}
          >
            <UserPlus size={16} /> Primeiro Acesso
          </button>
        </div>

        {/* Form Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-200 text-sm px-4 py-3 rounded-lg flex items-start gap-3">
              <div className="mt-0.5 min-w-[16px]">⚠️</div>
              <span>{error}</span>
            </div>
          )}

          {mode === "LOGIN" ? (
            <form onSubmit={handleLogin} className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  E-mail ou Usuário
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-3 text-slate-500"
                    size={18}
                  />
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    placeholder="seu@email.com ou admin"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-3 text-slate-500"
                    size={18}
                  />
                  <input
                    type="password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    placeholder="••••••"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold py-3.5 rounded-xl transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Entrando..." : "Entrar"} <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleRegister}
              className="space-y-4 animate-fadeIn"
            >
              <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-lg mb-4 text-xs text-indigo-200">
                Insira o código do grupo que você recebeu para criar seu acesso.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  Código do Grupo
                </label>
                <div className="relative">
                  <Hash
                    className="absolute left-3 top-3 text-indigo-400"
                    size={18}
                  />
                  <input
                    type="text"
                    required
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-indigo-500/50 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-mono tracking-wider uppercase placeholder:normal-case placeholder:font-sans"
                    placeholder="Ex: ABCDE12345"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <UserIcon
                    className="absolute left-3 top-3 text-slate-500"
                    size={18}
                  />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-brand-green transition-all"
                    placeholder="Seu Nome"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand-green transition-all"
                    placeholder="E-mail"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand-green transition-all"
                    placeholder="Senha"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Criando Conta..." : "Cadastrar e Entrar"}{" "}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>

        {/* Developer Quick Login is disabled when Supabase auth is enabled to preserve JWT/RLS consistency. */}
        {!isSupabaseAuthEnabled && (
          <div className="border-t border-slate-700 p-4 bg-slate-900/50">
            <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide text-center">
              Acesso Rápido (Desenvolvimento)
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableUsers.slice(0, 3).map((u) => (
                <button
                  key={u.id}
                  onClick={() => onLogin(u)}
                  className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-400 hover:text-white transition-colors"
                >
                  {u.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
