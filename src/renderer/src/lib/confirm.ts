/**
 * Electron disables window.confirm (it always returns false), so use the
 * native dialog through the preload bridge.
 */
export function confirmDialog(message: string): boolean {
  if (window.desktop?.confirm) return window.desktop.confirm(message);
  return window.confirm(message);
}
