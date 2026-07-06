-- 1) Add response_mode to reflections
ALTER TABLE public.reflections
  ADD COLUMN response_mode text;

ALTER TABLE public.reflections
  ADD CONSTRAINT reflections_response_mode_check
  CHECK (response_mode IS NULL OR response_mode IN ('listen','clarity','grounding','decision','celebration'));

-- 2) Extend user_feedback for new rating + ephemeral anonymous metadata
ALTER TABLE public.user_feedback
  ALTER COLUMN reflection_id DROP NOT NULL;

ALTER TABLE public.user_feedback
  ADD COLUMN rating text,
  ADD COLUMN reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN response_mode text,
  ADD COLUMN category text,
  ADD COLUMN intensity integer,
  ADD COLUMN save_mode text;

ALTER TABLE public.user_feedback
  ADD CONSTRAINT user_feedback_rating_check
  CHECK (rating IS NULL OR rating IN ('yes','a_little','not_really'));

ALTER TABLE public.user_feedback
  ADD CONSTRAINT user_feedback_save_mode_check
  CHECK (save_mode IS NULL OR save_mode IN ('private','ephemeral'));

ALTER TABLE public.user_feedback
  ADD CONSTRAINT user_feedback_response_mode_check
  CHECK (response_mode IS NULL OR response_mode IN ('listen','clarity','grounding','decision','celebration'));

ALTER TABLE public.user_feedback
  ADD CONSTRAINT user_feedback_intensity_check
  CHECK (intensity IS NULL OR (intensity BETWEEN 1 AND 10));

-- Ephemeral feedback must never carry raw writing or link to a stored reflection.
ALTER TABLE public.user_feedback
  ADD CONSTRAINT user_feedback_ephemeral_anon
  CHECK (save_mode IS DISTINCT FROM 'ephemeral' OR (comment IS NULL AND reflection_id IS NULL));