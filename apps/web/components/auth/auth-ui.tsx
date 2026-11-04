import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function AuthHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h1>
      {children ? (
        <p className="text-sm text-balance text-hero-subhead/80">{children}</p>
      ) : null}
    </div>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-center text-sm text-destructive">
      {message}
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="submit"
      variant="form-primary"
      size="field"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}
