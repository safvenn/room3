import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function addMonths(dateStr: string, n: number): string {
  const [year, mon] = dateStr.split('-').map(Number);
  const d = new Date(year, mon - 1 + n, 1);
  return format(d, 'yyyy-MM');
}

export function BudgetsPage() {
  const { user } = useAuth();
  const userId = user!.id;

  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { budgets, loading, upsertBudget, deleteBudget } = useBudgets(userId, month);
  const { categories } = useCategories(userId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category_id: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: 'category_id' | 'amount') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd = () => {
    const usedCategoryIds = new Set(budgets.map((b) => b.category_id));
    const firstFree = categories.find((c) => !usedCategoryIds.has(c.id));
    setForm({ category_id: firstFree?.id ?? categories[0]?.id ?? '', amount: '' });
    setEditingId(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (id: string, categoryId: string, amount: number) => {
    setForm({ category_id: categoryId, amount: String(amount) });
    setEditingId(id);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const { error } = await upsertBudget({
      category_id: form.category_id,
      month,
      amount: parseFloat(form.amount),
    });

    if (error) setFormError(error);
    else setModalOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    await deleteBudget(id);
  };

  const monthLabel = format(new Date(`${month}-01`), 'MMMM yyyy');

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">Set spending limits per category</p>
        </div>
        <button className="btn btn-primary" id="add-budget-btn" onClick={openAdd}>
          <Plus size={16} /> Add Budget
        </button>
      </div>

      <div className="page-body">
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-secondary btn-icon" id="prev-month-btn"
            onClick={() => setMonth(m => addMonths(m, -1))} title="Previous month">
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, minWidth: 150, textAlign: 'center', color: 'var(--clr-text)' }}>
            {monthLabel}
          </span>
          <button className="btn btn-secondary btn-icon" id="next-month-btn"
            onClick={() => setMonth(m => addMonths(m, 1))} title="Next month">
            <ChevronRight size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
          </div>
        ) : budgets.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <div className="empty-title">No budgets for {monthLabel}</div>
              <div className="empty-text">
                Set spending limits for each category to stay on track with your goals.
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} onClick={openAdd}>
                <Plus size={14} /> Create Budget
              </button>
            </div>
          </div>
        ) : (
          <div className="grid-auto">
            {budgets.map((b) => {
              const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
              const over = b.spent > b.amount;
              const color = over ? '#f43f5e' : pct > 75 ? '#f59e0b' : '#10b981';

              return (
                <div className="budget-card" key={b.id} style={{ position: 'relative' }}>
                  <div className="budget-header">
                    <div className="budget-category">
                      <span className="budget-icon">{b.category.icon}</span>
                      <div>
                        <div className="budget-name">{b.category.name}</div>
                        <div className="budget-amounts">
                          {formatCurrency(b.spent)} spent · {formatCurrency(b.amount)} budget
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => openEdit(b.id, b.category_id, b.amount)}
                        id={`edit-budget-${b.id}`} title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-danger btn-icon btn-sm"
                        onClick={() => handleDelete(b.id)}
                        id={`delete-budget-${b.id}`} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>

                  <div className="budget-footer">
                    <span className="budget-remaining" style={{ color: over ? 'var(--clr-expense)' : color }}>
                      {over
                        ? `⚠️ ${formatCurrency(b.spent - b.amount)} over budget`
                        : `${formatCurrency(b.amount - b.spent)} remaining`}
                    </span>
                    <span className="budget-pct">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Budget Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Budget' : 'Add Budget'}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalOpen(false)} id="close-budget-modal">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} id="budget-form">
              <div className="modal-body">
                {formError && <div className="alert alert-error"><span>⚠️</span> {formError}</div>}

                <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>Budget for</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-primary-l)' }}>{monthLabel}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="budget-category">Category</label>
                  <select id="budget-category" className="form-control" value={form.category_id}
                    onChange={set('category_id')} required disabled={!!editingId}>
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="budget-amount">Monthly limit ($)</label>
                  <input id="budget-amount" type="number" step="1" min="1" className="form-control"
                    placeholder="e.g. 500" value={form.amount} onChange={set('amount')} required />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="save-budget-btn" disabled={saving}>
                  {saving ? <span className="spinner" /> : null}
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
