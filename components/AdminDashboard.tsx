import React, { useState } from 'react';
import { User, UserRole, Group } from '../types';
import { UserPlus, Shield, ShieldOff, Trash2, Mail, CheckCircle, Users as UsersIcon } from 'lucide-react';

interface AdminDashboardProps {
  users: User[];
  groups: Group[];
  currentUser: User;
  onInvite: (email: string) => void;
  onUpdateRole: (userId: string, newRole: UserRole) => void;
  onRemoveUser: (userId: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  groups,
  currentUser,
  onInvite,
  onUpdateRole,
  onRemoveUser
}) => {
  const [inviteEmail, setInviteEmail] = useState('');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      onInvite(inviteEmail);
      setInviteEmail('');
      alert(`Convite enviado para ${inviteEmail}\n\nLink (Simulado): https://bolao.app/invite?token=xyz123`);
    }
  };

  const activeAdmins = users.filter(u => u.role === 'ADMIN' && u.status === 'ACTIVE').length;

  const handleRoleToggle = (user: User) => {
    if (user.role === 'ADMIN') {
       if (activeAdmins <= 1 && user.status === 'ACTIVE') {
           alert("Não é possível remover o único administrador.");
           return;
       }
       onUpdateRole(user.id, 'USER');
    } else {
       onUpdateRole(user.id, 'ADMIN');
    }
  };

  const handleRemove = (user: User) => {
    if (user.role === 'ADMIN' && activeAdmins <= 1) {
        alert("Não é possível remover o único administrador.");
        return;
    }
    if (window.confirm(`Tem certeza que deseja remover ${user.name}?`)) {
        onRemoveUser(user.id);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Invite Section */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <UserPlus className="text-brand-green" />
            Convidar Usuários
        </h2>
        <form onSubmit={handleInviteSubmit} className="flex gap-2">
            <input 
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemplo.com (Gmail)"
                className="flex-1 bg-slate-900 border border-slate-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
            <button 
                type="submit"
                className="bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors"
            >
                Enviar
            </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">O usuário receberá um link por e-mail para acessar o bolão com sua conta Google.</p>
      </div>

      {/* Groups Management */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <UsersIcon className="text-purple-400" />
            Grupos Existentes ({groups.length})
        </h2>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2 text-center">Membros</th>
                        <th className="px-3 py-2 text-right">Criado em</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {groups.map(group => {
                        const memberCount = users.filter(u => u.groupIds.includes(group.id)).length;
                        return (
                            <tr key={group.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                <td className="px-3 py-3 font-semibold text-white">{group.name}</td>
                                <td className="px-3 py-3 font-mono text-brand-green">{group.code}</td>
                                <td className="px-3 py-3 text-center">
                                    <span className="bg-slate-700 px-2 py-0.5 rounded text-xs">{memberCount}</span>
                                </td>
                                <td className="px-3 py-3 text-right text-slate-400 text-xs">
                                    {new Date(group.createdAt).toLocaleDateString('pt-BR')}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>

      {/* Users Management */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="text-blue-400" />
            Gerenciar Usuários ({users.length})
        </h2>

        <div className="space-y-3">
            {users.map(user => (
                <div key={user.id} className="flex flex-col sm:flex-row items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700 gap-3">
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative">
                            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                            {user.status === 'INVITED' && (
                                <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-slate-900 rounded-full p-0.5" title="Pendente">
                                    <Mail size={10} />
                                </div>
                            )}
                            {user.status === 'ACTIVE' && (
                                <div className="absolute -bottom-1 -right-1 bg-green-500 text-slate-900 rounded-full p-0.5" title="Ativo">
                                    <CheckCircle size={10} />
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{user.name}</span>
                                {user.role === 'ADMIN' && (
                                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">ADMIN</span>
                                )}
                                {user.id === currentUser.id && (
                                    <span className="text-[10px] bg-brand-green/20 text-brand-green px-1.5 py-0.5 rounded border border-brand-green/30">VOCÊ</span>
                                )}
                            </div>
                            <div className="text-xs text-slate-400">{user.email}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {user.id !== currentUser.id && (
                            <>
                                <button 
                                    onClick={() => handleRoleToggle(user)}
                                    className={`p-2 rounded-lg transition-colors ${user.role === 'ADMIN' ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                                    title={user.role === 'ADMIN' ? "Remover Admin" : "Tornar Admin"}
                                >
                                    {user.role === 'ADMIN' ? <ShieldOff size={16} /> : <Shield size={16} />}
                                </button>
                                <button 
                                    onClick={() => handleRemove(user)}
                                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                    title="Remover Usuário"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                        {user.id === currentUser.id && (
                            <span className="text-xs text-slate-500 italic px-2">Logado</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;