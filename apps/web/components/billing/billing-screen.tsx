"use client";

import type { BillingOverview, PortalSection } from "@marshaldesk/shared";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  SettingsRow,
  SettingsSection,
} from "@/components/dashboard/settings-section";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { orpc } from "@/lib/orpc/client";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function cycleText(cycle: BillingOverview["cycle"]): string {
  return `${dateFormat.format(new Date(cycle.start))} to ${dateFormat.format(new Date(cycle.end))}`;
}

/** Portal links are single use and expire within minutes, so each click makes a new one. */
function usePortal() {
  return useMutation(
    orpc.billing.createPortalLink.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url),
      onError: () => {
        toast.error("Couldn't open the billing portal. Try again.");
      },
    }),
  );
}

function PortalButton({
  section,
  label,
  portal,
  variant = "outline",
}: {
  section: PortalSection;
  label: string;
  portal: ReturnType<typeof usePortal>;
  variant?: "default" | "outline";
}) {
  const opening = portal.isPending && portal.variables.section === section;
  return (
    <Button
      variant={variant}
      disabled={portal.isPending}
      onClick={() => portal.mutate({ section })}
      className="self-start"
    >
      {label}
      {opening ? (
        <Loader2Icon data-icon="inline-end" className="animate-spin" />
      ) : (
        <ExternalLinkIcon data-icon="inline-end" />
      )}
    </Button>
  );
}

function aiRepliesCount(usage: BillingOverview["aiReplies"]): string {
  return usage.included === null
    ? `${usage.used}`
    : `${usage.used} / ${usage.included}`;
}

function overageText(usage: BillingOverview["aiReplies"]): string {
  if (!usage.overageBilled) {
    return "When they're used up, the agent hands new questions to your team until the next cycle starts.";
  }
  return usage.extra > 0
    ? `${usage.extra} extra ${usage.extra === 1 ? "AI reply is" : "AI replies are"} billed on your next invoice.`
    : "AI replies past the included ones are billed as extra on your next invoice.";
}

function AiRepliesRow({ usage }: { usage: BillingOverview["aiReplies"] }) {
  if (!usage.available) {
    return (
      <SettingsRow label="AI replies">
        <p className="text-sm">Not part of your plan.</p>
        <p className="text-[13px]/snug text-muted-foreground">
          The agent hands every question to your team. Change to a plan with AI
          replies so the agent can answer from your knowledge base.
        </p>
      </SettingsRow>
    );
  }
  const { used, included } = usage;
  return (
    <SettingsRow
      label="AI replies"
      description="Each answer the agent gives from your knowledge base counts once. Small talk, declined messages, and handoffs don't."
    >
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{used}</span>{" "}
        {included === null
          ? "used this cycle"
          : `of ${included} included used this cycle`}
      </p>
      {included === null ? null : (
        <Progress
          value={Math.min(used, included)}
          max={Math.max(included, 1)}
          aria-label="Included AI replies used"
        />
      )}
      <p className="text-[13px]/snug text-muted-foreground">
        {overageText(usage)}
      </p>
    </SettingsRow>
  );
}

function ReplySuggestionsRow({ available }: { available: boolean }) {
  return (
    <SettingsRow label="Reply suggestions">
      <p className="text-sm">
        {available ? "Included in your plan." : "Not part of your plan."}
      </p>
      {available ? null : (
        <p className="text-[13px]/snug text-muted-foreground">
          Change to a plan with reply suggestions so your team can draft replies
          from your knowledge base.
        </p>
      )}
    </SettingsRow>
  );
}

export function BillingScreen() {
  const { data: billing } = useSuspenseQuery(orpc.billing.get.queryOptions());
  const portal = usePortal();

  return (
    <div className="flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex max-w-xl flex-col gap-1.5">
        <h1 className="font-display text-3xl tracking-[-0.04em]">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Your workspace&apos;s plan and usage. Plans, invoices, and payments
          are handled by Kinde and Stripe.
        </p>
        {billing.aiReplies.available ? (
          <p className="text-sm">
            AI replies{" "}
            <span className="font-semibold tabular-nums">
              {aiRepliesCount(billing.aiReplies)}
            </span>
          </p>
        ) : null}
      </div>
      <SettingsSection title="Plan">
        <SettingsRow label="Current plan">
          <p className="text-sm font-semibold">
            {billing.plan?.name ?? "No plan"}
          </p>
          <PortalButton
            section="plan"
            label="Change plan"
            portal={portal}
            variant="default"
          />
        </SettingsRow>
        <SettingsRow
          label="Billing cycle"
          description={
            billing.cycle.source === "kinde"
              ? "Usage resets when a new cycle starts."
              : "Kinde reported no billing period, so this shows the calendar month."
          }
        >
          <p className="text-sm tabular-nums">{cycleText(billing.cycle)}</p>
        </SettingsRow>
        <AiRepliesRow usage={billing.aiReplies} />
        <ReplySuggestionsRow available={billing.replySuggestions.available} />
      </SettingsSection>
      <SettingsSection
        title="Payment details"
        description="The card your invoices are charged to."
      >
        <SettingsRow label="Payment method">
          <PortalButton
            section="payment"
            label="Manage payment details"
            portal={portal}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
