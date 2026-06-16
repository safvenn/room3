import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Budget, Category, BudgetWithCategory, NewBudget } from '@/types/database';

interface UseBudgetsReturn {
  budgets: BudgetWithCategory[];
  loading: boolean;
  error: string | null;
  upsertBudget: (budget: Omit<NewBudget, 'user_id'>) => Promise<{ error: string | null }>;
  deleteBudget: (id: string) => Promise<{ error: string | null }>;
  refetch: () => void;
}

export function useBudgets(userId: string, month: string): UseBudgetsReturn {
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch budgets with category info
    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('*, category:categories(*)')
      .eq('user_id', userId)
      .eq('month', month);

    if (budgetError) {
      setError(budgetError.message);
      setLoading(false);
      return;
    }

    // For each budget, calculate total spent this month
    const start = `${month}-01`;
    const end = `${month}-31`;

    const budgetsWithSpent = await Promise.all(
      (budgetData ?? []).map(async (budget: Budget & { category: Category }) => {
        const { data: txData } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .eq('category_id', budget.category_id)
          .eq('type', 'expense')
          .gte('date', start)
          .lte('date', end);

        const spent = (txData ?? []).reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0);

        return { ...budget, spent } as BudgetWithCategory;
      })
    );

    setBudgets(budgetsWithSpent);
    setLoading(false);
  }, [userId, month]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const upsertBudget = useCallback(
    async (budget: Omit<NewBudget, 'user_id'>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert(
          { ...budget, user_id: userId } as any,
          { onConflict: 'user_id,category_id,month' }
        );

      if (upsertError) return { error: upsertError.message };
      await fetchBudgets();
      return { error: null };
    },
    [userId, fetchBudgets]
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) return { error: deleteError.message };
      await fetchBudgets();
      return { error: null };
    },
    [userId, fetchBudgets]
  );

  return { budgets, loading, error, upsertBudget, deleteBudget, refetch: fetchBudgets };
}
