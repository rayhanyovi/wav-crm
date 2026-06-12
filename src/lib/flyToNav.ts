/**
 * Animates a small dot flying from an origin element toward a navigation target
 * (e.g. the "Deals" sidebar link), like an e-commerce add-to-cart effect.
 *
 * Pure DOM + Web Animations API — no dependencies. Safe no-op if either the
 * origin or the target can't be resolved (e.g. collapsed sidebar, reduced motion).
 */
export function flyDotToNav(origin: HTMLElement | null, navHref: string) {
  if (typeof window === "undefined" || !origin) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const target = document.querySelector<HTMLElement>(`[data-nav-href="${navHref}"]`);
  if (!target) return;

  const from = origin.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;

  const dot = document.createElement("div");
  dot.style.cssText = [
    "position:fixed",
    `left:${startX}px`,
    `top:${startY}px`,
    "width:14px",
    "height:14px",
    "margin:-7px 0 0 -7px",
    "border-radius:9999px",
    "background:var(--primary, #6366f1)",
    "box-shadow:0 0 0 4px color-mix(in srgb, var(--primary, #6366f1) 25%, transparent)",
    "z-index:200",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(dot);

  // Arc the dot: lift up and curve toward the target via a midpoint keyframe.
  const midX = startX + (endX - startX) * 0.5;
  const midY = Math.min(startY, endY) - 60;

  const anim = dot.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0 },
      {
        transform: `translate(${midX - startX}px, ${midY - startY}px) scale(1.25)`,
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.4)`,
        opacity: 0.2,
        offset: 1,
      },
    ],
    { duration: 700, easing: "cubic-bezier(0.5, 0, 0.5, 1)" },
  );

  anim.onfinish = () => {
    dot.remove();
    // Pulse the target so the landing is felt.
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.12)" },
        { transform: "scale(1)" },
      ],
      { duration: 320, easing: "ease-out" },
    );
  };
}
