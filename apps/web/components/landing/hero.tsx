import { Button } from "@/components/ui/button";
import { kindeRoutes } from "@/lib/kinde/urls";
import { hero } from "./content";
import { TrustRow } from "./trust-row";

const lineDelays = ["0.12s", "0.3s"];

export function Hero() {
  return (
    <section className="relative flex w-full max-w-[900px] flex-1 flex-col items-center justify-center text-center">
      <TrustRow />

      <h1 className="mb-[clamp(14px,2.2vh,22px)] w-full overflow-hidden font-display text-[clamp(30px,10.2vw,80px)] leading-[1.12] font-normal tracking-[-0.04em] whitespace-nowrap text-white max-nav:leading-[1.05] max-nav:tracking-[-0.03em] max-xs:leading-[1.04] max-xs:tracking-[-0.04em] [@media(max-height:700px)]:mb-3">
        {hero.headline.map((line, i) => (
          <span
            key={line}
            className="block animate-headline motion-reduce:animate-none"
            style={{ animationDelay: lineDelays[i] }}
          >
            {line}
          </span>
        ))}
      </h1>

      <p className="mb-[clamp(22px,3.4vh,34px)] max-w-[min(500px,92%)] animate-reveal text-[clamp(calc(13.5px+2pt),calc(1.55vw+2pt),calc(16.5px+2pt))] leading-[1.55] text-balance text-hero-subhead opacity-80 [animation-delay:0.28s] motion-reduce:animate-none [@media(max-height:700px)]:mb-5">
        {hero.subhead}
      </p>

      <Button
        variant="glow"
        size="cta"
        className="animate-reveal-pulse [animation-delay:0.4s] motion-reduce:animate-none"
        nativeButton={false}
        render={<a href={kindeRoutes.register} />}
      >
        {hero.ctaLabel}
      </Button>
    </section>
  );
}
