"use client";

import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { kindeRoutes } from "@/lib/kinde/urls";
import { dashboard, signInLabel, signUpLabel } from "./content";

export function AccountButton({
  className,
  style,
  onNavigate,
}: {
  className?: string;
  style?: CSSProperties;
  onNavigate?: () => void;
}) {
  const { isAuthenticated, isLoading } = useKindeBrowserClient();
  if (isLoading) return null;

  if (isAuthenticated) {
    return (
      <Button
        variant="ink"
        size="pill"
        className={className}
        style={style}
        nativeButton={false}
        render={<Link href={dashboard.href} onClick={onNavigate} />}
      >
        {dashboard.label}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ink"
        size="pill"
        className={className}
        style={style}
        nativeButton={false}
        render={<a href={kindeRoutes.login} onClick={onNavigate} />}
      >
        {signInLabel}
      </Button>
      <Button
        variant="glow"
        size="pill"
        className={className}
        style={style}
        nativeButton={false}
        render={<a href={kindeRoutes.register} onClick={onNavigate} />}
      >
        {signUpLabel}
      </Button>
    </>
  );
}
