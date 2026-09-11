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
  clipboard?: Clipboard & {
    write?: (items: ClipboardItem[]) => Promise<void>;
  };
};

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Fetch image as a File. Omit credentials on absolute CDN/S3 URLs (Windows CORS). */
export async function fetchImageFile(
  url: string,
  filename: string,
): Promise<File> {
  const absolute = isAbsoluteUrl(url);
  const resp = await fetch(url, {
    credentials: absolute ? "omit" : "include",
    mode: absolute ? "cors" : "same-origin",
  });
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status}`);
  }
  const blob = await resp.blob();
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return new File([blob], filename, { type });
}

/** JPEG/WebP → PNG blob for Windows clipboard (ClipboardItem prefers PNG). */
async function imageFileToPngBlob(file: File): Promise<Blob> {
  if (file.type === "image/png") return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!png) throw new Error("PNG encode failed");
  return png;
}

async function copyImageToClipboard(file: File): Promise<boolean> {
  const nav = navigator as ShareNav;
  if (!nav.clipboard?.write || typeof ClipboardItem === "undefined") {
    return false;
  }
  try {
    const png = await imageFileToPngBlob(file);
    await nav.clipboard.write([
      new ClipboardItem({
        "image/png": png,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

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
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err;
        }
      }
    }
  }
  await copyTextToClipboard(url);
  return "copied";
}

/** Share invitation image; on Windows desktop fall back to clipboard image copy. */
export async function shareInviteImage(opts: {
  file: File;
  title: string;
  text: string;
  url?: string;
}): Promise<"shared" | "copied" | "downloaded"> {
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

  // Windows Chrome/Edge: no file share — copy image to clipboard instead of silent fail.
  if (await copyImageToClipboard(opts.file)) {
    return "copied";
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
