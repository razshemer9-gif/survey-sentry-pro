-- ============================================================
-- survey-sentry-pro: RBAC Migration
-- Run once in Supabase SQL Editor → https://supabase.com/dashboard
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  role       TEXT         NOT NULL DEFAULT 'employee'
                          CHECK (role IN ('owner', 'admin', 'employee')),
  created_at TIMESTAMPTZ  DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. SECURITY DEFINER helper — reads profiles bypassing RLS (safe for use in other policies)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- 3. Trigger: prevent non-admins from escalating their own role
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    ) THEN
      RAISE EXCEPTION 'permission denied: only admins can change roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- 4. Profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles"     ON public.profiles;

-- Every authenticated user can see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_current_user_role() IN ('owner', 'admin'));

-- Users can update their own profile (role change blocked by trigger above)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins can manage (INSERT/UPDATE/DELETE) all profiles
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.get_current_user_role() IN ('owner', 'admin'));

-- Allow trigger (SECURITY DEFINER) to insert new profiles without a matching policy
CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- 5. Auto-create a profile for every new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'employee')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Backfill: create employee profiles for all existing users
INSERT INTO public.profiles (user_id, email, role)
SELECT id, email, 'employee'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 7. Promote your account to owner
UPDATE public.profiles
SET role = 'owner'
WHERE email = 'razshemer9@gmail.com';

-- 8. Lock accessibility_requirements — only admins can write
ALTER TABLE public.accessibility_requirements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'accessibility_requirements' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.accessibility_requirements', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone can read requirements" ON public.accessibility_requirements
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert requirements" ON public.accessibility_requirements
  FOR INSERT WITH CHECK (public.get_current_user_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update requirements" ON public.accessibility_requirements
  FOR UPDATE USING (public.get_current_user_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can delete requirements" ON public.accessibility_requirements
  FOR DELETE USING (public.get_current_user_role() IN ('owner', 'admin'));

-- 9. Verify result
SELECT user_id, email, role, created_at
FROM public.profiles
ORDER BY created_at;
