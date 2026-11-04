"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AssignableRole,
  type InviteMember,
  type InviteMemberInput,
  inviteMemberSchema,
} from "@marshaldesk/shared";
import { isDefinedError, safe } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { SettingsRow } from "@/components/dashboard/settings-section";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { client } from "@/lib/orpc/client";
import { writeTeam } from "@/lib/team/cache";
import { ASSIGNABLE_ROLE_ITEMS, ROLE_DESCRIPTIONS } from "./role";

const INVITE_FAILED = "Couldn't invite them. Try again.";

export function InviteForm() {
  const queryClient = useQueryClient();
  const form = useForm<InviteMemberInput, unknown, InviteMember>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "support" },
  });
  const { errors, isSubmitting } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit(async (values) => {
    const [error, team] = await safe(client.team.invite(values));
    if (error) {
      form.setError("root", {
        message: isDefinedError(error) ? error.message : INVITE_FAILED,
      });
      return;
    }
    writeTeam(queryClient, team);
    form.reset({ email: "", role: values.role });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsRow
        label="Email and role"
        htmlFor="invite-email"
        description="They join when they sign in to MarshalDesk with this email. No email is sent, so let them know."
      >
        <div className="flex flex-col gap-2 @lg:flex-row">
          <Input
            id="invite-email"
            type="email"
            size="lg"
            placeholder="name@example.com"
            autoComplete="off"
            className="@lg:flex-1"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select
                items={ASSIGNABLE_ROLE_ITEMS}
                value={field.value}
                onValueChange={(value: AssignableRole | null) => {
                  if (value) field.onChange(value);
                }}
              >
                <SelectTrigger
                  aria-label="Role"
                  className="h-9 w-full @lg:w-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2Icon
                className="animate-spin"
                data-icon="inline-start"
                aria-hidden
              />
            ) : null}
            Invite
          </Button>
        </div>
        <p className="text-[13px]/snug text-muted-foreground">
          {ROLE_DESCRIPTIONS[role]}
        </p>
        <FieldError errors={[errors.email, errors.root]} />
      </SettingsRow>
    </form>
  );
}
