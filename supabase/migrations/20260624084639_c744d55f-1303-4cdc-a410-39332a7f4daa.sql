
REVOKE EXECUTE ON FUNCTION public.consume_ai_rate_limit(UUID, TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_ai_rate_limit(UUID, TEXT, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_ai_rate_limit(UUID, TEXT, INT, INT) FROM authenticated;
