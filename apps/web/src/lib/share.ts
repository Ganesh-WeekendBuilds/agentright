/**
 * Shareable URL encoding/decoding.
 * Encodes agent configs as compressed base64 in the URL hash.
 */

export function encodeConfigToHash(config: object): string {
  try {
    const json = JSON.stringify(config);
    const encoded = btoa(
      encodeURIComponent(json).replace(
        /%([0-9A-F]{2})/g,
        (_, p1) => String.fromCharCode(parseInt(p1, 16))
      )
    );
    return encoded;
  } catch {
    return "";
  }
}

export function decodeConfigFromHash(hash: string): object | null {
  try {
    const cleaned = hash.replace(/^#/, "");
    if (!cleaned) return null;
    const json = decodeURIComponent(
      atob(cleaned)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function buildShareableUrl(config: object): string {
  const hash = encodeConfigToHash(config);
  if (typeof window !== "undefined") {
    return `${window.location.origin}${window.location.pathname}#${hash}`;
  }
  return `#${hash}`;
}
