-- 건강 챌린지 (종목별 월 누적 + 레벨 + 월말 V.Medal 정산)
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS public.health_challenge_seasons (
  season_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.health_challenge_tracks (
  track_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.health_challenge_seasons(season_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('WALK', 'RUN', 'HIKE', 'RIDE')),
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metric TEXT NOT NULL CHECK (metric IN ('DISTANCE_KM', 'ELEVATION_M')),
  min_distance_km NUMERIC DEFAULT NULL,
  min_speed_kmh NUMERIC DEFAULT NULL,
  min_elevation_m NUMERIC DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (season_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_health_tracks_season ON public.health_challenge_tracks(season_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.health_challenge_level_thresholds (
  threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.health_challenge_tracks(track_id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  target_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (track_id, level)
);

CREATE INDEX IF NOT EXISTS idx_health_thresholds_track ON public.health_challenge_level_thresholds(track_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.health_challenge_activity_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.health_challenge_seasons(season_id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.health_challenge_tracks(track_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  distance_km NUMERIC DEFAULT NULL,
  speed_kmh NUMERIC DEFAULT NULL,
  elevation_m NUMERIC DEFAULT NULL,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  contributed_value NUMERIC DEFAULT NULL,
  rejection_reason TEXT,
  reviewed_by TEXT REFERENCES public.users(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_logs_user ON public.health_challenge_activity_logs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_health_logs_status ON public.health_challenge_activity_logs(status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.health_challenge_monthly_rollups (
  rollup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.health_challenge_seasons(season_id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.health_challenge_tracks(track_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  approved_total NUMERIC NOT NULL DEFAULT 0,
  achieved_level INTEGER NOT NULL DEFAULT 0 CHECK (achieved_level >= 0 AND achieved_level <= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (season_id, track_id, user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_health_rollups_user_month ON public.health_challenge_monthly_rollups(user_id, year, month) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.health_challenge_monthly_settlements (
  settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.health_challenge_seasons(season_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  level_sum INTEGER NOT NULL DEFAULT 0,
  medal_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (season_id, user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_health_settlements_season_month ON public.health_challenge_monthly_settlements(season_id, year, month) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_health_challenge_seasons_updated_at ON public.health_challenge_seasons;
CREATE TRIGGER update_health_challenge_seasons_updated_at
  BEFORE UPDATE ON public.health_challenge_seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_challenge_tracks_updated_at ON public.health_challenge_tracks;
CREATE TRIGGER update_health_challenge_tracks_updated_at
  BEFORE UPDATE ON public.health_challenge_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_challenge_level_thresholds_updated_at ON public.health_challenge_level_thresholds;
CREATE TRIGGER update_health_challenge_level_thresholds_updated_at
  BEFORE UPDATE ON public.health_challenge_level_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_challenge_activity_logs_updated_at ON public.health_challenge_activity_logs;
CREATE TRIGGER update_health_challenge_activity_logs_updated_at
  BEFORE UPDATE ON public.health_challenge_activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_challenge_monthly_rollups_updated_at ON public.health_challenge_monthly_rollups;
CREATE TRIGGER update_health_challenge_monthly_rollups_updated_at
  BEFORE UPDATE ON public.health_challenge_monthly_rollups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_challenge_monthly_settlements_updated_at ON public.health_challenge_monthly_settlements;
CREATE TRIGGER update_health_challenge_monthly_settlements_updated_at
  BEFORE UPDATE ON public.health_challenge_monthly_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.health_challenge_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_challenge_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_challenge_level_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_challenge_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_challenge_monthly_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_challenge_monthly_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_seasons_select_active"
  ON public.health_challenge_seasons FOR SELECT
  USING (deleted_at IS NULL AND status = 'ACTIVE');

CREATE POLICY "health_tracks_select_active_season"
  ON public.health_challenge_tracks FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.health_challenge_seasons s
      WHERE s.season_id = health_challenge_tracks.season_id
        AND s.deleted_at IS NULL AND s.status = 'ACTIVE'
    )
  );

CREATE POLICY "health_thresholds_select_active"
  ON public.health_challenge_level_thresholds FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.health_challenge_tracks t
      JOIN public.health_challenge_seasons s ON s.season_id = t.season_id
      WHERE t.track_id = health_challenge_level_thresholds.track_id
        AND t.deleted_at IS NULL AND s.deleted_at IS NULL AND s.status = 'ACTIVE'
    )
  );

CREATE POLICY "health_logs_select_own"
  ON public.health_challenge_activity_logs FOR SELECT
  USING (deleted_at IS NULL AND auth.uid() IS NOT NULL AND user_id = auth.uid()::text);

CREATE POLICY "health_logs_insert_own"
  ON public.health_challenge_activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid()::text);

CREATE POLICY "health_rollups_select_own"
  ON public.health_challenge_monthly_rollups FOR SELECT
  USING (deleted_at IS NULL AND auth.uid() IS NOT NULL AND user_id = auth.uid()::text);

CREATE POLICY "health_settlements_select_own"
  ON public.health_challenge_monthly_settlements FOR SELECT
  USING (deleted_at IS NULL AND auth.uid() IS NOT NULL AND user_id = auth.uid()::text);

-- 시즌·종목·레벨: /admin/events/new 에서 People 이벤트 등록 시 「건강 챌린지 시즌」을 함께 켜거나, /admin/health-challenges 에서만 시즌 생성. 연결 이벤트 컬럼은 034 마이그레이션.
