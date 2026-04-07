# Dev Login — Web(Client) 구현 계획

## Context

Docker Hub public 이미지로 `docker compose up`만으로 실행할 수 있도록, Kakao OAuth 없이 로그인하는 dev-login 기능의 **웹 클라이언트** 측 구현 계획이다. `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` 환경변수로 활성화된다.

기존 로그인 흐름(Kakao OAuth → callback → 세션 저장)을 최대한 재사용하며, 카카오 리다이렉트 대신 닉네임 입력 폼으로 대체한다.

---

## 수정/생성할 파일 목록

| 구분     | 파일                                         | 작업                                       |
| -------- | -------------------------------------------- | ------------------------------------------ |
| 수정     | `src/features/auth/api/auth.dto.ts`          | DevLoginRequestDto 타입 추가               |
| 수정     | `src/features/auth/api/auth.api.ts`          | postDevLogin, postClientDevLogin 함수 추가 |
| 수정     | `src/features/auth/api/auth.queries.ts`      | useDevLoginMutation 훅 추가                |
| 수정     | `src/features/auth/api/index.ts`             | 새 export 추가                             |
| **생성** | `src/app/api/auth/dev-login/route.ts`        | Next.js API route (세션 저장)              |
| **생성** | `src/app/login/_components/DevLoginForm.tsx` | 닉네임 입력 폼 컴포넌트                    |
| 수정     | `src/app/login/_styles/Login.css.ts`         | 폼 스타일 추가                             |
| 수정     | `src/app/login/page.tsx`                     | 카카오 버튼 ↔ DevLoginForm 분기           |

---

## 구현 상세

### 1. DTO 타입 추가 (`auth.dto.ts`)

```ts
export type DevLoginRequestDto = {
  socialId: string;
  email: string;
  nickname: string;
};
```

응답은 기존 `LoginResponseDto`를 그대로 사용한다.

### 2. API 함수 추가 (`auth.api.ts`)

**postDevLogin** — 서버 → 백엔드 호출용 (Next.js API route에서 사용)

```ts
export const postDevLogin = async (params: DevLoginRequestDto) => {
  return await http
    .post("api/auth/dev-login", { json: params })
    .json<LoginResponseDto>();
};
```

**postClientDevLogin** — 클라이언트 → Next.js API route 호출용

```ts
export const postClientDevLogin = async (params: DevLoginRequestDto) => {
  return await nextHttp
    .post("api/auth/dev-login", { json: params })
    .json<Information>();
};
```

### 3. Mutation 훅 추가 (`auth.queries.ts`)

`useLoginMutation`과 동일한 패턴:

```ts
export const useDevLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postClientDevLogin,
    onSuccess: response => {
      clearClientSessionCache();
      queryClient.setQueryData(memberQueryKeys.me(), response);
    },
  });
};
```

### 4. Next.js API Route 생성 (`src/app/api/auth/dev-login/route.ts`)

기존 `/api/auth/login/route.ts`와 동일한 세션 저장 로직. 차이점:

- Request body: `{ socialId, email, nickname }` (code/origin 대신)
- 백엔드 호출: `postDevLogin({ socialId, email, nickname })`

```ts
export const POST = async (req: NextRequest) => {
  const { socialId, email, nickname } = await req.json();

  // 유효성 검사: socialId, email, nickname 필수
  if (!socialId || !email || !nickname) {
    return NextResponse.json(
      { errorMessage: "필수 값이 누락되었습니다." },
      { status: 400 }
    );
  }

  try {
    const data = await postDevLogin({ socialId, email, nickname });
    const session = await getSessionFromServer();

    // 기존 로그인과 동일한 세션 저장 로직
    session.isLoggedIn = true;
    session.accessToken = data.token.accessToken;
    session.refreshToken = data.token.refreshToken;
    session.userId = String(data.information.id);
    session.accessTokenExpiresAt =
      Date.now() + TOKEN_TIMES.ACCESS_TOKEN_LIFESPAN;
    await session.save();

    return NextResponse.json(data.information);
  } catch (error) {
    return NextResponse.json(
      { errorMessage: "Dev 로그인에 실패했습니다." },
      { status: 400 }
    );
  }
};
```

### 5. DevLoginForm 컴포넌트 (`src/app/login/_components/DevLoginForm.tsx`)

```tsx
"use client";
// useState로 nickname 관리
// useDevLoginMutation() 사용
// useRouter()로 리다이렉트

// 제출 시:
// - socialId = `dev-${Date.now()}`
// - email = `dev-${Date.now()}@dev.local`
// - nickname은 사용자 입력

// onSuccess: isSignUp → /member/onboarding, else → /
// onError: alert 표시

// UI: TextField(label="닉네임") + Button(variant="primary", size="fullWidth", "Dev 로그인")
// 닉네임 미입력 또는 isPending 시 버튼 disabled
```

### 6. 스타일 추가 (`Login.css.ts`)

```ts
export const devLoginWrapper = style({
  width: "100%",
  padding: "4rem 2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.2rem",
});
```

### 7. 로그인 페이지 분기 (`page.tsx`)

```tsx
const isDevLoginEnabled = process.env.NEXT_PUBLIC_DEV_LOGIN_ENABLED === "true";

// JSX에서:
{
  isDevLoginEnabled ? (
    <div className={styles.devLoginWrapper}>
      <DevLoginForm />
    </div>
  ) : (
    <div className={styles.kakaoButtonWrapper}>{/* 기존 카카오 버튼 */}</div>
  );
}
```

`NEXT_PUBLIC_` 접두어 환경변수는 Next.js 빌드 시 인라인되므로 클라이언트에서 정상 작동한다.

### 8. Export 추가 (`index.ts`)

- `postDevLogin`, `postClientDevLogin`
- `DevLoginRequestDto` (type)
- `useDevLoginMutation`

---

## 구현 순서

1. `auth.dto.ts` → 2. `auth.api.ts` → 3. `auth.queries.ts` → 4. `index.ts`
2. `src/app/api/auth/dev-login/route.ts`
3. `Login.css.ts` → 7. `DevLoginForm.tsx` → 8. `page.tsx`

(1~4와 5~6은 병렬 가능)

---

## 검증 방법

1. `.env.local`에 `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` 설정
2. `pnpm dev` 실행 후 `/login` 접속
3. 카카오 버튼 대신 닉네임 입력 폼이 표시되는지 확인
4. 닉네임 입력 후 Dev 로그인 버튼 클릭
5. 백엔드 `POST /api/auth/dev-login`이 호출되고 세션이 저장되는지 확인
6. isSignUp=true이면 `/member/onboarding`, false이면 `/`로 리다이렉트 확인
7. `NEXT_PUBLIC_DEV_LOGIN_ENABLED` 미설정 시 기존 카카오 버튼이 표시되는지 확인
