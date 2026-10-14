'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { accountsApi } from '@/features/accounts/api';
import type { AccountUser, UserRole, AccountUpdatePayload } from '@/features/accounts/types';
import {
  PERMISSION_GROUPS,
  MARKETING_DEFAULTS,
  permissionAllowedForRole,
  resolvePermissionToggle,
} from '@/features/accounts/constants';
import AccountsHeader from '@/features/accounts/components/AccountsHeader';
import AccountsFilterToolbar from '@/features/accounts/components/AccountsFilterToolbar';
import AccountsTableView from '@/features/accounts/components/AccountsTableView';
import AccountsCardGrid from '@/features/accounts/components/AccountsCardGrid';
import AccountCreateModal from '@/features/accounts/components/AccountCreateModal';
import AccountEditModal from '@/features/accounts/components/AccountEditModal';
import PermissionStudioModal from '@/features/accounts/components/PermissionStudioModal';
import PermissionMatrixTab from '@/features/accounts/components/PermissionMatrixTab';
import SecurityPolicyTab from '@/features/accounts/components/SecurityPolicyTab';

const emptyForm = {
  email: '',
  full_name: '',
  phone: '',
  role: 'MARKETING' as UserRole,
  permissions: [...MARKETING_DEFAULTS] as string[],
};

export default function AdminAccountsPage() {
  const { user: currentUser, updateProfile } = useAuth();
  const can = (permission: string) =>
    Boolean(
      currentUser?.permissions?.includes('*') ||
      currentUser?.permissions?.includes(permission)
    );

  const [activeTab, setActiveTab] = useState<'accounts' | 'matrix' | 'policy'>('accounts');

  // Core Data
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionAccount, setPermissionAccount] = useState<AccountUser | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountUser | null>(null);

  // Form states
  const [accountDraft, setAccountDraft] = useState<{
    full_name: string;
    phone: string;
    role: UserRole;
  }>({ full_name: '', phone: '', role: 'MARKETING' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [permissionRoleDraft, setPermissionRoleDraft] = useState<UserRole>('MARKETING');
  const [permissionModalSearch, setPermissionModalSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  // Presets and dependencies metadata
  const [presets, setPresets] = useState<Record<'ADMIN' | 'MARKETING', string[]>>({
    ADMIN: PERMISSION_GROUPS.flatMap((group) => [...group.values]),
    MARKETING: [...MARKETING_DEFAULTS],
  });
  const [dependencies, setDependencies] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const [accountItems, permissionCatalog] = await Promise.all([
        accountsApi.list(),
        accountsApi.permissions(),
      ]);
      setAccounts(accountItems);
      setPresets(permissionCatalog.presets);
      setDependencies(permissionCatalog.dependencies);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể tải danh sách tài khoản.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // Statistics
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => a.status === 'ACTIVE' && a.is_active).length;
    const pending = accounts.filter((a) => a.status === 'PENDING_SETUP').length;
    const locked = accounts.filter(
      (a) => a.status === 'LOCKED' || a.status === 'DISABLED' || !a.is_active
    ).length;
    const ceoCount = accounts.filter((a) => a.role === 'CEO').length;
    const adminCount = accounts.filter((a) => a.role === 'ADMIN').length;
    const marketingCount = accounts.filter((a) => a.role === 'MARKETING').length;

    return { total, active, pending, locked, ceoCount, adminCount, marketingCount };
  }, [accounts]);

  // Filtered accounts list
  const visibleAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const keyword = query.trim().toLowerCase();
      const matchesQuery =
        !keyword ||
        account.full_name.toLowerCase().includes(keyword) ||
        account.email.toLowerCase().includes(keyword) ||
        account.phone?.includes(keyword);

      const matchesRole = roleFilter === 'ALL' || account.role === roleFilter;

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') {
        matchesStatus = account.status === 'ACTIVE' && account.is_active;
      } else if (statusFilter === 'PENDING') {
        matchesStatus = account.status === 'PENDING_SETUP';
      } else if (statusFilter === 'LOCKED') {
        matchesStatus =
          account.status === 'LOCKED' || account.status === 'DISABLED' || !account.is_active;
      }

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [accounts, query, roleFilter, statusFilter]);

  // Submit new profile
  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setBusyId('create');
      const account = await accountsApi.create({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        permissions: form.permissions,
      });
      setCreateOpen(false);
      setForm(emptyForm);
      setMessage({
        type: 'success',
        text: `Đã tạo hồ sơ cho ${account.email}. Bấm “Cấp TK” để gửi thư kích hoạt khi sẵn sàng.`,
      });
      await loadAccounts();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể tạo hồ sơ.',
      });
    } finally {
      setBusyId(null);
    }
  };

  // Issue activation email
  const issueAccount = async (account: AccountUser) => {
    try {
      setBusyId(account.id);
      await accountsApi.issue(account.id);
      setMessage({
        type: 'success',
        text: `Đã xếp hàng gửi thư kích hoạt tài khoản đến ${account.email}.`,
      });
      await loadAccounts();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể cấp tài khoản.',
      });
    } finally {
      setBusyId(null);
    }
  };

  // Toggle lock
  const toggleLock = async (account: AccountUser) => {
    const unlock = account.status === 'LOCKED' || !account.is_active;
    try {
      setBusyId(account.id);
      await accountsApi.update(account.id, {
        status: unlock ? 'ACTIVE' : 'LOCKED',
        is_active: unlock,
      });
      if (!unlock) await accountsApi.revokeSessions(account.id);
      setMessage({
        type: 'success',
        text: `Đã ${unlock ? 'mở khóa' : 'khóa'} tài khoản ${account.email}.`,
      });
      await loadAccounts();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.',
      });
    } finally {
      setBusyId(null);
    }
  };

  // Revoke sessions
  const revokeSessions = async (account: AccountUser) => {
    try {
      setBusyId(account.id);
      const result = await accountsApi.revokeSessions(account.id);
      setMessage({
        type: 'success',
        text: result.message || `Đã thu hồi phiên của ${account.email}.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể thu hồi phiên.',
      });
    } finally {
      setBusyId(null);
    }
  };

  // Permission toggles
  const togglePermission = (permission: string) => {
    setForm((current) => ({
      ...current,
      permissions: resolvePermissionToggle(current.permissions, permission, dependencies),
    }));
  };

  const toggleExistingPermission = (permission: string) => {
    setPermissionDraft((current) =>
      resolvePermissionToggle(current, permission, dependencies)
    );
  };

  const toggleGroupInDraft = (groupValues: readonly string[], grantAll: boolean) => {
    if (!permissionAccount) return;
    const allowedValues = groupValues.filter((p) =>
      permissionAllowedForRole(p, permissionRoleDraft)
    );
    let next = [...permissionDraft];
    if (grantAll) {
      for (const p of allowedValues) {
        if (!next.includes(p)) {
          next = resolvePermissionToggle(next, p, dependencies);
        }
      }
    } else {
      for (const p of allowedValues) {
        if (next.includes(p)) {
          next = resolvePermissionToggle(next, p, dependencies);
        }
      }
    }
    setPermissionDraft(next);
  };

  const handleRoleChangeInPermissionModal = (newRole: UserRole) => {
    setPermissionRoleDraft(newRole);
    if (newRole === 'MARKETING') {
      setPermissionDraft((current) =>
        current.filter((p) => permissionAllowedForRole(p, 'MARKETING'))
      );
    }
  };

  const openPermissionEditor = (account: AccountUser) => {
    setPermissionAccount(account);
    const initialRole =
      (account.role === 'CEO' ? 'ADMIN' : (account.role as UserRole)) || 'MARKETING';
    setPermissionRoleDraft(initialRole);
    setPermissionDraft([...account.permissions]);
    setPermissionModalSearch('');
  };

  const openAccountEditor = (account: AccountUser) => {
    setEditingAccount(account);
    setAccountDraft({
      full_name: account.full_name,
      phone: account.phone || '',
      role: (account.role === 'CEO' ? 'ADMIN' : (account.role as UserRole)) || 'MARKETING',
    });
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const closeAccountEditor = () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditingAccount(null);
  };

  const selectAvatar = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({
        type: 'error',
        text: 'Ảnh đại diện chỉ chấp nhận định dạng JPEG, PNG hoặc WebP.',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: 'error',
        text: 'Ảnh đại diện không được vượt quá 5 MB.',
      });
      return;
    }
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setMessage(null);
  };

  const saveAccountInfo = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingAccount || !accountDraft.full_name.trim()) return;
    const isProtected =
      editingAccount.role === 'CEO' || editingAccount.email === currentUser?.email;
    try {
      setBusyId(editingAccount.id);
      const payload: AccountUpdatePayload = {
        full_name: accountDraft.full_name.trim(),
        phone: accountDraft.phone.trim(),
      };

      const roleChanged =
        !isProtected &&
        can('website.permissions.manage') &&
        accountDraft.role !== editingAccount.role;

      if (roleChanged) {
        payload.role = accountDraft.role;
        if (accountDraft.role === 'MARKETING') {
          payload.permissions = (editingAccount.permissions || []).filter((p) =>
            permissionAllowedForRole(p, 'MARKETING')
          );
        }
      }

      let updated = await accountsApi.update(editingAccount.id, payload);
      if (avatarFile) updated = await accountsApi.uploadAvatar(editingAccount.id, avatarFile);
      if (
        editingAccount.id === currentUser?.id ||
        editingAccount.email === currentUser?.email
      ) {
        updateProfile({
          name: updated.full_name,
          phone: updated.phone || '',
          avatar_url: updated.avatar_url || '',
        });
      }
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditingAccount(null);
      setMessage({
        type: 'success',
        text: roleChanged
          ? `Đã cập nhật thông tin và đổi vai trò sang ${accountDraft.role} cho ${editingAccount.email}.`
          : `Đã cập nhật thông tin tài khoản ${editingAccount.email}.`,
      });
      await loadAccounts();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể cập nhật thông tin.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const saveExistingPermissions = async () => {
    if (!permissionAccount) return;
    const isProtected =
      permissionAccount.role === 'CEO' || permissionAccount.email === currentUser?.email;
    try {
      setBusyId(permissionAccount.id);

      const sanitizedPermissions =
        permissionRoleDraft === 'MARKETING'
          ? permissionDraft.filter((p) => permissionAllowedForRole(p, 'MARKETING'))
          : permissionDraft;

      const payload: AccountUpdatePayload = {
        permissions: sanitizedPermissions,
      };

      const roleChanged =
        !isProtected &&
        can('website.permissions.manage') &&
        permissionRoleDraft !== permissionAccount.role;

      if (roleChanged) {
        payload.role = permissionRoleDraft;
      }

      await accountsApi.update(permissionAccount.id, payload);
      setPermissionAccount(null);
      setMessage({
        type: 'success',
        text: roleChanged
          ? `Đã đổi vai trò sang ${permissionRoleDraft} và cập nhật quyền cho ${permissionAccount.email}.`
          : `Đã cập nhật quyền thành công cho ${permissionAccount.email}.`,
      });
      await loadAccounts();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể cập nhật quyền/vai trò.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-module-page admin-module-page--accounts space-y-3.5 p-3.5 sm:p-5 max-w-[1680px] mx-auto text-[#2D1B14]">
      {/* 1. Header with Stats & Actions */}
      <AccountsHeader
        stats={stats}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        setActiveTab={setActiveTab}
        loading={loading}
        onRefresh={() => void loadAccounts()}
        canCreate={can('website.accounts.create')}
        onOpenCreate={() => {
          setForm({ ...emptyForm, permissions: [...presets.MARKETING] });
          setCreateOpen(true);
        }}
      />

      {/* Alert Notification Toast */}
      {message && (
        <div
          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition-all shadow-2xs ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{message.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Sub-Tabs & Filter Toolbar */}
      <AccountsFilterToolbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        accountsCount={visibleAccounts.length}
        query={query}
        setQuery={setQuery}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onClearFilters={() => {
          setQuery('');
          setRoleFilter('ALL');
          setStatusFilter('ALL');
        }}
      />

      {/* 3. Main Content Views */}
      {activeTab === 'accounts' && (
        <>
          {/* Desktop Table View */}
          <AccountsTableView
            accounts={visibleAccounts}
            currentUserEmail={currentUser?.email}
            currentUserRole={currentUser?.role}
            loading={loading}
            busyId={busyId}
            canUpdate={can('website.accounts.update')}
            canManagePermissions={can('website.permissions.manage')}
            canDisable={can('website.accounts.disable')}
            onOpenEdit={openAccountEditor}
            onOpenPermissions={openPermissionEditor}
            onIssueAccount={(account) => void issueAccount(account)}
            onRevokeSessions={(account) => void revokeSessions(account)}
            onToggleLock={(account) => void toggleLock(account)}
          />

          {/* Cards View (Mobile responsive only) */}
          <AccountsCardGrid
            accounts={visibleAccounts}
            currentUserEmail={currentUser?.email}
            currentUserRole={currentUser?.role}
            busyId={busyId}
            canUpdate={can('website.accounts.update')}
            canManagePermissions={can('website.permissions.manage')}
            canDisable={can('website.accounts.disable')}
            onOpenEdit={openAccountEditor}
            onOpenPermissions={openPermissionEditor}
            onIssueAccount={(account) => void issueAccount(account)}
            onRevokeSessions={(account) => void revokeSessions(account)}
            onToggleLock={(account) => void toggleLock(account)}
          />
        </>
      )}

      {/* Tab 2: Permission Matrix */}
      {activeTab === 'matrix' && (
        <PermissionMatrixTab presets={presets} dependencies={dependencies} />
      )}

      {/* Tab 3: Security & Policy */}
      {activeTab === 'policy' && <SecurityPolicyTab />}

      {/* 4. Modals */}
      {/* Modal: Create Profile */}
      <AccountCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        form={form}
        setForm={setForm}
        presets={presets}
        onSubmit={submitCreate}
        busy={busyId === 'create'}
        togglePermission={togglePermission}
      />

      {/* Modal: Edit Profile & Avatar */}
      <AccountEditModal
        editingAccount={editingAccount}
        accountDraft={accountDraft}
        setAccountDraft={setAccountDraft}
        avatarFile={avatarFile}
        avatarPreview={avatarPreview}
        currentUserEmail={currentUser?.email}
        canManagePermissions={can('website.permissions.manage')}
        busy={busyId === editingAccount?.id}
        onClose={closeAccountEditor}
        onSelectAvatar={selectAvatar}
        onSubmit={saveAccountInfo}
      />

      {/* Modal: Permission Studio */}
      <PermissionStudioModal
        permissionAccount={permissionAccount}
        permissionRoleDraft={permissionRoleDraft}
        permissionDraft={permissionDraft}
        permissionModalSearch={permissionModalSearch}
        setPermissionModalSearch={setPermissionModalSearch}
        presets={presets}
        currentUserEmail={currentUser?.email}
        canManagePermissions={can('website.permissions.manage')}
        busy={busyId === permissionAccount?.id}
        onClose={() => setPermissionAccount(null)}
        onRoleChange={handleRoleChangeInPermissionModal}
        onApplyPreset={(newPermissions) => setPermissionDraft([...newPermissions])}
        onTogglePermission={toggleExistingPermission}
        onToggleGroup={toggleGroupInDraft}
        onSave={saveExistingPermissions}
      />
    </div>
  );
}
