import type messages from "../../messages/es.json";

/** Keys under `errors` in the message catalogs (excluding nested groups). */
export type ErrorCode = Exclude<keyof (typeof messages)["errors"], "field">;
export type ErrorParams = Record<string, string | number>;

/** A business-rule violation. `code` is translated for the user by `runAction`. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params: ErrorParams = {},
  ) {
    super(code);
    this.name = "DomainError";
  }
}

/** The user is not signed in or lacks the role for this action. */
export class AuthzError extends DomainError {
  constructor(code: Extract<ErrorCode, "notSignedIn" | "adminOnly" | "cannotDeleteSelf"> = "adminOnly") {
    super(code);
    this.name = "AuthzError";
  }
}
