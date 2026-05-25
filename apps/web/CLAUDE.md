# Frontend Rules — apps/web

## Required packages (not yet in package.json — install before using)
```bash
pnpm --filter @pms/web add formik yup
```
`@/` path alias must be configured in both `vite.config.ts` and `tsconfig.json`:
```ts
// vite.config.ts
resolve: { alias: { "@": "/src" } }
// tsconfig.json → compilerOptions
"paths": { "@/*": ["./src/*"] }
```

## Directory layout

```
src/
  components/
    ui/           # Primitive atoms: Button, Input, Badge, Spinner, Avatar, Card
    forms/        # Formik-aware field wrappers: FormField, FormInput, FormSelect, FormTextarea, FormCheckbox
    layout/       # AppShell, Sidebar, Header, PageHeader, PageWrapper
    feedback/     # Alert, Toast, Modal, Drawer, EmptyState, ErrorBoundary
    data/         # DataTable, Pagination, StatCard, KPICard
  features/       # One folder per domain feature
    auth/         # LoginForm, useAuth hook, auth service
    reservations/ # ReservationTable, ReservationForm, ReservationDrawer, queries, service
    guests/
    rooms/
    billing/
    staff/
  pages/          # Thin route-level wrappers — import from features, no logic here
  hooks/          # Generic reusable hooks: useDebounce, useLocalStorage, useDisclosure
  lib/
    api.ts        # Axios instance + interceptors
    queryClient.ts
    cn.ts         # clsx + tailwind-merge helper
  services/       # One file per resource — all API calls live here, nowhere else
  types/          # Shared TypeScript types and enums
  constants/      # Route paths (ROUTES), app-wide enums and labels
  contexts/       # AuthContext, ToastContext
```

## Component rules

### Naming & exports
- **Pages**: default export, suffix `Page` — e.g. `export default function ReservationsPage`.
- **Components**: named export, PascalCase — e.g. `export function ReservationCard`.
- **Props interface**: always exported as `{ComponentName}Props`.
- One component per file; file name matches component name.

### Component template
```tsx
// features/reservations/ReservationCard.tsx
import { cn } from "@/lib/cn";

export interface ReservationCardProps {
  reservation: Reservation;
  onStatusChange: (id: string, status: ReservationStatus) => void;
  className?: string;
}

export function ReservationCard({ reservation, onStatusChange, className }: ReservationCardProps) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4", className)}>
      {/* ... */}
    </div>
  );
}
```

### Styling
- **Tailwind only** — no inline `style` props, no CSS modules, no styled-components.
- Always compose classes with `cn()` (`clsx` + `tailwind-merge`):
  ```ts
  // lib/cn.ts
  import { clsx, type ClassValue } from "clsx";
  import { twMerge } from "tailwind-merge";
  export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
  ```
- Conditional classes via `cn("base", condition && "extra")` — never template literals.
- Brand color tokens: `brand-500`, `brand-600`, `brand-700` — never hardcode hex.

### No prop drilling beyond 2 levels
- Pass via context or co-locate state in the nearest shared parent.
- Feature-level state lives in the feature's own context or a React Query cache.

---

## Forms — Formik + Yup (mandatory for all forms)

### Rule
Every form in the codebase uses **Formik** with a **Yup** schema. No `useState` for form fields.

### Reusable Formik field components (build these in `components/forms/`)

```tsx
// components/forms/FormField.tsx
import { useField } from "formik";
import { cn } from "@/lib/cn";

interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ name, label, required, className, children }: FormFieldProps) {
  const [, meta] = useField(name);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {meta.touched && meta.error && (
        <p className="text-xs text-red-600">{meta.error}</p>
      )}
    </div>
  );
}
```

```tsx
// components/forms/FormInput.tsx
import { useField } from "formik";
import { cn } from "@/lib/cn";
import { FormField } from "./FormField";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
}

export function FormInput({ name, label, className, ...props }: FormInputProps) {
  const [field, meta] = useField(name);
  return (
    <FormField name={name} label={label} required={props.required}>
      <input
        {...field}
        {...props}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500",
          meta.touched && meta.error ? "border-red-400" : "border-gray-300",
          className
        )}
      />
    </FormField>
  );
}
```

```tsx
// components/forms/FormSelect.tsx
import { useField } from "formik";
import { cn } from "@/lib/cn";
import { FormField } from "./FormField";

interface Option { value: string; label: string }

interface FormSelectProps {
  name: string;
  label: string;
  options: Option[];
  required?: boolean;
  className?: string;
}

export function FormSelect({ name, label, options, className, ...props }: FormSelectProps) {
  const [field, meta] = useField(name);
  return (
    <FormField name={name} label={label} required={props.required}>
      <select
        {...field}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500",
          meta.touched && meta.error ? "border-red-400" : "border-gray-300",
          className
        )}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FormField>
  );
}
```

### Form page pattern
```tsx
// features/reservations/ReservationForm.tsx
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { FormInput } from "@/components/forms/FormInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { Button } from "@/components/ui/Button";

const schema = Yup.object({
  guestId: Yup.string().uuid().required("Guest is required"),
  checkInDate: Yup.string().required("Check-in date is required"),
  checkOutDate: Yup.string().required("Check-out date is required"),
  adults: Yup.number().min(1).required(),
});

type FormValues = Yup.InferType<typeof schema>;

interface ReservationFormProps {
  initialValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  // Do NOT add isSubmitting — Formik manages it internally via render props.
}

export function ReservationForm({ initialValues, onSubmit }: ReservationFormProps) {
  const defaults: FormValues = {
    guestId: "", checkInDate: "", checkOutDate: "", adults: 1,
    ...initialValues,
  };

  return (
    <Formik initialValues={defaults} validationSchema={schema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form className="space-y-4">
          <FormInput name="checkInDate" label="Check-in Date" type="date" required />
          <FormInput name="checkOutDate" label="Check-out Date" type="date" required />
          <FormInput name="adults" label="Adults" type="number" min={1} required />
          <Button type="submit" loading={isSubmitting}>Save Reservation</Button>
        </Form>
      )}
    </Formik>
  );
}
```

### Yup conventions
- All schemas use `Yup.object({ ... })` — never loose `.shape()`.
- Derive `FormValues` type from schema via `Yup.InferType<typeof schema>`.
- String fields: always `.trim()` before `.required()`.
- UUID fields: always `.uuid("Must be a valid ID")`.
- Numeric fields: use `Yup.number().integer().positive()` where appropriate.

---

## Data fetching — TanStack Query v5

### Query key factory (one per feature)
```ts
// features/reservations/reservationKeys.ts
export const reservationKeys = {
  all:    ()           => ["reservations"] as const,
  lists:  ()           => [...reservationKeys.all(), "list"] as const,
  list:   (filters: ReservationFilters) => [...reservationKeys.lists(), filters] as const,
  detail: (id: string) => [...reservationKeys.all(), "detail", id] as const,
};
```

### Custom query hook (one per operation)
```ts
// features/reservations/useReservations.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reservationService } from "@/services/reservations";
import { reservationKeys } from "./reservationKeys";

export function useReservations(filters: ReservationFilters) {
  return useQuery({
    queryKey: reservationKeys.list(filters),
    queryFn: () => reservationService.list(filters),
  });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => reservationService.get(id),
    enabled: !!id,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reservationService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: reservationKeys.lists() }),
  });
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      reservationService.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: reservationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
  });
}
```

### Service layer (one file per resource)
```ts
// services/reservations.ts
import { api } from "@/lib/api";
import type { Reservation, CreateReservationDto, ReservationFilters, PaginatedResponse } from "@/types";

export const reservationService = {
  // axios .data unwraps the HTTP body; the body itself is { data: T[], meta }
  list: async (filters: ReservationFilters): Promise<PaginatedResponse<Reservation>> => {
    const res = await api.get("/api/reservations", { params: filters });
    return res.data; // { data: Reservation[], meta: PaginationMeta }
  },
  get: async (id: string): Promise<Reservation> => {
    const res = await api.get(`/api/reservations/${id}`);
    return res.data.data; // unwrap { data: Reservation }
  },
  create: async (dto: CreateReservationDto): Promise<Reservation> => {
    const res = await api.post("/api/reservations", dto);
    return res.data.data;
  },
  updateStatus: async (id: string, status: string): Promise<Reservation> => {
    const res = await api.patch(`/api/reservations/${id}/status`, { status });
    return res.data.data;
  },
};
```

**Never call `api` (Axios) directly from a component or Formik `onSubmit`. Always go through a service function.**

---

## Hooks

### Generic reusable hooks (`hooks/`)
```ts
// hooks/useDebounce.ts
import { useState, useEffect } from "react";
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// hooks/useDisclosure.ts
import { useState, useCallback } from "react";
export function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial);
  return {
    isOpen,
    open: useCallback(() => setIsOpen(true), []),
    close: useCallback(() => setIsOpen(false), []),
    toggle: useCallback(() => setIsOpen((v) => !v), []),
  };
}
```

---

## State management

| Concern | Tool |
|---|---|
| Server / async data | TanStack Query |
| Local UI state (open/closed, selected tab) | `useState` |
| Cross-component UI state | `useDisclosure` + props / context |
| Auth session | `AuthContext` |
| Form state | Formik |

No Redux, no Zustand unless a compelling case is made.

---

## Auth context pattern
```tsx
// contexts/AuthContext.tsx
interface AuthState {
  user: AuthUser | null;
  hotel: Hotel | null;
  permissions: string[];
  isAuthenticated: boolean;
}

// Hook: useAuth() returns AuthState + { login, logout }
// All permission checks: useAuth().permissions.includes("RESERVATION_CREATE")
```

---

## Page structure
```tsx
// pages/ReservationsPage.tsx  ← thin, no logic
import { Suspense, lazy } from "react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Spinner } from "@/components/ui/Spinner";

const ReservationTable = lazy(() =>
  import("@/features/reservations/ReservationTable")
);

export default function ReservationsPage() {
  return (
    <PageWrapper title="Reservations">
      <Suspense fallback={<Spinner />}>
        <ReservationTable />
      </Suspense>
    </PageWrapper>
  );
}
```

- Pages are lazy-loaded — always wrap with `Suspense`.
- Page file never contains business logic or API calls.
- Page passes no props into features — features read from React Query / context.

---

## TypeScript conventions
- `interface` for object shapes and props; `type` for unions, mapped types, utility types.
- `Yup.InferType<typeof schema>` for form value types — no duplication.
- DTO types in `types/` are plain interfaces mirroring the API response shape.
- `PaginatedResponse<T>` generic — mirrors the `{ data, meta }` backend envelope:
  ```ts
  export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
  export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
  }
  ```
  In TanStack Query hooks, rename the query `data` to avoid collision with the envelope `data` key:
  ```ts
  const { data: response } = useReservations(filters);
  // response?.data  → Reservation[]
  // response?.meta  → PaginationMeta
  ```
- `ApiError` type for Axios error responses:
  ```ts
  export interface ApiError { error: string; details?: unknown }
  ```

---

## UI component primitives checklist (build before using raw HTML)
- `Button` — variants: `primary | secondary | ghost | danger`; props: `loading`, `disabled`, `size`, `leftIcon`, `rightIcon`
- `Input` — base unstyled input used by `FormInput`
- `Badge` — `status` variant mapping to colors
- `Spinner` — sizes: `sm | md | lg`
- `Modal` — `isOpen`, `onClose`, `title`, `children`, `footer`
- `Drawer` — same interface as Modal but slides from right
- `DataTable<T>` — `columns: ColumnDef<T>[]`, `data: T[]`, `isLoading`, `pagination`
- `Pagination` — `page`, `total`, `limit`, `onPageChange`
- `EmptyState` — `title`, `description`, `action?`
- `Alert` — `variant: info | success | warning | error`

---

## Forbidden patterns
- `useState` for form field values — use Formik.
- `axios.get/post` directly in components — use service functions.
- `localStorage` for anything other than `accessToken` — use React Query cache.
- Hardcoded strings for API paths — use constants or service functions.
- `// eslint-disable` suppressions without a comment explaining why.
- `as any` casts — use proper types or `as unknown as T` with a comment.
