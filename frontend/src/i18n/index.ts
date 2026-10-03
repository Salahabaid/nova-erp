import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr";
import en from "./en";
import es from "./es";
import ar from "./ar";

const saved = localStorage.getItem("nova_lang") || "fr";

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es },
    ar: { translation: ar },
  },
  lng: saved,
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export function setLanguage(lng: string) {
  localStorage.setItem("nova_lang", lng);
  i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
}

setLanguage(saved);

export default i18n;
