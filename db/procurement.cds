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
    receivedQty  : Decimal(13,3) default 0;
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

entity Invoices : cuid, managed {
    invoiceId       : String(30);   // E.g. "INV-2024-0041"
    vendor          : String(100);  // Text representation for easy binding {vendorPayment>vendor}
    poRef           : String(30);   // "PO-1120"
    grnRef          : String(30);   // "GRN-0881"
    invoiceDate     : String(20);   // Handles string formats from UI mockups like "10 May 2025"
    dueDate         : String(20);   // "25 May 2025"
    grossAmount     : String(20);   // Pre-formatted currency strings: "₹2,40,000"
    tds             : String(20);   // "₹4,800"
    cgst            : String(20);   // "₹21,600"
    sgst            : String(20);   // "₹21,600"
    gst             : String(20);   // "₹43,200"
    netPayable      : String(20);   // "₹1,92,000"
    netPayableRaw   : Decimal(15,2);// Numeric equivalent for live field arithmetic computations
    status          : String(20);   // "Overdue", "Approved", "Pending", "Partial", "Paid"
    statusState     : String(10);   // "Error", "Success", "Warning", "None"
    action          : String(20);   // "Pay now", "Approve", "View"
}

// Enhancing VendorPayments block to link directly with our Invoices entity
entity VendorPayments : cuid, managed {
    paymentNumber   : String(20);
    vendor          : Association to master.Vendors;
    invoice         : Association to Invoices; // Linked transaction reference
    po              : Association to PurchaseOrders;
    paymentDate     : Date;
    amount          : Decimal(13,2);
    mode            : String(20); // NEFT, RTGS, Cheque
    bankAccount     : String(30);
    utrRef          : String(50);
    remarks         : String(500);
    status          : String(20); // Paid, Draft, Pending
}

entity DeliveryChallan {
  key challanID       : UUID;
      challanNumber   : String(20);
      challanDate     : Date;
      vendorName      : String(100);
      deliveryAddress : String(255);
      purchaseOrderNo : String(20);
      vehicleNumber   : String(20);
      driverName      : String(100);
      totalQuantity   : Decimal(13,3);
      totalWeight     : Decimal(13,3);
      remarks         : String(500);
      status          : String(20) default 'PENDING';
      // PENDING → EXTRACTED → GR_CREATED
      pdfFileName     : String(255);
      pdfContent      : LargeBinary;
      createdAt       : Timestamp;
      createdBy       : String(255);
      items           : Composition of many DeliveryChallanItem
                          on items.challan = $self;
}

entity DeliveryChallanItem {
  key itemID                : UUID;
      challan               : Association to DeliveryChallan;
      itemNumber            : Integer;
      vendorMaterialCode    : String(40);   // Vendor's own code
      materialDescription   : String(255);  // As written on challan
      deliveredQuantity     : Decimal(13,3);
      unitOfMeasure         : String(6);
      batchNumber           : String(20);
      expiryDate            : Date;
      hsnCode               : String(10);
      unitPrice             : Decimal(15,2);
      totalValue            : Decimal(15,2);
      extractionConfidence  : Decimal(5,2); // AI confidence per line
}