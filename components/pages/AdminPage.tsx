import React from "react";
import AdminDashboard from "../AdminDashboard";
import { User, Group } from "../../types";
import type { CompetitionSyncStatus } from "../../hooks/useMatchSystem";

interface AdminPageProps {
  users: User[];
  groups: Group[];
  currentUser: User;
  onInvite: (email: string) => void;
  onUpdateRole: (userId: string, newRole: "ADMIN" | "USER" | "DEACTIVATED") => void;
  onRemoveUser: (userId: string) => void;
  onCreateGroup: (name: string, competitionCode: string) => void;
  onDeleteGroup: (id: string) => Promise<void>;
  onAddUserToGroup: (uid: string, gid: string) => Promise<void>;
  onRemoveUserFromGroup: (uid: string, gid: string) => Promise<void>;
  isSyncing: boolean;
  isAutoSyncEnabled: boolean;
  toggleAutoSync: () => void;
  syncStatusByCompetition: Record<string, CompetitionSyncStatus>;
  onManualSync?: (competitionCode: string) => Promise<void>;
}

const AdminPage: React.FC<AdminPageProps> = (props) => {
  return <AdminDashboard {...props} />;
};

export default AdminPage;
