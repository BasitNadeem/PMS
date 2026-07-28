export const loadHome = () => import("../pages/Home");
export const loadFeatures = () => import("../pages/Features");
export const loadBookingEngine = () => import("../pages/BookingEngine");
export const loadChannelManager = () => import("../pages/ChannelManager");
export const loadFinancials = () => import("../pages/Financials");
export const loadPointOfSale = () => import("../pages/PointOfSale");
export const loadAutomations = () => import("../pages/Automations");
export const loadStatistics = () => import("../pages/Statistics");
export const loadPricing = () => import("../pages/Pricing");
export const loadAbout = () => import("../pages/About");
export const loadContact = () => import("../pages/Contact");
export const loadHotels = () => import("../pages/stays/Hotels");
export const loadGuestHouses = () => import("../pages/stays/GuestHouses");
export const loadVacationRentals = () => import("../pages/stays/VacationRentals");
export const loadGlamping = () => import("../pages/stays/Glamping");

const ROUTE_LOADERS = new Map<string, () => Promise<unknown>>([
  ["/", loadHome],
  ["/pms", loadFeatures],
  ["/booking-engine", loadBookingEngine],
  ["/channel-manager", loadChannelManager],
  ["/financials", loadFinancials],
  ["/pos", loadPointOfSale],
  ["/automations", loadAutomations],
  ["/statistics", loadStatistics],
  ["/pricing", loadPricing],
  ["/about", loadAbout],
  ["/contact", loadContact],
  ["/stays/hotels", loadHotels],
  ["/stays/guesthouses", loadGuestHouses],
  ["/stays/vacation-rentals", loadVacationRentals],
  ["/stays/glamping", loadGlamping],
]);

export const ROUTE_PREFETCH_ORDER = [
  "/pms",
  "/booking-engine",
  "/pricing",
  "/about",
  "/contact",
  "/financials",
  "/pos",
  "/automations",
  "/statistics",
  "/channel-manager",
  "/stays/hotels",
  "/stays/guesthouses",
  "/stays/vacation-rentals",
  "/stays/glamping",
] as const;

function normalizePath(path: string) {
  const cleanPath = path.split(/[?#]/, 1)[0] ?? "/";
  if (cleanPath === "/") return cleanPath;
  return cleanPath.replace(/\/+$/, "");
}

export function preloadRoute(path: string) {
  const loader = ROUTE_LOADERS.get(normalizePath(path));
  return loader?.();
}

export function preloadRoutes(paths: readonly string[]) {
  for (const path of paths) {
    void preloadRoute(path);
  }
}
