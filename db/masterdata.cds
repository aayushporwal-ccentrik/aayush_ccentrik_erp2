// ADDED: Master data entities — Customers, Vendors, Materials, Plants
namespace shreeCem.master;

using { cuid, managed } from '@sap/cds/common';

entity Customers : cuid, managed {
    customerCode : String(20);
    name         : String(100);
    type         : String(20); // e.g. Dealer, Contractor
    gstNumber    : String(20);
    address      : String(200);
    city         : String(50);
    state        : String(50);
    phone        : String(15);
}

entity Vendors : cuid, managed {
    vendorCode   : String(20);
    name         : String(100);
    type         : String(20); // e.g. Supplier, Transporter
    gstNumber    : String(20);
    address      : String(200);
    city         : String(50);
    state        : String(50);
    phone        : String(15);
}

entity Materials : cuid, managed {
    materialCode : String(20);
    description  : String(200);
    type         : String(30); // e.g. FinishedGood, RawMaterial, Spare
    uom          : String(10); // Unit of measure e.g. BAG, MT, KG
    grade        : String(30); // e.g. OPC53, PPC
}

entity Plants : cuid, managed {
    plantCode    : String(10);
    name         : String(100);
    type         : String(20); // e.g. Plant, Depot, Company
    address      : String(200);
    city         : String(50);
    state        : String(50);
}
