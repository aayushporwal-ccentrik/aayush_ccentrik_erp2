using { shreeCem.procurement as procurement } from '../db/procurement';
using { shreeCem.master as master } from '../db/masterdata';
service ProcurementService @(path: '/procurement') {
    entity Requisitions      as projection on procurement.Requisitions;
    entity RequisitionItems  as projection on procurement.RequisitionItems;
    @cds.redirection.target
    entity PurchaseOrders    as projection on procurement.PurchaseOrders;
    entity POItems           as projection on procurement.POItems;
    entity GoodsReceipt      as projection on procurement.GoodsReceipt;
    entity GRItems           as projection on procurement.GRItems;
    entity VendorPayments    as projection on procurement.VendorPayments;
    entity DeliveryChallans  as projection on procurement.DeliveryChallan;
    entity DeliveryChallanItems as projection on procurement.DeliveryChallanItem;
    @readonly
    entity Vendors as projection on master.Vendors;
    @readonly
    @cds.persistence.skip
    entity Invoices {
        key ID        : UUID;
            invoiceId : String(30);
            vendor    : String(100);
            vendor_ID : UUID;
            po_ID     : UUID;
            poRef     : String(20);
            grnRef    : String(20);
            invoiceDate   : Date;
            dueDate       : Date;
            grossAmount   : String(30);
            cgst          : String(30);
            sgst          : String(30);
            tds           : String(30);
            gst           : String(30);
            netPayable    : String(30);
            netPayableRaw : Decimal(13,2);
            status        : String(20);
            statusState   : String(20);
            action        : String(20);
    }
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
    action submitVendorPayment(
        po_ID       : UUID,
        vendor_ID   : UUID,
        amount      : Decimal(13,2),
        mode        : String(20),
        paymentDate : Date,
        remarks     : String(500)
    ) returns {
        success       : Boolean;
        paymentNumber : String(20);
        message       : String;
    };
    type MetricFields {
        totalOutstanding      : String;
        totalOutstandingCount : Integer;
        overdue               : String;
        overdueCount          : Integer;
        paidThisMonth         : String;
        paidThisMonthCount    : Integer;
        pendingApproval       : String;
        pendingApprovalCount  : Integer;
    }
    function getPaymentMetrics() returns MetricFields;
}