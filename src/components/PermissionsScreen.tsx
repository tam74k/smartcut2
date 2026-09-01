import { useState, useMemo, useEffect } from 'react';
import { 
  Shield, Users, KeyRound, Plus, Edit2, Trash2, CheckCircle2, XCircle, 
  Search, Lock, Unlock, Eye, Check, X, ShieldAlert, Sparkles, UserCheck, 
  Layers, HelpCircle, Download
} from 'lucide-react';
import { AppUser, UserRole, ActionPermission, CustomRole, AppSettings, Branch } from '../types';
import { AuthService, ROLE_LABELS, SCREEN_CATALOG, ACTION_CATALOG, DEFAULT_ROLE_PRESETS } from '../services/auth';
import { SubscriptionService } from '../services/subscriptionService';
import { exportToExcel } from '../utils/exportExcel';
import { DB } from '../services/db';

export function PermissionsScreen({ 
  settings, 
  activeBranchId, 
  branches: propBranches, 
  currentUser 
}: { 
  settings: AppSettings;
  activeBranchId?: string;
  branches?: Branch[];
  currentUser?: AppUser | null;
}) {
  const currentSalonId = settings.salonId || currentUser?.salonId || '';

  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'matrix'>('users');
  const [users, setUsers] = useState<AppUser[]>(() => AuthService.getUsers(currentSalonId));
  const [roles, setRoles] = useState<CustomRole[]>(() => AuthService.getCustomRoles());
  const [branches, setBranches] = useState<Branch[]>(() => {
    if (propBranches && propBranches.length > 0) return propBranches;
    return SubscriptionService.getBranches(currentSalonId);
  });
  
  // Sync branches prop if updated
  useEffect(() => {
    if (propBranches && propBranches.length > 0) {
      setBranches(propBranches);
    }
  }, [propBranches]);

  // Load and sync users from Supabase Cloud DB
  useEffect(() => {
    const loadDbUsers = async () => {
      try {
        const dbUsers = await DB.fetchUsers(currentSalonId);
        if (dbUsers && dbUsers.length > 0) {
          const clean = dbUsers.filter(u => u.role !== 'programmer' && u.username !== 'programmer');
          setUsers(clean);
          AuthService.saveUsers(clean);
        } else {
          const local = AuthService.getUsers(currentSalonId);
          setUsers(local);
          for (const u of local) {
            await DB.saveUser({ ...u, salonId: currentSalonId, salonCode: settings.salonCode });
          }
        }
      } catch (e) {
        console.error('Failed to load users from DB:', e);
      }
    };
    loadDbUsers();
  }, [currentSalonId, settings.salonCode]);

  // Load and sync custom roles from Supabase Cloud DB
  useEffect(() => {
    const loadDbCustomRoles = async () => {
      try {
        await DB.clearDemoCustomRoles(currentSalonId);
        const dbRoles = await DB.fetchCustomRoles(currentSalonId);
        setRoles(dbRoles);
        AuthService.saveCustomRoles(dbRoles);
      } catch (e) {
        console.error('Failed to load custom roles from DB:', e);
      }
    };
    loadDbCustomRoles();
  }, [currentSalonId]);

  const isOwnerOrProgrammer = currentUser?.role === 'programmer' || (currentUser?.role === 'admin' && !currentUser?.branchId);
  const userBranchId = currentUser?.branchId || activeBranchId;

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(
    isOwnerOrProgrammer ? (activeBranchId || 'all') : (userBranchId || 'all')
  );

  useEffect(() => {
    if (isOwnerOrProgrammer) {
      if (activeBranchId) setSelectedBranchFilter(activeBranchId);
    } else if (userBranchId) {
      setSelectedBranchFilter(userBranchId);
    }
  }, [activeBranchId, userBranchId, isOwnerOrProgrammer]);

  const [searchTerm, setSearchTerm] = useState('');

  // User Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState<{
    name: string;
    username: string;
    password?: string;
    phone: string;
    role: UserRole;
    customRoleId?: string;
    branchId?: string;
    active: boolean;
    screens: string[];
    actions: ActionPermission[];
  }>({
    name: '',
    username: '',
    password: '',
    phone: '',
    role: 'cashier',
    customRoleId: '',
    branchId: activeBranchId || '',
    active: true,
    screens: ['pos', 'bookings', 'invoices', 'clients'],
    actions: ['pos_discount', 'manage_shifts', 'treasury_deposit']
  });

  // Custom Role Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    screens: string[];
    actions: ActionPermission[];
  }>({
    name: '',
    description: '',
    screens: ['pos', 'bookings', 'invoices'],
    actions: ['pos_discount', 'pos_reprint', 'manage_shifts']
  });

  const handleRoleSelect = (value: string) => {
    if (value.startsWith('custom:')) {
      const cId = value.replace('custom:', '');
      const selectedRole = roles.find(r => r.id === cId);
      setUserForm(prev => ({
        ...prev,
        role: 'custom',
        customRoleId: cId,
        screens: selectedRole ? [...selectedRole.screens] : [...DEFAULT_ROLE_PRESETS.custom.screens],
        actions: selectedRole ? [...selectedRole.actions] : [...DEFAULT_ROLE_PRESETS.custom.actions]
      }));
    } else {
      const selectedRole = value as UserRole;
      const preset = DEFAULT_ROLE_PRESETS[selectedRole] || DEFAULT_ROLE_PRESETS.cashier;
      setUserForm(prev => ({
        ...prev,
        role: selectedRole,
        customRoleId: '',
        screens: [...preset.screens],
        actions: [...preset.actions]
      }));
    }
  };

  // Grouped catalogs for convenient UI rendering
  const screenCategories = useMemo(() => {
    const map = new Map<string, typeof SCREEN_CATALOG>();
    SCREEN_CATALOG.forEach(s => {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    });
    return Array.from(map.entries());
  }, []);

  const actionCategories = useMemo(() => {
    const map = new Map<string, typeof ACTION_CATALOG>();
    ACTION_CATALOG.forEach(a => {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    });
    return Array.from(map.entries());
  }, []);

  // Filtered users list (Strict deduplication + salon isolation + branch filter)
  const filteredUsers = useMemo(() => {
    const seen = new Set<string>();
    const salonScopedUsers = users.filter(u => {
      if (u.role === 'programmer' || u.username === 'programmer') return false;
      if (u.salonId && currentSalonId && u.salonId !== currentSalonId) return false;
      const uName = (u.username || '').toLowerCase();
      if (seen.has(uName)) return false;
      seen.add(uName);
      return true;
    });

    return salonScopedUsers
      .filter(u => {
        if (selectedBranchFilter === 'all') return true;
        if (!u.branchId) {
          const mainBranch = branches.find(b => b.isMain) || branches[0];
          return selectedBranchFilter === mainBranch?.id || selectedBranchFilter === 'br-1001-main' || selectedBranchFilter === 'b-main';
        }
        return u.branchId === selectedBranchFilter;
      })
      .filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.phone && u.phone.includes(searchTerm))
      );
  }, [users, searchTerm, selectedBranchFilter, branches, currentSalonId]);

  // Handle Save User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.username.trim()) return;

    const cleanUsername = userForm.username.trim().toLowerCase();
    if (AuthService.isUsernameTaken(cleanUsername, editingUser?.id, currentSalonId)) {
      alert(`⚠️ اسم المستخدم (${userForm.username.trim()}) مستخدم مسبقاً في النظام. يرجى اختيار اسم مستخدم فريد.`);
      return;
    }

    let finalScreens = userForm.screens;
    let finalActions = userForm.actions;

    if (userForm.role === 'admin') {
      finalScreens = ['*'];
      finalActions = ['*'];
    } else if (userForm.role === 'custom' && userForm.customRoleId) {
      const selectedCustomRole = roles.find(r => r.id === userForm.customRoleId);
      if (selectedCustomRole) {
        finalScreens = selectedCustomRole.screens;
        finalActions = selectedCustomRole.actions;
      }
    }

    if (editingUser) {
      const updatedUser: AppUser = {
        ...editingUser,
        name: userForm.name.trim(),
        username: cleanUsername,
        password: userForm.password ? userForm.password : editingUser.password,
        phone: userForm.phone.trim(),
        role: userForm.role,
        customRoleId: userForm.customRoleId,
        branchId: userForm.branchId || undefined,
        salonId: currentSalonId,
        salonCode: settings.salonCode,
        active: userForm.active,
        screens: finalScreens,
        actions: finalActions
      };
      const updated = users.map(u => u.id === editingUser.id ? updatedUser : u);
      setUsers(updated);
      AuthService.saveUsers(updated);
      await DB.saveUser(updatedUser);
    } else {
      const newUser: AppUser = {
        id: 'usr-' + Math.random().toString(36).substring(2, 9),
        name: userForm.name.trim(),
        username: cleanUsername,
        password: userForm.password || '123',
        phone: userForm.phone.trim(),
        role: userForm.role,
        customRoleId: userForm.customRoleId,
        branchId: userForm.branchId || undefined,
        salonId: currentSalonId,
        salonCode: settings.salonCode,
        active: userForm.active,
        screens: finalScreens,
        actions: finalActions
      };
      const updated = [...users, newUser];
      setUsers(updated);
      AuthService.saveUsers(updated);
      await DB.saveUser(newUser);
    }
    setShowUserModal(false);
  };


  // Handle Save Custom Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return;

    if (editingRole) {
      const updatedRole: CustomRole = {
        ...editingRole,
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        screens: roleForm.screens,
        actions: roleForm.actions
      };
      const updated = roles.map(r => r.id === editingRole.id ? updatedRole : r);
      setRoles(updated);
      AuthService.saveCustomRoles(updated);
      await DB.saveCustomRole(updatedRole, currentSalonId);
    } else {
      const newRole: CustomRole = {
        id: 'role-custom-' + Math.random().toString(36).substring(2, 9),
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        screens: roleForm.screens,
        actions: roleForm.actions,
        createdAt: new Date().toISOString().split('T')[0],
        isSystem: false
      };
      const updated = [...roles, newRole];
      setRoles(updated);
      AuthService.saveCustomRoles(updated);
      await DB.saveCustomRole(newRole, currentSalonId);
    }
    setShowRoleModal(false);
  };

  // Delete Role
  const handleDeleteRole = async (roleId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الدور المخصص؟')) {
      const updated = roles.filter(r => r.id !== roleId);
      setRoles(updated);
      AuthService.saveCustomRoles(updated);
      await DB.deleteCustomRole(roleId);
    }
  };

  // Toggle helper for arrays
  const toggleItem = <T extends string>(list: T[], item: T): T[] => {
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  };

  return (
    <div className="p-4 sm:p-8 w-full h-full overflow-y-auto bg-slate-100/60 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Shield size={18} />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">نظام الصلاحيات وإدارة المستخدمين (RBAC)</h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">
            التحكم الدقيق في الوصول للشاشات والعمليات الحساسة، وإنشاء الأدوار المخصصة
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'users' ? (
            <button
              onClick={() => {
                setEditingUser(null);
                setUserForm({
                  name: '',
                  username: '',
                  password: '',
                  phone: '',
                  role: 'cashier',
                  customRoleId: '',
                  active: true,
                  screens: [...DEFAULT_ROLE_PRESETS.cashier.screens],
                  actions: [...DEFAULT_ROLE_PRESETS.cashier.actions]
                });
                setShowUserModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة مستخدم جديد</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingRole(null);
                setRoleForm({
                  name: '',
                  description: '',
                  screens: ['pos', 'bookings', 'invoices'],
                  actions: ['pos_discount', 'pos_reprint', 'manage_shifts']
                });
                setShowRoleModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>إنشاء دور مخصص جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-2xl w-fit mb-6 shadow-2xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users size={15} />
          <span>المستخدمين والحسابات ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'roles' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers size={15} />
          <span>الأدوار والصلاحيات المخصصة ({roles.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          {/* Branch Filter Selector */}
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {isOwnerOrProgrammer ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">🏢 تصفية بحسب الفرع:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedBranchFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedBranchFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🌐 جميع الفروع ({users.length})
                  </button>
                  {branches.map(b => {
                    const bCount = users.filter(u => {
                      if (!u.branchId) {
                        const mainB = branches.find(mb => mb.isMain) || branches[0];
                        return b.id === mainB?.id || b.id === 'br-1001-main' || b.id === 'b-main';
                      }
                      return u.branchId === b.id;
                    }).length;

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBranchFilter(b.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          selectedBranchFilter === b.id
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{b.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedBranchFilter === b.id ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {bCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span>🏢 مستخدمو فرع:</span>
                <span className="text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                  {branches.find(b => b.id === userBranchId)?.name || 'الفرع المخصص'}
                </span>
                <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {filteredUsers.length} مستخدم
                </span>
              </div>
            )}

            {isOwnerOrProgrammer && activeBranchId && (
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-lg">
                📍 الفرع النشط حالياً: {branches.find(b => b.id === activeBranchId)?.name || activeBranchId}
              </span>
            )}
          </div>

          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="البحث باسم المستخدم أو الهاتف..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 shadow-2xs"
              />
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              onClick={() => {
                const headers = ['المعرف', 'الاسم', 'اسم المستخدم', 'الدور', 'الهاتف', 'الحالة'];
                const rows = filteredUsers.map(u => [
                  u.id,
                  u.name,
                  u.username,
                  ROLE_LABELS[u.role] || u.role,
                  u.phone || '-',
                  u.active ? 'نشط' : 'معطل'
                ]);
                exportToExcel(`قائمة_المستخدمين_${new Date().toISOString().split('T')[0]}`, 'المستخدمين', headers, rows);
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Download size={14} />
              <span>تصدير Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-extrabold border-b border-slate-200">
                  <th className="py-3.5 px-4">المستخدم</th>
                  <th className="py-3.5 px-4">اسم الدخول</th>
                  <th className="py-3.5 px-4">الدور الوظيفي</th>
                  <th className="py-3.5 px-4">الشاشات المسموحة</th>
                  <th className="py-3.5 px-4">العمليات الحساسة</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => {
                  const customRole = roles.find(r => r.id === user.customRoleId);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-xs">{user.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{user.phone || 'بدون هاتف'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">@{user.username}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border text-[11px] ${
                          user.role === 'admin' 
                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                            : user.role === 'custom'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {user.role === 'custom' && customRole ? customRole.name : (ROLE_LABELS[user.role] || user.role)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {user.role === 'admin' || user.screens?.includes('*') ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            كافة الشاشات ⭐
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                            {user.screens?.length || 0} شاشات
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {user.role === 'admin' || user.actions?.includes('*') ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            كافة العمليات ⭐
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                            {user.actions?.length || 0} عملية مصرح بها
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          user.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {user.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          <span>{user.active ? 'نشط' : 'معطل'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setUserForm({
                                name: user.name,
                                username: user.username,
                                password: '',
                                phone: user.phone || '',
                                role: user.role,
                                customRoleId: user.customRoleId || '',
                                branchId: user.branchId || '',
                                active: user.active,
                                screens: user.screens || [],
                                actions: user.actions || []
                              });
                              setShowUserModal(true);
                            }}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="تعديل المستخدم"
                          >
                            <Edit2 size={15} />
                          </button>
                          {user.id !== 'usr-admin' && (
                            <button
                              onClick={async () => {
                                if (confirm(`هل أنت متأكد من حذف المستخدم ${user.name}؟`)) {
                                  const updated = users.filter(u => u.id !== user.id);
                                  setUsers(updated);
                                  AuthService.saveUsers(updated);
                                  await DB.deleteUser(user.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف المستخدم"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS CATALOG */}
      {activeTab === 'roles' && (
        <div className="space-y-6 mb-12">
          {/* Sub-header info */}
          <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-black text-indigo-950 text-sm">دليل الأدوار وقوالب الصلاحيات الموحدة</h3>
              <p className="text-indigo-700 text-xs mt-0.5">
                يمكنك تخصيص وتعديل صلاحيات أي دور أساسي، أو إنشاء أدوار مخصصة جديدة لتطبيقها بنقرة واحدة على المستخدمين.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingRole(null);
                setRoleForm({
                  name: '',
                  description: '',
                  screens: ['pos', 'bookings', 'invoices'],
                  actions: ['pos_discount', 'pos_reprint', 'manage_shifts']
                });
                setShowRoleModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>إضافة دور مخصص جديد</span>
            </button>
          </div>

          {roles.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <KeyRound size={32} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base">لا توجد أدوار مخصصة حالياً</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  قاعدة بيانات الأدوار المخصصة (custom_roles) في سوبابيز فارغة وجاهزة لإضافة أدوار وظيفية جديدة بصلاحيات وشاشات محددة وفق متطلبات منشأتك.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingRole(null);
                  setRoleForm({
                    name: '',
                    description: '',
                    screens: ['pos', 'bookings', 'invoices'],
                    actions: ['pos_discount', 'pos_reprint', 'manage_shifts']
                  });
                  setShowRoleModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs inline-flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>إنشاء أول دور مخصص</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roles.map(role => {
                const assignedUsersCount = users.filter(u => 
                  u.customRoleId === role.id || 
                  (role.id === 'role-admin' && u.role === 'admin') ||
                  (role.id === 'role-supervisor' && u.role === 'supervisor') ||
                  (role.id === 'role-accountant' && u.role === 'accountant') ||
                  (role.id === 'role-warehouse-manager' && u.role === 'warehouse_manager') ||
                  (role.id === 'role-cashier' && u.role === 'cashier') ||
                  (role.id === 'role-receptionist' && u.role === 'receptionist') ||
                  (role.id === 'role-barber' && u.role === 'barber')
                ).length;

                return (
                  <div 
                    key={role.id}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                            role.isSystem ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            <KeyRound size={20} />
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                            role.isSystem 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}>
                            {role.isSystem ? '👑 دور أساسي قياسي' : '💎 دور مخصص'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingRole(role);
                              setRoleForm({
                                name: role.name,
                                description: role.description || '',
                                screens: role.screens,
                                actions: role.actions
                              });
                              setShowRoleModal(true);
                            }}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            title="تعديل صلاحيات الدور"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                              title="حذف الدور المخصص"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="font-black text-base text-slate-900 mb-1">{role.name}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed mb-4 min-h-[36px]">
                        {role.description || 'لا يوجد وصف مخصص لهذا الدور'}
                      </p>

                      <div className="space-y-2 pt-3 border-t border-slate-100 text-xs font-bold">
                        <div className="flex justify-between items-center text-slate-700">
                          <span>الشاشات المصرح بدخولها:</span>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black">
                            {role.screens.includes('*') ? 'كافة الشاشات (22)' : `${role.screens.length} من ${SCREEN_CATALOG.length}`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-700">
                          <span>العمليات المصرح بها:</span>
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-black">
                            {role.actions.includes('*') ? 'كافة العمليات (27)' : `${role.actions.length} من ${ACTION_CATALOG.length}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                      <button
                        onClick={() => {
                          setEditingRole(role);
                          setRoleForm({
                            name: role.name,
                            description: role.description || '',
                            screens: role.screens,
                            actions: role.actions
                          });
                          setShowRoleModal(true);
                        }}
                        className="text-indigo-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={12} />
                        <span>تخصيص الشاشات والعمليات</span>
                      </button>
                      <span className="font-bold text-slate-600">المستخدمين: {assignedUsersCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form 
            onSubmit={handleSaveUser}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Users size={16} />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingUser ? 'تعديل بيانات وصلاحيات المستخدم' : 'إضافة مستخدم جديد'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={userForm.phone}
                  onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المستخدم (Login Username) *</label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="ahmed123"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? 'اترك فارغاً للإبقاء على الحالية' : '••••••••'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الدور الوظيفي / قالب الصلاحية</label>
                <select
                  value={userForm.role === 'custom' && userForm.customRoleId ? `custom:${userForm.customRoleId}` : userForm.role}
                  onChange={e => handleRoleSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold text-slate-800"
                >
                  <optgroup label="👑 الأدوار القياسية الأساسية">
                    <option value="owner">مالك الصالون (Executive Owner - بوابة المالك التنفيذية)</option>
                    <option value="admin">مدير النظام (Admin - كافة الصلاحيات)</option>
                    <option value="supervisor">مشرف صالون عام (Supervisor)</option>
                    <option value="accountant">محاسب مالي (Accountant)</option>
                    <option value="warehouse_manager">مسؤول المخزن والمستودع (Warehouse Manager)</option>
                    <option value="cashier">كاشير (Cashier)</option>
                    <option value="receptionist">موظف استقبال (Receptionist)</option>
                    <option value="barber">فني / حلاق (Barber)</option>
                  </optgroup>
                  {roles.length > 0 && (
                    <optgroup label="💎 الأدوار والصلاحيات المخصصة (Custom Roles)">
                      {roles.map(r => (
                        <option key={r.id} value={`custom:${r.id}`}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الفرع المخصص للعمل 🏢</label>
                {isOwnerOrProgrammer ? (
                  <>
                    <select
                      value={userForm.branchId || ''}
                      onChange={e => setUserForm({ ...userForm, branchId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold text-slate-800"
                    >
                      <option value="">كافة الفروع (حساب عام / إدارة مالك الصالون)</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code || b.country}) {b.isMain ? '⭐ رئيسي' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {userForm.branchId ? '⚠️ سيتم تقييد هذا المستخدم بالعمل والاطلاع فقط على هذا الفرع ومنع الانتقال لفروع أخرى.' : '👑 هذا المستخدم يملك صلاحية الاطلاع والتنقل بين كافة الفروع (المالك / الإدارة).'}
                    </p>
                  </>
                ) : (
                  <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold flex items-center justify-between">
                    <span>{branches.find(b => b.id === userBranchId)?.name || 'الفرع المخصص'}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">🔒 مقفل تلقائياً لفرعك</span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom permission override if custom selected or non-admin */}
            {userForm.role !== 'admin' && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert size={16} className="text-indigo-600" />
                  <span>تخصيص الشاشات والعمليات للمستخدم</span>
                </h4>

                {/* Screens Matrix */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-800">الشاشات المسموح بدخولها ({userForm.screens.length})</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUserForm({ ...userForm, screens: SCREEN_CATALOG.map(s => s.id) })}
                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserForm({ ...userForm, screens: [] })}
                        className="text-[10px] text-rose-500 font-bold hover:underline"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {SCREEN_CATALOG.map(screen => (
                      <label 
                        key={screen.id}
                        className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          userForm.screens.includes(screen.id)
                            ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={userForm.screens.includes(screen.id)}
                          onChange={() => setUserForm({
                            ...userForm,
                            screens: toggleItem(userForm.screens, screen.id)
                          })}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <div className="flex-1">
                          <p className="leading-tight">{screen.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">{screen.category}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions Matrix */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-800">العمليات والخزائن المصرح بها ({userForm.actions.length})</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUserForm({ ...userForm, actions: ACTION_CATALOG.map(a => a.id) })}
                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserForm({ ...userForm, actions: [] })}
                        className="text-[10px] text-rose-500 font-bold hover:underline"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {ACTION_CATALOG.map(action => (
                      <label 
                        key={action.id}
                        className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          userForm.actions.includes(action.id)
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={userForm.actions.includes(action.id)}
                          onChange={() => setUserForm({
                            ...userForm,
                            actions: toggleItem(userForm.actions, action.id)
                          })}
                          className="mt-0.5 accent-emerald-600"
                        />
                        <div className="flex-1">
                          <p className="leading-tight">{action.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">{action.category}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                حفظ بيانات المستخدم
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTOM ROLE MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form 
            onSubmit={handleSaveRole}
            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <KeyRound size={16} />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingRole ? 'تعديل الدور المخصص' : 'إنشاء دور وصلاحية مخصصة جديدة'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الدور المخصص *</label>
                <input
                  type="text"
                  required
                  value={roleForm.name}
                  onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="مثال: مشرف عام الفرع / كاشير متقدم / محاسب مخازن"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-extrabold text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف الصلاحيات والمهام</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="وصف مختصر للمهام والمسؤوليات الموكلة لهذا الدور..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Screens Selection by Category */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-sm text-slate-900">
                  1. الشاشات المسموح بالدخول إليها ({roleForm.screens.length} من {SCREEN_CATALOG.length})
                </h4>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRoleForm({ ...roleForm, screens: SCREEN_CATALOG.map(s => s.id) })}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleForm({ ...roleForm, screens: [] })}
                    className="text-rose-500 font-bold hover:underline"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {screenCategories.map(([category, items]) => (
                  <div key={category} className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <p className="font-black text-xs text-slate-800 mb-2 border-b border-slate-200 pb-1 flex items-center justify-between">
                      <span>{category}</span>
                      <span className="text-[10px] text-slate-500">
                        {items.filter(i => roleForm.screens.includes(i.id)).length} / {items.length}
                      </span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {items.map(screen => (
                        <label
                          key={screen.id}
                          className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            roleForm.screens.includes(screen.id)
                              ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={roleForm.screens.includes(screen.id)}
                            onChange={() => setRoleForm({
                              ...roleForm,
                              screens: toggleItem(roleForm.screens, screen.id)
                            })}
                            className="mt-0.5 accent-emerald-600"
                          />
                          <div>
                            <p className="leading-tight">{screen.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">{screen.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions & Operations Selection by Category */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-sm text-slate-900">
                  2. صلاحيات العمليات والخزائن ({roleForm.actions.length} من {ACTION_CATALOG.length})
                </h4>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRoleForm({ ...roleForm, actions: ACTION_CATALOG.map(a => a.id) })}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleForm({ ...roleForm, actions: [] })}
                    className="text-rose-500 font-bold hover:underline"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {actionCategories.map(([category, items]) => (
                  <div key={category} className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <p className="font-black text-xs text-slate-800 mb-2 border-b border-slate-200 pb-1 flex items-center justify-between">
                      <span>{category}</span>
                      <span className="text-[10px] text-slate-500">
                        {items.filter(i => roleForm.actions.includes(i.id)).length} / {items.length}
                      </span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {items.map(action => (
                        <label
                          key={action.id}
                          className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            roleForm.actions.includes(action.id)
                              ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={roleForm.actions.includes(action.id)}
                            onChange={() => setRoleForm({
                              ...roleForm,
                              actions: toggleItem(roleForm.actions, action.id)
                            })}
                            className="mt-0.5 accent-emerald-600"
                          />
                          <div>
                            <p className="leading-tight">{action.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">{action.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
              >
                حفظ الدور المخصص
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
