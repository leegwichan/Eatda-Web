"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useDevLoginMutation } from "@/features/auth/api";
import { Button } from "@/shared/components/ui/Button";
import { TextField } from "@/shared/components/ui/TextField";

export const DevLoginForm = () => {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const { mutate: devLogin, isPending } = useDevLoginMutation();

  const handleSubmit = () => {
    const timestamp = Date.now();

    devLogin(
      {
        socialId: `dev-${timestamp}`,
        email: `dev-${timestamp}@dev.local`,
        nickname,
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
    <>
      <TextField
        label='닉네임'
        placeholder='닉네임을 입력하세요'
        value={nickname}
        onChange={e => setNickname(e.target.value)}
      />
      <Button
        variant='primary'
        size='fullWidth'
        disabled={!nickname.trim() || isPending}
        onClick={handleSubmit}
      >
        {isPending ? "로그인 중..." : "Dev 로그인"}
      </Button>
    </>
  );
};
