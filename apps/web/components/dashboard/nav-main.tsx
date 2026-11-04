"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  BookOpenIcon,
  CreditCardIcon,
  HouseIcon,
  InboxIcon,
  type LucideIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  allowedSections,
  type DashboardSectionKey,
} from "@/lib/dashboard-sections";
import { orpc } from "@/lib/orpc/client";

const icons: Record<DashboardSectionKey, LucideIcon> = {
  home: HouseIcon,
  knowledge: BookOpenIcon,
  inbox: InboxIcon,
  billing: CreditCardIcon,
  team: UsersIcon,
};

/** Only the sections the member's permissions open (PRD T-5). */
export function NavMain() {
  const pathname = usePathname();
  const { permissions } = useSuspenseQuery(
    orpc.member.getCurrent.queryOptions(),
  ).data;
  const items = allowedSections(permissions);

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1.5">
          {items.map((item) => {
            const active = item.matches(pathname);
            const Icon = icons[item.key];
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  className="h-10 gap-3 px-3 text-sm group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0! data-active:bg-brand/10 [&_svg]:size-5 data-active:[&_svg]:text-brand group-data-[collapsible=icon]:[&>span:last-child]:sr-only"
                  render={
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                    />
                  }
                >
                  <Icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
