-- V.Together 플랫폼 데이터베이스 스키마
-- Supabase PostgreSQL에서 실행할 SQL 스크립트

-- Users 테이블
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY, -- Google Email ID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  dept_name TEXT, -- 부서명 (Team 랭킹 집계용)
  current_points INTEGER DEFAULT 0, -- 가용 포인트
  total_donated_amount INTEGER DEFAULT 0, -- 누적 기부 금액 (ESG Level 산정 기준)
  level TEXT DEFAULT 'ECO_KEEPER' CHECK (level IN ('ECO_KEEPER', 'GREEN_MASTER', 'EARTH_HERO')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DonationTargets 테이블
CREATE TABLE IF NOT EXISTS donation_targets (
  target_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 기부처명 (예: 아름다운가게)
  description TEXT,
  image_url TEXT,
  target_amount INTEGER DEFAULT 10000000, -- 목표 금액 (1,000만원)
  current_amount INTEGER DEFAULT 0, -- 현재 모금액
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donations 테이블 (기부 내역)
CREATE TABLE IF NOT EXISTS donations (
  donation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  target_id UUID REFERENCES donation_targets(target_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0), -- 기부 포인트
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PointTransactions 테이블 (포인트 원장)
CREATE TABLE IF NOT EXISTS point_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('EARNED', 'DONATED', 'USED')),
  amount INTEGER NOT NULL, -- 양수(획득) 또는 음수(사용/기부)
  related_id UUID, -- 관련 ID (donation_id, campaign_id 등)
  related_type TEXT, -- DONATION, CAMPAIGN 등
  description TEXT,
  user_email TEXT, -- 기록 시점 사용자 이메일 (Supabase/엑셀 추출 시 보기 쉽게)
  user_name TEXT, -- 기록 시점 사용자 이름
  donation_target_name TEXT, -- 기부 시 기부처명 (type=DONATED일 때)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_target_id ON donations(target_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_users_total_donated_amount ON users(total_donated_amount DESC);

-- updated_at 자동 업데이트 함수 (search_path 고정으로 보안 취약점 방지)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- updated_at 트리거
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donation_targets_updated_at BEFORE UPDATE ON donation_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ESG Level 자동 계산 함수 (search_path 고정으로 보안 취약점 방지)
CREATE OR REPLACE FUNCTION calculate_esg_level(donated_amount INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF donated_amount >= 100001 THEN
    RETURN 'EARTH_HERO';
  ELSIF donated_amount >= 50001 THEN
    RETURN 'GREEN_MASTER';
  ELSIF donated_amount >= 10000 THEN
    RETURN 'ECO_KEEPER';
  ELSE
    RETURN 'ECO_KEEPER';
  END IF;
END;
$$;

-- ESG Level 자동 업데이트 트리거 (search_path 고정으로 보안 취약점 방지)
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.level = public.calculate_esg_level(NEW.total_donated_amount);
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_level_trigger
  BEFORE INSERT OR UPDATE OF total_donated_amount ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_level();

-- RLS (Row Level Security) 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- Users RLS 정책 (026: auth initplan + 정책 병합 적용)
CREATE POLICY "Users can view own data or rankings"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own row"
  ON users FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

-- DonationTargets RLS 정책
-- 모든 사용자 읽기 가능, 관리자만 수정 가능 (관리자 정책은 나중에 추가)
CREATE POLICY "Anyone can view donation targets"
  ON donation_targets FOR SELECT
  USING (true);

-- Donations RLS 정책
CREATE POLICY "Users can view own donations"
  ON donations FOR SELECT
  USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can create own donations"
  ON donations FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

-- PointTransactions RLS 정책
CREATE POLICY "Users can view own transactions"
  ON point_transactions FOR SELECT
  USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own transactions"
  ON point_transactions FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

-- site_content: 메인 화면 문구 (관리자 편집)
CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site_content"
  ON site_content FOR SELECT USING (true);

-- 초기 기부처 데이터 삽입 (선택사항)
-- 이미지 URL: Unsplash 등 외부 URL 사용 가능 (Next.js images.remotePatterns에 등록 필요)
INSERT INTO donation_targets (name, description, image_url, target_amount, current_amount, status)
VALUES
  (
    '아름다운 가게',
    '사회적 기업 아름다운 가게와 함께 나눔을 실천해요.',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
    10000000, 0, 'ACTIVE'
  ),
  (
    '혜명보육원',
    '아동 복지 기관 혜명보육원에 따뜻한 손길을 전해주세요.',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80',
    10000000, 0, 'ACTIVE'
  ),
  (
    '대한적십자사',
    '대한적십자사와 함께 인도적 지원에 동참해요.',
    'https://images.unsplash.com/photo-1584515933487-779824d29309?w=600&q=80',
    10000000, 0, 'ACTIVE'
  ),
  (
    '국제구조위원회',
    '국제구조위원회를 통해 글로벌 구호 활동을 응원해요.',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80',
    10000000, 0, 'ACTIVE'
  )
ON CONFLICT DO NOTHING;
