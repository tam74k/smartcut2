import { Scissors, Calendar, LayoutDashboard, Receipt, Menu, Smartphone } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
  canAccess: (screen: string) => boolean;
}

export function MobileBottomNav({ activeTab, setActiveTab, onOpenMobileMenu, canAccess }: MobileBottomNavProps) {
  const mainTabs = [
    { id: 'owner_portal', label: 'نبض المالك', icon: Smartphone },
    { id: 'pos', label: 'الكاشير', icon: Scissors },
    { id: 'bookings', label: 'الحجوزات', icon: Calendar },
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'invoices', label: 'الفواتير', icon: Receipt },
  ].filter(t => canAccess(t.id));

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-2 py-1.5 shadow-lg flex items-center justify-around">
      {mainTabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isActive 
                ? 'text-emerald-600 font-extrabold bg-emerald-50 scale-105' 
                : 'text-slate-500 font-semibold hover:text-slate-800'
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}

      <button
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 font-semibold hover:text-slate-800 transition-all"
      >
        <Menu size={20} strokeWidth={1.8} />
        <span className="text-[10px] mt-0.5">القائمة</span>
      </button>
    </div>
  );
}
