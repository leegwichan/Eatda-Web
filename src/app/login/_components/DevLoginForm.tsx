"use client";

import { useRouter } from "next/navigation";

import { useDevLoginMutation } from "@/features/auth/api";
import { Button } from "@/shared/components/ui/Button";

export const DevLoginForm = () => {
  const router = useRouter();
  const { mutate: devLogin, isPending } = useDevLoginMutation();

  const handleSubmit = () => {
    const timestamp = Date.now();

    devLogin(
      {
        socialId: `dev-${timestamp}`,
        email: `dev-${timestamp}@dev.local`,
        nickname: "테스트 유저",
      },
      {
        onSuccess: response => {
          if (response.isSignUp) {
            router.replace("/member/onboarding");
          } else {
            router.replace("/");
          }
        },
        onError: error => {
          console.error("Dev 로그인에 실패했습니다:", error);
          alert("Dev 로그인에 실패했습니다. 다시 시도해주세요.");
        },
      }
    );
  };

  return (
    <Button
      variant='primary'
      size='fullWidth'
      disabled={isPending}
      onClick={handleSubmit}
    >
      {isPending ? "로그인 중..." : "Dev 로그인"}
    </Button>
  );
};
