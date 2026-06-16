# 💰 BudgetBuddy

> A premium personal finance tracker powered by **Supabase** + **React + Vite (TypeScript)**

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 **Auth** | Email/password sign up & login via Supabase Auth |
| 🗄️ **Database** | PostgreSQL with full RLS — users only see their own data |
| ⚡ **Real-time** | Transactions update live via Supabase Realtime |
| 📁 **Storage** | Receipt image uploads to Supabase Storage |
| 📊 **Dashboard** | Balance, income/expense charts, budget progress bars |
| 💸 **Transactions** | Add, edit, delete, search, filter by month/type |
| 🎯 **Budgets** | Monthly spending limits per category with visual progress |

---

## 🚀 Getting Started

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → **New Project**

### 2. Run the database migration

In your Supabase Dashboard → **SQL Editor**, paste and run the contents of:

```
supabase/migrations/001_init_schema.sql
```

### 3. Create the Storage bucket

In Supabase Dashboard → **Storage** → **New bucket**:
- Name: `receipts`
- Public: ❌ (private)

Then add these Storage policies (or uncomment the SQL at the bottom of the migration file and run it):
- Users can upload their own receipts (`INSERT` where `(storage.foldername(name))[1] = auth.uid()::text`)
- Users can view their own receipts (`SELECT`)
- Users can delete their own receipts (`DELETE`)

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project URL and anon key from:
> Settings → API → Project URL & Project API keys (anon/public)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

---

## 📁 Project Structure

```
room/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── AppLayout.tsx        # Sidebar + navigation
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth state + actions
│   │   ├── useTransactions.ts   # Real-time transactions CRUD
│   │   ├── useBudgets.ts        # Budget CRUD + spending calc
│   │   ├── useCategories.ts     # Category fetch + manage
│   │   └── useStorage.ts        # Receipt upload/delete
│   ├── lib/
│   │   └── supabase.ts          # Typed Supabase client
│   ├── pages/
│   │   ├── AuthPage.tsx         # Login + Register
│   │   ├── DashboardPage.tsx    # Overview with charts
│   │   ├── TransactionsPage.tsx # Transaction management
│   │   └── BudgetsPage.tsx      # Budget management
│   ├── types/
│   │   └── database.ts          # TypeScript DB types
│   ├── App.tsx                  # Router + protected routes
│   ├── index.css                # Design system (dark mode)
│   └── main.tsx                 # React entry point
├── supabase/
│   └── migrations/
│       └── 001_init_schema.sql  # Full DB schema + RLS + seed
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔐 Security

All tables use **Row Level Security (RLS)**:
- Users can only read/write their own data
- Default categories are readable by all authenticated users
- Storage policies restrict file access by user ID

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Date handling**: date-fns
