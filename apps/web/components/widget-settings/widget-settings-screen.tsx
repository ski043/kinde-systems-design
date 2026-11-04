"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  DEFAULT_GREETING,
  defaultAgentName,
  type WidgetSettings,
  type WidgetSettingsInput,
  widgetSettingsSchema,
} from "@marshaldesk/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useDashboardAccent } from "@/components/dashboard/accent-provider";
import { Toaster } from "@/components/ui/sonner";
import type { WidgetAppearance } from "@/components/widget/types";
import { widgetAccent } from "@/components/widget/widget-theme";
import { orpc } from "@/lib/orpc/client";
import { routes } from "@/lib/routes";
import { generatedAgentAvatarUrl } from "@/lib/widget/agent-avatar";
import { EMBED_SCRIPT_URL, embedSnippet } from "@/lib/widget/embed-snippet";
import { InstallSection } from "./install-section";
import { MessagesSection } from "./messages-section";
import { PageHeader } from "./page-header";
import { SetupProgress } from "./setup-progress";
import { useAvatarUpload } from "./use-avatar-upload";
import { useWidgetSettingsAutosave } from "./use-widget-settings-autosave";
import { WidgetPreview } from "./widget-preview";
import { AppearanceSection } from "./appearance-section";
import { DomainsSection } from "./domains-section";

export function WidgetSettingsScreen() {
  const {
    data: { workspace },
  } = useSuspenseQuery(orpc.member.getCurrent.queryOptions());

  const { data: saved } = useSuspenseQuery(
    orpc.widgetSettings.get.queryOptions(),
  );
  const { data: knowledge } = useSuspenseQuery(
    orpc.knowledge.get.queryOptions(),
  );
  const hasKnowledge =
    knowledge.hasKnowledge ||
    knowledge.sources.some((source) => source.status === "ready");

  // Seeded once: later cache updates come from our own saves and must not
  // reset what the owner is typing.
  const [defaultValues] = useState(() => saved.settings);
  const form = useForm<WidgetSettingsInput, unknown, WidgetSettings>({
    resolver: zodResolver(widgetSettingsSchema),
    defaultValues,
    mode: "onChange",
  });
  const autosave = useWidgetSettingsAutosave(form, defaultValues);
  const [agentName, color, position, greeting, allowedDomains] = useWatch({
    control: form.control,
    name: ["agentName", "color", "position", "greeting", "allowedDomains"],
  });

  const { setColor: setDashboardColor } = useDashboardAccent();
  useEffect(() => setDashboardColor(color), [color, setDashboardColor]);

  const avatarUpload = useAvatarUpload();
  const displayName = agentName.trim() || defaultAgentName(workspace.name);
  const generatedAvatarUrl = useMemo(
    () => generatedAgentAvatarUrl(displayName, widgetAccent(color).background),
    [displayName, color],
  );
  const avatarUrl = avatarUpload.url ?? generatedAvatarUrl;

  const appearance: WidgetAppearance = {
    agentEnabled: hasKnowledge,
    agentName: displayName,
    agentAvatarUrl: avatarUrl,
    color,
    position,
    greeting: greeting.trim() || DEFAULT_GREETING,
    suggestedQuestions: knowledge.suggestedQuestions,
  };

  const setupSteps = [
    {
      id: "source",
      label: "Add a source",
      hint: "Teach the agent what you know.",
      href: routes.knowledge,
      done: hasKnowledge,
    },
    {
      id: "domain",
      label: "Add an allowed domain",
      hint: "Choose where the widget loads.",
      href: "#domains",
      done: allowedDomains.length > 0,
    },
    {
      id: "install",
      label: "Install the snippet",
      hint: "Paste one line on your site.",
      href: "#install",
      done: saved.snippetInstalledAt !== null,
    },
  ];

  return (
    <div className="@container flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader autosave={autosave} />
      <SetupProgress steps={setupSteps} />

      <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_25rem] @5xl:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <AppearanceSection
            form={form}
            agentName={displayName}
            avatarUrl={avatarUrl}
            upload={avatarUpload}
          />
          <MessagesSection
            form={form}
            greeting={greeting}
            questions={knowledge.suggestedQuestions}
            hasKnowledge={hasKnowledge}
          />
          <DomainsSection form={form} domains={allowedDomains} />
          <InstallSection
            snippet={embedSnippet(EMBED_SCRIPT_URL, workspace.id)}
          />
        </div>
        <WidgetPreview
          appearance={appearance}
          domain={allowedDomains[0] ?? "yourwebsite.com"}
          className="mx-auto w-full max-w-[25rem] @5xl:sticky @5xl:top-6 @5xl:mx-0"
        />
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
