-- campaign → events 테이블/컬럼 이름 변경
-- ⚠️ 이 스크립트는 "예전 006"으로 이미 campaigns 테이블을 만든 경우에만 실행하세요.
-- 이벤트 테이블이 아직 없다면 010 말고 006-create-events-tables.sql 만 실행하면 됩니다.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    RAISE EXCEPTION '010 불필요: "events" 테이블이 이미 있습니다. 이 스크립트를 실행하지 마세요.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    RAISE EXCEPTION '010 불가: "campaigns" 테이블이 없습니다. 먼저 006-create-events-tables.sql 을 실행하세요. 010은 예전에 campaigns로 만든 DB를 events로 바꿀 때만 사용합니다.';
  END IF;
END $$;

-- 1) campaigns → events
ALTER TABLE campaigns RENAME TO events;
ALTER TABLE events RENAME COLUMN campaign_id TO event_id;

-- 2) campaign_rounds → event_rounds
ALTER TABLE campaign_rounds RENAME TO event_rounds;
ALTER TABLE event_rounds RENAME COLUMN campaign_id TO event_id;

-- 3) campaign_verification_methods → event_verification_methods
ALTER TABLE campaign_verification_methods RENAME TO event_verification_methods;
ALTER TABLE event_verification_methods RENAME COLUMN campaign_id TO event_id;

-- 4) campaign_submissions → event_submissions
ALTER TABLE campaign_submissions RENAME TO event_submissions;
ALTER TABLE event_submissions RENAME COLUMN campaign_id TO event_id;

-- 5) 트리거 이름 변경 (기존 트리거 제거 후 재생성)
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_submissions_updated_at ON event_submissions;
CREATE TRIGGER update_event_submissions_updated_at BEFORE UPDATE ON event_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6) 인덱스 재생성 (이름 정리)
DROP INDEX IF EXISTS idx_campaigns_category;
DROP INDEX IF EXISTS idx_campaigns_status;
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

DROP INDEX IF EXISTS idx_campaign_rounds_campaign_id;
CREATE INDEX IF NOT EXISTS idx_event_rounds_event_id ON event_rounds(event_id);

DROP INDEX IF EXISTS idx_campaign_verification_methods_campaign_id;
CREATE INDEX IF NOT EXISTS idx_event_verification_methods_event_id ON event_verification_methods(event_id);

DROP INDEX IF EXISTS idx_campaign_submissions_campaign_id;
DROP INDEX IF EXISTS idx_campaign_submissions_user_id;
DROP INDEX IF EXISTS idx_campaign_submissions_status;
DROP INDEX IF EXISTS idx_campaign_submissions_created_at;
CREATE INDEX IF NOT EXISTS idx_event_submissions_event_id ON event_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_submissions_user_id ON event_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_submissions_status ON event_submissions(status);
CREATE INDEX IF NOT EXISTS idx_event_submissions_created_at ON event_submissions(created_at DESC);

DROP INDEX IF EXISTS idx_campaign_submissions_unique_always;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_submissions_unique_always
ON event_submissions(event_id, user_id) WHERE round_id IS NULL;

DROP INDEX IF EXISTS idx_campaign_submissions_unique_seasonal;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_submissions_unique_seasonal
ON event_submissions(event_id, round_id, user_id) WHERE round_id IS NOT NULL;
