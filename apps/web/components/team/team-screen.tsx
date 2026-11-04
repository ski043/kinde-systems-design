"use client";

import type {
  AssignableRole,
  Invitation,
  Team,
  TeamMember,
} from "@marshaldesk/shared";
import { ORPCError } from "@orpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2Icon, MailIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/dashboard/icon-button";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/lib/orpc/client";
import { writeTeam } from "@/lib/team/cache";
import { InviteForm } from "./invite-form";
import { ASSIGNABLE_ROLE_ITEMS, ROLE_LABELS } from "./role";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

/** A defined error's own message, or `fallback` for anything unexpected. */
function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ORPCError && error.defined ? error.message : fallback;
}

function useTeamMutations() {
  const queryClient = useQueryClient();
  const onSuccess = (team: Team) => writeTeam(queryClient, team);
  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: orpc.team.list.queryKey() });

  const changeRole = useMutation(
    orpc.team.changeRole.mutationOptions({
      onSuccess,
      onError: (error) => {
        toast.error(
          errorMessage(error, "Couldn't change the role. Try again."),
        );
        void refetch();
      },
    }),
  );
  const revokeInvitation = useMutation(
    orpc.team.revokeInvitation.mutationOptions({
      onSuccess,
      onError: (error) => {
        toast.error(
          errorMessage(error, "Couldn't revoke the invitation. Try again."),
        );
        void refetch();
      },
    }),
  );
  return { changeRole, revokeInvitation };
}

function RemoveMemberButton({ member }: { member: TeamMember }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation(
    orpc.team.removeMember.mutationOptions({
      onSuccess: (team) => {
        writeTeam(queryClient, team);
        setOpen(false);
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        if (next) remove.reset();
        setOpen(next);
      }}
    >
      <IconButton
        label="Remove"
        disabled={remove.isPending}
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        <Trash2Icon aria-hidden />
      </IconButton>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="leading-snug">
            Remove {member.name}?
          </DialogTitle>
          <DialogDescription className="break-words">
            They lose access to this workspace within a minute, even if
            they&apos;re signed in right now. You can invite them again later.
          </DialogDescription>
        </DialogHeader>
        {remove.error ? (
          <p className="text-sm text-destructive">
            {errorMessage(remove.error, "Couldn't remove them. Try again.")}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" />}
            disabled={remove.isPending}
          >
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ memberId: member.id })}
          >
            {remove.isPending ? (
              <Loader2Icon
                className="animate-spin"
                data-icon="inline-start"
                aria-hidden
              />
            ) : null}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleControl({
  member,
  canManage,
  onChange,
  pending,
}: {
  member: TeamMember;
  canManage: boolean;
  onChange: (role: AssignableRole) => void;
  pending: boolean;
}) {
  if (member.role === "owner" || !canManage) {
    return (
      <Badge variant={member.role === "owner" ? "secondary" : "outline"}>
        {ROLE_LABELS[member.role]}
      </Badge>
    );
  }
  return (
    <Select
      items={ASSIGNABLE_ROLE_ITEMS}
      value={member.role}
      disabled={pending}
      onValueChange={(value: AssignableRole | null) => {
        if (value && value !== member.role) onChange(value);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Role of ${member.name}`}
        className="w-36"
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
  );
}

function MemberRow({
  member,
  isYou,
  canManage,
  mutations,
}: {
  member: TeamMember;
  isYou: boolean;
  canManage: boolean;
  mutations: ReturnType<typeof useTeamMutations>;
}) {
  const changing =
    mutations.changeRole.isPending &&
    mutations.changeRole.variables.memberId === member.id;
  return (
    <div className="flex items-center gap-3 p-4 @2xl:px-5">
      <Avatar>
        <AvatarImage src={member.avatarUrl} alt="" />
        <AvatarFallback>{initialsOf(member.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {member.name}
          {isYou ? (
            <span className="font-normal text-muted-foreground"> (you)</span>
          ) : null}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {member.email} · Joined {formatDate(member.joinedAt)}
        </span>
      </div>
      <RoleControl
        member={member}
        canManage={canManage}
        pending={changing}
        onChange={(role) =>
          mutations.changeRole.mutate({ memberId: member.id, role })
        }
      />
      {canManage ? (
        <div className="flex w-7 justify-end">
          {member.role === "owner" ? null : (
            <RemoveMemberButton member={member} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function InvitationRow({
  invitation,
  canManage,
  mutations,
}: {
  invitation: Invitation;
  canManage: boolean;
  mutations: ReturnType<typeof useTeamMutations>;
}) {
  const revoking =
    mutations.revokeInvitation.isPending &&
    mutations.revokeInvitation.variables.invitationId === invitation.id;
  return (
    <div className="flex items-center gap-3 p-4 @2xl:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <MailIcon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{invitation.email}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          Invited {formatDate(invitation.createdAt)}
        </span>
      </div>
      <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
      {canManage ? (
        <div className="flex w-7 justify-end">
          <IconButton
            label="Revoke invitation"
            disabled={revoking}
            onClick={() =>
              mutations.revokeInvitation.mutate({
                invitationId: invitation.id,
              })
            }
          >
            {revoking ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <XIcon aria-hidden />
            )}
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}

export function TeamScreen() {
  const { data: current } = useSuspenseQuery(
    orpc.member.getCurrent.queryOptions(),
  );
  const { data: team } = useSuspenseQuery(orpc.team.list.queryOptions());
  const mutations = useTeamMutations();
  // Hides the controls only; every team procedure checks `members:manage` itself.
  const canManage = current.permissions.includes("members:manage");

  return (
    <div className="flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex max-w-xl flex-col gap-1.5">
        <h1 className="font-display text-3xl tracking-[-0.04em]">Team</h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Invite people to help with conversations or billing, and decide what each of them can do."
            : "Everyone who works in this workspace."}
        </p>
      </div>
      {canManage ? (
        <SettingsSection
          title="Invite a member"
          description="Pick the role that fits what they'll do."
        >
          <InviteForm />
        </SettingsSection>
      ) : null}
      <SettingsSection
        title="Members"
        description={`${team.members.length} ${team.members.length === 1 ? "member" : "members"}`}
      >
        {team.members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isYou={member.id === current.member.id}
            canManage={canManage}
            mutations={mutations}
          />
        ))}
      </SettingsSection>
      {team.invitations.length > 0 ? (
        <SettingsSection
          title="Pending invitations"
          description="They join with the role shown when they sign in with that email."
        >
          {team.invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              canManage={canManage}
              mutations={mutations}
            />
          ))}
        </SettingsSection>
      ) : null}
    </div>
  );
}
