import { api } from "@/lib/api";

export const uploadService = {
  uploadPhoto: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post("/api/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return (res.data as { data: { url: string } }).data.url;
  },
};
