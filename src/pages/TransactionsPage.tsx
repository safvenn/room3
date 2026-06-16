import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Pencil, X, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import type { TransactionWithCategory, NewTransaction } from '@/types/database';

type TxUpdatePayload = {
  category_id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  notes: string | null;
};

const TODAY = format(new Date(), 'yyyy-MM');

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

interface TxFormData {
  title: string;
  amount: string;
  type: 'income' | 'expense';
  category_id: string;
  date: string;
  notes: string;
}

const EMPTY_FORM: TxFormData = {
  title: '',
  amount: '',
  type: 'expense',
  category_id: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
};

export function TransactionsPage() {
  const { user } = useAuth();
  const userId = user!.id;

  const [month, setMonth] = useState(TODAY);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction } =
    useTransactions({ userId, month });
  const { categories } = useCategories(userId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TxFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: keyof TxFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (search && !tx.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filterType, search]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' });
    setEditingId(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (tx: TransactionWithCategory) => {
    setForm({
      title: tx.title,
      amount: String(tx.amount),
      type: tx.type,
      category_id: tx.category_id,
      date: tx.date.slice(0, 10),
      notes: tx.notes ?? '',
    });
    setEditingId(tx.id);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const addPayload: Omit<NewTransaction, 'user_id'> = {
      title: form.title.trim(),
      amount: parseFloat(form.amount),
      type: form.type,
      category_id: form.category_id,
      date: form.date,
      notes: form.notes.trim() || null,
    };

    const updatePayload: TxUpdatePayload = {
      title: form.title.trim(),
      amount: parseFloat(form.amount),
      type: form.type,
      category_id: form.category_id,
      date: form.date,
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await updateTransaction(editingId, updatePayload)
      : await addTransaction(addPayload);

    if (error) setFormError(error);
    else setModalOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(id);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Track every income and expense</p>
        </div>
        <button className="btn btn-primary" id="add-transaction-btn" onClick={openAdd}>
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Month picker */}
          <input
            id="month-filter"
            type="month"
            className="form-control"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: 160 }}
          />

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-dim)' }} />
            <input
              id="tx-search"
              type="text"
              className="form-control"
              placeholder="Search transactions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          {/* Type filter */}
          <div className="type-toggle" style={{ width: 'auto' }}>
            {(['all', 'income', 'expense'] as const).map((t) => (
              <button
                key={t}
                className={`type-toggle-btn ${t} ${filterType === t ? 'active' : ''}`}
                onClick={() => setFilterType(t)}
                id={`filter-${t}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">💸</div>
              <div className="empty-title">No transactions found</div>
              <div className="empty-text">
                {search ? 'Try a different search term' : 'Add your first transaction with the button above'}
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} onClick={openAdd}>
                <Plus size={14} /> Add Transaction
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="transaction-list">
              {filtered.map((tx) => (
                <div className="transaction-item" key={tx.id} style={{ cursor: 'default' }}>
                  <div className="tx-icon" style={{ background: `${tx.category.color}20` }}>
                    {tx.category.icon}
                  </div>
                  <div className="tx-info">
                    <div className="tx-title">{tx.title}</div>
                    <div className="tx-meta">
                      <span>{tx.category.name}</span>
                      <span>·</span>
                      <span>{format(new Date(tx.date), 'MMM d, yyyy')}</span>
                      {tx.notes && <><span>·</span><span style={{ fontStyle: 'italic' }}>{tx.notes}</span></>}
                    </div>
                  </div>
                  <div className={`tx-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(tx)} id={`edit-tx-${tx.id}`} title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(tx.id)} id={`delete-tx-${tx.id}`} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Transaction Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalOpen(false)} id="close-modal">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} id="tx-form">
              <div className="modal-body">
                {formError && <div className="alert alert-error"><span>⚠️</span> {formError}</div>}

                {/* Income / Expense toggle */}
                <div className="type-toggle">
                  <button type="button" className={`type-toggle-btn expense ${form.type === 'expense' ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, type: 'expense' }))} id="type-expense">
                    💸 Expense
                  </button>
                  <button type="button" className={`type-toggle-btn income ${form.type === 'income' ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, type: 'income' }))} id="type-income">
                    💰 Income
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tx-title">Description</label>
                  <input id="tx-title" type="text" className="form-control" placeholder="e.g. Grocery shopping"
                    value={form.title} onChange={set('title')} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="tx-amount">Amount</label>
                    <input id="tx-amount" type="number" step="0.01" min="0.01" className="form-control"
                      placeholder="0.00" value={form.amount} onChange={set('amount')} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="tx-date">Date</label>
                    <input id="tx-date" type="date" className="form-control" value={form.date} onChange={set('date')} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tx-category">Category</label>
                  <select id="tx-category" className="form-control" value={form.category_id} onChange={set('category_id')} required>
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tx-notes">Notes (optional)</label>
                  <textarea id="tx-notes" className="form-control" placeholder="Any additional notes…"
                    value={form.notes} onChange={set('notes')} rows={2}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="save-tx-btn" disabled={saving}>
                  {saving ? <span className="spinner" /> : null}
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
