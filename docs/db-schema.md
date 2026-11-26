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

### `student_type` (학생 구분)

| 값 | 의미 |
| --- | --- |
| `middle_school` | 중학생 |
| `high_school` | 고등학생 |
| `repeat_exam_taker` | N수생 |
| `general` | 일반인 |

## 테이블

### `profiles`

사용자당 1행. **row가 있으면 온보딩 완료**로 본다(별도 완료 플래그 없음).

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `id` | uuid | PK, `auth.users(id)` 참조, on delete cascade | 사용자 ID |
| `nickname` | text | not null, 2~20자, 앞뒤 공백 불가, `lower(nickname)` 유니크 | 활동명 (대소문자 구분 없이 중복 불가) |
| `avatar` | text | not null, 1~50자 | 기본 아바타 색 식별자. 허용값 `mint` / `peach` / `sky` / `lemon` (앱 규약, DB는 길이만 검사). 프로필 사진이 없을 때 대체로 사용 |
| `avatar_url` | text | null 허용 | 프로필 사진 URL (`avatars` 버킷). null이면 `avatar` 색을 표시 |
| `student_type` | `student_type` | null 허용 | 학생 구분. 기존 row 때문에 nullable이며 신규 가입은 클라이언트에서 필수로 받는다 |
| `school_name` | text | null 허용, 값이 있으면 1~50자·앞뒤 공백 불가 (`profiles_school_name_check`) | 학교 이름. `student_type`에 따라 필수 여부가 달라진다(아래 참고) |
| `school_code` | text | null 허용, `school_name`이 null이면 null | NEIS 표준 학교 코드. 목록에서 못 찾아 직접 입력하면 null |
| `school_kind` | text | null 허용, `school_name`이 null이면 null | `중학교` / `고등학교` (NEIS 값). 직접 입력이면 null |
| `grade` | smallint | null 허용, 값이 있으면 1~3 (`profiles_grade_check`) | 학년. `student_type`에 따라 필수 여부가 달라진다(아래 참고) |
| `study_concern` | `study_concern` | not null | 공부 고민 |
| `matched_student` | `ai_student` | not null | 매칭된 AI 학생 (이후 변경 가능) |
| `created_at` | timestamptz | not null, default `now()` | 생성 시각 |
| `updated_at` | timestamptz | not null, default `now()` | 수정 시각 (update 트리거로 갱신) |

**인덱스**

| 이름 | 대상 | 용도 |
| --- | --- | --- |
| `profiles_nickname_lower_key` | `lower(nickname)` unique | 닉네임 중복 방지 |
| `profiles_school_code_idx` | `school_code` (where `school_code is not null`) | "우리 학교" 피드 조회 |

**`grade`와 `student_type`의 관계** (`profiles_grade_requires_student_type`)

| `student_type` | `grade` |
| --- | --- |
| `middle_school`, `high_school` | 필수 (1~3) |
| `repeat_exam_taker`, `general` | 반드시 null |
| null (기존 row) | 제약 없음 |

**`school_name`과 `student_type`의 관계** (`profiles_school_requires_student_type`)

| `student_type` | `school_name` |
| --- | --- |
| `middle_school`, `high_school` | 필수 |
| `repeat_exam_taker`, `general` | 선택 (null이어도, 값이 있어도 됨) |
| null (기존 row) | 제약 없음 |

**학교 컬럼 간 관계** (`profiles_school_link_requires_name`)

- `school_name`이 null이면 `school_code`, `school_kind`도 모두 null이어야 한다.
- `school_name`이 있어도 직접 입력이면 `school_code`, `school_kind`는 둘 다 null일 수 있다.

**RLS** (대상 role: `authenticated`)

| 동작 | 조건 |
| --- | --- |
| select | `id = auth.uid()` (본인 row만) |
| insert | `id = auth.uid()` |
| update | `id = auth.uid()` (id 변경 불가) |
| delete | 정책 없음 → 차단 (`auth.users` 삭제 시 cascade로만 삭제) |

다른 사용자의 프로필 공개 조회는 티치톡 단계에서 별도 마이그레이션으로 추가한다.

## Storage

### `avatars` 버킷 (프로필 사진)

| 항목 | 값 |
| --- | --- |
| 공개 여부 | public (URL로 누구나 읽기 가능) |
| 경로 규칙 | `{user_id}/avatar.jpg` |
| 파일 크기 | 최대 2MB |
| MIME 타입 | `image/jpeg`, `image/png`, `image/webp` |

`storage.objects` RLS (대상 role: `authenticated`, 조건: 첫 폴더 이름 = `auth.uid()`)

| 정책 | 동작 |
| --- | --- |
| `avatars_select_own` | 본인 폴더 조회 (upsert에 필요) |
| `avatars_insert_own` | 본인 폴더에 업로드 |
| `avatars_update_own` | 본인 폴더 파일 수정(덮어쓰기) |
| `avatars_delete_own` | 본인 폴더 파일 삭제 |

- 폴더 이름만 검사하며 파일명(`avatar.jpg`)과 확장자는 DB가 강제하지 않는다. 클라이언트가 규칙을 지킨다.
- anon용 select 정책이 없으므로 Storage API로 다른 사용자의 폴더 목록(user id)을 나열할 수 없다. 파일 URL을 알면 public 버킷이라 읽을 수 있다.
- 업로드 후 `profiles.avatar_url`에 공개 URL을 저장한다. 같은 경로를 덮어쓰면 URL이 같으므로 캐시 우회용 쿼리 문자열(`?v=`)은 앱에서 붙인다.

## 함수

### `is_nickname_available(p_nickname text) → boolean`

- 닉네임 사용 가능 여부. 대소문자·앞뒤 공백을 무시하고 비교한다.
- 다른 사용자가 쓰는 닉네임이면 `false`. 호출자 본인의 현재 닉네임은 `true`(프로필 수정용).
- `null`/빈 문자열은 `false`. 길이 등 형식 검증은 `profiles` 제약이 담당한다(insert/update 시 검증).
- `security definer`, `search_path = ''`. `authenticated`만 실행 가능(`public`, `anon` 권한 회수).

### `set_updated_at() → trigger`

`updated_at`을 `now()`로 갱신하는 공용 트리거 함수. `profiles`에 연결돼 있다.
