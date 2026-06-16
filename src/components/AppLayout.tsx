import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Target, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = (user?.user_metadata?.display_name as string ?? user?.email ?? '?')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const displayName = (user?.user_metadata?.display_name as string) ?? user?.email?.split('@')[0] ?? 'User';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">💰</div>
          <span className="sidebar-logo-text">BudgetBuddy</span>
        </div>

        <p className="nav-section-label">Menu</p>
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/" end id="nav-dashboard">
              <LayoutDashboard size={16} />
              Dashboard
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/transactions" id="nav-transactions">
              <ArrowLeftRight size={16} />
              Transactions
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/budgets" id="nav-budgets">
              <Target size={16} />
              Budgets
            </NavLink>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="user-card" onClick={handleSignOut} id="user-signout-btn" title="Sign out">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{displayName}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <LogOut size={14} color="var(--clr-text-muted)" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
