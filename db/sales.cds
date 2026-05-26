// ADDED: Sales module — SalesOrders, Invoices, Payments, SalesReturns
namespace shreeCem.sales;

using { cuid, managed } from '@sap/cds/common';
using { shreeCem.master } from './masterdata';

entity SalesOrders : cuid, managed {
    soNumber     : String(20);
    customer     : Association to master.Customers;
    plant        : Association to master.Plants;
    orderDate    : Date;
    status       : String(20); // e.g. Open, Delivered, Cancelled
    items        : Composition of many SalesOrderItems on items.order = $self;
}

entity SalesOrderItems : cuid {
    order        : Association to SalesOrders;
    material     : Association to master.Materials;
    quantity     : Decimal(13,3);
    uom          : String(10);
    rate         : Decimal(13,2);
    amount       : Decimal(13,2);
}

entity Invoices : cuid, managed {
    invoiceNumber : String(20);
    salesOrder    : Association to SalesOrders;
    customer      : Association to master.Customers;
    invoiceDate   : Date;
    totalAmount   : Decimal(13,2);
    gstAmount     : Decimal(13,2);
    netAmount     : Decimal(13,2);
    status        : String(20); // e.g. Draft, Posted, Cancelled
}

entity Payments : cuid, managed {
    paymentNumber : String(20);
    invoice       : Association to Invoices;
    customer      : Association to master.Customers;
    paymentDate   : Date;
    amount        : Decimal(13,2);
    mode          : String(20); // e.g. NEFT, Cheque, Cash
    status        : String(20); // e.g. Received, Overdue
}

entity SalesReturns : cuid, managed {
    returnNumber  : String(20);
    salesOrder    : Association to SalesOrders;
    customer      : Association to master.Customers;
    returnDate    : Date;
    reason        : String(200); // e.g. RejectedBags
    creditNoteRef : String(20);
    items         : Composition of many SalesReturnItems on items.return = $self;
}

entity SalesReturnItems : cuid {
    return       : Association to SalesReturns;
    material     : Association to master.Materials;
    quantity     : Decimal(13,3);
    uom          : String(10);
}
