
import React, { useState } from 'react';
import { User, Group } from '../types';
import { Shield, Trash2, CheckCircle, Copy, Plus, X, Users, Settings, ArrowLeft, UserPlus, UserMinus, Search, Database, Download, CloudUpload, AlertTriangle, Check, Loader2, RefreshCw, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';
import { seedDatabase } from '../services/seeder';
import { isSupabaseEnabled } from '../services/supabase';
import { useMatchSystem } from '../hooks/useMatchSystem';

interface AdminDashboardProps {
  users: User[];
  groups: Group[];
  currentUser: User;
  onInvite: (email: string) => void;
  onUpdateRole: (userId: string, newRole: 'ADMIN' | 'USER') => void;
  onRemoveUser: (userId: string) => void;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (id: string) => Promise<void>;
  // Fix: changed onAddUserToGroup to return Promise<void> to match async nature of db operations
  onAddUserToGroup: (uid: string, gid: string) => Promise<void>;
  onRemoveUserFromGroup: (uid: string, gid: string) => Promise<void>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  groups,
  currentUser,
  onRemoveUser,
  onCreateGroup,
  onDeleteGroup,
  onAddUserToGroup,
  onRemoveUserFromGroup
}) => {
  const db = useDatabase(); // Access raw DB tables and config
  const { isSyncing, isAutoSyncEnabled, toggleAutoSync } = useMatchSystem(); // Access Match Sync
  
  const [activeView, setActiveView] = useState<'general' | 'db_inspector'>('general');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  
  // UI States
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  
  // Delete Modal States
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Remove Member Modal States
  const [memberToRemove, setMemberToRemove] = useState<{ user: User, groupId: string } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  
  // Loading States (Legacy for user removal system-wide)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedLogs, setSeedLogs] = useState<string[]>([]);

  // --- Actions ---

  const handleCreateGroup = () => {
      if (!newGroupName.trim()) return;
      onCreateGroup(newGroupName);
      setNewGroupName('');
  };

  const handleRequestDeleteGroup = (e: React.MouseEvent, group: Group) => {
      e.stopPropagation();
      e.preventDefault();
      setGroupToDelete(group);
  };

  const confirmDeleteGroup = async () => {
      if (!groupToDelete) return;
      
      setIsDeleting(true);
      try {
         await onDeleteGroup(groupToDelete.id);
         
         // Se deletou o grupo que estava sendo visualizado, volta para a lista
         if (selectedGroupId === groupToDelete.id) {
             setSelectedGroupId(null);
         }
         
         setGroupToDelete(null); // Fecha o modal
      } catch (error: any) {
          console.error(error);
          alert(`Erro ao excluir grupo: ${error.message || 'Erro desconhecido'}`);
      } finally {
          setIsDeleting(false);
      }
  };

  const handleRequestRemoveMember = (e: React.MouseEvent, user: User, groupId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setMemberToRemove({ user, groupId });
  };

  const confirmRemoveMember = async () => {
      if (!memberToRemove) return;
      setIsRemovingMember(true);
      try {
          await onRemoveUserFromGroup(memberToRemove.user.id, memberToRemove.groupId);
          setMemberToRemove(null); // Close Modal
      } catch (error: any) {
          console.error(error);
          alert('Erro ao remover membro');
      } finally {
          setIsRemovingMember(false);
      }
  };

  const handleRemoveUserSystem = async (e: React.MouseEvent, user: User) => {
      e.stopPropagation();
      e.preventDefault();

      if (window.confirm(`PERIGO: Remover ${user.name} do sistema apaga login, palpites e pontos.\nEsta ação é irreversível. Continuar?`)) {
          setDeletingUserId(user.id);
          try {
              await onRemoveUser(user.id);
          } catch (error) {
              console.error(error);
          } finally {
              setDeletingUserId(null);
          }
      }
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedGroup(id);
      setTimeout(() => setCopiedGroup(null), 2000);
  };

  const handleUpdateInterval = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const ms = parseInt(e.target.value);
      db.updateSystemConfig({ sync_interval_ms: ms });
  };

  const handleSeed = async () => {
      if (!isSupabaseEnabled()) {
          setSeedLogs(['Erro: Supabase não configurado. Adicione a URL e Key em services/supabase.ts']);
          return;
      }
      if (!window.confirm("Isso tentará inserir todos os dados de exemplo no Supabase. Certifique-se de ter criado as tabelas antes (usando o script SQL). Continuar?")) return;

      setSeeding(true);
      setSeedLogs(['Iniciando...']);
      const result = await seedDatabase();
      setSeedLogs(result.logs);
      setSeeding(false);
      
      if (result.success) {
          alert('Dados populados com sucesso! Atualize a página para ver os dados vindos do banco.');
      }
  };

  const downloadJson = (filename: string, data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Render Helpers ---

  const renderDbInspector = () => {
      const isConnected = isSupabaseEnabled();

      return (
      <div className="space-y-6 pb-10">
        <div className="flex items-center gap-4 mb-4">
             <button 
                onClick={() => setActiveView('general')}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
                <ArrowLeft size={20} />
                Voltar
            </button>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className="text-brand-green" />
                Ferramentas de Banco de Dados
            </h2>
        </div>

        {/* STATUS SECTION */}
        <div className={`p-4 rounded-xl border ${isConnected ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
            <div className="flex items-center gap-3">
                {isConnected ? <CheckCircle className="text-green-500" /> : <AlertTriangle className="text-red-500" />}
                <div>
                    <h3 className={`font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                        {isConnected ? 'Supabase Conectado' : 'Supabase Desconectado'}
                    </h3>
                    <p className="text-xs text-slate-400">
                        {isConnected 
                            ? 'O aplicativo está lendo e gravando dados na nuvem.' 
                            : 'Edite o arquivo "services/supabase.ts" e adicione sua ANON KEY para conectar.'}
                    </p>
                </div>
            </div>
        </div>

        {/* SEEDER SECTION */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6">
            <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                <CloudUpload className="text-blue-400" />
                Popular Banco de Dados (Seed)
            </h3>
            <p className="text-sm text-slate-400 mb-4">
                Use esta ferramenta para enviar os dados locais (Times, Jogos, Usuários de teste) para o Supabase.
                <br />
                <span className="text-yellow-500 font-bold">Atenção:</span> As tabelas devem ter sido criadas previamente no Supabase SQL Editor usando o script SQL fornecido.
            </p>
            
            <button 
                onClick={handleSeed}
                disabled={seeding || !isConnected}
                className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isConnected ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
                {seeding ? 'Enviando...' : 'Enviar Dados Locais para Nuvem'}
            </button>

            {seedLogs.length > 0 && (
                <div className="mt-4 bg-slate-950 p-4 rounded-lg font-mono text-xs text-green-400 border border-slate-700 max-h-40 overflow-y-auto">
                    {seedLogs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            )}
        </div>

        <div className="grid gap-6">
            <h3 className="font-bold text-slate-300 ml-1">Dados Atuais (Memória do App)</h3>
            {/* USERS TABLE */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-300">Tabela: Users ({db.users.length})</h3>
                    <button onClick={() => downloadJson('users', db.users)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1">
                        <Download size={12} /> Baixar users.json
                    </button>
                </div>
                <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-[10px] text-green-400 font-mono max-h-60 custom-scrollbar">
                    {JSON.stringify(db.users, null, 2)}
                </pre>
            </div>
            {/* GROUPS TABLE */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-300">Tabela: Groups ({db.groups.length})</h3>
                    <button onClick={() => downloadJson('groups', db.groups)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1">
                        <Download size={12} /> Baixar groups.json
                    </button>
                </div>
                <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-[10px] text-green-400 font-mono max-h-60 custom-scrollbar">
                    {JSON.stringify(db.groups, null, 2)}
                </pre>
            </div>
        </div>
      </div>
  )};

  const renderMainView = () => (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div className="bg-gradient-to-r from-red-900 to-slate-900 p-6 rounded-xl border border-red-500/30 shadow-lg flex items-center gap-4 flex-1">
            <div className="bg-red-600 p-3 rounded-full text-white shadow-lg shadow-red-600/20">
                <Shield size={32} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white">Painel do Mestre</h1>
                <p className="text-red-200 text-sm">Gerenciamento total do bolão</p>
            </div>
        </div>
      </div>
      
      {/* GLOBAL ACTIONS BAR */}
      <div className="flex flex-wrap justify-end gap-3 items-center">
        
        {/* SYNC WIDGET (Unified) */}
        <div className="relative z-20">
            <button 
                onClick={() => setShowSyncMenu(!showSyncMenu)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all ${
                    isAutoSyncEnabled 
                    ? 'bg-slate-800 border-green-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
            >
                <div className={`p-1.5 rounded-full ${isAutoSyncEnabled ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-400'}`}>
                    <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                </div>
                <div className="text-left">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Sincronização</div>
                    <div className={`text-xs font-bold ${isAutoSyncEnabled ? 'text-white' : 'text-slate-400'}`}>
                        {isAutoSyncEnabled ? 'Automática: ON' : 'Manual / Parada'}
                    </div>
                </div>
                {showSyncMenu ? <ChevronUp size={16} className="text-slate-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
            </button>

            {/* Dropdown Menu */}
            {showSyncMenu && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                    <div className="p-4 space-y-4">
                        
                        {/* Toggle Area */}
                        <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                            <div className="flex flex-col">
                                <span className="text-sm text-white font-bold">Atualização em Tempo Real</span>
                                <span className="text-[10px] text-slate-400">Puxa placares da API oficial</span>
                            </div>
                            <button 
                                onClick={toggleAutoSync}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${isAutoSyncEnabled ? 'bg-green-600' : 'bg-slate-600'}`}
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isAutoSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>

                        {/* Interval Settings */}
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2">
                                <Clock size={12} /> Intervalo de Busca
                            </label>
                            <select 
                                value={db.systemConfig.sync_interval_ms} 
                                onChange={handleUpdateInterval}
                                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-green"
                            >
                                <option value={15000}>15 segundos (Rápido)</option>
                                <option value={30000}>30 segundos</option>
                                <option value={60000}>1 minuto (Recomendado)</option>
                                <option value={300000}>5 minutos</option>
                                <option value={600000}>10 minutos</option>
                            </select>
                        </div>

                        {/* Note */}
                        <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20 flex gap-2">
                            <div className="mt-0.5"><Clock size={12} className="text-indigo-400" /></div>
                            <p className="text-[10px] text-indigo-200 leading-relaxed">
                                A atualização consome cotas da API. Use "15 segundos" apenas durante jogos importantes.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* DB Inspector Button */}
        <button 
            onClick={() => setActiveView('db_inspector')}
            className={`flex items-center gap-2 border px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg ${isSupabaseEnabled() ? 'bg-slate-800 hover:bg-slate-700 text-brand-green border-brand-green/30' : 'bg-red-900/20 border-red-500/50 text-red-300'}`}
        >
            <Database size={16} />
            {isSupabaseEnabled() ? 'Banco de Dados' : 'Configurar BD'}
        </button>
      </div>

      {/* GROUPS MANAGEMENT */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Settings className="text-brand-green" />
            Gerenciar Grupos
        </h2>

        {/* Create Group */}
        <div className="flex gap-2 mb-6">
            <input 
                type="text" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nome do novo grupo..."
                className="flex-1 bg-slate-900 border border-slate-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-brand-green"
            />
            <button 
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
                <Plus size={18} /> Criar
            </button>
        </div>
        
        {/* List Groups */}
        <div className="grid gap-3 sm:grid-cols-2">
            {groups.length === 0 ? (
                <div className="col-span-2 text-center text-slate-500 py-4 italic border border-dashed border-slate-700 rounded-lg">
                    Nenhum grupo encontrado no banco de dados.
                </div>
            ) : (
                groups.map(group => (
                    <div key={group.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4 relative group hover:border-slate-500 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-white text-lg">{group.name}</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors text-xs font-bold flex items-center gap-1"
                                    title="Gerenciar Membros"
                                >
                                    <Settings size={14} />
                                    Editar
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                            <div className="bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-sm text-brand-green tracking-wider">
                                {group.code}
                            </div>
                            <button 
                                onClick={() => handleCopy(group.code, group.id)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                {copiedGroup === group.id ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
                            <Users size={14} />
                            {users.filter(u => u.groupIds.includes(group.id)).length} participantes
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* GLOBAL USERS MANAGEMENT */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Users className="text-blue-400" />
            Todos os Usuários
        </h2>

        <div className="space-y-4">
            {users.filter(u => u.role !== 'ADMIN').map(user => (
                <div key={user.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                        <div>
                            <div className="font-bold text-sm text-white">{user.name}</div>
                            <div className="text-[10px] text-slate-400">{user.email}</div>
                        </div>
                    </div>
                    <button 
                        onClick={(e) => handleRemoveUserSystem(e, user)}
                        disabled={deletingUserId === user.id}
                        className={`p-2 transition-colors ${deletingUserId === user.id ? 'text-red-300' : 'text-slate-600 hover:text-red-400'}`}
                        title="Excluir do Sistema"
                    >
                        {deletingUserId === user.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                </div>
            ))}
            {users.filter(u => u.role !== 'ADMIN').length === 0 && (
                <p className="text-slate-500 text-sm italic text-center">Nenhum usuário cadastrado além do admin.</p>
            )}
        </div>
      </div>
    </div>
  );

  const renderGroupDetailView = () => {
      const group = groups.find(g => g.id === selectedGroupId);
      if (!group) return <div className="p-4 text-center">Grupo não encontrado</div>;

      const members = users.filter(u => u.groupIds.includes(group.id));
      const nonMembers = users.filter(u => !u.groupIds.includes(group.id) && u.role !== 'ADMIN');

      return (
        <div className="space-y-6 pb-10">
            {/* Header / Back */}
            <button 
                onClick={() => setSelectedGroupId(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
            >
                <ArrowLeft size={20} />
                Voltar ao Painel
            </button>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-start border-b border-slate-700 pb-6 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">{group.name}</h1>
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-brand-green bg-slate-900 px-2 py-1 rounded text-sm border border-slate-700">
                                {group.code}
                            </span>
                            <span className="text-sm text-slate-400">{members.length} membros</span>
                        </div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
                        <Users size={24} className="text-brand-blue" />
                    </div>
                </div>

                {/* Add Member Section */}
                <div className="bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-lg mb-8">
                    <h3 className="text-sm font-bold text-indigo-300 uppercase mb-3 flex items-center gap-2">
                        <UserPlus size={16} />
                        Adicionar Participante
                    </h3>
                    <div className="flex gap-2">
                        <select 
                            className="flex-1 bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-green"
                            onChange={(e) => {
                                if (e.target.value) {
                                    onAddUserToGroup(e.target.value, group.id);
                                    e.target.value = '';
                                }
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>Selecione um usuário para adicionar...</option>
                            {nonMembers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                            ))}
                            {nonMembers.length === 0 && <option disabled>Todos os usuários já estão neste grupo</option>}
                        </select>
                    </div>
                </div>

                {/* Members List */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-lg font-bold text-white">Membros do Grupo</h3>
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-2 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Buscar membro..." 
                                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white focus:outline-none focus:border-slate-500"
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {members
                            .filter(m => m.name.toLowerCase().includes(userSearch.toLowerCase()))
                            .map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-3">
                                    <img src={member.avatar} alt={member.name} className="w-9 h-9 rounded-full bg-slate-800" />
                                    <div>
                                        <div className="font-semibold text-sm text-white flex items-center gap-2">
                                            {member.name}
                                            {member.role === 'ADMIN' && <Shield size={12} className="text-brand-blue" />}
                                            {member.id === currentUser.id && <span className="text-[10px] bg-slate-700 px-1 rounded text-slate-300">VOCÊ</span>}
                                        </div>
                                        <div className="text-xs text-slate-500">{member.email}</div>
                                    </div>
                                </div>
                                
                                {member.id !== currentUser.id && (
                                    <button 
                                        type="button"
                                        onClick={(e) => handleRequestRemoveMember(e, member, group.id)}
                                        className="text-slate-500 hover:text-red-400 hover:bg-red-900/20 p-2 rounded transition-all cursor-pointer z-10"
                                        title="Remover do Grupo"
                                    >
                                        <UserMinus size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                        
                        {members.length === 0 && (
                            <div className="text-center py-8 text-slate-500 text-sm">Nenhum membro neste grupo.</div>
                        )}
                    </div>
                </div>

                {/* DANGER ZONE */}
                <div className="mt-8 pt-6 border-t border-slate-700">
                    <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <AlertTriangle size={16} /> Zona de Perigo
                    </h3>
                    <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h4 className="text-white font-bold text-sm">Excluir este grupo permanentemente</h4>
                            <p className="text-slate-400 text-xs mt-1">
                                Esta ação não pode ser desfeita. Todos os palpites e dados deste grupo serão perdidos.
                            </p>
                        </div>
                        <button
                            onClick={(e) => handleRequestDeleteGroup(e, group)}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
                        >
                            <Trash2 size={16} />
                            Excluir Grupo
                        </button>
                    </div>
                </div>

            </div>
        </div>
      );
  };

  return (
    <>
      {activeView === 'db_inspector' ? renderDbInspector() : (selectedGroupId ? renderGroupDetailView() : renderMainView())}
      
      {/* DELETE GROUP CONFIRMATION MODAL */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
                <button 
                    onClick={() => setGroupToDelete(null)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X size={20} />
                </button>
                
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <AlertTriangle className="text-red-500" size={24} />
                    Excluir Grupo?
                </h3>
                
                <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 mb-4">
                    <p className="text-red-200 font-bold text-sm text-center">
                        Você está prestes a apagar: "{groupToDelete.name}"
                    </p>
                </div>

                <ul className="text-slate-300 text-sm mb-6 space-y-2 list-disc list-inside">
                    <li>O grupo será apagado permanentemente.</li>
                    <li>Todos os usuários serão removidos dele.</li>
                    <li>O histórico de palpites vinculado a este grupo será perdido.</li>
                </ul>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setGroupToDelete(null)}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDeleteGroup}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        Confirmar Exclusão
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* REMOVE MEMBER CONFIRMATION MODAL */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
                <button 
                    onClick={() => setMemberToRemove(null)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X size={20} />
                </button>
                
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <UserMinus className="text-orange-500" size={24} />
                    Remover Membro?
                </h3>
                
                <div className="bg-orange-900/20 border border-orange-500/20 rounded-lg p-4 mb-4 flex items-center gap-3">
                    <img src={memberToRemove.user.avatar} className="w-10 h-10 rounded-full" alt="avatar" />
                    <div>
                        <p className="text-orange-200 font-bold text-sm">
                            {memberToRemove.user.name}
                        </p>
                        <p className="text-xs text-orange-200/70">{memberToRemove.user.email}</p>
                    </div>
                </div>

                <p className="text-slate-300 text-sm mb-6">
                    Este usuário perderá o acesso a este grupo e seus palpites neste contexto não serão mais contabilizados para o ranking do grupo.
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setMemberToRemove(null)}
                        disabled={isRemovingMember}
                        className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmRemoveMember}
                        disabled={isRemovingMember}
                        className="flex-1 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        {isRemovingMember ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Remoção'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
