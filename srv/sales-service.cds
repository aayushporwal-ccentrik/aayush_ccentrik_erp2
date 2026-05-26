// ADDED: Exposes all Sales entities as OData service
using { shreeCem.sales } from '../db/sales';

service SalesService @(path: '/sales') {
    entity SalesOrders      as projection on sales.SalesOrders;
    entity SalesOrderItems  as projection on sales.SalesOrderItems;
    entity Invoices         as projection on sales.Invoices;
    entity Payments         as projection on sales.Payments;
    entity SalesReturns     as projection on sales.SalesReturns;
    entity SalesReturnItems as projection on sales.SalesReturnItems;
}
