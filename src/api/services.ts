import { supabase } from '../lib/supabase';
import type {
  User, Group, Expense, ExpenseCreate,
  Settlement, BalanceDetail, Budget, Notification, DashboardData, NotificationListResponse, GroupListResponse, FriendListResponse
} from '../types';

// Helper to map Supabase profile to App User
const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.display_name || profile.email.split('@')[0],
  email: profile.email,
  avatar_url: profile.avatar_url || '',
  created_at: profile.created_at,
});

// Utility to fetch detailed mapped friendship request info
async function mapFriendships(friendships: any[], currentUserId: string) {
  if (!friendships || friendships.length === 0) return [];
  const friendIds = friendships.map(f => f.sender_id === currentUserId ? f.receiver_id : f.sender_id);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', friendIds);
  const profileMap = new Map(profiles?.map(p => [p.id, p]));
  
  return friendships.map(f => {
    const friendId = f.sender_id === currentUserId ? f.receiver_id : f.sender_id;
    const profile = profileMap.get(friendId) || { id: friendId, email: 'unknown@example.com', display_name: 'Unknown User' };
    return {
      friendship_id: f.id,
      friend: mapProfileToUser(profile),
      status: f.status,
      created_at: f.created_at,
    };
  });
}

// Utility to map group info including member profiles
async function mapGroupDetails(group: any) {
  const { data: members } = await supabase.from('group_members').select('*').eq('group_id', group.id);
  if (!members || members.length === 0) return { ...group, members: [] };
  
  const memberUserIds = members.map(m => m.user_id);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', memberUserIds);
  const profileMap = new Map(profiles?.map(p => [p.id, p]));
  
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    created_by: group.created_by,
    created_at: group.created_at,
    members: members.map(m => ({
      id: m.id,
      user: mapProfileToUser(profileMap.get(m.user_id) || { id: m.user_id, email: 'unknown@example.com', display_name: 'Unknown' }),
      joined_at: m.joined_at,
    })),
  };
}

// Utility to map detailed expense with splits
async function mapExpenseDetails(exp: any) {
  const { data: splits } = await supabase.from('expense_splits').select('*').eq('expense_id', exp.id);
  return {
    ...exp,
    splits: splits || [],
  };
}

// ─── Auth ──────────────────────────────────────────────────────────────
export const authAPI = {
  register: async (data: { name: string; email: string; password: string }) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.name } },
    });
    if (error) throw error;
    if (!authData.session) throw new Error('Registration successful! Please check your email for confirmation.');
    
    // Explicit profile upsert just in case trigger is slow
    const userObj = {
      id: authData.user!.id,
      email: data.email,
      display_name: data.name,
    };
    await supabase.from('profiles').upsert(userObj);
    
    return {
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        token_type: 'bearer',
        user: mapProfileToUser(userObj),
      }
    };
  },

  login: async (data: { email: string; password: string }) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) throw error;
    return {
      data: {
        access_token: authData.session!.access_token,
        refresh_token: authData.session!.refresh_token || '',
        token_type: 'bearer',
      }
    };
  },

  me: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return { data: mapProfileToUser(profile) };
  },

  refresh: async (refresh_token: string) => {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) throw error;
    return {
      data: {
        access_token: data.session!.access_token,
        refresh_token: data.session!.refresh_token || '',
        token_type: 'bearer',
      }
    };
  },
};

// ─── Users ─────────────────────────────────────────────────────────────
export const usersAPI = {
  me: async () => {
    return authAPI.me();
  },
  update: async (data: Partial<User>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const updateObj: any = {};
    if (data.name) updateObj.display_name = data.name;
    if (data.avatar_url) updateObj.avatar_url = data.avatar_url;
    
    const { data: profile } = await supabase
      .from('profiles')
      .update(updateObj)
      .eq('id', user.id)
      .select()
      .single();
    return { data: mapProfileToUser(profile) };
  },
  search: async (q: string) => {
    const { data, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
    return {
      data: {
        users: (data || []).map(mapProfileToUser),
        total: count || 0,
      }
    };
  },
  getById: async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    return { data: mapProfileToUser(data) };
  },
};

// ─── Friends ───────────────────────────────────────────────────────────
export const friendsAPI = {
  list: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted');
      
    const mapped = await mapFriendships(friendships || [], user.id);
    return {
      data: {
        friends: mapped,
        total: mapped.length,
      } as FriendListResponse
    };
  },
  sendRequest: async (receiver_id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data } = await supabase.from('friendships').insert({
      sender_id: user.id,
      receiver_id,
      status: 'pending',
    }).select().single();
    
    // Create notification
    await supabase.from('notifications').insert({
      user_id: receiver_id,
      title: 'New Friend Request',
      message: `${user.user_metadata?.display_name || user.email?.split('@')[0]} sent you a friend request.`,
      notification_type: 'friend_request',
      is_read: false,
    });
    
    return { data };
  },
  pending: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Received requests (receiver_id = user.id)
    const { data: received } = await supabase
      .from('friendships')
      .select('*')
      .eq('receiver_id', user.id)
      .eq('status', 'pending');
      
    // Sent requests (sender_id = user.id)
    const { data: sent } = await supabase
      .from('friendships')
      .select('*')
      .eq('sender_id', user.id)
      .eq('status', 'pending');
      
    const mappedReceived = await mapFriendships(received || [], user.id);
    const mappedSent = await mapFriendships(sent || [], user.id);
    
    return {
      data: {
        received: mappedReceived,
        sent: mappedSent,
      }
    };
  },
  accept: async (id: string) => {
    const { data: friendship } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
      
    // Notify sender
    await supabase.from('notifications').insert({
      user_id: friendship.sender_id,
      title: 'Friend Request Accepted',
      message: 'Your friend request has been accepted.',
      notification_type: 'friend_accepted',
      is_read: false,
    });
    
    return { data: friendship };
  },
  reject: async (id: string) => {
    const { data } = await supabase.from('friendships').delete().eq('id', id);
    return { data };
  },
  remove: async (id: string) => {
    return friendsAPI.reject(id);
  },
};

// ─── Groups ────────────────────────────────────────────────────────────
export const groupsAPI = {
  list: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: memberRows } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
    const groupIds = memberRows?.map(m => m.group_id) || [];
    
    const { data: groups, count } = await supabase
      .from('groups')
      .select('*', { count: 'exact' })
      .or(`created_by.eq.${user.id},id.in.(${groupIds.length > 0 ? groupIds.map(id => `'${id}'`).join(',') : `'00000000-0000-0000-0000-000000000000'`})`);
      
    const mapped = await Promise.all((groups || []).map(mapGroupDetails));
    return {
      data: {
        groups: mapped,
        total: count || 0,
      } as GroupListResponse
    };
  },
  create: async (data: { name: string; description?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: group } = await supabase.from('groups').insert({
      name: data.name,
      description: data.description,
      created_by: user.id,
    }).select().single();
    
    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
    });
    
    const detailed = await mapGroupDetails(group);
    return { data: detailed as Group };
  },
  get: async (id: string) => {
    const { data } = await supabase.from('groups').select('*').eq('id', id).single();
    const detailed = await mapGroupDetails(data);
    return { data: detailed as Group };
  },
  update: async (id: string, data: Partial<Group>) => {
    const { data: group } = await supabase
      .from('groups')
      .update({ name: data.name, description: data.description })
      .eq('id', id)
      .select()
      .single();
    const detailed = await mapGroupDetails(group);
    return { data: detailed as Group };
  },
  delete: async (id: string) => {
    const { data } = await supabase.from('groups').delete().eq('id', id);
    return { data };
  },
  addMember: async (group_id: string, user_id: string) => {
    const { data } = await supabase.from('group_members').insert({ group_id, user_id }).select().single();
    return { data };
  },
  removeMember: async (group_id: string, user_id: string) => {
    const { data } = await supabase.from('group_members').delete().eq('group_id', group_id).eq('user_id', user_id);
    return { data };
  },
};

// ─── Expenses ──────────────────────────────────────────────────────────
export const expensesAPI = {
  create: async (data: ExpenseCreate) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: exp } = await supabase.from('expenses').insert({
      title: data.title,
      description: data.description,
      amount: data.amount,
      paid_by: user.id,
      payment_method: data.payment_method,
      category: data.category,
      split_type: data.split_type,
      group_id: data.group_id || null,
      expense_date: data.expense_date,
    }).select().single();
    
    const splitsToInsert: any[] = [];
    if (data.split_type === 'equal') {
      const share = data.amount / data.participants.length;
      for (const pid of data.participants) {
        splitsToInsert.push({
          expense_id: exp.id,
          user_id: pid,
          share_amount: share,
          status: pid === user.id ? 'accepted' : 'pending',
        });
      }
    } else if (data.split_type === 'percentage') {
      for (const detail of data.split_details || []) {
        const share = (data.amount * detail.value) / 100;
        splitsToInsert.push({
          expense_id: exp.id,
          user_id: detail.user_id,
          share_amount: share,
          status: detail.user_id === user.id ? 'accepted' : 'pending',
        });
      }
    } else {
      // custom split
      for (const detail of data.split_details || []) {
        splitsToInsert.push({
          expense_id: exp.id,
          user_id: detail.user_id,
          share_amount: detail.value,
          status: detail.user_id === user.id ? 'accepted' : 'pending',
        });
      }
    }
    
    await supabase.from('expense_splits').insert(splitsToInsert);
    
    // Create notifications for other participants
    const notifs = data.participants
      .filter(pid => pid !== user.id)
      .map(pid => ({
        user_id: pid,
        title: 'New Expense Added',
        message: `${user.user_metadata?.display_name || user.email?.split('@')[0]} added: "${data.title}" (Share: ₹${(splitsToInsert.find(s => s.user_id === pid)?.share_amount || 0).toFixed(2)})`,
        notification_type: 'expense_added',
        is_read: false,
      }));
    if (notifs.length > 0) {
      await supabase.from('notifications').insert(notifs);
    }
    
    const detailed = await mapExpenseDetails(exp);
    return { data: detailed as Expense };
  },

  list: async (skip = 0, limit = 20) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: splits } = await supabase.from('expense_splits').select('expense_id').eq('user_id', user.id);
    const expenseIds = splits?.map(s => s.expense_id) || [];
    
    const { data: expenses, count } = await supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .or(`paid_by.eq.${user.id},id.in.(${expenseIds.length > 0 ? expenseIds.map(id => `'${id}'`).join(',') : `'00000000-0000-0000-0000-000000000000'`})`)
      .order('expense_date', { ascending: false })
      .range(skip, skip + limit - 1);
      
    if (!expenses || expenses.length === 0) return { data: { expenses: [], total: 0 } };
    
    const allExpIds = expenses.map(e => e.id);
    const { data: allSplits } = await supabase.from('expense_splits').select('*').in('expense_id', allExpIds);
    const splitsMap = new Map<string, any[]>();
    allSplits?.forEach(s => {
      if (!splitsMap.has(s.expense_id)) splitsMap.set(s.expense_id, []);
      splitsMap.get(s.expense_id)!.push(s);
    });
    
    const mapped = expenses.map(e => ({
      ...e,
      splits: splitsMap.get(e.id) || [],
    }));
    
    return { data: { expenses: mapped as Expense[], total: count || 0 } };
  },

  get: async (id: string) => {
    const { data } = await supabase.from('expenses').select('*').eq('id', id).single();
    const detailed = await mapExpenseDetails(data);
    return { data: detailed as Expense };
  },

  byGroup: async (group_id: string) => {
    const { data: expenses } = await supabase.from('expenses').select('*').eq('group_id', group_id).order('expense_date', { ascending: false });
    if (!expenses || expenses.length === 0) return { data: { expenses: [], total: 0 } };
    
    const allExpIds = expenses.map(e => e.id);
    const { data: allSplits } = await supabase.from('expense_splits').select('*').in('expense_id', allExpIds);
    const splitsMap = new Map<string, any[]>();
    allSplits?.forEach(s => {
      if (!splitsMap.has(s.expense_id)) splitsMap.set(s.expense_id, []);
      splitsMap.get(s.expense_id)!.push(s);
    });
    
    const mapped = expenses.map(e => ({
      ...e,
      splits: splitsMap.get(e.id) || [],
    }));
    
    return { data: { expenses: mapped as Expense[], total: mapped.length } };
  },

  delete: async (id: string) => {
    const { data } = await supabase.from('expenses').delete().eq('id', id);
    return { data };
  },

  updateSplitStatus: async (split_id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: split } = await supabase
      .from('expense_splits')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', split_id)
      .select()
      .single();
      
    if (status === 'accepted') {
      const { data: exp } = await supabase.from('expenses').select('title, paid_by').eq('id', split.expense_id).single();
      if (exp && exp.paid_by !== user.id) {
        await supabase.from('notifications').insert({
          user_id: exp.paid_by,
          title: 'Split Accepted',
          message: `${user.user_metadata?.display_name || user.email?.split('@')[0]} accepted split of ₹${split.share_amount.toFixed(2)} for "${exp.title}".`,
          notification_type: 'expense_accepted',
          is_read: false,
        });
      }
    }
    return { data: split };
  },
};

// ─── Settlements ───────────────────────────────────────────────────────
export const settlementsAPI = {
  create: async (data: { receiver_id: string; amount: number; payment_method: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: setl } = await supabase.from('settlements').insert({
      payer_id: user.id,
      receiver_id: data.receiver_id,
      amount: data.amount,
      payment_method: data.payment_method,
      status: 'pending',
    }).select().single();
    
    await supabase.from('notifications').insert({
      user_id: data.receiver_id,
      title: 'Settlement Recorded',
      message: `${user.user_metadata?.display_name || user.email?.split('@')[0]} paid you ₹${data.amount.toFixed(2)}. Please confirm receipt.`,
      notification_type: 'settlement_pending',
      is_read: false,
    });
    
    return { data: setl as Settlement };
  },

  list: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data } = await supabase
      .from('settlements')
      .select('*')
      .or(`payer_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    return { data: (data || []) as Settlement[] };
  },

  approve: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: setl } = await supabase
      .from('settlements')
      .update({ status: 'completed', settled_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
      
    await supabase.from('notifications').insert({
      user_id: setl.payer_id,
      title: 'Settlement Approved',
      message: `${user.user_metadata?.display_name || user.email?.split('@')[0]} confirmed receipt of your payment of ₹${setl.amount.toFixed(2)}.`,
      notification_type: 'settlement_completed',
      is_read: false,
    });
    
    return { data: setl as Settlement };
  },

  balances: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: paidExpenses } = await supabase.from('expenses').select('id, amount, paid_by').eq('paid_by', user.id);
    const paidExpIds = paidExpenses?.map(e => e.id) || [];
    
    const { data: receivableSplits } = await supabase.from('expense_splits').select('*').in('expense_id', paidExpIds).neq('user_id', user.id).eq('status', 'accepted');
    const { data: payableSplits } = await supabase.from('expense_splits').select('*, expense:expenses(*)').eq('user_id', user.id).eq('status', 'accepted');
    
    const { data: settledPayments } = await supabase.from('settlements').select('*').eq('payer_id', user.id).eq('status', 'completed');
    const { data: settledReceipts } = await supabase.from('settlements').select('*').eq('receiver_id', user.id).eq('status', 'completed');
    
    const balanceMap: Record<string, number> = {};
    
    receivableSplits?.forEach(s => {
      balanceMap[s.user_id] = (balanceMap[s.user_id] || 0) + Number(s.share_amount);
    });
    
    payableSplits?.forEach(s => {
      const payerId = s.expense.paid_by;
      if (payerId !== user.id) {
        balanceMap[payerId] = (balanceMap[payerId] || 0) - Number(s.share_amount);
      }
    });
    
    settledPayments?.forEach(s => {
      balanceMap[s.receiver_id] = (balanceMap[s.receiver_id] || 0) + Number(s.amount);
    });
    
    settledReceipts?.forEach(s => {
      balanceMap[s.payer_id] = (balanceMap[s.payer_id] || 0) - Number(s.amount);
    });
    
    let totalPayable = 0;
    let totalReceivable = 0;
    const perUser = [];
    
    for (const [uid, bal] of Object.entries(balanceMap)) {
      if (Math.abs(bal) < 0.01) continue;
      
      if (bal > 0) {
        totalReceivable += bal;
      } else {
        totalPayable += Math.abs(bal);
      }
      
      perUser.push({
        user_id: uid,
        balance: bal,
      });
    }
    
    return {
      data: {
        summary: {
          total_payable: totalPayable,
          total_receivable: totalReceivable,
          net_balance: totalReceivable - totalPayable,
        },
        per_user: perUser,
      } as BalanceDetail
    };
  },
};

// ─── Budgets ───────────────────────────────────────────────────────────
export const budgetsAPI = {
  create: async (data: { month: number; year: number; amount: number }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    await supabase.from('budgets').insert({
      user_id: user.id,
      month: data.month,
      year: data.year,
      amount: data.amount,
    }).select().single();
    
    const spentRes = await budgetsAPI.get(data.month, data.year);
    return { data: spentRes.data as Budget };
  },

  list: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data } = await supabase.from('budgets').select('*').eq('user_id', user.id);
    const detailed = await Promise.all((data || []).map(async b => {
      const res = await budgetsAPI.get(b.month, b.year);
      return res.data;
    }));
    return { data: detailed.filter(Boolean) as Budget[] };
  },

  get: async (month: number, year: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data: budget } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();
      
    if (!budget) return { data: null };
    
    // Find expenses user is part of in this month
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = new Date(year, month, 0).toISOString().slice(0, 10);
    
    const { data: splits } = await supabase
      .from('expense_splits')
      .select('share_amount, expense:expenses!inner(expense_date)')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .gte('expense.expense_date', startStr)
      .lte('expense.expense_date', endStr);
      
    const spent = splits?.reduce((acc, s) => acc + Number(s.share_amount), 0) || 0;
    
    return {
      data: {
        id: budget.id,
        user_id: budget.user_id,
        month: budget.month,
        year: budget.year,
        amount: budget.amount,
        spent,
        remaining: budget.amount - spent,
      } as Budget
    };
  },

  update: async (month: number, year: number, amount: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    await supabase
      .from('budgets')
      .update({ amount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year);
      
    return budgetsAPI.get(month, year);
  },
};

// ─── Analytics ─────────────────────────────────────────────────────────
export const analyticsAPI = {
  dashboard: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const balRes = await settlementsAPI.balances();
    const { total_payable, total_receivable, net_balance } = balRes.data.summary;
    
    const { data: splits } = await supabase.from('expense_splits').select('share_amount').eq('user_id', user.id).eq('status', 'accepted');
    const totalSpent = splits?.reduce((acc, s) => acc + Number(s.share_amount), 0) || 0;
    
    const { data: expenses } = await supabase.from('expenses').select('id', { count: 'exact' }).eq('paid_by', user.id);
    const totalExpenses = expenses?.length || 0;
    
    return {
      data: {
        total_expenses: totalExpenses,
        total_spent: totalSpent,
        total_payable,
        total_receivable,
        net_balance,
      } as DashboardData
    };
  },

  monthly: async (year?: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const queryYear = year || new Date().getFullYear();
    const startStr = `${queryYear}-01-01`;
    const endStr = `${queryYear}-12-31`;
    
    const { data: splits } = await supabase
      .from('expense_splits')
      .select('share_amount, expense:expenses!inner(expense_date)')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .gte('expense.expense_date', startStr)
      .lte('expense.expense_date', endStr);
      
    const monthlySum: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) monthlySum[i] = 0;
    
    splits?.forEach(s => {
      const expense = s.expense as any;
      const month = new Date(expense.expense_date).getMonth() + 1;
      monthlySum[month] = (monthlySum[month] || 0) + Number(s.share_amount);
    });
    
    const formatted = Object.entries(monthlySum).map(([m, val]) => ({
      month: Number(m),
      amount: val,
    }));
    
    return { data: formatted };
  },

  categories: async (month?: number, year?: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const qMonth = month || new Date().getMonth() + 1;
    const qYear = year || new Date().getFullYear();
    
    const startStr = `${qYear}-${String(qMonth).padStart(2, '0')}-01`;
    const endStr = new Date(qYear, qMonth, 0).toISOString().slice(0, 10);
    
    const { data: splits } = await supabase
      .from('expense_splits')
      .select('share_amount, expense:expenses!inner(category, expense_date)')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .gte('expense.expense_date', startStr)
      .lte('expense.expense_date', endStr);
      
    const catMap: Record<string, number> = {};
    splits?.forEach(s => {
      const expense = s.expense as any;
      const cat = expense.category;
      catMap[cat] = (catMap[cat] || 0) + Number(s.share_amount);
    });
    
    const formatted = Object.entries(catMap).map(([category, val]) => ({
      category,
      amount: val,
    }));
    
    return { data: formatted };
  },

  trends: async (months = 6) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startStr = start.toISOString().slice(0, 10);
    
    const { data: splits } = await supabase
      .from('expense_splits')
      .select('share_amount, expense:expenses!inner(expense_date)')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .gte('expense.expense_date', startStr);
      
    const trendsMap: Record<string, number> = {};
    splits?.forEach(s => {
      const expense = s.expense as any;
      const date = new Date(expense.expense_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      trendsMap[key] = (trendsMap[key] || 0) + Number(s.share_amount);
    });
    
    const formatted = Object.entries(trendsMap).map(([month, val]) => ({
      month,
      amount: val,
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    return { data: formatted };
  },
};

// ─── Notifications ─────────────────────────────────────────────────────
export const notificationsAPI = {
  list: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    const unreadCount = data?.filter(n => !n.is_read).length || 0;
    return {
      data: {
        notifications: (data || []) as Notification[],
        unread_count: unreadCount,
      } as NotificationListResponse
    };
  },
  
  readAll: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);
    return { data };
  },
};
