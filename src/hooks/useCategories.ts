import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category, NewCategory } from '@/types/database';

interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: string | null;
  addCategory: (cat: Omit<NewCategory, 'user_id'>) => Promise<{ error: string | null }>;
  deleteCategory: (id: string) => Promise<{ error: string | null }>;
}

export function useCategories(userId: string): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // Fetch default + user-created categories
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .or(`is_default.eq.true,user_id.eq.${userId}`)
        .order('name');

      if (fetchError) setError(fetchError.message);
      else setCategories(data ?? []);
      setLoading(false);
    };

    fetch();
  }, [userId]);

  const addCategory = async (cat: Omit<NewCategory, 'user_id'>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await supabase
      .from('categories')
      .insert({ ...cat, user_id: userId } as any);

    if (insertError) return { error: insertError.message };

    // Refetch
    const { data } = await supabase
      .from('categories')
      .select('*')
      .or(`is_default.eq.true,user_id.eq.${userId}`)
      .order('name');
    setCategories(data ?? []);
    return { error: null };
  };

  const deleteCategory = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Can only delete own categories

    if (deleteError) return { error: deleteError.message };
    setCategories((prev) => prev.filter((c) => c.id !== id));
    return { error: null };
  };

  return { categories, loading, error, addCategory, deleteCategory };
}
