import { NextResponse } from "next/server";

import { postDevLogin } from "@/features/auth/api";
import { TOKEN_TIMES } from "@/shared/constants/time.constants";
import { type ApiError } from "@/shared/lib/api";
import { getSessionFromServer } from "@/shared/lib/session";

/**
 * Dev 로그인 요청 (Kakao OAuth 우회)
 * @param req - 요청 객체
 * @returns 응답 객체
 */
export const POST = async (req: Request) => {
  const { socialId, email, nickname } = await req.json();

  if (!socialId || !email || !nickname) {
    return NextResponse.json<ApiError>(
      { errorMessage: "필수 값이 누락되었습니다." },
      { status: 400 }
    );
  }

  try {
    const data = await postDevLogin({ socialId, email, nickname });
    const session = await getSessionFromServer();

    session.isLoggedIn = true;
    session.accessToken = data.token.accessToken;
    session.refreshToken = data.token.refreshToken;
    session.userId = String(data.information.id);
    session.accessTokenExpiresAt =
      Date.now() + TOKEN_TIMES.ACCESS_TOKEN_LIFESPAN;

    await session.save();

    return NextResponse.json(data.information);
  } catch (error) {
    console.error("Dev login failed:", error);

    return NextResponse.json<ApiError>(
      { errorMessage: "Dev 로그인에 실패했습니다." },
      { status: 400 }
    );
  }
};
