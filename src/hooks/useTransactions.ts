import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TransactionWithCategory, NewTransaction } from '@/types/database';

type TransactionUpdate = {
  category_id?: string;
  title?: string;
  amount?: number;
  type?: 'income' | 'expense';
  date?: string;
  notes?: string | null;
};

interface UseTransactionsOptions {
  userId: string;
  month?: string; // 'YYYY-MM'
  categoryId?: string;
  limit?: number;
}

interface UseTransactionsReturn {
  transactions: TransactionWithCategory[];
  loading: boolean;
  error: string | null;
  addTransaction: (tx: Omit<NewTransaction, 'user_id'>) => Promise<{ error: string | null }>;
  updateTransaction: (id: string, updates: TransactionUpdate) => Promise<{ error: string | null }>;
  deleteTransaction: (id: string) => Promise<{ error: string | null }>;
  refetch: () => void;
}

export function useTransactions(options: UseTransactionsOptions): UseTransactionsReturn {
  const { userId, month, categoryId, limit = 100 } = options;
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (month) {
      const start = `${month}-01`;
      const end = `${month}-31`;
      query = query.gte('date', start).lte('date', end);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTransactions((data as TransactionWithCategory[]) ?? []);
    }

    setLoading(false);
  }, [userId, month, categoryId, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Real-time subscription ───────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Re-fetch on any change (insert / update / delete)
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTransactions]);

  const addTransaction = useCallback(
    async (tx: Omit<NewTransaction, 'user_id'>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({ ...tx, user_id: userId } as any);

      if (insertError) return { error: insertError.message };
      return { error: null };
    },
    [userId]
  );

  const updateTransaction = useCallback(
    async (id: string, updates: TransactionUpdate) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = supabase.from('transactions') as any;
      const { error: updateError } = await table
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) return { error: (updateError as { message: string }).message };
      return { error: null };
    },
    [userId]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) return { error: deleteError.message };
      return { error: null };
    },
    [userId]
  );

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refetch: fetchTransactions,
  };
}
