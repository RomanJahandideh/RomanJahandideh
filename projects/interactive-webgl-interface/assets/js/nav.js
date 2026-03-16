/*
  Project: Interactive WebGL Interface
  Author: Roman Jahandideh
  Copyright: © 2026 Roman Jahandideh. All rights reserved.
*/

(() => {
  "use strict";

  const navItems = Array.from(document.querySelectorAll(".minimal-nav__item"));
  if (!navItems.length) return;

  const currentPath = window.location.pathname.replace(/\/+/g, "/");

  navItems.forEach((item) => {
    const href = item.getAttribute("href") || "";
    item.classList.remove("is-current");

    if (
      (href === "index.html" && (currentPath === "/" || currentPath.endsWith("/index.html"))) ||
      (href.includes("work/index.html") && currentPath.includes("/work"))
    ) {
      item.classList.add("is-current");
    }

    item.addEventListener("click", (e) => {
      e.preventDefault();
    });
  });

  if (!document.querySelector(".minimal-nav__item.is-current")) {
    navItems[0].classList.add("is-current");
  }
})();
