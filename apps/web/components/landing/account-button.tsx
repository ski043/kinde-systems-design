"use client";

import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { kindeRoutes } from "@/lib/kinde/urls";
import { dashboard, signInLabel } from "./content";

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

  return (
    <Button
      variant="ink"
      size="pill"
      className={className}
      style={style}
      nativeButton={false}
      render={
        isAuthenticated ? (
          <Link href={dashboard.href} onClick={onNavigate} />
        ) : (
          <a href={kindeRoutes.login} onClick={onNavigate} />
        )
      }
    >
      {isAuthenticated ? dashboard.label : signInLabel}
    </Button>
  );
}
