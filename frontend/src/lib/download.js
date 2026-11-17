// Authenticated downloads (FRONTEND_PROMPT §3): fetch with the Bearer header -> Blob -> object URL.
// Never link directly to an API URL (the token must not appear in a URL).

/** Save a Blob as a file. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Open a Blob in a new tab (e.g. a PDF); falls back to saving it if pop-ups are blocked. */
export function openBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  // Not using the 'noopener' feature: with it window.open() always returns null. The opener is cut manually.
  const win = window.open(url, '_blank');
  if (win) win.opener = null;
  else saveBlob(blob, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
