-- SECURITY ENHANCEMENT SCRIPT
-- RUN THIS IN THE SUPABASE SQL EDITOR

-- 1. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. Portfolios Policies
DROP POLICY IF EXISTS "Users can view own portfolios" ON public.portfolios;
CREATE POLICY "Users can view own portfolios" 
ON public.portfolios FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own portfolios" ON public.portfolios;
CREATE POLICY "Users can create own portfolios" 
ON public.portfolios FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own portfolios" ON public.portfolios;
CREATE POLICY "Users can update own portfolios" 
ON public.portfolios FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own portfolios" ON public.portfolios;
CREATE POLICY "Users can delete own portfolios" 
ON public.portfolios FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Expenses Policies
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
CREATE POLICY "Users can view own expenses" 
ON public.expenses FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own expenses" ON public.expenses;
CREATE POLICY "Users can create own expenses" 
ON public.expenses FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses" 
ON public.expenses FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Users can delete own expenses" 
ON public.expenses FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Helper verification query
SELECT * FROM pg_policies WHERE schemaname = 'public';
