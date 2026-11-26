# TeachMe Server

티치미(TeachMe) 앱의 서버. Supabase(Auth, PostgreSQL, Storage, Edge Functions, pgvector) 기반이며,
AI는 OpenAI, 숏폼 렌더링은 Creatomate를 사용한다.

> 현재는 뼈대만 있는 상태이며, 모든 Edge Function은 `501 Not Implemented`를 반환한다.

## 시작하기

1. [Supabase CLI](https://supabase.com/docs/guides/cli) 설치 (Windows: `scoop install supabase` 또는 `npm i -g supabase`)
2. `.env.example`을 `.env`로 복사하고 값을 채운다.
3. 로컬 실행:

```bash
supabase start
supabase functions serve --env-file .env
```

## 구조

```
supabase/
  config.toml
  migrations/            # 스키마 변경은 새 마이그레이션으로만 추가
  seed.sql
  functions/
    _shared/             # ai.ts, supabase.ts, cors.ts, errors.ts, prompts/
    materials/
    sessions/
    shorts/
    creatomate-webhook/
docs/                    # teachme-plan.md, api-spec.md, db-schema.md
```

개발 원칙은 [CLAUDE.md](CLAUDE.md)를 참고.
