// ADDED: Exposes all Dispatch & Logistics entities as OData service
using { shreeCem.dispatch } from '../db/dispatch';

service DispatchService @(path: '/dispatch') {
    entity DispatchOrders   as projection on dispatch.DispatchOrders;
    entity WeighBridge      as projection on dispatch.WeighBridge;
    entity EWayBill         as projection on dispatch.EWayBill;
    entity ProofOfDelivery  as projection on dispatch.ProofOfDelivery;
}
