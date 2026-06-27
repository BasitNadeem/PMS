export function isMobileDevice(): boolean {
  return window.innerWidth < 768 || /Mobile/i.test(navigator.userAgent);
}
