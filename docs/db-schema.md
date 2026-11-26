# DB 스키마

## 규약

- 모든 테이블은 RLS를 켜고 시작한다.
- 비동기 job 테이블의 `status`: `pending` / `processing` / `done` / `failed`
- 스키마 변경은 `supabase/migrations/`에 새 마이그레이션으로만 추가한다.

## Enum

### `study_concern` (온보딩 공부 고민)

| 값 | 화면 문구 | 매칭되는 `ai_student` |
| --- | --- | --- |
| `just_for_fun` | 다 필요 없고 재미가 최고예요 | `dapdapi` (답답이) |
| `cant_explain_terms` | 용어는 외웠는데 설명이 안 돼요 | `chorongi` (초롱이) |
| `confused_causality` | 개념은 아는데 인과관계가 헷갈려요 | `ttokttogi` (똑똑이) |
| `trips_on_tricky_questions` | 응용·함정 문제만 나오면 틀려요 | `kkanjogi` (깐족이) |

### `ai_student` (AI 학생)

`dapdapi` · `chorongi` · `ttokttogi` · `kkanjogi`

## 테이블

### `profiles`

사용자당 1행. **row가 있으면 온보딩 완료**로 본다(별도 완료 플래그 없음).

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `id` | uuid | PK, `auth.users(id)` 참조, on delete cascade | 사용자 ID |
| `nickname` | text | not null, 2~20자, 앞뒤 공백 불가, `lower(nickname)` 유니크 | 활동명 (대소문자 구분 없이 중복 불가) |
| `avatar` | text | not null, 1~50자 | 아바타 식별자 |
| `school_name` | text | not null, 1~50자, 앞뒤 공백 불가 | 학교 이름 |
| `school_code` | text | null 허용 | NEIS 표준 학교 코드. 목록에서 못 찾아 직접 입력하면 null |
| `school_kind` | text | null 허용 | `중학교` / `고등학교` (NEIS 값). 직접 입력이면 null |
| `grade` | smallint | not null, 1~3 | 학년 |
| `study_concern` | `study_concern` | not null | 공부 고민 |
| `matched_student` | `ai_student` | not null | 매칭된 AI 학생 (이후 변경 가능) |
| `created_at` | timestamptz | not null, default `now()` | 생성 시각 |
| `updated_at` | timestamptz | not null, default `now()` | 수정 시각 (update 트리거로 갱신) |

**인덱스**

| 이름 | 대상 | 용도 |
| --- | --- | --- |
| `profiles_nickname_lower_key` | `lower(nickname)` unique | 닉네임 중복 방지 |
| `profiles_school_code_idx` | `school_code` (where `school_code is not null`) | "우리 학교" 피드 조회 |

**RLS** (대상 role: `authenticated`)

| 동작 | 조건 |
| --- | --- |
| select | `id = auth.uid()` (본인 row만) |
| insert | `id = auth.uid()` |
| update | `id = auth.uid()` (id 변경 불가) |
| delete | 정책 없음 → 차단 (`auth.users` 삭제 시 cascade로만 삭제) |

다른 사용자의 프로필 공개 조회는 티치톡 단계에서 별도 마이그레이션으로 추가한다.

## 함수

### `is_nickname_available(p_nickname text) → boolean`

- 닉네임 사용 가능 여부. 대소문자·앞뒤 공백을 무시하고 비교한다.
- 다른 사용자가 쓰는 닉네임이면 `false`. 호출자 본인의 현재 닉네임은 `true`(프로필 수정용).
- `null`/빈 문자열은 `false`. 길이 등 형식 검증은 `profiles` 제약이 담당한다(insert/update 시 검증).
- `security definer`, `search_path = ''`. `authenticated`만 실행 가능(`public`, `anon` 권한 회수).

### `set_updated_at() → trigger`

`updated_at`을 `now()`로 갱신하는 공용 트리거 함수. `profiles`에 연결돼 있다.
