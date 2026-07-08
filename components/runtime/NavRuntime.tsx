"use client";

/**
 * Navigation runtime enhancer.
 *
 * Replicates the Framer nav behaviors measured on https://www.siena.cx:
 *
 * Desktop (nav[data-framer-name="Desktop"], visible >= 1200px):
 *  - hovering Product / Resources / Partners / Company expands the nav card
 *    into the matching dropdown (variant classes framer-v-wctfne / 1pxg195 /
 *    1fz5xqi / 1m4j5up). Height springs open in ~110ms, menu panels fade in
 *    ~130ms, chevrons rotate 180deg with a spring (slight overshoot).
 *  - the SSR DOM ships a stale hidden Menu Area; at hydration it is replaced
 *    with the current menu content captured from the live site (real hrefs).
 *  - hovering the bar turns the card solid (variant framer-v-116z0bk,
 *    "Desktop / Hover"): background rgb(250,247,241) + layered shadow.
 *    Scrolling down also turns it solid; it goes transparent again only when
 *    scrolled back to the top (measured live behavior - closing a menu or
 *    un-hovering keeps it solid).
 *  - scrolling while a menu is open closes it; hovering "Customers" closes
 *    it; hovering "Book a demo" keeps it open (all measured live).
 *  - inactive top links dim to rgb(160,166,167), the active one goes to
 *    rgb(18,32,35); the Customers link dims via container opacity 0.4.
 *  - "Book a demo" hover animates its background gradient stops from solid
 *    dark to the brand rainbow (measured from live computed styles).
 *
 * Mobile/tablet (nav[data-framer-name="Main"], <= 1199px):
 *  - the hamburger (.framer-x592o9) toggles the menu. State switches are
 *    instant on the live site (verified twice with rAF sampling), so the DOM
 *    swaps without a tween: nav variant class + menu body + extra banner row
 *    + hamburger glyph (Font Awesome bars -> minus).
 *  - rows open captured submenus (Products / Resources / Partners / Company),
 *    "Back" returns, links navigate to real targets.
 *
 * All injected DOM comes verbatim from live captures (asset URLs rewritten to
 * local /assets paths, hrefs to internal /path form) stored in
 * /public/runtime/nav-states.json.
 */
import { useEffect } from "react";
import { animate } from "framer-motion";

type DesktopKey = "product" | "resources" | "partners" | "company";

type NavPayload = {
  desktop: {
    variants: Record<string, string>;
    names: Record<string, string>;
    openCardStyle: string;
    panels: {
      products: string;
      resources: string;
      productsHiddenStyle: string;
      resourcesHiddenStyle: string;
    };
    footers: { product: string; partnersCompany: string };
    linkVars: { open: string; closedDim: string; closedNormal: string };
  };
  mobile: {
    states: Record<string, { body: string }>;
    variants: Record<string, string>;
    names: Record<string, string>;
    banner142: string;
    burgerOpenInner: string;
  };
  sprites: string;
};

const OPEN_MS = 110;
const CLOSE_MS = 200;
const PANEL_MS = 130;
const FADE_MS = 150;
const EASE_OPEN = "cubic-bezier(0.5, 0, 0.2, 1)";
const EASE_CLOSE = "cubic-bezier(0.45, 0, 0.2, 1)";

const ACTIVE_COLOR = "rgb(18, 32, 35)";
const DIM_COLOR = "rgb(160, 166, 167)";
const NORMAL_COLOR = "rgb(0, 0, 0)";

// nav link containers in the desktop bar (stable framer classes)
const LINK_CONTAINERS: Record<DesktopKey, string> = {
  product: "framer-1kgdahl-container",
  resources: "framer-4bxy1r-container",
  partners: "framer-3ha8pi-container",
  company: "framer-1v1u4ns-container",
};

// CTA gradient stops measured live (before / hover): [r, g, b, stop%]
const CTA_FROM = [
  [18, 32, 35, 0], [18, 32, 35, 20], [18, 32, 35, 40],
  [18, 32, 35, 60], [18, 32, 35, 80], [18, 32, 35, 100],
];
const CTA_TO = [
  [242, 229, 154, 0], [254, 199, 150, 17.5676], [251, 86, 70, 34.2342],
  [130, 122, 204, 54.0541], [46, 121, 216, 80.6306], [41, 79, 186, 100],
];

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function swapVariantClass(el: Element, variant: string) {
  el.className = el.className
    .split(/\s+/)
    .filter((c) => c && !/^framer-v-/.test(c))
    .concat(variant)
    .join(" ");
}

function htmlToElement(html: string): HTMLElement {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild as HTMLElement;
}

/* ------------------------------------------------------------------ */
/* Desktop                                                             */
/* ------------------------------------------------------------------ */

function initDesktop(payload: NavPayload, cleanups: Array<() => void>) {
  const d = payload.desktop;
  const nav = document.querySelector<HTMLElement>('nav[data-framer-name="Desktop"]');
  const card = nav?.querySelector<HTMLElement>("div.framer-abxou");
  const menuArea = card?.querySelector<HTMLElement>("div.framer-k27yhv");
  if (!nav || !card || !menuArea) return;

  const closedCardStyle = card.getAttribute("style") || "";
  const instant = reducedMotion();

  // ---- replace the stale SSR menu panels with the live-captured ones ----
  const panelP = htmlToElement(d.panels.products);
  panelP.setAttribute("style", d.panels.productsHiddenStyle);
  const panelR = htmlToElement(d.panels.resources);
  panelR.setAttribute("style", d.panels.resourcesHiddenStyle);
  menuArea.replaceChildren(panelP, panelR);

  let footerEl: HTMLElement | null = null;
  let footerGroup: "product" | "partnersCompany" | null = null;

  const ensureFooter = (group: "product" | "partnersCompany" | null) => {
    if (group === footerGroup) return;
    if (footerEl) {
      footerEl.remove();
      footerEl = null;
    }
    footerGroup = group;
    if (group) {
      footerEl = htmlToElement(d.footers[group]);
      card.appendChild(footerEl);
    }
  };

  // footer row opacities for the partners <-> company crossfade
  const setFooterRows = (state: DesktopKey, fade: boolean) => {
    if (!footerEl || footerGroup !== "partnersCompany") return;
    const partnersRow = footerEl.querySelector<HTMLElement>("div.framer-1957rwz");
    const companyRow = footerEl.querySelector<HTMLElement>("div.framer-x14izb");
    const apply = (el: HTMLElement | null, visible: boolean) => {
      if (!el) return;
      const target = visible ? "1" : "0";
      if (fade && !instant) {
        el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: target }], {
          duration: FADE_MS,
          easing: "ease",
        });
      }
      el.style.opacity = target;
      el.style.pointerEvents = visible ? "" : "none";
      // item containers inside the rows carry their own captured opacities
      el.querySelectorAll<HTMLElement>(":scope > div").forEach((child) => {
        child.style.opacity = visible ? "1" : "0";
      });
    };
    apply(partnersRow, state === "partners");
    apply(companyRow, state === "company");
  };

  // ---- chevrons (spring rotate, slight overshoot - fitted from live) ----
  const chevronAngles = new Map<DesktopKey, { value: number; stop?: () => void }>();
  const rotateChevron = (key: DesktopKey, open: boolean) => {
    const container = nav.querySelector<HTMLElement>(`div.${LINK_CONTAINERS[key]}`);
    const wrap = container?.querySelector<HTMLElement>("div.framer-uGclp");
    const odbusp = container?.querySelector<HTMLElement>("div.framer-odbusp");
    if (!wrap || !odbusp) return;
    wrap.setAttribute("data-framer-name", open ? "Open" : "Closed");
    swapVariantClass(wrap, open ? "framer-v-ibv02u" : "framer-v-57ec9o");
    const entry = chevronAngles.get(key) || { value: 0 };
    entry.stop?.();
    const target = open ? 180 : 0;
    if (instant) {
      entry.value = target;
      odbusp.style.transform = target ? `rotate(${target}deg)` : "none";
      chevronAngles.set(key, entry);
      return;
    }
    odbusp.style.willChange = "transform";
    const controls = animate(entry.value, target, {
      type: "spring",
      stiffness: 540,
      damping: 38,
      onUpdate: (v: number) => {
        entry.value = v;
        odbusp.style.transform = `rotate(${v}deg)`;
      },
      onComplete: () => {
        odbusp.style.willChange = "";
        odbusp.style.transform = target ? `rotate(${target}deg)` : "none";
      },
    });
    entry.stop = () => controls.stop();
    chevronAngles.set(key, entry);
  };

  // ---- top link text states ----
  const setLinkStates = (active: DesktopKey | null) => {
    (Object.keys(LINK_CONTAINERS) as DesktopKey[]).forEach((key) => {
      const container = nav.querySelector<HTMLElement>(`div.${LINK_CONTAINERS[key]}`);
      const a = container?.querySelector<HTMLElement>("a");
      const varsEl = a?.querySelector<HTMLElement>("div.framer-18of653");
      const p = a?.querySelector<HTMLElement>("p");
      if (!a || !p) return;
      const state = active === null ? "normal" : active === key ? "open" : "dim";
      a.setAttribute("data-framer-name", state === "open" ? "Open" : "Closed");
      swapVariantClass(a, state === "open" ? "framer-v-4lksqi" : "framer-v-1cncyf0");
      if (varsEl) {
        varsEl.setAttribute(
          "style",
          state === "open" ? d.linkVars.open : state === "dim" ? d.linkVars.closedDim : d.linkVars.closedNormal
        );
      }
      p.style.transition = instant ? "" : "color 0.15s ease";
      p.style.color = state === "open" ? ACTIVE_COLOR : state === "dim" ? DIM_COLOR : NORMAL_COLOR;
    });
    const customers = nav.querySelector<HTMLElement>("div.framer-1uwyr6h-container");
    if (customers) {
      customers.style.transition = instant ? "" : "opacity 0.15s ease";
      customers.style.opacity = active === null ? "1" : "0.4";
    }
  };

  // ---- menu panels ----
  const setPanel = (panel: HTMLElement, hiddenStyle: string, visible: boolean, fade: boolean) => {
    panel.getAnimations().forEach((a) => a.cancel());
    if (visible) {
      if (!fade || instant) {
        panel.style.opacity = "1";
        panel.style.transform = "none";
        return;
      }
      panel.style.opacity = "0";
      panel.style.willChange = "transform";
      const anim = panel.animate(
        [
          { opacity: 0, transform: "translateY(-8px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration: PANEL_MS, easing: EASE_CLOSE }
      );
      anim.onfinish = () => {
        panel.style.opacity = "1";
        panel.style.transform = "none";
      };
    } else {
      if (!fade || instant || getComputedStyle(panel).opacity === "0") {
        panel.setAttribute("style", hiddenStyle);
        return;
      }
      const anim = panel.animate([{ opacity: getComputedStyle(panel).opacity }, { opacity: 0 }], {
        duration: 100,
        easing: "ease-out",
      });
      anim.onfinish = () => panel.setAttribute("style", hiddenStyle);
    }
  };

  // ---- card height animation ----
  let heightAnim: Animation | null = null;
  const animateCardHeight = (h0: number, duration: number, easing: string) => {
    heightAnim?.cancel();
    const h1 = card.offsetHeight;
    if (instant || Math.abs(h1 - h0) < 1) return;
    card.style.overflow = "hidden";
    heightAnim = card.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration, easing });
    heightAnim.onfinish = () => {
      card.style.overflow = "";
      heightAnim = null;
    };
    heightAnim.oncancel = () => {
      card.style.overflow = "";
    };
  };
  const currentCardHeight = () => card.getBoundingClientRect().height;

  // ---- card background / shadow ----
  const shadowZero = (shadow: string) =>
    shadow === "none" ? "none" : shadow.replace(/rgba?\(([^)]+)\)/g, "rgba(0, 0, 0, 0)");
  const applyCardChrome = (solid: boolean, fade: boolean) => {
    const prevBg = getComputedStyle(card).backgroundColor;
    const prevShadow = getComputedStyle(card).boxShadow;
    card.setAttribute("style", solid ? d.openCardStyle : closedCardStyle);
    if (fade && !instant) {
      const nextBg = getComputedStyle(card).backgroundColor;
      const nextShadow = getComputedStyle(card).boxShadow;
      if (prevBg !== nextBg) {
        card.animate(
          [
            { backgroundColor: prevBg, boxShadow: prevShadow === "none" ? shadowZero(nextShadow) : prevShadow },
            { backgroundColor: nextBg, boxShadow: nextShadow === "none" ? shadowZero(prevShadow) : nextShadow },
          ],
          { duration: FADE_MS, easing: "ease" }
        );
      }
    }
  };

  /* ---------------- state machine ---------------- */
  let open: DesktopKey | null = null;
  let solid = false;
  let pointerOverCard = false;

  const setCardVariant = (variant: string, name: string) => {
    swapVariantClass(card, variant);
    card.setAttribute("data-framer-name", name);
  };

  const openMenu = (key: DesktopKey) => {
    if (open === key) return;
    const prev = open;
    open = key;
    const h0 = currentCardHeight();
    const wasSolid = solid;
    solid = true;

    setCardVariant(d.variants[key], d.names[key]);
    applyCardChrome(true, !wasSolid);

    const isArea = key === "product" || key === "resources";
    const prevIsArea = prev === "product" || prev === "resources";
    ensureFooter(key === "product" ? "product" : isArea ? null : "partnersCompany");

    if (isArea) {
      setPanel(panelP, d.panels.productsHiddenStyle, key === "product", prev === null || prevIsArea);
      setPanel(panelR, d.panels.resourcesHiddenStyle, key === "resources", prev === null || prevIsArea);
    } else {
      // live unmounts the area panels instantly when switching to footer menus
      setPanel(panelP, d.panels.productsHiddenStyle, false, false);
      setPanel(panelR, d.panels.resourcesHiddenStyle, false, false);
      setFooterRows(key, prev === "partners" || prev === "company");
    }

    animateCardHeight(h0, OPEN_MS, EASE_OPEN);
    if (prev) rotateChevron(prev, false);
    rotateChevron(key, true);
    setLinkStates(key);
  };

  const closeMenu = () => {
    if (!open) return;
    const prev = open;
    open = null;
    const h0 = currentCardHeight();
    setCardVariant(d.variants.hover, d.names.hover);
    applyCardChrome(true, false);
    ensureFooter(null); // live removes the footer at close start
    setPanel(panelP, d.panels.productsHiddenStyle, false, true);
    setPanel(panelR, d.panels.resourcesHiddenStyle, false, true);
    animateCardHeight(h0, CLOSE_MS, EASE_CLOSE);
    rotateChevron(prev, false);
    setLinkStates(null);
  };

  const toSolid = (fade: boolean) => {
    if (solid || open) return;
    solid = true;
    setCardVariant(d.variants.hover, d.names.hover);
    applyCardChrome(true, fade);
  };

  const toTransparent = () => {
    if (!solid || open || pointerOverCard) return;
    solid = false;
    setCardVariant(d.variants.closed, d.names.closed);
    applyCardChrome(false, true);
  };

  /* ---------------- events ---------------- */
  const on = (
    el: HTMLElement | Window,
    type: string,
    fn: (e: Event) => void,
    opts?: AddEventListenerOptions
  ) => {
    el.addEventListener(type, fn as EventListener, opts);
    cleanups.push(() => el.removeEventListener(type, fn as EventListener, opts));
  };

  (Object.keys(LINK_CONTAINERS) as DesktopKey[]).forEach((key) => {
    const a = nav.querySelector<HTMLElement>(`div.${LINK_CONTAINERS[key]} a`);
    if (a) on(a, "pointerenter", () => openMenu(key));
  });

  const customersA = nav.querySelector<HTMLElement>("div.framer-1uwyr6h-container a");
  if (customersA) on(customersA, "pointerenter", () => closeMenu());

  on(card, "pointerenter", () => {
    pointerOverCard = true;
    toSolid(true);
  });
  on(card, "pointerleave", () => {
    pointerOverCard = false;
    closeMenu();
  });

  const onScroll = () => {
    if (window.scrollY > 0) {
      if (open) closeMenu(); // live closes the dropdown on scroll
      toSolid(false);
    } else if (!open && !pointerOverCard) {
      toTransparent();
    }
  };
  on(window, "scroll", onScroll, { passive: true });
  if (window.scrollY > 0) {
    solid = true;
    setCardVariant(d.variants.hover, d.names.hover);
    card.setAttribute("style", d.openCardStyle);
  }

  // "hover" class for underline links inside injected menu content (Framer
  // toggles a hover class; page.css already ships the matching .hover rules)
  const hoverLine = (a: HTMLElement, over: boolean) => {
    const line = a.querySelector<HTMLElement>("div.framer-1wllu0q");
    const before = line?.getBoundingClientRect();
    a.classList.toggle("hover", over);
    if (!line || !before || instant) return;
    const after = line.getBoundingClientRect();
    if (before.width === after.width || after.width === 0) return;
    const sx = before.width / after.width;
    const dx = before.left - after.left;
    line.animate(
      [
        { transform: `translateX(${dx}px) scaleX(${sx})`, transformOrigin: "0 50%" },
        { transform: "none", transformOrigin: "0 50%" },
      ],
      { duration: 200, easing: "ease" }
    );
  };
  on(card, "pointerover", (e) => {
    const t = (e.target as HTMLElement).closest?.("a.framer-A6ifb");
    if (t && card.contains(t)) hoverLine(t as HTMLElement, true);
  });
  on(card, "pointerout", (e) => {
    const t = (e.target as HTMLElement).closest?.("a.framer-A6ifb");
    const rel = (e as PointerEvent).relatedTarget as Node | null;
    if (t && card.contains(t) && (!rel || !t.contains(rel))) hoverLine(t as HTMLElement, false);
  });

  // CTA gradient hover (stops measured from live computed styles)
  const cta = nav.querySelector<HTMLElement>("div.framer-167oinb-container a");
  if (cta) {
    let ctaStop: (() => void) | null = null;
    let ctaValue = 0;
    const gradient = (t: number) =>
      `linear-gradient(90deg, ${CTA_FROM.map((f, i) => {
        const g = CTA_TO[i];
        const c = f.slice(0, 3).map((v, j) => Math.round(v + (g[j] - v) * t));
        const pos = +(f[3] + (g[3] - f[3]) * t).toFixed(4);
        return `rgb(${c[0]}, ${c[1]}, ${c[2]}) ${pos}%`;
      }).join(", ")})`;
    const runCta = (to: number) => {
      ctaStop?.();
      cta.classList.toggle("hover", to === 1);
      if (instant) {
        ctaValue = to;
        cta.style.backgroundImage = to ? gradient(1) : "";
        cta.style.backgroundColor = to ? "rgba(0, 0, 0, 0)" : "";
        return;
      }
      cta.style.backgroundColor = "rgba(0, 0, 0, 0)";
      const controls = animate(ctaValue, to, {
        duration: 0.25,
        ease: "easeOut",
        onUpdate: (v: number) => {
          ctaValue = v;
          cta.style.backgroundImage = gradient(v);
        },
        onComplete: () => {
          if (to === 0) {
            cta.style.backgroundImage = "";
            cta.style.backgroundColor = "";
          }
        },
      });
      ctaStop = () => controls.stop();
    };
    on(cta, "pointerenter", () => runCta(1));
    on(cta, "pointerleave", () => runCta(0));
  }
}

/* ------------------------------------------------------------------ */
/* Mobile / tablet                                                     */
/* ------------------------------------------------------------------ */

type MobileKey = "closed" | "opened" | "product" | "resources" | "partners" | "company";

function initMobile(payload: NavPayload, cleanups: Array<() => void>) {
  const m = payload.mobile;
  const nav = document.querySelector<HTMLElement>('nav[data-framer-name="Main"]');
  const banner = nav?.querySelector<HTMLElement>("div.framer-b2uh9w");
  const burger = nav?.querySelector<HTMLElement>("div.framer-x592o9");
  if (!nav || !banner || !burger) return;

  const burgerInnerOrig = burger.querySelector<HTMLElement>("div.framer-a3zmiv");
  if (!burgerInnerOrig) return;
  const burgerInnerOpen = htmlToElement(m.burgerOpenInner);
  const banner142 = htmlToElement(m.banner142);

  let state: MobileKey = "closed";
  let bodyEl: HTMLElement | null = null;

  const setState = (next: MobileKey) => {
    if (next === state) return;
    state = next;
    swapVariantClass(nav, m.variants[next]);
    nav.setAttribute("data-framer-name", m.names[next]);
    if (bodyEl) {
      bodyEl.remove();
      bodyEl = null;
    }
    if (next !== "closed") {
      bodyEl = htmlToElement(m.states[next].body);
      nav.appendChild(bodyEl);
    }
    // the banner's second row exists only while the menu is open (live DOM)
    if (next === "closed") banner142.remove();
    else if (banner142.parentElement !== banner) banner.appendChild(banner142);
    // hamburger glyph: Font Awesome "bars" <-> "minus"
    const current = burger.querySelector<HTMLElement>("div.framer-a3zmiv");
    const wanted = next === "closed" ? burgerInnerOrig : burgerInnerOpen;
    if (current && current !== wanted) current.replaceWith(wanted);
  };

  const rowLabel = (row: HTMLElement): MobileKey | null => {
    const text = (row.textContent || "").trim();
    if (text.startsWith("Product")) return "product";
    if (text.startsWith("Resources")) return "resources";
    if (text.startsWith("Partners")) return "partners";
    if (text.startsWith("Company")) return "company";
    return null;
  };

  const onClick = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest("div.framer-x592o9")) {
      e.preventDefault();
      setState(state === "closed" ? "opened" : "closed");
      return;
    }
    if (target.closest("div.framer-y2su2r")) {
      e.preventDefault();
      setState("opened");
      return;
    }
    const row = target.closest<HTMLElement>('div[data-framer-name="Phone"]');
    if (row && state === "opened" && !target.closest("a[href]")) {
      const key = rowLabel(row);
      if (key) {
        e.preventDefault();
        setState(key);
      }
    }
  };
  nav.addEventListener("click", onClick);
  cleanups.push(() => nav.removeEventListener("click", onClick));

  // close the menu if the viewport grows past the mobile/tablet nav range
  const mq = window.matchMedia("(min-width: 1200px)");
  const onMq = () => {
    if (mq.matches) setState("closed");
  };
  mq.addEventListener("change", onMq);
  cleanups.push(() => mq.removeEventListener("change", onMq));
}

/* ------------------------------------------------------------------ */

function injectSprites(payload: NavPayload) {
  if (!payload.sprites || document.getElementById("nav-runtime-sprites")) return;
  const holder = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  holder.setAttribute("id", "nav-runtime-sprites");
  holder.setAttribute("aria-hidden", "true");
  holder.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = payload.sprites;
  holder.appendChild(defs);
  document.body.appendChild(holder);
}

export function NavRuntime() {
  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];
    fetch("/runtime/nav-states.json")
      .then((r) => r.json())
      .then((payload: NavPayload) => {
        if (disposed) return;
        injectSprites(payload);
        initDesktop(payload, cleanups);
        initMobile(payload, cleanups);
      })
      .catch((err) => console.error("NavRuntime: failed to load nav-states.json", err));
    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);
  return null;
}
