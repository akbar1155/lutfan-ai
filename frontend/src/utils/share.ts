/** Native share / clipboard helpers for invitation result actions. */

export function publicInviteUrl(invitationId: string): string {
  return `${window.location.origin}/i/${invitationId}`;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through to legacy path
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Clipboard unavailable");
}

type ShareNav = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** Share a public invite link via system sheet, else copy to clipboard. */
export async function shareInviteLink(opts: {
  invitationId: string;
  title: string;
  text: string;
}): Promise<"shared" | "copied"> {
  const url = publicInviteUrl(opts.invitationId);
  const nav = navigator as ShareNav;
  const payload: ShareData = {
    title: opts.title,
    text: opts.text,
    url,
  };
  if (typeof nav.share === "function") {
    const can =
      typeof nav.canShare !== "function" || nav.canShare({ url, title: opts.title, text: opts.text });
    if (can) {
      try {
        await nav.share(payload);
        return "shared";
      } catch (err) {
        // User cancelled share sheet — not an error.
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err;
        }
      }
    }
  }
  await copyTextToClipboard(url);
  return "copied";
}

/** Fetch image as a File (credentials for same-origin /media). */
export async function fetchImageFile(
  url: string,
  filename: string,
): Promise<File> {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status}`);
  }
  const blob = await resp.blob();
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return new File([blob], filename, { type });
}

/** Share invitation image via system sheet; fall back to saving the file. */
export async function shareInviteImage(opts: {
  file: File;
  title: string;
  text: string;
  url?: string;
}): Promise<"shared" | "downloaded"> {
  const nav = navigator as ShareNav;
  const data: ShareData = {
    files: [opts.file],
    title: opts.title,
    text: opts.text,
  };
  if (opts.url) data.url = opts.url;

  if (typeof nav.share === "function") {
    const canFiles =
      typeof nav.canShare !== "function" || nav.canShare({ files: [opts.file] });
    if (canFiles) {
      try {
        await nav.share(data);
        return "shared";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err;
        }
      }
    }
    // Some browsers share URL+text but not files.
    if (opts.url) {
      const linkOnly: ShareData = {
        title: opts.title,
        text: opts.text,
        url: opts.url,
      };
      const canLink =
        typeof nav.canShare !== "function" || nav.canShare(linkOnly);
      if (canLink) {
        try {
          await nav.share(linkOnly);
          return "shared";
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            throw err;
          }
        }
      }
    }
  }

  const objectUrl = URL.createObjectURL(opts.file);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = opts.file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  return "downloaded";
}
