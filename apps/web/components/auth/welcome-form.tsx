"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateWorkspaceInput,
  createWorkspaceSchema,
} from "@marshaldesk/shared";
import { isDefinedError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { kindeRoutes } from "@/lib/kinde/urls";
import { orpc } from "@/lib/orpc/client";
import { AuthHeading, FormAlert, SubmitButton } from "./auth-ui";

export function WelcomeForm() {
  const router = useRouter();
  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "" },
  });
  const { errors } = form.formState;

  const createWorkspace = useMutation(
    orpc.workspace.create.mutationOptions({
      // Signing in again puts the new workspace in the session.
      onSuccess: ({ continueUrl }) => window.location.assign(continueUrl),
      onError: (error) => {
        // The page gate sends a signed-out person to the right place.
        if (isDefinedError(error)) router.refresh();
      },
    }),
  );
  const pending = createWorkspace.isPending || createWorkspace.isSuccess;

  const onSubmit = form.handleSubmit((input) => createWorkspace.mutate(input));

  const formError =
    createWorkspace.error && !isDefinedError(createWorkspace.error)
      ? "We couldn't save that. Check your connection and try again."
      : null;

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <AuthHeading title="What's your business called?">
          This names your workspace. You can change it later in settings.
        </AuthHeading>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Business name</FieldLabel>
          <Input
            variant="ink"
            id="name"
            autoComplete="organization"
            autoFocus
            placeholder="Acme Bakery"
            disabled={pending}
            aria-invalid={!!errors.name}
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <FormAlert message={formError} />
        <Field>
          <SubmitButton pending={pending}>Continue</SubmitButton>
        </Field>
        <FieldDescription className="text-center">
          Not you?{" "}
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-normal text-foreground underline"
            nativeButton={false}
            render={<a href={kindeRoutes.logout} />}
          >
            Sign out
          </Button>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
