using { shreeCem.procurement } from '../db/procurement';

service ProcurementService @(path: '/procurement') {

    // ── Existing projections (unchanged) ──────────────────────────
    entity Requisitions      as projection on procurement.Requisitions;
    entity RequisitionItems  as projection on procurement.RequisitionItems;
    entity PurchaseOrders    as projection on procurement.PurchaseOrders;
    entity POItems           as projection on procurement.POItems;
    entity GoodsReceipt      as projection on procurement.GoodsReceipt;
    entity GRItems           as projection on procurement.GRItems;
    entity VendorPayments    as projection on procurement.VendorPayments;

    // ── New: DOX Invoice entities ──────────────────────────────────
    entity VendorInvoices      as projection on procurement.VendorInvoices;
    entity VendorInvoiceItems  as projection on procurement.VendorInvoiceItems;

    // ── New: Action triggered after GR is posted ───────────────────
    // Accepts a PDF/image (Base64), runs DOX, does 3-way match,
    // and auto-creates a VendorPayment if amounts match.
    action processVendorInvoice(
        grnId       : UUID,         // ID of the posted GoodsReceipt
        fileContent : LargeString,  // Base64-encoded PDF or image
        fileName    : String        // e.g. "invoice_123.pdf"
    ) returns VendorInvoices;
}