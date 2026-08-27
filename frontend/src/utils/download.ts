/** Save a remote image to disk instead of opening it in a new tab. */
export async function downloadImageFile(url: string, filename: string): Promise<void> {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status}`);
  }
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".png")
    ? filename
    : `${filename}.jpg`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}
