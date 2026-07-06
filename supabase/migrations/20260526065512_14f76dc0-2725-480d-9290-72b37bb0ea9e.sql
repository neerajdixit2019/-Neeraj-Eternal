
-- =========== PROFILES ===========
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  age_gate_passed boolean not null default false,
  primary_struggle text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- =========== CONSENT ===========
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  consent_type text not null,
  consent_version text not null default 'v1',
  accepted_at timestamptz not null default now()
);
alter table public.consent_records enable row level security;
create policy "consent_select_own" on public.consent_records for select using (auth.uid() = user_id);
create policy "consent_insert_own" on public.consent_records for insert with check (auth.uid() = user_id);
create policy "consent_delete_own" on public.consent_records for delete using (auth.uid() = user_id);

-- =========== MOOD LOGS ===========
create table public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  mood_score int not null check (mood_score between 1 and 10),
  energy_score int check (energy_score between 1 and 10),
  emotion_tags text[] not null default '{}',
  trigger_tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now()
);
alter table public.mood_logs enable row level security;
create policy "mood_select_own" on public.mood_logs for select using (auth.uid() = user_id);
create policy "mood_insert_own" on public.mood_logs for insert with check (auth.uid() = user_id);
create policy "mood_update_own" on public.mood_logs for update using (auth.uid() = user_id);
create policy "mood_delete_own" on public.mood_logs for delete using (auth.uid() = user_id);
create index mood_logs_user_created on public.mood_logs (user_id, created_at desc);

-- =========== JOURNAL ===========
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  body text not null default '',
  mood_before int check (mood_before between 1 and 10),
  emotion_tags text[] not null default '{}',
  entry_type text not null default 'free',
  is_ai_readable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.journal_entries enable row level security;
create policy "journal_select_own" on public.journal_entries for select using (auth.uid() = user_id);
create policy "journal_insert_own" on public.journal_entries for insert with check (auth.uid() = user_id);
create policy "journal_update_own" on public.journal_entries for update using (auth.uid() = user_id);
create policy "journal_delete_own" on public.journal_entries for delete using (auth.uid() = user_id);
create trigger journal_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();
create index journal_user_created on public.journal_entries (user_id, created_at desc);

-- =========== HEALING PATHS (public read) ===========
create table public.healing_paths (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  theme text not null,
  duration_days int not null,
  created_at timestamptz not null default now()
);
alter table public.healing_paths enable row level security;
create policy "healing_paths_read_all" on public.healing_paths for select using (auth.role() = 'authenticated');

create table public.healing_steps (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.healing_paths on delete cascade,
  day_number int not null,
  title text not null,
  exercise_text text not null,
  journal_prompt text not null,
  order_index int not null default 0
);
alter table public.healing_steps enable row level security;
create policy "healing_steps_read_all" on public.healing_steps for select using (auth.role() = 'authenticated');
create index healing_steps_path on public.healing_steps (path_id, day_number);

-- =========== USER PROGRESS ===========
create table public.user_path_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  path_id uuid not null references public.healing_paths on delete cascade,
  current_day int not null default 1,
  completed_steps int[] not null default '{}',
  last_active_at timestamptz not null default now(),
  unique (user_id, path_id)
);
alter table public.user_path_progress enable row level security;
create policy "progress_select_own" on public.user_path_progress for select using (auth.uid() = user_id);
create policy "progress_insert_own" on public.user_path_progress for insert with check (auth.uid() = user_id);
create policy "progress_update_own" on public.user_path_progress for update using (auth.uid() = user_id);
create policy "progress_delete_own" on public.user_path_progress for delete using (auth.uid() = user_id);

-- =========== AI CONVERSATIONS ===========
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  mode text not null default 'reflection',
  summary text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;
create policy "conv_select_own" on public.ai_conversations for select using (auth.uid() = user_id);
create policy "conv_insert_own" on public.ai_conversations for insert with check (auth.uid() = user_id);
create policy "conv_update_own" on public.ai_conversations for update using (auth.uid() = user_id);
create policy "conv_delete_own" on public.ai_conversations for delete using (auth.uid() = user_id);
create trigger conv_touch before update on public.ai_conversations
  for each row execute function public.touch_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  risk_label text,
  created_at timestamptz not null default now()
);
alter table public.ai_messages enable row level security;
create policy "msg_select_own" on public.ai_messages for select using (auth.uid() = user_id);
create policy "msg_insert_own" on public.ai_messages for insert with check (auth.uid() = user_id);
create policy "msg_delete_own" on public.ai_messages for delete using (auth.uid() = user_id);
create index ai_messages_conv on public.ai_messages (conversation_id, created_at);

-- =========== FEEDBACK ===========
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  rating int check (rating between 1 and 5),
  message text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy "feedback_select_own" on public.feedback for select using (auth.uid() = user_id);
create policy "feedback_insert_own" on public.feedback for insert with check (auth.uid() = user_id);

-- =========== RIGHTS REQUESTS ===========
create table public.rights_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  request_type text not null,
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.rights_requests enable row level security;
create policy "rights_select_own" on public.rights_requests for select using (auth.uid() = user_id);
create policy "rights_insert_own" on public.rights_requests for insert with check (auth.uid() = user_id);

-- =========== SAFETY EVENTS ===========
create table public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  event_type text not null,
  severity text not null default 'info',
  resource_shown text,
  created_at timestamptz not null default now()
);
alter table public.safety_events enable row level security;
create policy "safety_select_own" on public.safety_events for select using (auth.uid() = user_id);
create policy "safety_insert_own" on public.safety_events for insert with check (auth.uid() = user_id);
