
-- harden functions
create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- seed healing paths
insert into public.healing_paths (slug, title, description, theme, duration_days) values
('heartbreak-reset','7-Day Heartbreak Reset','A gentle week to feel, name, and slowly release what hurts.','heartbreak',7),
('overthinking-reset','5-Day Overthinking Reset','Quiet the looping mind, one small ritual at a time.','overthinking',5),
('social-comparison-reset','3-Day Social Media Comparison Reset','Step out of the comparison loop and return to your own life.','social',3),
('night-calm','Night Calm Flow','Soft rituals to soothe restless evenings and prepare you for sleep.','night',5),
('loneliness-support','Loneliness Support Path','A tender path back to feeling connected — with yourself first.','loneliness',5);

-- Heartbreak steps
insert into public.healing_steps (path_id, day_number, title, exercise_text, journal_prompt, order_index)
select id, d.n, d.t, d.e, d.j, d.n from public.healing_paths, (values
  (1,'Name what hurts','For 3 minutes, place a hand on your chest and breathe slowly. Then name out loud, or in writing, exactly what hurts — without fixing it.','What part of this hurts the most right now, and why?'),
  (2,'Separate love from attachment','List three things you loved about them, and three things you needed that you were not getting.','Which of these needs can I begin to meet for myself?'),
  (3,'Stop the checking loop','For today, move their chat, profile, and photos one folder deeper. Notice the urge without acting on it.','What am I hoping to find when I check? What am I actually finding?'),
  (4,'Write the unsent letter','Write a letter you will not send. Say the full truth — anger, longing, gratitude, grief.','What is the one sentence I most needed them to hear?'),
  (5,'Rebuild self-worth','Write five things you are proud of that have nothing to do with them.','Who am I outside of this story?'),
  (6,'Create a no-contact promise','Write a small, kind promise to yourself about contact for the next 7 days.','What boundary would the wiser version of me choose?'),
  (7,'Choose one step forward','Pick one tiny step — a walk, a call, a meal — that belongs only to your new chapter.','What does one quiet step forward look like today?')
) as d(n,t,e,j)
where slug = 'heartbreak-reset';

-- Overthinking steps
insert into public.healing_steps (path_id, day_number, title, exercise_text, journal_prompt, order_index)
select id, d.n, d.t, d.e, d.j, d.n from public.healing_paths, (values
  (1,'Name the loop','Write the exact thought running on repeat. Just one sentence.','When did this thought first show up today?'),
  (2,'Fact vs fear','Draw two columns: what I know is true, and what I am afraid is true.','What would change if only the "true" column was real?'),
  (3,'The 10-minute window','Give the worry a scheduled 10-minute window. Outside of that, gently postpone it.','What does my mind try to solve that is not mine to solve right now?'),
  (4,'Body before mind','Do 2 minutes of slow breathing and 1 minute of stretching before journaling.','What does my body know that my mind keeps arguing with?'),
  (5,'One small next step','Pick the smallest possible next action and do only that.','What is enough for today?')
) as d(n,t,e,j)
where slug = 'overthinking-reset';

-- Social comparison
insert into public.healing_steps (path_id, day_number, title, exercise_text, journal_prompt, order_index)
select id, d.n, d.t, d.e, d.j, d.n from public.healing_paths, (values
  (1,'Notice the trigger','For one day, note every time a post makes you feel smaller. No judgment, just notice.','Which account or theme hurts me most? Why?'),
  (2,'Mute, do not explain','Quietly mute three accounts that consistently take from your peace.','What would my feed look like if it only nourished me?'),
  (3,'Return to your own life','Spend 20 minutes off-screen doing something that is just yours.','What is true and good in my life that no feed will ever show?')
) as d(n,t,e,j)
where slug = 'social-comparison-reset';

-- Night calm
insert into public.healing_steps (path_id, day_number, title, exercise_text, journal_prompt, order_index)
select id, d.n, d.t, d.e, d.j, d.n from public.healing_paths, (values
  (1,'Soft landing','Dim the lights an hour before bed. Slow your breathing to 4 in, 6 out, for 2 minutes.','What does my body need to feel safe enough to rest?'),
  (2,'Empty the desk in your head','Brain-dump every open loop onto paper before bed.','What is one worry I can hand to tomorrow?'),
  (3,'Tender goodbye to the day','Place a hand on your heart and say: "I did what I could today."','What did I survive today that deserves to be acknowledged?'),
  (4,'No-screen wind-down','Replace 15 minutes of scrolling with reading, music, or stretching.','What helps me feel held in the dark?'),
  (5,'Morning kindness','Wake gently. Drink water. Whisper one kind sentence to yourself before reaching for your phone.','What is the first kind thing I can say to myself tomorrow?')
) as d(n,t,e,j)
where slug = 'night-calm';

-- Loneliness
insert into public.healing_steps (path_id, day_number, title, exercise_text, journal_prompt, order_index)
select id, d.n, d.t, d.e, d.j, d.n from public.healing_paths, (values
  (1,'Witness yourself','Look in the mirror for 60 seconds. Say "I see you. You are not alone with me."','What do I most want to be seen for?'),
  (2,'Reach for one','Send one small message to someone — even just a song, an emoji, a memory.','Who is one safe person I could reach toward this week?'),
  (3,'Gentle company','Sit in a public place for 20 minutes — a café, a park bench — and just exist alongside others.','How does my body feel when I am near people without performing?'),
  (4,'Befriend yourself','Make one small thing today the way someone who loved you would: tea, a meal, a walk.','What would it feel like to be my own quiet company?'),
  (5,'A tiny ritual','Choose one weekly ritual that is just for you and put it on the calendar.','What ritual could carry me through the next quiet week?')
) as d(n,t,e,j)
where slug = 'loneliness-support';
