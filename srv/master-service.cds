// ADDED: Exposes all Master Data entities as OData service
using { shreeCem.master } from '../db/masterdata';

service MasterService @(path: '/master') {
    entity Customers  as projection on master.Customers;
    entity Vendors    as projection on master.Vendors;
    entity Materials  as projection on master.Materials;
    entity Plants     as projection on master.Plants;
}
