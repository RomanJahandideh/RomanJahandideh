/*
  Project: Interactive WebGL Interface
  Author: Roman Jahandideh
  Copyright: © 2026 Roman Jahandideh. All rights reserved.
  Notes:
  - Adaptive spotlight
  - Eye micro-interaction system
  - Scene discovery hotspots
  - Hidden debug controls
*/

(() => {
  "use strict";

  const root = document.documentElement;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const state = {
    pointerX: window.innerWidth / 2,
    pointerY: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    currentX: window.innerWidth / 2,
    currentY: window.innerHeight / 2,
    currentRadius: 220,
    targetRadius: 220,
    currentSoftness: 160,
    targetSoftness: 160,
    velocity: 0,
    lastMoveTime: performance.now(),
    eyeSensitivity: 1,
    parallaxStrength: 12,
    isPanelOpen: false,
    rafId: null,
    discoveryTimeout: null,
    activeHotspotId: null,
    foundHotspots: new Set(),
    blinkTimeout: null
  };

  const config = {
    smoothing: 0.16,
    radiusMin: 170,
    radiusMax: 280,
    softnessMin: 110,
    softnessMax: 210,
    hotspotNearDistance: 120,
    hotspotFoundDistance: 74,
    idleBlinkMin: 1800,
    idleBlinkMax: 4200
  };

  const setVar = (name, value) => root.style.setProperty(name, value);

  const setSpotlight = (x, y, radius, softness) => {
    setVar("--mx", `${x}px`);
    setVar("--my", `${y}px`);
    setVar("--reveal-radius", `${radius}px`);
    setVar("--reveal-softness", `${softness}px`);
  };

  const setParallax = (x, y) => {
    setVar("--parallax-x", `${x}px`);
    setVar("--parallax-y", `${y}px`);
  };

  const hero = document.querySelector(".hero");
  const eyes = Array.from(document.querySelectorAll("#eyes .eye"));
  const hotspots = Array.from(document.querySelectorAll(".scene-hotspot"));

  const discoveryChip = document.getElementById("discovery-chip");
  const discoveryTitle = discoveryChip?.querySelector(".discovery-chip__title");
  const discoveryCopy = discoveryChip?.querySelector(".discovery-chip__copy");

  const debugPanel = document.getElementById("debug-panel");
  const debugRadius = document.getElementById("debug-radius");
  const debugSoftness = document.getElementById("debug-softness");
  const debugEyeSensitivity = document.getElementById("debug-eye-sensitivity");
  const debugParallax = document.getElementById("debug-parallax");

  const updateDiscovery = (title, copy, active = false) => {
    if (!discoveryChip || !discoveryTitle || !discoveryCopy) return;

    discoveryTitle.textContent = title;
    discoveryCopy.textContent = copy;
    discoveryChip.classList.toggle("is-active", active);

    clearTimeout(state.discoveryTimeout);
    if (active) {
      state.discoveryTimeout = window.setTimeout(() => {
        discoveryChip.classList.remove("is-active");
        discoveryTitle.textContent = "Ready";
        discoveryCopy.textContent = "Move the light across the scene to reveal hidden interaction points.";
      }, 1800);
    }
  };

  const blink = () => {
    if (!eyes.length) return;

    eyes.forEach((eye) => eye.classList.add("is-blinking"));

    window.setTimeout(() => {
      eyes.forEach((eye) => eye.classList.remove("is-blinking"));
    }, 120);
  };

  const queueBlink = () => {
    clearTimeout(state.blinkTimeout);
    const delay = Math.round(
      config.idleBlinkMin + Math.random() * (config.idleBlinkMax - config.idleBlinkMin)
    );

    state.blinkTimeout = window.setTimeout(() => {
      blink();
      queueBlink();
    }, delay);
  };

  const updateEyes = (clientX, clientY) => {
    if (!eyes.length) return;

    const speedWide = state.velocity > 26;

    eyes.forEach((eye) => {
      eye.classList.toggle("is-wide", speedWide);

      const pupil = eye.querySelector(".pupil");
      if (!pupil) return;

      const r = eye.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      const dx = (clientX - cx) * state.eyeSensitivity;
      const dy = (clientY - cy) * state.eyeSensitivity;

      const pupilRect = pupil.getBoundingClientRect();
      const pupilRadius = pupilRect.width / 2 || 9;
      const eyeRadius = r.width / 2;
      const max = Math.max(0, eyeRadius - pupilRadius - 6);

      const dist = Math.hypot(dx, dy) || 1;
      const nx = (dx / dist) * Math.min(dist, max);
      const ny = (dy / dist) * Math.min(dist, max);

      pupil.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    });
  };

  const readHotspotCenter = (hotspot) => {
    const rect = hotspot.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  };

  const updateHotspots = () => {
    if (!hotspots.length) return;

    let nearestFound = null;
    let nearestDistance = Infinity;

    hotspots.forEach((hotspot) => {
      const { x, y } = readHotspotCenter(hotspot);
      const distance = Math.hypot(state.currentX - x, state.currentY - y);

      hotspot.classList.toggle("is-near", distance < config.hotspotNearDistance);
      hotspot.classList.toggle("is-found", state.foundHotspots.has(hotspot.dataset.hotspot));

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestFound = hotspot;
      }

      if (
        distance < config.hotspotFoundDistance &&
        !state.foundHotspots.has(hotspot.dataset.hotspot)
      ) {
        state.foundHotspots.add(hotspot.dataset.hotspot);
        hotspot.classList.add("is-found");
        updateDiscovery(
          hotspot.dataset.label || "Discovery",
          hotspot.dataset.copy || "Hidden scene detail revealed.",
          true
        );
      }
    });

    if (
      nearestFound &&
      nearestDistance < config.hotspotNearDistance &&
      state.activeHotspotId !== nearestFound.dataset.hotspot
    ) {
      state.activeHotspotId = nearestFound.dataset.hotspot;
      updateDiscovery(
        nearestFound.dataset.label || "Discovery",
        nearestFound.dataset.copy || "Hidden scene detail revealed.",
        true
      );
    }

    if (nearestDistance >= config.hotspotNearDistance) {
      state.activeHotspotId = null;
    }
  };

  const updateAdaptiveSpotlightTargets = () => {
    const idleFor = performance.now() - state.lastMoveTime;
    const speedInfluence = clamp(state.velocity * 1.8, 0, 38);
    const idleShrink = idleFor > 1800 ? 12 : 0;

    state.targetRadius = clamp(
      220 + speedInfluence - idleShrink,
      config.radiusMin,
      config.radiusMax
    );

    state.targetSoftness = clamp(
      160 + speedInfluence * 0.9,
      config.softnessMin,
      config.softnessMax
    );

    if (state.activeHotspotId) {
      state.targetRadius = clamp(state.targetRadius - 18, config.radiusMin, config.radiusMax);
      state.targetSoftness = clamp(state.targetSoftness - 10, config.softnessMin, config.softnessMax);
    }

    if (debugRadius) state.targetRadius = Number(debugRadius.value);
    if (debugSoftness) state.targetSoftness = Number(debugSoftness.value);
  };

  const tick = () => {
    state.currentX += (state.targetX - state.currentX) * config.smoothing;
    state.currentY += (state.targetY - state.currentY) * config.smoothing;

    updateAdaptiveSpotlightTargets();

    state.currentRadius = lerp(state.currentRadius, state.targetRadius, 0.12);
    state.currentSoftness = lerp(state.currentSoftness, state.targetSoftness, 0.12);

    setSpotlight(state.currentX, state.currentY, state.currentRadius, state.currentSoftness);

    const normalizedX = (state.currentX / window.innerWidth) - 0.5;
    const normalizedY = (state.currentY / window.innerHeight) - 0.5;
    setParallax(
      clamp(normalizedX * state.parallaxStrength, -state.parallaxStrength, state.parallaxStrength),
      clamp(normalizedY * state.parallaxStrength, -state.parallaxStrength, state.parallaxStrength)
    );

    updateEyes(state.currentX, state.currentY);
    updateHotspots();

    const dx = Math.abs(state.targetX - state.currentX);
    const dy = Math.abs(state.targetY - state.currentY);
    const dr = Math.abs(state.targetRadius - state.currentRadius);
    const ds = Math.abs(state.targetSoftness - state.currentSoftness);

    if (dx < 0.2 && dy < 0.2 && dr < 0.2 && ds < 0.2 && performance.now() - state.lastMoveTime > 400) {
      state.rafId = null;
      return;
    }

    state.rafId = requestAnimationFrame(tick);
  };

  const requestUpdate = () => {
    if (state.rafId == null) state.rafId = requestAnimationFrame(tick);
  };

  const onPointerMove = (clientX, clientY) => {
    const now = performance.now();
    const distance = Math.hypot(clientX - state.pointerX, clientY - state.pointerY);
    const dt = Math.max(16, now - state.lastMoveTime);

    state.velocity = distance / (dt / 16.6667);
    state.pointerX = clientX;
    state.pointerY = clientY;

    state.targetX = clientX;
    state.targetY = clientY;
    state.lastMoveTime = now;

    requestUpdate();
  };

  window.addEventListener("mousemove", (e) => {
    onPointerMove(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    onPointerMove(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener("resize", () => {
    state.targetX = clamp(state.targetX, 0, window.innerWidth);
    state.targetY = clamp(state.targetY, 0, window.innerHeight);
    state.currentX = clamp(state.currentX, 0, window.innerWidth);
    state.currentY = clamp(state.currentY, 0, window.innerHeight);
    requestUpdate();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "d") return;
    state.isPanelOpen = !state.isPanelOpen;

    if (debugPanel) {
      debugPanel.hidden = !state.isPanelOpen;
    }
  });

  if (debugRadius) {
    debugRadius.addEventListener("input", () => {
      requestUpdate();
    });
  }

  if (debugSoftness) {
    debugSoftness.addEventListener("input", () => {
      requestUpdate();
    });
  }

  if (debugEyeSensitivity) {
    debugEyeSensitivity.addEventListener("input", () => {
      state.eyeSensitivity = Number(debugEyeSensitivity.value);
      requestUpdate();
    });
  }

  if (debugParallax) {
    debugParallax.addEventListener("input", () => {
      state.parallaxStrength = Number(debugParallax.value);
      requestUpdate();
    });
  }

  if (hero) {
    hero.addEventListener("mouseleave", () => {
      blink();
    });
  }

  queueBlink();
  setSpotlight(state.currentX, state.currentY, state.currentRadius, state.currentSoftness);
  setParallax(0, 0);
  updateEyes(state.currentX, state.currentY);
  updateHotspots();
  requestUpdate();

  window.addEventListener("load", () => {
    document.body.classList.remove("is-preload");
  });
})();
