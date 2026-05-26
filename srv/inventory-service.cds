// ADDED: Exposes all Inventory entities as OData service
using { shreeCem.inventory } from '../db/inventory';

service InventoryService @(path: '/inventory') {
    entity StockOverview   as projection on inventory.StockOverview;
    entity StockTransfer   as projection on inventory.StockTransfer;
    entity StockLedger     as projection on inventory.StockLedger;
}
