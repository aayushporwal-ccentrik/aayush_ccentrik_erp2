// ADDED: Inventory module — StockOverview, StockTransfer, StockLedger
namespace shreeCem.inventory;

using { cuid, managed } from '@sap/cds/common';
using { shreeCem.master } from './masterdata';

entity StockOverview : cuid, managed {
    plant        : Association to master.Plants;
    material     : Association to master.Materials;
    quantity     : Decimal(13,3);
    uom          : String(10);
    lastUpdated  : DateTime;
}

entity StockTransfer : cuid, managed {
    transferNo   : String(20);
    fromPlant    : Association to master.Plants;
    toPlant      : Association to master.Plants;
    material     : Association to master.Materials;
    quantity     : Decimal(13,3);
    uom          : String(10);
    transferDate : Date;
    status       : String(20); // e.g. Pending, Completed
}

entity StockLedger : cuid, managed {
    plant        : Association to master.Plants;
    material     : Association to master.Materials;
    movementType : String(20); // e.g. GoodsIn, GoodsOut, Transfer
    quantity     : Decimal(13,3);
    uom          : String(10);
    referenceDoc : String(20); // PO/SO/Transfer number
    postingDate  : Date;
}
