
-- ============ ai_rate_limits ============
CREATE TABLE public.ai_rate_limits (
  user_id UUID NOT NULL,
  route TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, route, window_start)
);
GRANT ALL ON public.ai_rate_limits TO service_role;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon: table is server-only via service role.

CREATE INDEX ai_rate_limits_window_idx
  ON public.ai_rate_limits (window_start);

-- ============ consume_ai_rate_limit ============
CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  p_user_id UUID,
  p_route TEXT,
  p_limit INT,
  p_window_seconds INT
) RETURNS TABLE(allowed BOOLEAN, remaining INT, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- Align window to fixed buckets so concurrent callers share the same row.
  v_window_start := to_timestamp(
    (EXTRACT(EPOCH FROM now())::BIGINT / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.ai_rate_limits (user_id, route, window_start, count)
  VALUES (p_user_id, p_route, v_window_start, 1)
  ON CONFLICT (user_id, route, window_start)
  DO UPDATE SET count = ai_rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Opportunistic cleanup of stale buckets (~1% of calls).
  IF random() < 0.01 THEN
    DELETE FROM public.ai_rate_limits
    WHERE window_start < now() - INTERVAL '1 day';
  END IF;

  allowed := v_count <= p_limit;
  remaining := GREATEST(p_limit - v_count, 0);
  reset_at := v_window_start + (p_window_seconds * INTERVAL '1 second');
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(UUID, TEXT, INT, INT) TO service_role;

-- ============ ai_prompt_versions ============
CREATE TABLE public.ai_prompt_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_name TEXT NOT NULL,
  hash TEXT NOT NULL,
  model TEXT NOT NULL,
  system_text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prompt_name, hash, model)
);
GRANT ALL ON public.ai_prompt_versions TO service_role;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
-- No client policies: registry is admin-only.

-- ============ ai_prompt_invocations ============
CREATE TABLE public.ai_prompt_invocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  route TEXT NOT NULL,
  prompt_version_id UUID REFERENCES public.ai_prompt_versions(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  latency_ms INTEGER,
  input_chars INTEGER,
  output_chars INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_prompt_invocations TO service_role;
ALTER TABLE public.ai_prompt_invocations ENABLE ROW LEVEL SECURITY;
-- No client policies: log is admin-only.

CREATE INDEX ai_prompt_invocations_user_idx
  ON public.ai_prompt_invocations (user_id, created_at DESC);
CREATE INDEX ai_prompt_invocations_route_idx
  ON public.ai_prompt_invocations (route, created_at DESC);
