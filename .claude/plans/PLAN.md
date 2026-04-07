# Dev Login 구현 가이드 (Kakao OAuth 우회)

## Context

Docker Hub에 public 이미지로 올려서 누구나 `docker compose up`만으로 실행할 수 있게 하려면, Kakao OAuth 없이 로그인할 수 있는 dev-login 기능이 필요하다. `DEV_LOGIN_ENABLED=true` 환경변수로 활성화되며, 새 회원을 생성하여 로그인한다.

---

## Server 수정 사항

### 1. Dev Login 설정 추가

**파일**: `src/main/resources/application-local-docker.yml`

```yaml
dev-login:
  enabled: ${DEV_LOGIN_ENABLED:false}
```

**파일**: 새로 생성 — 설정 클래스 (예: `config/DevLoginProperties.java`)

```java
@ConfigurationProperties(prefix = "dev-login")
public record DevLoginProperties(boolean enabled) {}
```

### 2. Dev Login 엔드포인트 추가

**파일**: `controller/auth/AuthController.java` (또는 별도 `DevAuthController.java`)

기존 로그인 흐름을 재사용한다:

- 카카오 OAuth에서 `OauthMemberInformation(socialId, email, nickname)`을 받는 대신, 클라이언트가 직접 전달
- 기존 `MemberPersistence.login(member)` 호출 → `socialId`로 조회, 없으면 새 회원 생성

```java
@PostMapping("/api/auth/dev-login")
public ResponseEntity<LoginResponse> devLogin(@RequestBody DevLoginRequest request) {
    // DEV_LOGIN_ENABLED가 false면 404 반환
    // request에서 socialId, email, nickname을 받아서:
    // 1. new Member(socialId, email, nickname) 생성
    // 2. memberPersistence.login(member) 호출 (기존 upsert 로직 재사용)
    // 3. jwtManager로 accessToken, refreshToken 발급
    // 4. 기존 LoginResponse 형태로 반환
}
```

**요청/응답 형태:**

```
POST /api/auth/dev-login
Body: { "socialId": "dev-12345", "email": "dev@example.com", "nickname": "테스트유저" }

Response: 기존 LoginResponse와 동일
{
  "token": { "accessToken": "...", "refreshToken": "..." },
  "information": { "id": 81, "nickname": "테스트유저", "isSignUp": true, ... }
}
```

- 같은 `socialId`로 다시 요청하면 기존 회원으로 로그인 (`isSignUp: false`)
- 다른 `socialId`로 요청하면 새 회원 생성 (`isSignUp: true`)

### 3. OAuth 설정을 optional로 변경

현재 `OauthProperties`가 `clientId`를 필수로 검증한다면, dev-login 모드에서는 OAuth 관련 환경변수가 없으므로 기본값을 넣거나 검증을 완화해야 한다.

**파일**: `application-local-docker.yml`

```yaml
oauth:
  client-id: unused-in-dev-login-mode
  redirect-path: /login/callback
  allowed-origins:
    - http://localhost:3000
```

---

## Web 수정 사항

### 1. Dev Login API 호출 함수

**파일**: `src/features/auth/_api/auth.api.ts`

```typescript
export async function devLogin(
  socialId: string,
  email: string,
  nickname: string
) {
  // POST /api/auth/dev-login (Next.js API route)
  // body: { socialId, email, nickname }
}
```

### 2. Dev Login Next.js API Route

**파일**: 새로 생성 — `src/app/api/auth/dev-login/route.ts`

기존 `src/app/api/auth/login/route.ts`와 동일한 로직이지만:

- Kakao auth code 대신 `socialId`, `email`, `nickname`을 받음
- 백엔드의 `/api/auth/dev-login`을 호출
- 응답으로 받은 token을 세션에 저장 (기존 로직 재사용)

```typescript
export async function POST(request: Request) {
  const { socialId, email, nickname } = await request.json();

  // 백엔드 dev-login 호출
  const response = await fetch(`${INTERNAL_API_URL}/api/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ socialId, email, nickname }),
  });

  const data = await response.json();

  // 기존 세션 저장 로직과 동일
  session.accessToken = data.token.accessToken;
  session.refreshToken = data.token.refreshToken;
  session.userId = String(data.information.id);
  session.isLoggedIn = true;
  session.accessTokenExpiresAt = Date.now() + 60 * 60 * 1000;
  await session.save();

  return Response.json(data.information);
}
```

### 3. 로그인 페이지에서 카카오 버튼을 Dev Login 버튼으로 교체

**파일**: `src/app/login/page.tsx` (또는 로그인 관련 컴포넌트)

환경변수 `NEXT_PUBLIC_DEV_LOGIN_ENABLED`로 분기:

- `true`: 카카오 로그인 버튼 대신 Dev Login UI 표시
- `false` 또는 미설정: 기존 카카오 로그인 버튼 표시

```tsx
{
  isDevLoginEnabled ? (
    <DevLoginForm /> // nickname 등 입력 폼 + 로그인 버튼
  ) : (
    <KakaoLoginButton /> // 기존 카카오 로그인 버튼
  );
}
```

Dev Login 폼에서는 사용자가 닉네임을 입력하고, `socialId`와 `email`은 자동 생성하거나 고정값을 사용한다.
예: `socialId = "dev-" + timestamp`, `email = "dev-{timestamp}@example.com"`

### 4. Dev Login 후 리다이렉트

기존 로그인 성공 시와 동일하게 `/` (홈)으로 리다이렉트.

---

## Docker Compose 환경변수

```yaml
services:
  server:
    environment:
      DEV_LOGIN_ENABLED: true
  web:
    environment:
      NEXT_PUBLIC_DEV_LOGIN_ENABLED: true
```

---

## 핵심 포인트

- **기존 코드 최대 재사용**: `MemberPersistence.login()`, `JwtManager`, `LoginResponse` 그대로 사용
- **새 회원 생성**: 카카오 OAuth가 해주던 역할을 클라이언트가 대신 수행 (socialId, email, nickname 전달)
- **카카오 버튼 교체**: `NEXT_PUBLIC_DEV_LOGIN_ENABLED` 환경변수로 카카오 로그인 버튼과 Dev Login 버튼을 분기
- **프로덕션 안전**: 환경변수가 없으면 서버 엔드포인트 비활성화 + 프론트 카카오 버튼 유지
- **OAuth 의존성 제거**: Docker 실행 시 Kakao API 키 불필요

---

## 검증 방법

1. `cd docker && docker compose up --build`
2. `http://localhost:3000/login` 접속
3. 닉네임 입력 후 Dev Login 버튼 클릭 → 홈으로 리다이렉트 확인
4. 로그인된 상태에서 각 기능 정상 동작 확인
