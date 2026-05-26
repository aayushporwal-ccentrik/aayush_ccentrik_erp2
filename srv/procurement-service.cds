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

}

