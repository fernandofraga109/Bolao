import React, { useState, useEffect } from "react";
import {
  Trophy,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  Hash,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import { User } from "../types";
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
  onRequestPasswordReset: (
    email: string,
  ) => Promise<{ success: boolean; message?: string }>;
  onUpdatePassword: (
    newPassword: string,
  ) => Promise<{ success: boolean; message?: string }>;
  initialMode?: AuthMode;
  onPasswordResetComplete?: () => void;
}

type AuthMode = "LOGIN" | "REGISTER" | "RESET_PASSWORD" | "RESET_PASSWORD_CONFIRM";

const Login: React.FC<LoginProps> = ({
  onLogin,
  availableUsers,
  onRegister,
  onAuth,
  onRequestPasswordReset,
  onUpdatePassword,
  initialMode = "LOGIN",
  onPasswordResetComplete,
}) => {
  const isSupabaseAuthEnabled = isSupabaseEnabled();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login Form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Register Form
  const [regCode, setRegCode] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setResetSuccess(null);
    setLoading(true);

    try {
      const resolved = await onAuth(loginEmail, loginPass);
      if (resolved.success && resolved.user) {
        onLogin(resolved.user);
        return;
      }

      setError(resolved.message || "Erro ao entrar.");
    } catch {
      setError("Erro inesperado ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setResetSuccess(null);

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
    try {
      const result = await onRegister(regName, regEmail, regPass, regCode);
      if (result.success) {
        return;
      }

      setError(result.message || "Erro ao cadastrar.");
    } catch {
      setError("Erro inesperado ao cadastrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setResetSuccess(null);

    if (!resetEmail.trim()) {
      setError("Informe o e-mail para resetar a senha.");
      return;
    }

    setLoading(true);
    try {
      const result = await onRequestPasswordReset(resetEmail);
      if (!result.success) {
        setError(result.message || "Não foi possível enviar o reset.");
        return;
      }

      setResetSuccess(
        result.message ||
          "Se o e-mail existir, você receberá um link de redefinição.",
      );
    } catch {
      setError("Erro inesperado ao solicitar reset de senha.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setResetSuccess(null);

    if (!newPassword.trim()) {
      setError("Informe a nova senha.");
      return;
    }

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const result = await onUpdatePassword(newPassword);
      if (!result.success) {
        setError(result.message || "Não foi possível atualizar a senha.");
        return;
      }

      setResetSuccess(result.message || "Senha atualizada com sucesso.");
      setNewPassword("");
      setConfirmNewPassword("");
      onPasswordResetComplete?.();
    } catch {
      setError("Erro inesperado ao atualizar senha.");
    } finally {
      setLoading(false);
    }
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
              setResetSuccess(null);
            }}
            disabled={initialMode === "RESET_PASSWORD_CONFIRM"}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === "LOGIN" ? "text-brand-green bg-slate-800" : "text-slate-500 bg-slate-900/50 hover:bg-slate-800"}`}
          >
            <LogIn size={16} /> Entrar
          </button>
          <button
            onClick={() => {
              setMode("REGISTER");
              setError(null);
              setResetSuccess(null);
            }}
            disabled={initialMode === "RESET_PASSWORD_CONFIRM"}
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

          {resetSuccess && (
            <div className="mb-6 bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-sm px-4 py-3 rounded-lg">
              {resetSuccess}
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
                    placeholder="seu@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                  <input
                    type={showLoginPass ? "text" : "password"}
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-10 py-3 rounded-xl focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    placeholder="••••••"
                  />
                  <button type="button" onClick={() => setShowLoginPass(v => !v)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors">
                    {showLoginPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold py-3.5 rounded-xl transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Entrando..." : "Entrar"} <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetEmail(loginEmail);
                  setMode("RESET_PASSWORD");
                  setError(null);
                  setResetSuccess(null);
                }}
                className="w-full text-xs text-slate-400 hover:text-brand-green transition-colors"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : mode === "REGISTER" ? (
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
                  <div className="relative">
                    <input
                      type={showRegPass ? "text" : "password"}
                      required
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white px-4 pr-10 py-3 rounded-xl focus:outline-none focus:border-brand-green transition-all"
                      placeholder="Senha"
                    />
                    <button type="button" onClick={() => setShowRegPass(v => !v)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors">
                      {showRegPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
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
          ) : mode === "RESET_PASSWORD" ? (
            <form
              onSubmit={handlePasswordReset}
              className="space-y-4 animate-fadeIn"
            >
              <div className="bg-slate-900/60 border border-slate-700 p-3 rounded-lg text-xs text-slate-300">
                Informe seu e-mail para receber o link de redefinição de senha.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-3 text-slate-500"
                    size={18}
                  />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold py-3.5 rounded-xl transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar link de reset"}
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("LOGIN");
                  setError(null);
                }}
                className="w-full text-xs text-slate-400 hover:text-white transition-colors"
              >
                Voltar para login
              </button>
            </form>
          ) : (
            <form
              onSubmit={handlePasswordUpdate}
              className="space-y-4 animate-fadeIn"
            >
              <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-lg text-xs text-emerald-200">
                Defina sua nova senha para concluir a recuperação da conta.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  Nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-10 py-3 rounded-xl focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors">
                    {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-10 py-3 rounded-xl focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    placeholder="Repita a senha"
                  />
                  <button type="button" onClick={() => setShowConfirmPass(v => !v)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors">
                    {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold py-3.5 rounded-xl transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Atualizando..." : "Salvar nova senha"}
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("LOGIN");
                  setError(null);
                  onPasswordResetComplete?.();
                }}
                className="w-full text-xs text-slate-400 hover:text-white transition-colors"
              >
                Voltar para login
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
