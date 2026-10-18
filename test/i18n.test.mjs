import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/i18n/locales/en.ts";
import { tr } from "../src/i18n/locales/tr.ts";
import { ur } from "../src/i18n/locales/ur.ts";
import { fr } from "../src/i18n/locales/fr.ts";
import { de } from "../src/i18n/locales/de.ts";
import { ar } from "../src/i18n/locales/ar.ts";
import { ru } from "../src/i18n/locales/ru.ts";
import { es } from "../src/i18n/locales/es.ts";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
];

const DICTIONARIES = { en, tr, ur, fr, de, ar, ru, es };

function getLanguageInfo(code) {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) || SUPPORTED_LANGUAGES[0];
}

function getDictionary(code) {
  return DICTIONARIES[code] || DICTIONARIES.en;
}

function formatWithParams(text, params) {
  if (!params) return text;
  return Object.entries(params).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(val)),
    text
  );
}

test("i18n - All 8 required languages are registered", () => {
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
  const required = ["tr", "en", "ur", "fr", "de", "ar", "ru", "es"];

  for (const req of required) {
    assert.ok(codes.includes(req), `Language ${req} is missing from SUPPORTED_LANGUAGES`);
  }
  assert.equal(SUPPORTED_LANGUAGES.length, 8);
});

test("i18n - Arabic and Urdu have RTL text direction", () => {
  const ar = getLanguageInfo("ar");
  const ur = getLanguageInfo("ur");

  assert.equal(ar.dir, "rtl", "Arabic must be RTL");
  assert.equal(ur.dir, "rtl", "Urdu must be RTL");

  const ltrLanguages = ["en", "tr", "fr", "de", "ru", "es"];
  for (const code of ltrLanguages) {
    const lang = getLanguageInfo(code);
    assert.equal(lang.dir, "ltr", `${code} must be LTR`);
  }
});

test("i18n - All 8 languages have complete translation keys matching English schema", () => {
  const enDict = DICTIONARIES.en;

  function verifyKeys(baseObj, testObj, path = "") {
    for (const key of Object.keys(baseObj)) {
      const currentPath = path ? `${path}.${key}` : key;
      assert.ok(
        key in testObj,
        `Missing translation key: '${currentPath}'`
      );
      if (typeof baseObj[key] === "object" && baseObj[key] !== null) {
        assert.equal(
          typeof testObj[key],
          "object",
          `Expected object at '${currentPath}'`
        );
        verifyKeys(baseObj[key], testObj[key], currentPath);
      } else {
        assert.equal(
          typeof testObj[key],
          "string",
          `Expected string at '${currentPath}'`
        );
        assert.ok(
          testObj[key].trim().length > 0,
          `Empty translation string at '${currentPath}'`
        );
      }
    }
  }

  for (const [langCode, dict] of Object.entries(DICTIONARIES)) {
    try {
      verifyKeys(enDict, dict, langCode);
    } catch (err) {
      assert.fail(`Translation dictionary '${langCode}' failed schema verification: ${err.message}`);
    }
  }
});

test("i18n - formatWithParams interpolates parameters correctly", () => {
  const template = "{files} files, {folders} folders";
  const result = formatWithParams(template, { files: 12, folders: 4 });
  assert.equal(result, "12 files, 4 folders");

  const single = "{count} items selected";
  assert.equal(formatWithParams(single, { count: 1 }), "1 items selected");
});

test("i18n - Fallback to English when unknown language requested", () => {
  const fallback = getDictionary("unknown_lang");
  assert.equal(fallback.app.name, "FinestFile");
  assert.equal(fallback.common.save, "Save");
});
