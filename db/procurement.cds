// ADDED: Procurement module — Requisitions, PurchaseOrders, GoodsReceipt, VendorPayments
namespace shreeCem.procurement;

using { cuid, managed } from '@sap/cds/common';
using { shreeCem.master } from './masterdata';

entity Requisitions : cuid, managed {
    prNumber     : String(20);
    plant        : Association to master.Plants;
    requestDate  : Date;
    status       : String(20); // e.g. Draft, Approved, Rejected
    items        : Composition of many RequisitionItems on items.requisition = $self;
}

entity RequisitionItems : cuid {
    requisition  : Association to Requisitions;
    material     : Association to master.Materials;
    quantity     : Decimal(13,3);
    uom          : String(10);
}

entity PurchaseOrders : cuid, managed {
    poNumber     : String(20);
    vendor       : Association to master.Vendors;
    plant        : Association to master.Plants;
    requisition  : Association to Requisitions;
    orderDate    : Date;
    status       : String(20); // e.g. Open, GRDone, Invoiced
    items        : Composition of many POItems on items.po = $self;
}

entity POItems : cuid {
    po           : Association to PurchaseOrders;
    material     : Association to master.Materials;
    quantity     : Decimal(13,3);
    uom          : String(10);
    rate         : Decimal(13,2);
    amount       : Decimal(13,2);
}

entity GoodsReceipt : cuid, managed {
    grnNumber    : String(20);
    po           : Association to PurchaseOrders;
    vendor       : Association to master.Vendors;
    receiptDate  : Date;
    status       : String(20); // e.g. Posted, Pending
    items        : Composition of many GRItems on items.grn = $self;
}

entity GRItems : cuid {
    grn          : Association to GoodsReceipt;
    material     : Association to master.Materials;
    quantity     : Decimal(13,3);
    uom          : String(10);
}

entity VendorPayments : cuid, managed {
    paymentNumber : String(20);
    vendor        : Association to master.Vendors;
    po            : Association to PurchaseOrders;
    paymentDate   : Date;
    amount        : Decimal(13,2);
    mode          : String(20);
    status        : String(20); // e.g. Paid, Pending
}

// Extracted invoice from DOX — links back to PO and GR
entity VendorInvoices : cuid, managed {
    invoiceNumber  : String(20);
    po             : Association to PurchaseOrders;
    grn            : Association to GoodsReceipt;
    vendor         : Association to master.Vendors;
    invoiceDate    : Date;
    netAmount      : Decimal(13,2);
    taxAmount      : Decimal(13,2);
    grossAmount    : Decimal(13,2);
    currencyCode   : String(3);
    status         : String(20) enum { PENDING; MATCHED; DISCREPANCY; PAID; };
    rawDoxResponse : LargeString;   // full DOX JSON for audit
    matchResult    : String(50);    // e.g. '3-way match OK', 'Qty mismatch'
    items          : Composition of many VendorInvoiceItems on items.invoice = $self;
}

entity VendorInvoiceItems : cuid {
    invoice     : Association to VendorInvoices;
    material    : Association to master.Materials;
    description : String;
    quantity    : Decimal(13,3);
    unitPrice   : Decimal(13,2);
    amount      : Decimal(13,2);
}