import { api } from "@/lib/api";

export type SearchResultType = "guest" | "reservation" | "room" | "group" | "folio" | "staff";

export interface SearchResultItem {
  id:       string;
  type:     SearchResultType;
  title:    string;
  subtitle: string | null;
  route:    string;
}

export const searchService = {
  search: async (q: string): Promise<SearchResultItem[]> => {
    const res = await api.get("/api/search", { params: { q } });
    return res.data.data;
  },
};
