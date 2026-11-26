# API 명세서

> 작성 중 — 구현된 엔드포인트부터 추가한다.

## 공통

- Base URL: `https://<project-ref>.supabase.co/functions/v1`
- 인증: `Authorization: Bearer <사용자 access token>` (JWT 검증 켜짐)
- 에러 응답 형식:

```json
{ "error": { "code": "string", "message": "string", "details": null } }
```

## Edge Functions

| 함수 | 상태 |
| --- | --- |
| `schools` | 구현됨 |
| `materials` | 미구현 (501) |
| `sessions` | 미구현 (501) |
| `shorts` | 미구현 (501) |
| `creatomate-webhook` | 미구현 (501) |

---

## `schools` — 학교 검색

NEIS Open API(학교기본정보)로 중학교·고등학교를 검색한다. 온보딩의 학교 선택용.
NEIS 키는 서버 시크릿(`NEIS_API_KEY`)에만 있고 앱으로 내려가지 않는다.

### 요청

`GET /schools?q=<검색어>` 또는 `POST /schools` + `{ "q": "<검색어>" }`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `q` | string | O | 학교 이름 일부. 앞뒤 공백 제거 후 2~50자 |

### 응답 `200`

최대 20개. 중학교·고등학교만 포함하며 학교 이름순(가나다)으로 정렬한다.
코드가 없는 학교(설립 예정 등)는 제외한다. 결과가 없으면 빈 배열.

```json
{
  "schools": [
    {
      "school_code": "7010057",
      "school_name": "가락고등학교",
      "school_kind": "고등학교",
      "region": "서울특별시",
      "address": "서울특별시 송파구 송이로 42"
    }
  ]
}
```

| 필드 | 타입 | NEIS 필드 | 설명 |
| --- | --- | --- | --- |
| `school_code` | string | `SD_SCHUL_CODE` | 표준 학교 코드. `profiles.school_code`에 저장 |
| `school_name` | string | `SCHUL_NM` | 학교 이름 |
| `school_kind` | string | `SCHUL_KND_SC_NM` | `중학교` 또는 `고등학교`. `profiles.school_kind`에 저장 |
| `region` | string \| null | `LCTN_SC_NM` | 시도 |
| `address` | string \| null | `ORG_RDNMA` | 도로명 주소 |

결과 없음:

```json
{ "schools": [] }
```

### 에러

| status | code | 상황 |
| --- | --- | --- |
| 400 | `invalid_query` | `q`가 없거나 2자 미만 / 50자 초과 |
| 400 | `invalid_request` | POST 본문이 JSON이 아님 |
| 401 | — | 로그인하지 않음 (Supabase 게이트웨이가 반환) |
| 405 | `method_not_allowed` | GET/POST 외 메서드 |
| 502 | `upstream_error` | NEIS 오류, HTTP 오류, 예상 밖 응답 |
| 502 | `upstream_timeout` | NEIS 응답 5초 초과 |
| 500 | `server_misconfigured` | `NEIS_API_KEY` 미설정 |

```json
{ "error": { "code": "invalid_query", "message": "q must be at least 2 characters" } }
```

```json
{ "error": { "code": "upstream_timeout", "message": "School search is unavailable" } }
```

### 비고

- 학교를 목록에서 못 찾으면 앱은 `school_name`만 직접 입력하고 `school_code` / `school_kind`는 null로 저장한다.
