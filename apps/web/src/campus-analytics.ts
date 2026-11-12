/// <reference types="vite/client" />

import type { CaptureResult, PostHog } from "posthog-js";

export interface ExplorationLocation {
  mode: "tour" | "play";
  place_type: "camera view" | "campus area" | "interior" | "room";
  place: string;
  building?: string;
  floor?: number;
}

type CampusEvents = {
  "$pageview": { entry: "home" | "play" | "tour" };
  campus_mode_selected: { mode: "tour" | "play" };
  campus_teaser_opened: { from: "home" | "game" };
  campus_building_entered: { building: string };
  campus_vehicle_used: { vehicle: string };
  campus_map_opened: { from: "tour" | "play" | "interior" };
  campus_place_explored: ExplorationLocation;
  campus_active_time: ExplorationLocation & { active_seconds: number };
};

const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
const host = import.meta.env.VITE_POSTHOG_REGION === "eu" ? "https://eu.i.posthog.com" : "https://us.i.posthog.com";
export const campusAnalyticsEnabled = import.meta.env.PROD && Boolean(token && /^phc_[\w-]+$/.test(token)) &&
  window.location.hostname === "gta.mmmut.app" && navigator.doNotTrack !== "1" &&
  !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;

let client: PostHog | undefined;
let loadingClient: Promise<PostHog | undefined> | undefined;
let countedPage = false;
const placesSeen = new Set<string>();

function redactUrls(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  const properties = { ...event.properties };
  for (const key of Object.keys(properties)) {
    // Referring domains are enough for traffic sources. Exclude raw paths and URL parameters.
    if (key.endsWith("url") || key.endsWith("referrer") || key.startsWith("$initial_") ||
      key.startsWith("utm_") || ["gclid", "fbclid", "msclkid", "dclid", "$search_keyword"].includes(key)) delete properties[key];
  }
  properties.$current_url = window.location.origin + window.location.pathname;
  return { ...event, properties };
}

function loadAnalytics() {
  return loadingClient ??= import("posthog-js/no-external").then(({ default: sdk }) => {
    sdk.init(token!, {
      api_host: host,
      cookieless_mode: "always",
      person_profiles: "never",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      enable_heatmaps: false,
      respect_dnt: true,
      before_send: redactUrls,
    });
    client = sdk;
    return client;
  }).catch(() => undefined);
}

export function trackCampusEvent<Event extends keyof CampusEvents>(event: Event, properties: CampusEvents[Event], flush = false) {
  if (!campusAnalyticsEnabled) return;
  const options = flush ? { send_instantly: true, transport: "sendBeacon" as const } : undefined;
  if (client) client.capture(event, properties, options);
  else void loadAnalytics().then((ready) => ready?.capture(event, properties, options));
}

export function countCampusVisit(entry: CampusEvents["$pageview"]["entry"]) {
  if (countedPage) return;
  countedPage = true;
  trackCampusEvent("$pageview", { entry });
}

const sampleInterval = 2_000;
const flushInterval = 30_000;
const idleAfter = 45_000;

export function watchCampusExploration(canvas: HTMLCanvasElement, getLocation: () => ExplorationLocation | null) {
  if (!campusAnalyticsEnabled) return () => {};
  const listeners = new AbortController();
  const options = { passive: true, signal: listeners.signal };
  const pending = new Map<string, { location: ExplorationLocation; milliseconds: number }>();
  let lastInput = performance.now();
  let lastSample = lastInput;
  let lastFlush = lastInput;
  let previous: { key: string; since: number } | null = null;

  const onInput = () => { lastInput = performance.now(); };
  window.addEventListener("keydown", onInput, options);
  window.addEventListener("pointerdown", onInput, options);
  canvas.addEventListener("pointermove", onInput, options);
  canvas.addEventListener("wheel", onInput, options);

  function flush(immediate: boolean) {
    for (const { location, milliseconds } of pending.values()) {
      if (milliseconds >= 500) {
        trackCampusEvent("campus_active_time", { ...location, active_seconds: Math.round(milliseconds / 100) / 10 }, immediate);
      }
    }
    pending.clear();
    lastFlush = performance.now();
  }

  function sample() {
    const now = performance.now();
    const elapsed = Math.min(now - lastSample, sampleInterval * 1.25);
    lastSample = now;
    const location = document.visibilityState === "visible" && document.hasFocus() && now - lastInput < idleAfter
      ? getLocation() : null;
    if (!location) previous = null;
    else {
      const key = JSON.stringify([location.mode, location.place_type, location.place, location.building, location.floor]);
      if (previous?.key === key) {
        const bucket = pending.get(key) ?? { location, milliseconds: 0 };
        bucket.milliseconds += elapsed;
        pending.set(key, bucket);
        if (now - previous.since >= sampleInterval && !placesSeen.has(key)) {
          placesSeen.add(key);
          trackCampusEvent("campus_place_explored", location);
        }
      } else previous = { key, since: now };
    }
    if (now - lastFlush >= flushInterval) flush(false);
  }

  function pause() {
    previous = null;
    lastSample = performance.now();
    flush(true);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
  }, options);
  window.addEventListener("pagehide", pause, options);
  window.addEventListener("blur", pause, options);
  const timer = window.setInterval(sample, sampleInterval);
  sample();

  return () => {
    window.clearInterval(timer);
    listeners.abort();
    pause();
  };
}
