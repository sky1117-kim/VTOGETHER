-- Phase 2: 챌린지 & 보상 시스템 테이블 생성
-- Supabase SQL Editor에서 실행하세요.
--
-- ⚠️ 실행 순서: 반드시 006-1-add-admin-column.sql 을 먼저 실행한 뒤 이 파일을 실행하세요.
-- (users.is_admin 컬럼이 없으면 RLS 정책에서 오류가 납니다.)

-- Campaigns 테이블 (챌린지/이벤트)
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('V_TOGETHER', 'CULTURE')),
  type TEXT NOT NULL CHECK (type IN ('ALWAYS', 'SEASONAL')),
  reward_policy TEXT NOT NULL CHECK (reward_policy IN ('SENDER_ONLY', 'BOTH')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('POINTS', 'COUPON', 'CHOICE')),
  reward_amount INTEGER, -- 포인트 보상 금액 (쿠폰일 경우 NULL)
  image_url TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'ENDED')),
  created_by TEXT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Rounds 테이블 (구간 정보 - 기간제 이벤트용)
CREATE TABLE IF NOT EXISTS campaign_rounds (
  round_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL, -- 1, 2, 3...
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  reward_amount INTEGER, -- 구간별 보상 (상위 보상이 있으면 우선)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, round_number)
);

-- Campaign Verification Methods 테이블 (인증 방식)
CREATE TABLE IF NOT EXISTS campaign_verification_methods (
  method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('PHOTO', 'TEXT', 'VALUE', 'PEER_SELECT')),
  is_required BOOLEAN DEFAULT true,
  label TEXT, -- 사용자에게 보여줄 라벨 (예: "인증 사진", "칭찬 메시지")
  placeholder TEXT, -- 입력 필드 placeholder
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Submissions 테이블 (참여 내역)
CREATE TABLE IF NOT EXISTS campaign_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  round_id UUID REFERENCES campaign_rounds(round_id), -- NULL 가능 (상시 이벤트)
  user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  verification_data JSONB, -- { photo_url: "...", text: "...", value: 123, peer_id: "..." }
  peer_user_id TEXT REFERENCES users(user_id), -- 칭찬 챌린지의 경우 수신자
  reward_received BOOLEAN DEFAULT false, -- 보상 지급 여부
  reward_type TEXT, -- 실제 받은 보상 타입 (CHOICE인 경우)
  reward_amount INTEGER, -- 실제 받은 보상 금액
  rejection_reason TEXT, -- 반려 사유
  reviewed_by TEXT REFERENCES users(user_id), -- 심사자
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 참여 제한: 상시 이벤트는 campaign_id + user_id, 기간제는 campaign_id + round_id + user_id
  -- Partial Unique Index로 처리 (아래 인덱스 섹션 참조)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_rounds_campaign_id ON campaign_rounds(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_verification_methods_campaign_id ON campaign_verification_methods(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_submissions_campaign_id ON campaign_submissions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_submissions_user_id ON campaign_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_submissions_status ON campaign_submissions(status);
CREATE INDEX IF NOT EXISTS idx_campaign_submissions_created_at ON campaign_submissions(created_at DESC);

-- 참여 제한: 상시 이벤트는 사용자당 1회만 참여 가능
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_submissions_unique_always 
ON campaign_submissions(campaign_id, user_id) 
WHERE round_id IS NULL;

-- 참여 제한: 기간제 이벤트는 구간당 1회만 참여 가능
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_submissions_unique_seasonal 
ON campaign_submissions(campaign_id, round_id, user_id) 
WHERE round_id IS NOT NULL;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_submissions_updated_at BEFORE UPDATE ON campaign_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 활성화
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_verification_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_submissions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 사용자가 챌린지 조회 가능
CREATE POLICY "Anyone can view active campaigns"
  ON campaigns FOR SELECT
  USING (status = 'ACTIVE');

-- RLS 정책: 관리자만 챌린지 생성/수정 가능
-- 주의: users 테이블에 is_admin 컬럼이 있어야 합니다 (별도 마이그레이션 필요)
CREATE POLICY "Admins can manage campaigns"
  ON campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE user_id = auth.uid()::text 
      AND is_admin = true
    )
  );

-- RLS 정책: 본인 참여 내역만 조회 가능
CREATE POLICY "Users can view own submissions"
  ON campaign_submissions FOR SELECT
  USING (auth.uid()::text = user_id);

-- RLS 정책: 본인만 참여 가능
CREATE POLICY "Users can create own submissions"
  ON campaign_submissions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- RLS 정책: 인증 방식은 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view verification methods"
  ON campaign_verification_methods FOR SELECT
  USING (true);

-- RLS 정책: 구간 정보는 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view campaign rounds"
  ON campaign_rounds FOR SELECT
  USING (true);

-- RLS 정책: 관리자는 모든 submission 조회 가능
CREATE POLICY "Admins can view all submissions"
  ON campaign_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE user_id = auth.uid()::text 
      AND is_admin = true
    )
  );

-- RLS 정책: 관리자는 submission 승인/반려 가능
CREATE POLICY "Admins can update submissions"
  ON campaign_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE user_id = auth.uid()::text 
      AND is_admin = true
    )
  );
