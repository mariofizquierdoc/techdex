import type messages from "../../messages/es.json";
import type { formats } from "./request";
import type { Locale } from "./config";

// Type-checks every t("…") key against the Spanish catalog (the source of truth).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
