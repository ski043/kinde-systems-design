import type { Metadata } from "next";
import Script from "next/script";
import {
  HeadphonesIcon,
  LampDeskIcon,
  PackageIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TruckIcon,
  WatchIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Northwind Supply",
  robots: { index: false },
};

type Product = { name: string; price: string; icon: ReactNode; tint: string };

const products: Product[] = [
  {
    name: "Wireless headphones",
    price: "$129",
    icon: <HeadphonesIcon />,
    tint: "bg-amber-100 text-amber-900",
  },
  {
    name: "Smart watch",
    price: "$199",
    icon: <WatchIcon />,
    tint: "bg-sky-100 text-sky-900",
  },
  {
    name: "Desk lamp",
    price: "$49",
    icon: <LampDeskIcon />,
    tint: "bg-emerald-100 text-emerald-900",
  },
];

const perks: { label: string; icon: ReactNode }[] = [
  { label: "Free shipping over $50", icon: <TruckIcon /> },
  { label: "30-day returns", icon: <RotateCcwIcon /> },
  { label: "2-year warranty on electronics", icon: <ShieldCheckIcon /> },
];

// A stand-in for a customer's own website: it embeds the widget exactly as the
// install snippet does, so the widget, agent, and handoff can be shown end to end.
export default async function DemoStorePage({
  params,
}: PageProps<"/demo/[workspaceId]">) {
  const { workspaceId } = await params;

  return (
    <div className="flex min-h-svh flex-col bg-stone-50 text-stone-900 [color-scheme:light]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold">
            <PackageIcon className="size-5" />
            Northwind Supply
          </span>
          <nav className="hidden gap-6 text-sm text-stone-600 sm:flex">
            <span>Electronics</span>
            <span>Home</span>
            <span>Deals</span>
            <span>Orders</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-12">
        <section className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Everyday tech and home goods, delivered fast
          </h1>
          <p className="max-w-xl text-lg text-stone-600">
            Questions about shipping, returns, or your order? Ask in the chat in
            the corner.
          </p>
          <ul className="mt-2 flex flex-wrap gap-3">
            {perks.map((perk) => (
              <li
                key={perk.label}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-stone-200 [&_svg]:size-4"
              >
                {perk.icon}
                {perk.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.name}
              className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200"
            >
              <div
                className={`grid aspect-[4/3] place-items-center rounded-xl [&_svg]:size-14 [&_svg]:stroke-[1.25] ${product.tint}`}
              >
                {product.icon}
              </div>
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">{product.name}</h2>
                <span className="text-stone-600">{product.price}</span>
              </div>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-500">
        Northwind Supply is a demo store for MarshalDesk.
      </footer>

      <Script
        src="/embed.js"
        data-workspace={workspaceId}
        strategy="afterInteractive"
      />
    </div>
  );
}
