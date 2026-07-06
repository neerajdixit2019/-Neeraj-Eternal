
ALTER TABLE public.reflection_sessions
  ADD COLUMN IF NOT EXISTS ai_reply_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_reason text;

CREATE TABLE IF NOT EXISTS public.reflection_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.reflection_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_number integer NOT NULL,
  user_message text NOT NULL,
  ai_response jsonb NOT NULL,
  risk_level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_number)
);

GRANT SELECT, DELETE ON public.reflection_turns TO authenticated;
GRANT ALL ON public.reflection_turns TO service_role;

ALTER TABLE public.reflection_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rt_select_own" ON public.reflection_turns
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "rt_delete_own" ON public.reflection_turns
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
