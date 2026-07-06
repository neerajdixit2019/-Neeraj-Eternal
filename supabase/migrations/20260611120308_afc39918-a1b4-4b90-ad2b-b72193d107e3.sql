
-- Memories
CREATE TABLE public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  story text,
  feeling_tag text,
  memory_date date,
  media_path text,
  media_type text,
  is_ai_readable boolean not null default false,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own memories" ON public.memories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own memories" ON public.memories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own memories" ON public.memories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own memories" ON public.memories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX memories_user_date_idx ON public.memories (user_id, memory_date DESC, created_at DESC);

-- User story
CREATE TABLE public.user_story (
  user_id uuid primary key references auth.users(id) on delete cascade,
  roots text,
  current_chapter text,
  people text,
  healing_from text,
  speaking_preference text,
  is_ai_readable boolean not null default false,
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_story TO authenticated;
GRANT ALL ON public.user_story TO service_role;

ALTER TABLE public.user_story ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own story" ON public.user_story
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own story" ON public.user_story
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own story" ON public.user_story
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own story" ON public.user_story
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_story_touch_updated
  BEFORE UPDATE ON public.user_story
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies for the private "memories" bucket.
-- Files are stored at <user_id>/<filename> so the first folder = owner.
CREATE POLICY "Users read own memory files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own memory files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own memory files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);
