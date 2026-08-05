import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, X } from "lucide-react";
import { cashbookService } from "@/services/cashbook";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { DatePicker } from "@/components/ui/DatePicker";

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TransferAccountsModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ["cashbook", "accounts"], queryFn: cashbookService.getAccounts });
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Account transfer");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const source = fromAccountId || accounts[0]?.id || "";
  const destination = toAccountId || accounts.find((item) => item.id !== source)?.id || "";

  const mutation = useMutation({
    mutationFn: () => cashbookService.createTransfer({
      fromAccountId: source, toAccountId: destination,
      amount: Math.round((Number(amount) || 0) * 100), description, entryDate,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cashbook"] }); onSuccess(); onClose(); },
    onError: (value) => {
      const response = value as { response?: { data?: { error?: string } } };
      setError(response.response?.data?.error ?? "Transfer failed. Please try again.");
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!source || !destination) { setError("At least two accounts are required."); return; }
    if (source === destination) { setError("Choose two different accounts."); return; }
    if ((Number(amount) || 0) <= 0) { setError("Enter a valid amount."); return; }
    mutation.mutate();
  }

  const input = "mt-1.5 w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-sm outline-none focus:border-coral/40 focus:ring-2 focus:ring-coral/20 transition-colors";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-paper shadow-2xl">
      <div className="flex items-center gap-3 border-b border-line px-6 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-coral/10 text-coral"><ArrowRightLeft size={18} /></span>
        <div className="flex-1"><h2 className="serif text-xl text-ink">Transfer between accounts</h2><p className="text-xs text-ink-mute">Records equal outgoing and incoming movements.</p></div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist"><X size={17} /></button>
      </div>
      <div className="space-y-4 px-6 py-5">
        {error && <div className="rounded-xl bg-clay-soft px-4 py-3 text-sm text-clay">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">From<select value={source} onChange={(e) => setFromAccountId(e.target.value)} className={input}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="text-sm font-semibold">To<select value={destination} onChange={(e) => setToAccountId(e.target.value)} className={input}>{accounts.filter((a) => a.id !== source).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        </div>
        <label className="block text-sm font-semibold">Amount (PKR)<input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} /></label>
        <label className="block text-sm font-semibold">Description<input value={description} onChange={(e) => setDescription(e.target.value)} className={input} /></label>
        <label className="block text-sm font-semibold">Date<DatePicker value={entryDate} onChange={setEntryDate} className="mt-1.5 w-full" /></label>
        <label className="block text-sm font-semibold">Notes <span className="font-normal text-ink-faint">(optional)</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} resize-none`} /></label>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-4"><button type="button" onClick={onClose} className="h-10 rounded-full border border-line px-5 text-sm font-semibold">Cancel</button><button disabled={mutation.isPending} className="h-10 rounded-full bg-coral px-5 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Transferring…" : "Record transfer"}</button></div>
    </form>
  </div>;
}
