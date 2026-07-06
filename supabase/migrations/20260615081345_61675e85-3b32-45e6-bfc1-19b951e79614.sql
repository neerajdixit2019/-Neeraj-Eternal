
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_letter_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_letter_uses_memories boolean NOT NULL DEFAULT false;

CREATE TABLE public.weekly_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  body text NOT NULL,
  ritual text,
  tone text NOT NULL DEFAULT 'gentle' CHECK (tone IN ('gentle','tender')),
  kept boolean NOT NULL DEFAULT true,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_letters TO authenticated;
GRANT ALL ON public.weekly_letters TO service_role;

ALTER TABLE public.weekly_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own letters select" ON public.weekly_letters
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own letters insert" ON public.weekly_letters
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own letters update" ON public.weekly_letters
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own letters delete" ON public.weekly_letters
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER weekly_letters_touch_updated_at
  BEFORE UPDATE ON public.weekly_letters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
