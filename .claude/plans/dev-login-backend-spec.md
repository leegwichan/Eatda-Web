# Dev Login — 백엔드 API 스펙 문서

> 프론트엔드에서 필요한 백엔드 엔드포인트 스펙을 정리한 문서입니다.
> Docker 환경에서 Kakao OAuth 없이 로그인하기 위한 기능입니다.

---

## 왜 필요한가?

Docker Hub에 public 이미지로 올려서 누구나 `docker compose up`만으로 실행할 수 있게 하려면,
Kakao API 키 없이도 로그인할 수 있어야 합니다.

기존 로그인은 이런 흐름입니다:

```
[카카오 OAuth] → 인가코드 발급 → POST /api/auth/login {code, origin} → 토큰+회원정보 응답
```

Dev Login은 카카오 OAuth 부분을 건너뛰고, 클라이언트가 직접 회원 정보를 전달합니다:

```
[Dev Login 폼] → POST /api/auth/dev-login {socialId, email, nickname} → 토큰+회원정보 응답
```

---

## 필요한 엔드포인트

### `POST /api/auth/dev-login`

**활성화 조건**: `DEV_LOGIN_ENABLED=true` 환경변수가 설정된 경우에만 동작. 미설정 시 404 반환.

#### Request

```json
{
  "socialId": "dev-1712483200000",
  "email": "dev-1712483200000@dev.local",
  "nickname": "테스트유저"
}
```

| 필드       | 타입   | 설명                                                             |
| ---------- | ------ | ---------------------------------------------------------------- |
| `socialId` | string | 카카오 socialId 대체값. `dev-` 접두어 + 타임스탬프로 자동 생성됨 |
| `email`    | string | 이메일 대체값. 자동 생성됨                                       |
| `nickname` | string | 사용자가 직접 입력한 닉네임                                      |

#### Response — 성공 (200)

**기존 `POST /api/auth/login`의 응답과 동일한 형태**여야 합니다:

```json
{
  "token": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
  },
  "information": {
    "id": 81,
    "isSignUp": true
  }
}
```

| 필드                   | 타입    | 설명                                        |
| ---------------------- | ------- | ------------------------------------------- |
| `token.accessToken`    | string  | JWT 액세스 토큰                             |
| `token.refreshToken`   | string  | JWT 리프레시 토큰                           |
| `information.id`       | number  | 회원 ID                                     |
| `information.isSignUp` | boolean | 신규 회원이면 `true`, 기존 회원이면 `false` |

#### Response — 비활성화 (404)

`DEV_LOGIN_ENABLED`가 `false`이거나 미설정인 경우:

```json
{
  "errorMessage": "Not Found"
}
```

#### Response — 실패 (400)

필수 값 누락 등:

```json
{
  "errorMessage": "socialId, email, nickname은 필수입니다."
}
```

---

## 내부 동작 (권장 구현 방식)

기존 로그인 흐름에서 **카카오가 해주던 역할을 클라이언트가 대신**하는 것이므로,
기존 코드를 최대한 재사용할 수 있습니다:

```
기존: 카카오 → OauthMemberInformation(socialId, email, nickname)
                 ↓
         MemberPersistence.login(member)  ← upsert 로직
                 ↓
         JwtManager → accessToken, refreshToken 발급
                 ↓
         LoginResponse 반환

Dev:  클라이언트 → { socialId, email, nickname }
                 ↓
         new Member(socialId, email, nickname)
                 ↓
         MemberPersistence.login(member)  ← 동일한 upsert 로직 재사용
                 ↓
         JwtManager → accessToken, refreshToken 발급
                 ↓
         LoginResponse 반환 (동일 형태)
```

### 핵심 포인트

1. **같은 `socialId`로 재요청** → 기존 회원 조회 → `isSignUp: false`
2. **새로운 `socialId`로 요청** → 새 회원 생성 → `isSignUp: true`
3. **토큰 발급/갱신** — 기존 JWT 로직 그대로 사용
4. **응답 형태** — 기존 `LoginResponse`와 완전히 동일

---

## Docker Compose 환경변수 설정

```yaml
services:
  server:
    environment:
      DEV_LOGIN_ENABLED: "true"

  web:
    environment:
      NEXT_PUBLIC_DEV_LOGIN_ENABLED: "true"
```

---

## 프론트엔드 호출 흐름

참고로 프론트엔드에서는 이렇게 호출합니다:

```
1. 사용자가 /login 페이지에서 닉네임 입력 후 "Dev 로그인" 버튼 클릭
2. 클라이언트 → Next.js API Route (POST /api/auth/dev-login)
3. Next.js 서버 → 백엔드 (POST /api/auth/dev-login)  ← 이 문서의 엔드포인트
4. 백엔드 응답 → Next.js 서버가 iron-session 쿠키에 토큰 저장
5. 클라이언트로 information 반환 → 홈(/) 또는 온보딩(/member/onboarding)으로 리다이렉트
```

---

## OAuth 설정 관련

Dev Login 모드에서는 Kakao OAuth 환경변수(`client-id` 등)가 없을 수 있으므로,
`OauthProperties`의 필수 검증을 완화하거나 기본값을 설정해야 합니다:

```yaml
# application-local-docker.yml
oauth:
  client-id: unused-in-dev-login-mode
  redirect-path: /login/callback
  allowed-origins:
    - http://localhost:3000
```

---

## 프로덕션 안전성

- `DEV_LOGIN_ENABLED`가 **미설정(기본값 false)이면 엔드포인트 자체가 비활성화**
- 프론트엔드도 `NEXT_PUBLIC_DEV_LOGIN_ENABLED` 미설정 시 카카오 로그인 버튼만 표시
- 양쪽 모두 환경변수로 게이트되므로 프로덕션에서는 절대 노출되지 않음
