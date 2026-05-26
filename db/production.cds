// ADDED: Production module — ProductionOrders, BillOfMaterials, QualityTests
namespace shreeCem.production;

using { cuid, managed } from '@sap/cds/common';
using { shreeCem.master } from './masterdata';

entity ProductionOrders : cuid, managed {
    prodOrderNo  : String(20);
    plant        : Association to master.Plants;
    material     : Association to master.Materials; // finished cement grade
    plannedQty   : Decimal(13,3);
    actualQty    : Decimal(13,3);
    uom          : String(10);
    startDate    : Date;
    endDate      : Date;
    status       : String(20); // e.g. Planned, InProgress, Completed
}

entity BillOfMaterials : cuid, managed {
    bomNumber    : String(20);
    material     : Association to master.Materials; // header: finished good
    plant        : Association to master.Plants;
    validFrom    : Date;
    items        : Composition of many BOMItems on items.bom = $self;
}

entity BOMItems : cuid {
    bom          : Association to BillOfMaterials;
    component    : Association to master.Materials; // raw material
    quantity     : Decimal(13,3);
    uom          : String(10);
}

entity QualityTests : cuid, managed {
    testNumber   : String(20);
    prodOrder    : Association to ProductionOrders;
    material     : Association to master.Materials;
    testDate     : Date;
    batchNumber  : String(20);
    result       : String(20); // e.g. Pass, Fail
    remarks      : String(200);
}
