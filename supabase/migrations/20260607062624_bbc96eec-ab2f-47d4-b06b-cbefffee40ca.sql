-- 1. Extend reflections
ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS encourage_human_support boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_crisis_support boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS model_name text;

ALTER TABLE public.reflections ALTER COLUMN source SET DEFAULT 'openai';

-- 2. Extend safety_events
ALTER TABLE public.safety_events
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.reflection_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS flagged_categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_taken text NOT NULL DEFAULT 'logged';

-- Lock safety_events down: only service_role (Edge Function) can insert.
DROP POLICY IF EXISTS "safety_insert_own" ON public.safety_events;

-- 3. user_feedback table
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_id uuid NOT NULL REFERENCES public.reflections(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.user_feedback TO authenticated;
GRANT ALL ON public.user_feedback TO service_role;

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uf_select_own" ON public.user_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "uf_insert_own" ON public.user_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uf_delete_own" ON public.user_feedback
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_feedback_reflection_idx ON public.user_feedback(reflection_id);
CREATE INDEX IF NOT EXISTS user_feedback_user_idx ON public.user_feedback(user_id);