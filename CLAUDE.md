# CLAUDE.md — TeachMe Server

티치미(TeachMe) 앱의 서버 레포. Supabase(Auth, PostgreSQL, Storage, Edge Functions, pgvector) + OpenAI + Creatomate.
기획서: `docs/teachme-plan.md`. API 명세(`docs/api-spec.md`)와 DB 스키마(`docs/db-schema.md`)는 작성 예정.

## 프로젝트 개요

- **서비스**: 사용자가 선생님, AI가 학생이 되어 배운 내용을 말로 설명하며 학습하는 역할 반전 공부 앱. 앱은 React Native, 서버는 이 레포(Supabase).
- **핵심 흐름**: 교재 업로드 → AI 학생(답답이·초롱이·똑똑이·깐족이) 선택 → 가르치기 라이브(음성 설명 ↔ AI 학생 꼬리 질문) → AI 분석 리포트 → 하이라이트 숏폼 → 티치톡 게시.
- **서버가 맡는 일**
  - **교재 처리** (`materials`): 텍스트 추출(이미지는 OCR) → 개념 단위 분할 → 임베딩(pgvector) 저장, 핵심 개념 목록 추출. 비동기 job.
  - **수업 턴 처리** (`sessions`): 사용자 음성 STT → 관련 교재 검색(RAG) → AI 학생 질문 생성(+선택적 TTS), 설명을 개념별로 정확·모호·누락·오개념으로 분류(JSON), 힌트 생성.
  - **리포트** (`sessions`): 분류 결과 집계 → 이해도, 막힌 질문 타임라인, 부족한 개념 + 교재 근거 피드백. 비동기 job.
  - **숏폼** (`shorts`, `creatomate-webhook`): 하이라이트 구간 선별 → Creatomate 렌더링 요청 → 웹훅으로 완료 수신 → Storage 저장. 비동기 job.
- 복습 일정은 AI가 아닌 규칙 기반(간격 반복) 알고리즘이다.
- 프로토타입 목표는 실제 휴대폰에서 전체 흐름 시연. 시연 안정성을 위해 미리 만든 결과로 이어가는 시연 모드를 고려한다.

## 원칙

- AI·외부 API 호출은 Edge Functions에서만 한다. 키는 앱으로 내려가지 않는다.
- AI 호출은 `supabase/functions/_shared/ai.ts`를 통해서만 한다. (프로바이더 교체 시 이 파일만 수정)
- 단순 CRUD(프로필, 팔로우, 좋아요, 댓글, 피드 조회)는 앱이 RLS로 직접 접근한다. Edge Function은 AI/외부 API가 필요한 작업만 만든다.
- 교재 처리, 리포트 생성, 숏폼 렌더링은 비동기 job으로 처리하고 `status` 컬럼은 `pending` / `processing` / `done` / `failed` 규약을 쓴다.
- 모든 테이블은 RLS를 켜고 시작한다.
- 스키마 변경은 항상 `supabase/migrations/`에 새 마이그레이션으로 추가한다. 기존 마이그레이션은 수정하지 않는다.
- 한국어로 소통하고, 코드와 식별자는 영어를 쓴다.

## 개발 규칙 (Git)

- main에는 직접 커밋/push하지 않는다. 모든 변경은 브랜치 → PR → 머지로 진행한다. (최초 뼈대 커밋만 예외)
- 브랜치는 항상 최신 main에서 따고, 이름은 feature/ fix/ chore/ docs/ 접두사 + 소문자 하이픈을 쓴다. (예: feature/materials)
- 한 브랜치는 한 기능만 다룬다. 범위를 벗어난 작업이 필요하면 멈추고 사용자에게 묻는다.
- 커밋은 Conventional Commits 형식으로 작은 단위로 나눠서 한다.
- 브랜치 push는 사용자가 요청했을 때만 한다. 커밋만 하고 push는 사용자의 지시를 기다린다.
- PR은 사용자가 요청했을 때만 만든다. PR 본문에는 변경 요약, 테스트 방법, 관련 엔드포인트를 적는다.
- 머지는 Squash merge로 한다. 머지된 브랜치는 삭제하지 않고 그대로 둔다.
- 머지 후 다음 작업은 main을 pull한 뒤 새 브랜치에서 시작한다.

## 구조

- `supabase/functions/_shared/` — `ai.ts`, `supabase.ts`, `cors.ts`, `errors.ts`, `prompts/`
- `supabase/functions/schools/index.ts` — NEIS 학교 검색 (구현됨)
- `supabase/functions/{materials,sessions,shorts,creatomate-webhook}/index.ts` — 현재 501 stub
- `supabase/migrations/` — 마이그레이션 (확장, profiles)
- `docs/` — 기획서, API 명세, DB 스키마

## Edge Function 작성 규칙

- 핸들러는 `withErrorHandling`(`_shared/errors.ts`)으로 감싸 CORS와 JSON 에러 형식을 통일한다.
- 에러 응답: `{ "error": { "code", "message", "details"? } }`
