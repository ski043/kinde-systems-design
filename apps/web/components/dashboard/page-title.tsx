"use client";

import { usePathname } from "next/navigation";
import { sectionFor } from "@/lib/dashboard-sections";

export function PageTitle() {
  const pathname = usePathname();
  return (
    <p className="text-sm font-medium tracking-[-0.01em]">
      {sectionFor(pathname)?.title ?? "Home"}
    </p>
  );
}
