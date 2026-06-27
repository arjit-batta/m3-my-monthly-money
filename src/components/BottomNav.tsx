import { NavLink } from '@/components/NavLink';
import { PlusCircle, Wallet, BarChart3, Settings, Repeat } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Add', icon: PlusCircle },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/subscriptions', label: 'Subs', icon: Repeat },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className="flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
