📂 V.Together 플랫폼 구축 마스터 기획서 (v2.6)

문서 상태: Final Draft
작성일: 2026.02.11
수정일: 2026.02.11 (v2.6 업데이트)
작성자: PM

1. 프로젝트 개요 (Overview)

1.1 배경 및 목적

배경: ESG 경영 실천 및 조직문화(Culture) 활성화를 위한 통합 임직원 참여 플랫폼 구축.

목표:

전사 연간 기부 목표 2,000만 포인트 달성.

전직원(약 230명)의 80% 이상이 월 1회 이상 접속하는 MAU 확보.

핵심 가치:

Gamification: 레벨(ESG Level), 뱃지, 랭킹 시스템을 통한 참여 동기 부여.

Transparency: 기부금 모금 현황 및 달성 과정을 실시간으로 투명하게 공개.

Togetherness: 동료 칭찬, 팀 대항전 등을 통한 사내 연대감 강화.

1.2 타겟 유저 및 환경

사용자: VNTG 전직원.

플랫폼: Web (PC/Mobile 반응형 웹).

접근성: 사내 그룹웨어 배너 또는 즐겨찾기를 통해 접근.

인증: Google OAuth 2.0 (사내 G-Suite 계정 @vntg.co.kr만 로그인 허용).

2. 시스템 아키텍처 (Technical Architecture)

2.1 Google Cloud Platform (GCP) 구성 - Fixed Stack

안정적이고 확장이 용이한 서버리스(Serverless) 아키텍처를 준수합니다.

구분

서비스명

용도 및 설명

컴퓨팅/배포

Cloud Run

(Main) React 프론트엔드 및 Node.js 백엔드 API 호스팅. 트래픽 기반 자동 스케일링.

컴퓨팅

Compute Engine

(Sub) 배치(Batch) 작업, 레거시 시스템 연동 등 VM이 필수적인 경우 제한적 사용.

데이터베이스

Cloud SQL

(PostgreSQL) 사용자 정보, 포인트 원장(Ledger), 기부/결제 트랜잭션 등 정합성이 중요한 데이터.

NoSQL

Cloud Datastore

이벤트 로그, 챌린지 인증 내역(비정형 텍스트, JSON), 알림 로그 저장.

데이터/AI

Vertex AI

챌린지 인증샷 이미지 분석(텀블러/일회용컵 구분 등), 텍스트(칭찬 메시지) 감성 분석.

네트워크

Cloud Domains

서비스 도메인 등록 및 DNS 관리.

운영/관리

Cloud Monitoring

서버/DB 로그 수집, 트래픽/에러 모니터링, 슬랙(Slack) 연동 알림.

2.2 핵심 데이터 모델링 (ERD Logical View)

1) Users (사용자)

user_id (PK): Google Email ID

dept_name: 부서명 (Team 랭킹 집계용, 최초 로그인 시 자동 동기화)

current_points: 가용 포인트 (현재 보유량, 기부/샵 사용 가능)

total_donated_amount: 누적 기부 금액 (ESG Level 산정 기준 - 획득 포인트가 아님)

level: ECO_KEEPER (LV1), GREEN_MASTER (LV2), EARTH_HERO (LV3)

2) DonationTargets (기부처)

target_id (PK)

target_amount: 목표 금액 (Default: 10,000,000)

current_amount: 현재 모금액

status: ACTIVE (모금 중), COMPLETED (목표 달성/마감)

3) Campaigns (이벤트/챌린지)

campaign_id (PK)

type: ALWAYS (상시), SEASONAL (시즌/구간제)

reward_policy: SENDER_ONLY (참여자만), BOTH (참여자+수신자 쌍방지급 - 칭찬챌린지)

rounds: JSONB (구간 정보, 보상 옵션 SINGLE/CHOICE, 인증 방식 포함)

3. 기능 명세 (Functional Specifications)

3.1 로그인 및 마이 페이지 (My Status)

로그인: Google OAuth 2.0. 최초 접속 시 Users 테이블에 레코드 생성.

ESG Level System:

기준: total_donated_amount (순수 기부액).

등급:

🌱 Eco Keeper: 0 ~ 30,000 P (회색 뱃지)

🌿 Green Master: 30,001 ~ 80,000 P (초록색 뱃지)

🌳 Earth Hero: 80,001 P ~ (보라색 뱃지)

UI: 레벨 아이콘 클릭 시 [레벨 로드맵 모달] 호출 (다음 레벨까지 남은 기부액 표시).

3.2 상시 기부 (Donation) - Core Logic

기부처: 4~5개 고정 (아름다운가게, 혜명보육원 등).

목표 관리:

각 기부처별 목표 금액: 1,000만 포인트(원) 고정.

전사 달성률: 메인 상단에 전체 목표(SUM(Targets)) 대비 현재 달성률(SUM(Current)) Progress Bar 노출.

달성 완료(Completed) 처리:

Trigger: current_amount >= 10,000,000 도달 시 즉시 발동.

UI 상태: 카드 테두리 Gold/Yellow 변경, "Goal Reached! 🏆" 뱃지 부착, 이미지 흑백 처리.

기능 제한: [기부하기] 버튼 -> [달성 완료] 버튼으로 변경 및 Disabled(클릭 불가) 처리.

데이터: 해당 기부처의 status를 COMPLETED로 업데이트.

3.3 챌린지 & 보상 (Campaigns)

필터: 전체 / V.Together(ESG) / People(조직문화) 탭 구분.

인증 방식별 UI (Dynamic Icons):

PHOTO: 📷 (사진 업로드 폼 활성화)

TEXT: ✏️ (텍스트 입력 폼 활성화)

VALUE: 🔢 (숫자 키패드 활성화)

PEER_SELECT: 👥 (조직도 검색 및 동료 선택 폼 활성화)

칭찬 챌린지 (쌍방 보상 로직):

참여: User A가 동료(User B)를 선택하고 칭찬 메시지 작성 (PEER_SELECT + TEXT).

심사: 관리자가 메시지 내용 확인 후 승인.

트랜잭션 (Atomic):

User A에게 보상 포인트 지급.

User B에게 보상 포인트 지급 (동일 금액).

User B에게 "User A님이 칭찬 메시지를 보냈습니다" 알림 발송.

보상 선택 (Reward Choice):

조건: 챌린지 달성 후 보상 옵션이 CHOICE인 경우.

UI: [보상 받기] 대신 [보상 선택] 버튼(강조색) 노출.

Action: 클릭 시 [포인트 vs 쿠폰] 선택 모달 팝업.

후처리: 선택 완료 시 즉시 지급 처리 후 버튼을 [수령 완료](비활성) 상태로 변경.

3.4 개인 기부 (급여 공제)

기능: '신청서 작성하기' 버튼 클릭 시 외부 구글 설문지(Google Form) 새 창 연결.

데이터: 별도 DB 저장 없음 (HR팀 수기 취합용).

3.5 V.Honors (랭킹)

기준: total_donated_amount 내림차순.

탭: 개인 랭킹 / 팀 랭킹.

디자인: 1~3위 메달 표시, 리스트 내 사용자 레벨에 맞는 뱃지 컬러 적용.

4. 관리자 기능 (Admin)

4.1 대시보드

Key Metrics: 전사 누적 기부금, 목표 달성률, MAU, 승인 대기 건수(Pending).

4.2 이벤트 관리 (CMS) - Smart Form

인증 방식 설정: 다중 선택 체크박스 (예: 사진 + 소감 동시 필수).

칭찬 챌린지 설정: 동료 지목 옵션 체크 시 -> 쌍방 지급 옵션 토글 활성화.

보상 설정:

포인트: "승인 시 자동 적립됨" 안내 문구.

쿠폰: "관리자가 별도 발송해야 함" 경고 문구.

구간(Round) 설정: 기간제 이벤트의 경우 N개의 구간을 추가/삭제 가능.

4.3 인증 심사 (Verification Center)

대량 처리: 목록에서 체크박스 다중 선택 -> 하단 Floating Action Bar ([일괄 승인] / [일괄 반려]) 노출.

콘텐츠 미리보기:

사진: 썸네일 (Hover/Click 시 원본 확대).

텍스트: 말풍선 형태로 내용 전체 보기 지원.

수치: 강조된 텍스트로 표시.

4.4 기부처 관리

목표 수정: 각 기부처별 목표 금액(target_amount) 수정 기능 (Default 1,000만원).

오프라인 합산: 오프라인 성금 발생 시 current_amount를 강제로 증액할 수 있는 보정 기능.

5. 개발 로드맵 (Roadmap)

Phase 1: 기반 구축 & 기부 (MVP)

[ ] GCP 프로젝트 셋업 (Cloud Run, SQL, Auth).

[ ] 사용자 DB 스키마 설계 및 OAuth 연동.

[ ] 메인 대시보드(레벨, 포인트) 및 기부(목표/마감 로직) 구현.

Phase 2: 챌린지 & 보상 시스템

[ ] 관리자 이벤트 등록(CMS) 페이지 개발 (복합 인증/보상 설정).

[ ] 사용자 챌린지 참여 모달(동적 폼) 개발.

[ ] 칭찬 챌린지 쌍방 지급 트랜잭션 구현.

[ ] 관리자 대량 심사 기능 개발.

Phase 3: 고도화 & 안정화

[ ] V.Honors 랭킹 집계 최적화 (Redis 캐싱).

[ ] Vertex AI 이미지 분류 모델 도입 (텀블러/일회용컵 자동 식별).

[ ] 모바일 웹뷰 UX 최적화 (터치 인터페이스 개선).