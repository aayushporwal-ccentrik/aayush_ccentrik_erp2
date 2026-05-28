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


    entity DeliveryChallans     as projection on procurement.DeliveryChallan;
    entity DeliveryChallanItems as projection on procurement.DeliveryChallanItem;


    // ── Challan Custom Actions ─────────────────────────────────

    action uploadChallanPDF(
        challanID : UUID,
        pdfBase64 : LargeString,
        fileName  : String(255)
    ) returns {
        success : Boolean;
        message : String;
    };

    action extractChallanData(
        challanID : UUID
    ) returns {
        success    : Boolean;
        message    : String;
        confidence : Decimal(5,2);
    };

    action createGoodsReceipt(
        challanID : UUID
    ) returns {
        success  : Boolean;
        grNumber : String(20);
        message  : String;
    };
// ADD to ProcurementService

function getVendorInvoices() returns array of {
    invoiceId    : String;
    vendor       : String;
    vendor_ID    : UUID;
    po_ID        : UUID;
    poRef        : String;
    grnRef       : String;
    invoiceDate  : Date;
    dueDate      : Date;
    grossAmount  : Decimal(13,2);
    cgst         : Decimal(13,2);
    sgst         : Decimal(13,2);
    tds          : Decimal(13,2);
    netPayable   : Decimal(13,2);
    status       : String;
};

action submitVendorPayment(
    po_ID       : UUID,
    vendor_ID   : UUID,
    amount      : Decimal(13,2),
    mode        : String,
    paymentDate : Date,
    remarks     : String
) returns {
    success       : Boolean;
    paymentNumber : String;
    message       : String;
};

// Add to srv/procurement-service.cds

// Read-only invoice view: GRDone POs with vendor + amounts

};

entity VendorInvoices as select from procurement.PurchaseOrders {
    ID,
    poNumber,
    orderDate,
    status,
    vendor.name        as vendor,
    items.amount       as grossAmount  // sum not possible in CDS projection; use action instead
};

