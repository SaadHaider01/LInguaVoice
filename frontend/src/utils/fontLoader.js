// ============================================================
// frontend/src/utils/fontLoader.js
// Dynamically loads Google Fonts for native scripts.
// Idempotent — safe to call multiple times for same language.
// RTL detection exported for use in JSX.
// ============================================================

import { LANGUAGE_FONTS } from "../config/languages";

const RTL_LANGUAGES = new Set(["arabic", "urdu"]);

/**
 * Dynamically injects a Google Fonts <link> for the given language.
 * Does nothing if font already loaded or language uses Latin script.
 * @param {string} language - Language key from LANGUAGES array
 */
export function loadNativeFont(language) {
  const font = LANGUAGE_FONTS[language];
  if (!font) return; // Latin script — no extra font needed

  const existing = document.querySelector(`link[data-lang="${language}"]`);
  if (existing) return; // Already loaded — idempotent

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.dataset.lang = language;
  link.href = `https://fonts.googleapis.com/css2?family=${font}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Returns true if the given language uses RTL text direction.
 * Use this to apply dir="rtl" and .rtl-text class to native text nodes.
 * @param {string} language
 * @returns {boolean}
 */
export function isRTL(language) {
  return RTL_LANGUAGES.has(language);
}

/**
 * Returns the props needed for native script text elements.
 * Apply as spread: <span {...getNativeTextProps(language)}>...</span>
 * @param {string} language
 * @returns {{ dir?: string, className: string }}
 */
export function getNativeTextProps(language) {
  if (isRTL(language)) {
    return { dir: "rtl", className: "rtl-text" };
  }
  return { className: "native-text" };
}

export default loadNativeFont;
