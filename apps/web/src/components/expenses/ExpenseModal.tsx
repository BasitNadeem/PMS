import { useRef, useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, TrendingDown, Paperclip, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { uploadService } from "@/services/upload";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  expensesService,
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  type Expense,
  type CreateExpenseDto,
  type ExpenseCategory,
} from "@/services/expenses";

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

const PAYMENT_METHODS = [
  { value: "CASH",          label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE",        label: "Cheque" },
  { value: "ONLINE",        label: "Online" },
];

const schema = Yup.object({
  date:          Yup.string().required("Date is required"),
  category:      Yup.string().oneOf(EXPENSE_CATEGORIES as unknown as string[]).required("Category is required"),
  description:   Yup.string().trim().min(2, "At least 2 characters").required("Description is required"),
  amountPkr:     Yup.number().typeError("Enter a valid amount").positive("Must be greater than 0").required("Amount is required"),
  paymentMethod: Yup.string().required("Payment method is required"),
  paidTo:        Yup.string().trim().min(1, "Required").required("Paid To is required"),
  receiptRef:    Yup.string().trim().optional(),
  notes:         Yup.string().trim().optional(),
});

type FormValues = Yup.InferType<typeof schema>;

export interface ExpenseModalProps {
  mode:      "add" | "edit";
  expense?:  Expense;
  onClose:   () => void;
  onSuccess: (message: string) => void;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExpenseModal({ mode, expense, onClose, onSuccess }: ExpenseModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  // Attachment state is managed outside Formik — it's async with its own upload lifecycle
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(expense?.attachment_url ?? null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialValues: FormValues = {
    date:          expense?.date?.slice(0, 10) ?? todayIso(),
    category:      (expense?.category as ExpenseCategory) ?? "UTILITIES",
    description:   expense?.description   ?? "",
    amountPkr:     expense ? Math.floor(expense.amount / 100) : (undefined as unknown as number),
    paymentMethod: expense?.payment_method ?? "CASH",
    paidTo:        expense?.paid_to        ?? "",
    receiptRef:    expense?.receipt_ref    ?? "",
    notes:         expense?.notes          ?? "",
  };

  const mutation = useMutation({
    mutationFn: (dto: Partial<CreateExpenseDto>) =>
      mode === "add"
        ? expensesService.createExpense(dto as CreateExpenseDto)
        : expensesService.updateExpense(expense!.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      onSuccess(mode === "add" ? "Expense recorded" : "Expense updated");
      onClose();
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadService.uploadPhoto(file);
      setAttachmentUrl(url);
    } catch {
      setUploadError("Upload failed — try again");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSubmit(values: FormValues, { setStatus }: { setStatus: (s: string) => void }) {
    const base = {
      date:          values.date,
      category:      values.category as ExpenseCategory,
      description:   values.description.trim(),
      paidTo:        values.paidTo.trim(),
      receiptRef:    values.receiptRef?.trim() || undefined,
      notes:         values.notes?.trim()      || undefined,
      attachmentUrl: attachmentUrl ?? null,
    };
    // Amount and paymentMethod are locked on edit — omit them so the ledger entry is never touched
    const dto: Partial<CreateExpenseDto> = mode === "edit"
      ? base
      : { ...base, amount: Math.round(values.amountPkr * 100), paymentMethod: values.paymentMethod };
    mutation.mutate(dto, {
      onError: () => setStatus("Failed to save expense. Please try again."),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[92vh] anim-scale-in">

        {/* Header — outside Form so it never scrolls */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-clay-soft shrink-0">
            <TrendingDown size={18} className="text-clay" />
          </div>
          <h2 className="serif text-[20px] text-ink leading-tight flex-1">
            {mode === "add" ? "Record Expense" : "Edit Expense"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <Formik initialValues={initialValues} validationSchema={schema} onSubmit={handleSubmit}>
          {({ values, status, isSubmitting }) => (
            <Form className="flex-1 flex flex-col min-h-0">

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-4">

                {(status || mutation.isError) && (
                  <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
                    {status ?? "Failed to save expense. Please try again."}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Date <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span>
                    </label>
                    <Field name="date">
                      {({ field, form }: { field: { value: string }; form: { setFieldValue: (name: string, value: string) => void } }) => (
                        <DatePicker value={field.value} onChange={(v) => form.setFieldValue("date", v)} className="w-full" />
                      )}
                    </Field>
                    <ErrorMessage name="date" component="p" className="mt-1 text-[12px] text-clay" />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Category <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span>
                    </label>
                    <Field as="select" name="category" className={cn(inputCls, "cursor-pointer")}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                      ))}
                    </Field>
                    <ErrorMessage name="category" component="p" className="mt-1 text-[12px] text-clay" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    Description <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span>
                  </label>
                  <Field name="description" type="text" placeholder="e.g. Electricity bill for May" className={inputCls} />
                  <ErrorMessage name="description" component="p" className="mt-1 text-[12px] text-clay" />
                </div>

                <div>
                  <label className={labelCls}>
                    Paid To <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span>
                  </label>
                  <Field name="paidTo" type="text" placeholder="e.g. LESCO, Ali Khan, ABC Suppliers" className={inputCls} />
                  <ErrorMessage name="paidTo" component="p" className="mt-1 text-[12px] text-clay" />
                </div>

                {mode === "edit" ? (
                  <div className="rounded-xl border border-line bg-mist/60 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-0.5">Amount · {PAYMENT_METHODS.find(m => m.value === values.paymentMethod)?.label ?? values.paymentMethod}</p>
                      <p className="text-[18px] font-bold text-ink tnum">
                        PKR {Math.floor(Number(values.amountPkr)).toLocaleString("en-PK")}
                      </p>
                    </div>
                    <span className="text-[11px] text-ink-faint bg-line-soft px-2 py-1 rounded-lg font-medium">Locked</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>
                        Amount (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span>
                      </label>
                      <Field name="amountPkr" type="number" min="1" step="1" placeholder="0" className={inputCls} />
                      {Number(values.amountPkr) > 0 && (
                        <p className="mt-1 text-[12px] font-semibold text-coral tnum">
                          = PKR {Math.floor(Number(values.amountPkr)).toLocaleString("en-PK")}
                        </p>
                      )}
                      <ErrorMessage name="amountPkr" component="p" className="mt-1 text-[12px] text-clay" />
                    </div>

                    <div>
                      <label className={labelCls}>Payment Method</label>
                      <Field as="select" name="paymentMethod" className={cn(inputCls, "cursor-pointer")}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </Field>
                    </div>
                  </>
                )}

                <div>
                  <label className={labelCls}>
                    Receipt / Invoice Ref <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span>
                  </label>
                  <Field name="receiptRef" type="text" placeholder="e.g. INV-2026-0042" className={inputCls} />
                </div>

                {/* ── Receipt photo upload ─────────────────────────── */}
                <div>
                  <label className={labelCls}>
                    Receipt Photo <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {attachmentUrl ? (
                    <div className="flex items-center gap-3 rounded-xl border border-pine/30 bg-pine/5 px-4 py-3">
                      <CheckCircle2 size={16} className="text-pine shrink-0" />
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] text-pine font-medium flex-1 truncate hover:underline"
                      >
                        View attachment
                      </a>
                      <button
                        type="button"
                        onClick={() => setAttachmentUrl(null)}
                        className="text-ink-faint hover:text-clay transition-colors"
                      >
                        <XCircle size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={cn(
                        "flex items-center gap-2 h-10 px-4 rounded-xl border border-dashed border-line text-[13px] text-ink-soft font-medium hover:border-coral/40 hover:text-ink transition-colors w-full justify-center",
                        uploading && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      {uploading
                        ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                        : <><Paperclip size={14} /> Attach receipt photo</>
                      }
                    </button>
                  )}
                  {uploadError && (
                    <p className="mt-1 text-[12px] text-clay">{uploadError}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>
                    Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span>
                  </label>
                  <Field as="textarea" name="notes" rows={3} className={cn(inputCls, "resize-none")} />
                </div>

              </div>

              {/* Footer — inside Form so type="submit" works */}
              <div className="flex justify-end gap-2.5 px-6 pb-6 pt-4 border-t border-line flex-shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || mutation.isPending || uploading}
                  className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50"
                >
                  {mutation.isPending ? "Saving…" : mode === "add" ? "Record Expense" : "Save Changes"}
                </button>
              </div>

            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}
