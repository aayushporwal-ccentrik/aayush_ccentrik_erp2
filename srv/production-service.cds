// ADDED: Exposes all Production entities as OData service
using { shreeCem.production } from '../db/production';

service ProductionService @(path: '/production') {
    entity ProductionOrders  as projection on production.ProductionOrders;
    entity BillOfMaterials   as projection on production.BillOfMaterials;
    entity BOMItems          as projection on production.BOMItems;
    entity QualityTests      as projection on production.QualityTests;
}
