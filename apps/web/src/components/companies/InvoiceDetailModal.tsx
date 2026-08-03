import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileText, Mail, Printer, Send, Trash2, X } from "lucide-react";
import { companiesService, pkr } from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

const fmtDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
  : "—";

interface InvoiceDetailModalProps {
  companyId: string;
  invoiceId: string;
  canManage: boolean;
  onClose: () => void;
  onMessage: (message: string) => void;
}

export function InvoiceDetailModal({ companyId, invoiceId, canManage, onClose, onMessage }: InvoiceDetailModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const invoice = useQuery({
    queryKey: ["company-invoice", companyId, invoiceId],
    queryFn: () => companiesService.getInvoice(companyId, invoiceId),
  });
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["company-invoice", companyId, invoiceId] }),
      qc.invalidateQueries({ queryKey: ["company-invoices", companyId] }),
    ]);
  };
  const issue = useMutation({
    mutationFn: () => companiesService.issueInvoice(companyId, invoiceId),
    onSuccess: async () => { await refresh(); onMessage("Invoice issued."); },
  });
  const voidInvoice = useMutation({
    mutationFn: async () => {
      const reason = window.prompt("Why is this invoice being voided?")?.trim();
      if (!reason) throw new Error("A reason is required to void an invoice.");
      return companiesService.voidInvoice(companyId, invoiceId, reason);
    },
    onSuccess: async () => { await refresh(); onMessage("Invoice voided and its charges released."); },
  });
  const emailInvoice = useMutation({
    mutationFn: () => companiesService.emailInvoice(companyId, invoiceId),
    onSuccess: (result) => onMessage(`Invoice emailed to ${result.recipient}.`),
  });
  const error = issue.error ?? voidInvoice.error ?? emailInvoice.error ?? invoice.error;
  const errorMessage = error
    ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? error.message)
    : null;
  const data = invoice.data;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-paper shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-6 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-coral/10"><FileText size={18} className="text-coral" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="serif text-[21px] text-ink">{data?.invoiceNumber ?? "Invoice"}</h2>
            <p className="text-[12px] text-ink-mute">{data?.company.name ?? "Loading…"}</p>
          </div>
          {data && <StatusBadge status={data.status.replace("_", " ")} size="sm" />}
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-mist"><X size={18} /></button>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5 print:overflow-visible">
          {!data ? <div className="py-12 text-center text-sm text-ink-mute">Loading invoice…</div> : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-mist p-4 sm:grid-cols-4">
                <div><div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Period</div><div className="mt-1 text-[13px] text-ink">{fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}</div></div>
                <div><div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Issued</div><div className="mt-1 text-[13px] text-ink">{fmtDate(data.issuedAt)}</div></div>
                <div><div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Due</div><div className="mt-1 text-[13px] text-ink">{fmtDate(data.dueDate)}</div></div>
                <div><div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Outstanding</div><div className="mt-1 text-[14px] font-semibold text-ink">{pkr(Math.max(0, data.totalAmount - data.paidAmount))}</div></div>
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="hidden grid-cols-[1fr_110px_120px] gap-3 border-b border-line bg-mist px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint sm:grid">
                  <div>Charge</div><div>Date</div><div className="text-right">Amount</div>
                </div>
                {data.lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line-soft px-4 py-3 last:border-0 sm:grid-cols-[1fr_110px_120px]">
                    <div><div className="text-[13px] font-medium text-ink">{line.description}</div><div className="text-[11.5px] text-ink-mute">{[line.guestName, line.roomNumber && `Room ${line.roomNumber}`].filter(Boolean).join(" · ")}</div></div>
                    <div className="hidden text-[12.5px] text-ink-mute sm:block">{fmtDate(line.entryDate)}</div>
                    <div className="text-right text-[13.5px] font-semibold text-ink">{pkr(line.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="ml-auto mt-5 w-full max-w-xs space-y-2 text-[13px]">
                <div className="flex justify-between text-ink-mute"><span>Total</span><span>{pkr(data.totalAmount)}</span></div>
                <div className="flex justify-between text-sage-deep"><span>Paid</span><span>−{pkr(data.paidAmount)}</span></div>
                <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold text-ink"><span>Balance due</span><span>{pkr(Math.max(0, data.totalAmount - data.paidAmount))}</span></div>
              </div>
            </>
          )}
          {errorMessage && <div className="mt-4 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/10 px-3 py-2.5 text-[12.5px] text-ink-soft"><AlertCircle size={14} className="mt-0.5 shrink-0 text-clay" />{errorMessage}</div>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4 print:hidden">
          <Button variant="ghost" leftIcon={Printer} onClick={() => window.print()}>Print / PDF</Button>
          {canManage && data?.status === "DRAFT" && <Button leftIcon={Send} loading={issue.isPending} onClick={() => issue.mutate()}>Issue invoice</Button>}
          {canManage && data && !["DRAFT", "VOID"].includes(data.status) && <Button leftIcon={Mail} loading={emailInvoice.isPending} onClick={() => emailInvoice.mutate()}>Email invoice</Button>}
          {canManage && data && data.status !== "VOID" && data.paidAmount === 0 && <Button variant="ghost" leftIcon={Trash2} loading={voidInvoice.isPending} onClick={() => voidInvoice.mutate()}>Void</Button>}
        </div>
      </div>
    </div>, document.body,
  );
}
