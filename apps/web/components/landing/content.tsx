import type { ReactNode } from "react";
import { BookOpenIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";

export type NavLink = { label: string; href: string };

export type TrustLogo = { label: string; icon: ReactNode };

export type Stat = {
  glyph: string;
  value: number;
  suffix: string;
  decimals: number;
  label: string;
};

export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Contact", href: "#contact" },
];

export const signInLabel = "Sign in";

export const dashboard: NavLink = { label: "Dashboard", href: "/dashboard" };

export const trust: { label: string; logos: TrustLogo[] } = {
  label: "Answers only from your knowledge base",
  logos: [
    { label: "Knowledge base", icon: <BookOpenIcon /> },
    { label: "Declines off-topic messages", icon: <ShieldCheckIcon /> },
    { label: "Hands off to you", icon: <UserRoundIcon /> },
  ],
};

export const hero = {
  headline: ["Stop answering", "the same questions"],
  subhead:
    "Your agent answers visitors from your knowledge base around the clock, and only brings you in when it isn't sure.",
  ctaLabel: "Get started",
};

export const authShowcase = {
  headline: ["An agent that", "knows its limits"],
  subhead:
    "It answers from your knowledge base, declines what's off-topic, and hands off to you when it isn't sure.",
};

export const stats: Stat[] = [
  {
    glyph: "<",
    value: 10,
    suffix: " min",
    decimals: 0,
    label: "From sign-up to live widget",
  },
  {
    glyph: "%",
    value: 100,
    suffix: "%",
    decimals: 0,
    label: "Of messages classified first",
  },
  {
    glyph: "*",
    value: 24,
    suffix: "/7",
    decimals: 0,
    label: "Answers for your visitors",
  },
  {
    glyph: "#",
    value: 1,
    suffix: "",
    decimals: 0,
    label: "Snippet to paste on your website",
  },
];

export const backgroundVideoUrl =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";
