import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { CompanyService } from "../services/CompanyService";
import {
  listCompaniesSchema, createCompanySchema, updateCompanySchema, setCreditLimitSchema,
  companyLedgerQuerySchema, recordCompanyPaymentSchema, adjustCompanyLedgerSchema,
  createCompanyInvoiceSchema, agingReportSchema,
  reverseCompanyPaymentSchema, refundCompanyCreditSchema, voidCompanyInvoiceSchema,
  reverseFolioTransferSchema,
  companyProductionQuerySchema,
} from "../schemas/companies";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// ── Collection ───────────────────────────────────────────────────────────────

router.get("/", requirePermission("COMPANY_READ"), async (req, res) => {
  const query = listCompaniesSchema.parse(req.query);
  const result = await CompanyService.listCompanies(req.withTenant, query);
  res.json(result);
});

// Static paths must stay above "/:id" or they get parsed as company ids.
router.get("/picker", requirePermission("COMPANY_READ"), async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const data = await CompanyService.searchForPicker(req.withTenant, search);
  res.json({ data });
});

router.get("/aging", requirePermission("COMPANY_READ"), async (req, res) => {
  const query = agingReportSchema.parse(req.query);
  const result = await CompanyService.agingReport(req.withTenant, query);
  res.json(result);
});

router.post("/", requirePermission("COMPANY_CREATE"), async (req, res) => {
  const dto = createCompanySchema.parse(req.body);
  const company = await CompanyService.createCompany(req.withTenant, req.user!, dto);
  res.status(201).json({ data: company });
});

// ── Single company ───────────────────────────────────────────────────────────

router.get("/:id", requirePermission("COMPANY_READ"), async (req, res) => {
  const company = await CompanyService.getCompany(req.withTenant, req.params.id as string);
  res.json({ data: company });
});

router.patch("/:id", requirePermission("COMPANY_UPDATE"), async (req, res) => {
  const dto = updateCompanySchema.parse(req.body);
  const company = await CompanyService.updateCompany(req.withTenant, req.user!, req.params.id as string, dto);
  res.json({ data: company });
});

router.delete("/:id", requirePermission("COMPANY_DELETE"), async (req, res) => {
  const result = await CompanyService.deleteCompany(req.withTenant, req.user!, req.params.id as string);
  res.json({ data: result });
});

// Separate from PATCH on purpose: raising a credit limit is how a hotel decides
// to lend money, and reception holds COMPANY_UPDATE but not this.
router.put("/:id/credit-limit", requirePermission("COMPANY_CREDIT_LIMIT"), async (req, res) => {
  const dto = setCreditLimitSchema.parse(req.body);
  const company = await CompanyService.setCreditLimit(req.withTenant, req.user!, req.params.id as string, dto);
  res.json({ data: company });
});

// ── Ledger ───────────────────────────────────────────────────────────────────

router.get("/:id/ledger", requirePermission("COMPANY_READ"), async (req, res) => {
  const query = companyLedgerQuerySchema.parse(req.query);
  const result = await CompanyService.listLedger(req.withTenant, req.params.id as string, query);
  res.json(result);
});

router.get("/:id/statement", requirePermission("COMPANY_READ"), async (req, res) => {
  const data = await CompanyService.getStatement(req.withTenant, req.params.id as string);
  res.json({ data });
});

router.get("/:id/reservations", requirePermission("COMPANY_READ"), async (req, res) => {
  const data = await CompanyService.listCompanyReservations(req.withTenant, req.params.id as string);
  res.json({ data });
});

router.get("/:id/production", requirePermission("COMPANY_READ"), async (req, res) => {
  const query = companyProductionQuerySchema.parse(req.query);
  const data = await CompanyService.getProduction(req.withTenant, req.params.id as string, query);
  res.json({ data });
});

router.post("/:id/payments", requirePermission("COMPANY_PAYMENT"), async (req, res) => {
  const dto = recordCompanyPaymentSchema.parse(req.body);
  const result = await CompanyService.recordPayment(req.withTenant, req.user!, req.params.id as string, dto);
  res.status(201).json({ data: result });
});

router.post("/:id/payments/:paymentId/reverse", requirePermission("COMPANY_PAYMENT"), async (req, res) => {
  const dto = reverseCompanyPaymentSchema.parse(req.body);
  const result = await CompanyService.reversePayment(req.withTenant, req.user!, req.params.id as string, req.params.paymentId as string, dto);
  res.json({ data: result });
});

router.post("/:id/folio-transfers/:entryId/reverse", requirePermission("COMPANY_LEDGER_POST"), async (req, res) => {
  const dto = reverseFolioTransferSchema.parse(req.body);
  const result = await CompanyService.reverseFolioTransfer(
    req.withTenant,
    req.user!,
    req.params.id as string,
    req.params.entryId as string,
    dto,
  );
  res.json({ data: result });
});

router.post("/:id/credit-refunds", requirePermission("COMPANY_PAYMENT"), async (req, res) => {
  const dto = refundCompanyCreditSchema.parse(req.body);
  const result = await CompanyService.refundCredit(req.withTenant, req.user!, req.params.id as string, dto);
  res.status(201).json({ data: result });
});

// ADJUSTMENT and WRITE_OFF share a route but not a permission — writing debt
// off is checked here rather than in the service so the 403 arrives before any
// work is done.
router.post("/:id/adjustments", requirePermission("COMPANY_UPDATE"), async (req, res) => {
  const dto = adjustCompanyLedgerSchema.parse(req.body);
  if (dto.type === "WRITE_OFF" && !req.user!.permissions.includes("COMPANY_WRITE_OFF")) {
    res.status(403).json({ error: "Missing permission: COMPANY_WRITE_OFF" });
    return;
  }
  const result = await CompanyService.adjustLedger(req.withTenant, req.user!, req.params.id as string, dto);
  res.status(201).json({ data: result });
});

// ── Invoices ─────────────────────────────────────────────────────────────────

router.get("/:id/invoices", requirePermission("COMPANY_READ"), async (req, res) => {
  const data = await CompanyService.listInvoices(req.withTenant, req.params.id as string);
  res.json({ data });
});

router.post("/:id/invoices", requirePermission("COMPANY_INVOICE"), async (req, res) => {
  const dto = createCompanyInvoiceSchema.parse(req.body);
  const invoice = await CompanyService.createInvoice(req.withTenant, req.user!, req.params.id as string, dto);
  res.status(201).json({ data: invoice });
});

router.get("/:id/invoices/:invoiceId", requirePermission("COMPANY_READ"), async (req, res) => {
  const data = await CompanyService.getInvoice(
    req.withTenant, req.params.id as string, req.params.invoiceId as string,
  );
  res.json({ data });
});

router.post("/:id/invoices/:invoiceId/issue", requirePermission("COMPANY_INVOICE"), async (req, res) => {
  const result = await CompanyService.issueInvoice(req.withTenant, req.user!, req.params.id as string, req.params.invoiceId as string);
  res.json({ data: result });
});

router.post("/:id/invoices/:invoiceId/void", requirePermission("COMPANY_INVOICE"), async (req, res) => {
  const dto = voidCompanyInvoiceSchema.parse(req.body);
  const result = await CompanyService.voidInvoice(req.withTenant, req.user!, req.params.id as string, req.params.invoiceId as string, dto.reason);
  res.json({ data: result });
});

router.post("/:id/invoices/:invoiceId/email", requirePermission("COMPANY_INVOICE"), async (req, res) => {
  const result = await CompanyService.emailInvoice(req.withTenant, req.user!, req.params.id as string, req.params.invoiceId as string);
  res.json({ data: result });
});

export default router;
