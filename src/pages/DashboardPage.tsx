import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';

const TODAY = new Date();
const CURRENT_MONTH = format(TODAY, 'yyyy-MM');

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function DashboardPage() {
  const { user } = useAuth();
  const userId = user!.id;

  const { transactions, loading: txLoading } = useTransactions({ userId, month: CURRENT_MONTH });
  const { budgets, loading: budgetLoading } = useBudgets(userId, CURRENT_MONTH);

  // ── Summary stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, count: transactions.length };
  }, [transactions]);

  // ── Spending by category (for pie chart) ─────────────────
  const categorySpend = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const key = t.category_id;
        if (!map[key]) map[key] = { name: t.category.name, value: 0, color: t.category.color };
        map[key].value += t.amount;
      });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [transactions]);

  // ── Daily spending (for area chart) ──────────────────────
  const dailyData = useMemo(() => {
    const start = startOfMonth(TODAY);
    const end = endOfMonth(TODAY);
    const days: Record<string, { date: string; income: number; expense: number }> = {};

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = format(d, 'yyyy-MM-dd');
      days[key] = { date: format(d, 'MMM d'), income: 0, expense: 0 };
    }

    transactions.forEach(t => {
      const key = t.date.slice(0, 10);
      if (days[key]) {
        if (t.type === 'income') days[key].income += t.amount;
        else days[key].expense += t.amount;
      }
    });

    return Object.values(days).slice(0, new Date().getDate());
  }, [transactions]);

  if (txLoading || budgetLoading) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 36, height: 36 }} />
        <p style={{ color: 'var(--clr-text-muted)' }}>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{format(TODAY, 'MMMM yyyy')} overview</p>
        </div>
      </div>

      <div className="page-body">
        {/* ── Stat cards ── */}
        <div className="stats-grid">
          <StatCard
            label="Total Balance"
            value={formatCurrency(stats.balance)}
            icon={<Wallet size={18} color="#a78bfa" />}
            iconBg="rgba(124,58,237,0.15)"
            positive={stats.balance >= 0}
          />
          <StatCard
            label="Income"
            value={formatCurrency(stats.income)}
            icon={<TrendingUp size={18} color="#10b981" />}
            iconBg="rgba(16,185,129,0.15)"
            positive={true}
          />
          <StatCard
            label="Expenses"
            value={formatCurrency(stats.expense)}
            icon={<TrendingDown size={18} color="#f43f5e" />}
            iconBg="rgba(244,63,94,0.15)"
            positive={false}
          />
          <StatCard
            label="Transactions"
            value={String(stats.count)}
            icon={<ArrowLeftRight size={18} color="#38bdf8" />}
            iconBg="rgba(56,189,248,0.15)"
          />
        </div>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          {/* ── Area chart ── */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--clr-text)' }}>
              Cash Flow — {format(TODAY, 'MMM yyyy')}
            </h2>
            {dailyData.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-icon">📊</div>
                <p className="empty-text">No transactions this month yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#7c8599', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7c8599', fontSize: 11 }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e2e8f0' }}
                    formatter={(v: unknown, name: unknown) => [formatCurrency(v as number), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" name="income" />
                  <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} fill="url(#expenseGrad)" name="expense" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Pie chart ── */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--clr-text)' }}>
              Spending by Category
            </h2>
            {categorySpend.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-icon">🍕</div>
                <p className="empty-text">No expenses recorded yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={categorySpend} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                      paddingAngle={3} dataKey="value" stroke="none">
                      {categorySpend.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e2e8f0' }}
                      formatter={(v: unknown) => [formatCurrency(v as number)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {categorySpend.map((item) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text)' }}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Budget progress ── */}
        {budgets.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--clr-text)' }}>Budget Progress</h2>
            <div className="grid-auto">
              {budgets.map((b) => {
                const pct = Math.min((b.spent / b.amount) * 100, 100);
                const over = b.spent > b.amount;
                const color = over ? '#f43f5e' : pct > 75 ? '#f59e0b' : '#10b981';
                return (
                  <div className="budget-card" key={b.id}>
                    <div className="budget-header">
                      <div className="budget-category">
                        <span className="budget-icon">{b.category.icon}</span>
                        <div>
                          <div className="budget-name">{b.category.name}</div>
                          <div className="budget-amounts">{formatCurrency(b.spent)} of {formatCurrency(b.amount)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="budget-footer">
                      <span className="budget-remaining" style={{ color: over ? 'var(--clr-expense)' : 'var(--clr-income)' }}>
                        {over ? `${formatCurrency(b.spent - b.amount)} over` : `${formatCurrency(b.amount - b.spent)} left`}
                      </span>
                      <span className="budget-pct">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recent transactions ── */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--clr-text)' }}>
            Recent Transactions
          </h2>
          {transactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💸</div>
              <div className="empty-title">No transactions yet</div>
              <div className="empty-text">Start adding transactions to see your financial activity here</div>
            </div>
          ) : (
            <div className="transaction-list">
              {transactions.slice(0, 8).map((tx) => (
                <div className="transaction-item" key={tx.id}>
                  <div className="tx-icon" style={{ background: `${tx.category.color}20` }}>
                    {tx.category.icon}
                  </div>
                  <div className="tx-info">
                    <div className="tx-title">{tx.title}</div>
                    <div className="tx-meta">
                      <span>{tx.category.name}</span>
                      <span>·</span>
                      <span>{format(new Date(tx.date), 'MMM d')}</span>
                    </div>
                  </div>
                  <div className={`tx-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({
  label, value, icon, iconBg, positive,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  positive?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {positive !== undefined && (
        <div className={`stat-change ${positive ? 'positive' : 'negative'}`}>
          {positive ? '↑' : '↓'} This month
        </div>
      )}
    </div>
  );
}
