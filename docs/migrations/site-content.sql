-- 메인 화면 문구 관리용 테이블 (관리자에서 편집)
CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 문구 (없을 때만 삽입)
INSERT INTO site_content (key, value)
VALUES
  ('hero_season_badge', '2026 Season 1'),
  ('hero_title', '나의 활동이' || E'\n' || '세상의 기회가 되도록'),
  ('hero_subtitle', '획득한 V.Credit로 기부하고' || E'\n' || '나의 ESG Level을 올려보세요!')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site_content"
  ON site_content FOR SELECT USING (true);
