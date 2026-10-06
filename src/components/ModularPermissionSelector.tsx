import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Wallet, Package, UserCheck, Users, Shield, 
  Search, CheckSquare, Square, Check, X, Sparkles, Filter, 
  Layers, CheckCircle2, ChevronRight
} from 'lucide-react';
import { ActionPermission } from '../types';
import { SCREEN_CATALOG, ACTION_CATALOG, ScreenMeta, ActionMeta } from '../services/auth';

export interface SystemModule {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  headerBgClass: string;
  screenIds: string[];
  actionIds: ActionPermission[];
}

export const NEW_PERMISSIONS: Record<string, { label: string; badgeClass: string; desc: string }> = {
  manage_expense_categories: {
    label: '⭐ جديد: بنود وتصنيفات الصرف',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
    desc: 'إضافة وتعديل وحذف بنود وتصنيفات شجرة المصروفات بدقة'
  },
  export_excel: {
    label: '⭐ جديد: تصدير Excel لكافة الشاشات',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold',
    desc: 'تصدير وتحميل شيتات الإكسل والجداول في جميع الشاشات والتقارير'
  },
  manage_hr_actions: {
    label: '⭐ شامل: كافة إجراءات شؤون العاملين (HR Actions)',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-extrabold',
    desc: 'صلاحية شاملة لكافة إجراءات HR: السلف، الجزاءات، المكافآت، الإجازات، والأذونات'
  },
  hr_manage_advances: {
    label: '💵 صرف وإدارة السلف النقدية',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
    desc: 'السماح بصرف السلف النقدية السريعة وسندات السلف على حساب الراتب من الخزائن'
  },
  hr_manage_penalties: {
    label: '⚠️ تطبيق الجزاءات والخصومات',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold',
    desc: 'السماح بخصم مبالغ نقدية أو خصم أيام جزاءات إدارية من الموظفين'
  },
  hr_manage_bonuses: {
    label: '🎁 تسجيل وصرف المكافآت والحوافز',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold',
    desc: 'السماح بصرف مكافآت التميز وحوافز الأداء والتقدير المالي للموظفين'
  },
  hr_manage_leaves: {
    label: '🏖️ إدارة وتسجيل الإجازات',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 font-extrabold',
    desc: 'تسجيل واعتماد وحذف إجازات الموظفين (مدفوعة وبدون أجر) في التايم شيت'
  },
  hr_manage_permissions: {
    label: '⏱️ أذونات الاستئذان والمأموريات',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-extrabold',
    desc: 'تسجيل وإقرار أذونات الخروج المؤقت والمأموريات الرسمية'
  },
  hr_manage_attendance: {
    label: '🕒 تعديل الحضور والدوام اليدوي',
    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 font-extrabold',
    desc: 'تسجيل وتعديل بصمات الحضور والانصراف يدوياً وضبط سجلات الدوام'
  },
  hr_approve_delays_overtime: {
    label: '✨ العفو عن التأخيرات والأوفرتايم',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 font-extrabold',
    desc: 'العفو عن دقائق التأخير واعتماد أو رفض ساعات العمل الإضافي (الأوفرتايم)'
  },
  hr_manage_salary_increments: {
    label: '📈 إقرار وتعديل زيادات الرواتب',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-extrabold',
    desc: 'منح وتطبيق زيادات الرواتب الأساسية وتوثيقها في السجل التاريخي'
  },
  hr_disburse_payroll: {
    label: '💳 صرف مسير الرواتب الشهرية',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300 font-extrabold',
    desc: 'اعتماد وصرف مسير الرواتب الشهرية وإخراج السيولة النقدية من الخزائن'
  },
  hr_manage_commissions: {
    label: '💎 تصفية وصرف العمولات',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-300 font-extrabold',
    desc: 'اعتماد وتصفية وصرف عمولات الخدمات والمبيعات المستحقة للموظفين'
  }
};

export const SYSTEM_MODULES: SystemModule[] = [
  {
    id: 'sales',
    name: 'المبيعات ونقطة البيع وطابور الانتظار والحجوزات',
    shortName: 'المبيعات والكاشير',
    description: 'شاشة الكاشير POS، كشك حجز الأدوار (Kiosk)، المناداة، الحجوزات، الفواتير ومرتجع المبيعات',
    icon: ShoppingCart,
    color: 'emerald',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    headerBgClass: 'bg-emerald-50/80',
    screenIds: ['pos', 'kiosk', 'queue_calling', 'bookings', 'invoices', 'sales_returns'],
    actionIds: [
      'pos_discount',
      'pos_custom_price',
      'pos_void',
      'pos_reprint',
      'sales_return',
      'manage_invoices_delete',
      'manage_queue',
      'manage_booking_settings',
      'manage_bookings_delete'
    ]
  },
  {
    id: 'finance',
    name: 'الماليات والورديات والخزائن والمصروفات',
    shortName: 'الماليات والخزائن',
    description: 'إدارة الورديات، تقرير Z، إيداع وسحب الخزائن، وسندات وبنود وتصنيفات المصروفات',
    icon: Wallet,
    color: 'blue',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    borderClass: 'border-blue-200',
    headerBgClass: 'bg-blue-50/80',
    screenIds: ['treasury', 'expenses'],
    actionIds: [
      'manage_shifts',
      'edit_shift_cash',
      'treasury_deposit',
      'treasury_withdraw',
      'treasury_transfer',
      'treasury_view_balance',
      'manage_expenses',
      'manage_expense_categories' // ⭐ جديد: إضافة وتعديل بنود الصرف
    ]
  },
  {
    id: 'warehouse',
    name: 'المخزون والمستودع والمشتريات والموردين',
    shortName: 'المخزون والمستودع',
    description: 'دليل المنتجات، استيراد وتصدير الإكسل، كشوف الموردين، فواتير الشراء، والجرد الدوري',
    icon: Package,
    color: 'amber',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    borderClass: 'border-amber-200',
    headerBgClass: 'bg-amber-50/80',
    screenIds: ['warehouse', 'warehouse_products', 'warehouse_suppliers', 'warehouse_purchases', 'warehouse_inventory', 'warehouse_shortages'],
    actionIds: [
      'manage_products',
      'import_products_excel',
      'manage_suppliers',
      'manage_purchases',
      'manage_inventory'
    ]
  },
  {
    id: 'hr',
    name: 'شؤون العاملين والموظفين والرواتب (HR)',
    shortName: 'شؤون الموظفين (HR)',
    description: 'سجلات الكادر الفني والإداري، الرواتب والعمولات، التايم شيت، وإجراءات HR المتكاملة',
    icon: UserCheck,
    color: 'purple',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    borderClass: 'border-purple-200',
    headerBgClass: 'bg-purple-50/80',
    screenIds: ['employees'],
    actionIds: [
      'manage_employees',
      'manage_salaries',
      'manage_hr',
      'manage_hr_actions', // ⭐ شامل: كافة إجراءات شؤون العاملين
      'hr_manage_advances', // 💵 صرف وإدارة السلف
      'hr_manage_penalties', // ⚠️ تطبيق الجزاءات والخصومات
      'hr_manage_bonuses', // 🎁 تسجيل وصرف المكافآت
      'hr_manage_leaves', // 🏖️ إدارة وتسجيل الإجازات
      'hr_manage_permissions', // ⏱️ أذونات الاستئذان والمأموريات
      'hr_manage_attendance', // 🕒 تعديل الحضور والدوام اليدوي
      'hr_approve_delays_overtime', // ✨ العفو عن التأخيرات والأوفرتايم
      'hr_manage_salary_increments', // 📈 إقرار وتعديل زيادات الرواتب
      'hr_disburse_payroll', // 💳 صرف مسير الرواتب الشهرية
      'hr_manage_commissions' // 💎 تصفية وصرف العمولات
    ]
  },
  {
    id: 'services_clients',
    name: 'الخدمات والعملاء والشكاوى والولاء',
    shortName: 'الخدمات والعملاء',
    description: 'دليل الخدمات والأسعار، سجل العملاء ونقاط الولاء، وإدارة الشكاوى وسجل الضمان',
    icon: Users,
    color: 'teal',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    borderClass: 'border-teal-200',
    headerBgClass: 'bg-teal-50/80',
    screenIds: ['services', 'clients', 'complaints'],
    actionIds: [
      'manage_clients'
    ]
  },
  {
    id: 'reports_admin',
    name: 'لوحة المؤشرات والتقارير والإدارة العامة والنظام',
    shortName: 'التقارير والإدارة العامة',
    description: 'بوابات المالك والفني، المؤشرات العامة، التقارير التحليلية، تصدير الإكسل، وإعدادات المنشأة',
    icon: Shield,
    color: 'rose',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    borderClass: 'border-rose-200',
    headerBgClass: 'bg-rose-50/80',
    screenIds: ['owner_portal', 'barber_portal', 'dashboard', 'reports', 'permissions', 'saas_subscriptions', 'ai_assistant', 'settings'],
    actionIds: [
      'view_reports',
      'view_system_analytics',
      'view_employee_analytics',
      'export_excel', // ⭐ جديد: تصدير الجداول والتقارير إلى Excel
      'manage_settings',
      'manage_rbac'
    ]
  }
];

export interface ModularPermissionSelectorProps {
  selectedScreens: string[];
  selectedActions: ActionPermission[];
  onToggleScreen: (screenId: string) => void;
  onToggleAction: (actionId: ActionPermission) => void;
  onSetScreens: (screens: string[]) => void;
  onSetActions: (actions: ActionPermission[]) => void;
  theme?: 'indigo' | 'emerald';
}

export function ModularPermissionSelector({
  selectedScreens,
  selectedActions,
  onToggleScreen,
  onToggleAction,
  onSetScreens,
  onSetActions,
  theme = 'indigo'
}: ModularPermissionSelectorProps) {
  const [activeModuleTab, setActiveModuleTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Screen and Action metadata lookups
  const screenMetaMap = useMemo(() => {
    const map = new Map<string, ScreenMeta>();
    SCREEN_CATALOG.forEach(s => map.set(s.id, s));
    return map;
  }, []);

  const actionMetaMap = useMemo(() => {
    const map = new Map<ActionPermission, ActionMeta>();
    ACTION_CATALOG.forEach(a => map.set(a.id, a));
    return map;
  }, []);

  // Filter modules and items based on search and active tab
  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return SYSTEM_MODULES.map(module => {
      // Screens in this module
      const moduleScreens = module.screenIds
        .map(id => screenMetaMap.get(id))
        .filter((s): s is ScreenMeta => Boolean(s));

      // Actions in this module
      const moduleActions = module.actionIds
        .map(id => actionMetaMap.get(id))
        .filter((a): a is ActionMeta => Boolean(a));

      // If no query, return as is
      if (!query) {
        return {
          module,
          screens: moduleScreens,
          actions: moduleActions,
          matchesTab: activeModuleTab === 'all' || activeModuleTab === module.id
        };
      }

      // Filter screens and actions matching query
      const matchedScreens = moduleScreens.filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.description.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query)
      );

      const matchedActions = moduleActions.filter(a => 
        a.name.toLowerCase().includes(query) || 
        a.description.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query)
      );

      const moduleNameMatches = module.name.toLowerCase().includes(query) || 
                                module.shortName.toLowerCase().includes(query) ||
                                module.description.toLowerCase().includes(query);

      return {
        module,
        screens: moduleNameMatches ? moduleScreens : matchedScreens,
        actions: moduleNameMatches ? moduleActions : matchedActions,
        matchesTab: activeModuleTab === 'all' || activeModuleTab === module.id
      };
    }).filter(item => {
      if (!item.matchesTab) return false;
      if (!searchQuery.trim()) return true;
      return item.screens.length > 0 || item.actions.length > 0;
    });
  }, [screenMetaMap, actionMetaMap, activeModuleTab, searchQuery]);

  // Bulk actions for a specific module
  const handleSelectModuleAll = (module: SystemModule) => {
    const newScreens = Array.from(new Set([...selectedScreens, ...module.screenIds]));
    const newActions = Array.from(new Set([...selectedActions, ...module.actionIds]));
    onSetScreens(newScreens);
    onSetActions(newActions);
  };

  const handleDeselectModuleAll = (module: SystemModule) => {
    const newScreens = selectedScreens.filter(id => !module.screenIds.includes(id));
    const newActions = selectedActions.filter(id => !module.actionIds.includes(id));
    onSetScreens(newScreens);
    onSetActions(newActions);
  };

  // Bulk actions system-wide
  const handleSelectAllSystem = () => {
    onSetScreens(SCREEN_CATALOG.map(s => s.id));
    onSetActions(ACTION_CATALOG.map(a => a.id));
  };

  const handleDeselectAllSystem = () => {
    onSetScreens([]);
    onSetActions([]);
  };

  const activeColorBtn = theme === 'indigo' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm';
  const accentBorderColor = theme === 'indigo' ? 'border-indigo-500' : 'border-emerald-500';

  return (
    <div className="space-y-4">
      {/* Top Controls: System-wide counts and actions */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-extrabold text-slate-800">إجمالي الصلاحيات المختارة:</span>
          <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-0.5 rounded-lg font-bold">
            🖥️ {selectedScreens.length} من {SCREEN_CATALOG.length} شاشة
          </span>
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-bold">
            ⚡ {selectedActions.length} من {ACTION_CATALOG.length} عملية
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleSelectAllSystem}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center gap-1 cursor-pointer"
          >
            <CheckSquare size={14} />
            <span>تحديد الكل بالنظام</span>
          </button>
          <button
            type="button"
            onClick={handleDeselectAllSystem}
            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Square size={14} />
            <span>إلغاء تحديد الكل</span>
          </button>
        </div>
      </div>

      {/* Search and Module Tabs Bar */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث فوري في الشاشات أو العمليات أو أقسام النظام..."
            className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-9 py-2 text-xs font-semibold outline-none focus:border-indigo-500 shadow-2xs"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Module Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveModuleTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeModuleTab === 'all'
                ? activeColorBtn
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers size={14} />
            <span>كافة الأقسام (6)</span>
          </button>

          {SYSTEM_MODULES.map(mod => {
            const ModIcon = mod.icon;
            const selScreensCount = mod.screenIds.filter(id => selectedScreens.includes(id)).length;
            const selActionsCount = mod.actionIds.filter(id => selectedActions.includes(id)).length;
            const isFull = selScreensCount === mod.screenIds.length && selActionsCount === mod.actionIds.length;
            const isPartial = (selScreensCount > 0 || selActionsCount > 0) && !isFull;

            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveModuleTab(mod.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeModuleTab === mod.id
                    ? activeColorBtn
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ModIcon size={14} />
                <span>{mod.shortName}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeModuleTab === mod.id 
                    ? 'bg-white/20 text-white' 
                    : isFull 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : isPartial 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {selScreensCount + selActionsCount}/{mod.screenIds.length + mod.actionIds.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {filteredModules.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-bold">
            لا توجد شاشات أو عمليات تطابق كلمة البحث "{searchQuery}"
          </div>
        ) : (
          filteredModules.map(({ module, screens, actions }) => {
            const ModIcon = module.icon;
            const selScreensCount = module.screenIds.filter(id => selectedScreens.includes(id)).length;
            const selActionsCount = module.actionIds.filter(id => selectedActions.includes(id)).length;
            const isAllSelected = selScreensCount === module.screenIds.length && selActionsCount === module.actionIds.length;

            return (
              <div 
                key={module.id} 
                className={`bg-white rounded-2xl border ${module.borderClass} shadow-2xs overflow-hidden`}
              >
                {/* Module Section Header */}
                <div className={`p-3.5 ${module.headerBgClass} border-b ${module.borderClass} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white shadow-2xs flex items-center justify-center text-slate-800">
                      <ModIcon size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">{module.name}</h4>
                        {isAllSelected && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <CheckCircle2 size={11} />
                            <span>مكتمل</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{module.description}</p>
                    </div>
                  </div>

                  {/* Module Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-xs">
                    <span className="text-[11px] font-bold text-slate-600 bg-white/80 px-2 py-1 rounded-lg border border-slate-200">
                      {selScreensCount}/{module.screenIds.length} شاشات • {selActionsCount}/{module.actionIds.length} عمليات
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectModuleAll(module)}
                      className="text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      تحديد القسم
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeselectModuleAll(module)}
                      className="text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>

                <div className="p-3 sm:p-4 space-y-4">
                  {/* Subsection 1: Screens */}
                  {screens.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                        <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span>🖥️ الشاشات المسموح بالدخول إليها</span>
                          <span className="text-[10px] text-slate-400 font-bold">({selScreensCount} من {module.screenIds.length})</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {screens.map(screen => {
                          const isChecked = selectedScreens.includes(screen.id);
                          return (
                            <label
                              key={screen.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => onToggleScreen(screen.id)}
                                className="mt-0.5 accent-indigo-600 rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="leading-tight text-xs">{screen.name}</p>
                                <p className="text-[10px] text-slate-400 font-normal mt-0.5 line-clamp-1">
                                  {screen.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Subsection 2: Sensitive Actions & Operations */}
                  {actions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                        <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span>⚡ العمليات والإجراءات الحساسة المسموح بها</span>
                          <span className="text-[10px] text-slate-400 font-bold">({selActionsCount} من {module.actionIds.length})</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {actions.map(action => {
                          const isChecked = selectedActions.includes(action.id);
                          const newPermInfo = NEW_PERMISSIONS[action.id];

                          return (
                            <label
                              key={action.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => onToggleAction(action.id)}
                                className="mt-0.5 accent-emerald-600 rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                  <p className="leading-tight text-xs">{action.name}</p>
                                  {newPermInfo && (
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md border ${newPermInfo.badgeClass}`}>
                                      {newPermInfo.label}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-normal line-clamp-1">
                                  {action.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
