
-- 1. reflection_sessions
CREATE TABLE public.reflection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  intensity integer NOT NULL CHECK (intensity BETWEEN 1 AND 10),
  save_mode text NOT NULL CHECK (save_mode IN ('private','ephemeral')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflection_sessions TO authenticated;
GRANT ALL ON public.reflection_sessions TO service_role;
ALTER TABLE public.reflection_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rs_select_own" ON public.reflection_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rs_insert_own" ON public.reflection_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rs_update_own" ON public.reflection_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rs_delete_own" ON public.reflection_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. reflection_journal_entries
CREATE TABLE public.reflection_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.reflection_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflection_journal_entries TO authenticated;
GRANT ALL ON public.reflection_journal_entries TO service_role;
ALTER TABLE public.reflection_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rje_select_own" ON public.reflection_journal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rje_insert_own" ON public.reflection_journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rje_update_own" ON public.reflection_journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rje_delete_own" ON public.reflection_journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. reflections
CREATE TABLE public.reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.reflection_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'mock',
  title text NOT NULL,
  what_i_hear text NOT NULL,
  possible_underneath jsonb NOT NULL,
  gentle_question text NOT NULL,
  micro_action jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflections TO authenticated;
GRANT ALL ON public.reflections TO service_role;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_select_own" ON public.reflections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ref_insert_own" ON public.reflections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ref_update_own" ON public.reflections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ref_delete_own" ON public.reflections FOR DELETE TO authenticated USING (auth.uid() = user_id);
