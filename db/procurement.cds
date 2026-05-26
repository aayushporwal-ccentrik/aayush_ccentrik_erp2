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

entity VendorPayments : cuid, managed {
    paymentNumber : String(20);
    vendor        : Association to master.Vendors;
    po            : Association to PurchaseOrders;
    paymentDate   : Date;
    amount        : Decimal(13,2);
    mode          : String(20);
    status        : String(20); // e.g. Paid, Pending
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