import { api } from "@/lib/api";

export interface FrontDeskNote {
  id: string;
  text: string;
  isCompleted: boolean;
  completedAt: string | null;
  completedById: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  completedBy: { id: string; name: string } | null;
}

export const notesService = {
  getNotes: async (): Promise<FrontDeskNote[]> => {
    const res = await api.get("/api/notes");
    return res.data.data;
  },
  createNote: async (text: string): Promise<FrontDeskNote> => {
    const res = await api.post("/api/notes", { text });
    return res.data.data;
  },
  toggleNote: async (id: string): Promise<FrontDeskNote> => {
    const res = await api.patch(`/api/notes/${id}`);
    return res.data.data;
  },
  deleteNote: async (id: string): Promise<void> => {
    await api.delete(`/api/notes/${id}`);
  },
};
