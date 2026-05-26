// ADDED: Dispatch & Logistics module — DispatchOrders, WeighBridge, EWayBill, ProofOfDelivery
namespace shreeCem.dispatch;

using { cuid, managed } from '@sap/cds/common';
using { shreeCem.master } from './masterdata';
using { shreeCem.sales } from './sales';

entity DispatchOrders : cuid, managed {
    dispatchNo   : String(20);
    salesOrder   : Association to sales.SalesOrders;
    customer     : Association to master.Customers;
    plant        : Association to master.Plants;
    truckNumber  : String(20);
    driverName   : String(100);
    dispatchDate : Date;
    status       : String(20); // e.g. Pending, Dispatched, Delivered
}

entity WeighBridge : cuid, managed {
    weighNo      : String(20);
    dispatchOrder: Association to DispatchOrders;
    tareWeight   : Decimal(13,3); // empty truck weight
    grossWeight  : Decimal(13,3); // loaded truck weight
    netWeight    : Decimal(13,3); // gross - tare
    weighDate    : DateTime;
}

entity EWayBill : cuid, managed {
    ewbNumber      : String(30);
    dispatchOrder  : Association to DispatchOrders;
    generatedDate  : Date;
    validUpto      : Date;
    gstinSupplier  : String(20);
    gstinRecipient : String(20);
}

entity ProofOfDelivery : cuid, managed {
    podNumber     : String(20);
    dispatchOrder : Association to DispatchOrders;
    deliveryDate  : Date;
    receivedBy    : String(100);
    remarks       : String(200);
    confirmed     : Boolean default false;
}
