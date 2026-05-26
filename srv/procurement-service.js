// srv/procurement-service.js
const cds = require('@sap/cds');

module.exports = class ProcurementService extends cds.ApplicationService {

    async init() {
        this.on('uploadChallanPDF',  this._uploadChallanPDF.bind(this));
        this.on('extractChallanData', this._extractChallanData.bind(this));
        this.on('createGoodsReceipt', this._createGoodsReceipt.bind(this));
        return super.init();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 1: uploadChallanPDF
    // Stores the base64 PDF into DeliveryChallan.pdfContent and sets
    // status = PENDING. Creates the challan record if it doesn't exist yet.
    // ─────────────────────────────────────────────────────────────────────────
    async _uploadChallanPDF({ data }) {
        const { challanID, pdfBase64, fileName } = data;
        if (!challanID || !pdfBase64) {
            return { success: false, message: 'challanID and pdfBase64 are required' };
        }

        const db = await cds.connect.to('db');
        const { DeliveryChallan } = db.entities('shreeCem.procurement');

        const existing = await db.read(DeliveryChallan, challanID);

        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        if (existing) {
            await db.update(DeliveryChallan, challanID).with({
                pdfContent  : pdfBuffer,
                pdfFileName : fileName,
                status      : 'PENDING',
                createdAt   : new Date().toISOString(),
                createdBy   : cds.context?.user?.id || 'system'
            });
        } else {
            await db.insert(DeliveryChallan).entries({
                challanID,
                pdfContent  : pdfBuffer,
                pdfFileName : fileName,
                status      : 'PENDING',
                createdAt   : new Date().toISOString(),
                createdBy   : cds.context?.user?.id || 'system'
            });
        }

        return { success: true, message: 'PDF uploaded successfully' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 2: extractChallanData
    // Calls BTP Document Information Extraction, maps the result back into
    // DeliveryChallan header fields + DeliveryChallanItem rows, sets
    // status = EXTRACTED.
    // ─────────────────────────────────────────────────────────────────────────
    async _extractChallanData({ data }) {
        const { challanID } = data;
        if (!challanID) return { success: false, message: 'challanID is required', confidence: 0 };

        const db = await cds.connect.to('db');
        const { DeliveryChallan, DeliveryChallanItem } = db.entities('shreeCem.procurement');

        const challan = await db.read(DeliveryChallan, challanID);
        if (!challan) return { success: false, message: 'Challan not found', confidence: 0 };
        if (!challan.pdfContent) return { success: false, message: 'No PDF uploaded yet', confidence: 0 };

        // ── Call BTP DIE ──────────────────────────────────────────────────
        let extracted;
        try {
            extracted = await this._callDocumentAI(challan.pdfContent, challan.pdfFileName);
        } catch (err) {
            return { success: false, message: `AI extraction failed: ${err.message}`, confidence: 0 };
        }

        // ── Update challan header with extracted fields ────────────────────
        await db.update(DeliveryChallan, challanID).with({
            challanNumber   : extracted.challanNumber   || challan.challanNumber,
            challanDate     : extracted.challanDate     || challan.challanDate,
            vendorName      : extracted.vendorName      || challan.vendorName,
            purchaseOrderNo : extracted.purchaseOrderNo || challan.purchaseOrderNo,
            vehicleNumber   : extracted.vehicleNumber   || challan.vehicleNumber,
            driverName      : extracted.driverName      || challan.driverName,
            deliveryAddress : extracted.deliveryAddress || challan.deliveryAddress,
            totalQuantity   : extracted.totalQuantity   || challan.totalQuantity,
            status          : 'EXTRACTED'
        });

        // ── Delete old items (re-extract replaces them) ───────────────────
        await db.delete(DeliveryChallanItem).where({ challan_challanID: challanID });

        // ── Insert freshly extracted line items ───────────────────────────
        const itemEntries = (extracted.lineItems || []).map((li, idx) => ({
            itemID               : cds.utils.uuid(),
            challan_challanID    : challanID,
            itemNumber           : idx + 1,
            vendorMaterialCode   : li.vendorMaterialCode || '',
            materialDescription  : li.materialDescription || li.description || '',
            deliveredQuantity    : li.deliveredQuantity   || li.quantity || 0,
            unitOfMeasure        : li.unitOfMeasure       || li.uom     || 'EA',
            batchNumber          : li.batchNumber         || '',
            hsnCode              : li.hsnCode             || '',
            unitPrice            : li.unitPrice           || 0,
            totalValue           : li.totalValue          || (li.quantity * li.unitPrice) || 0,
            extractionConfidence : li.confidence          || extracted.overallConfidence || 0
        }));

        if (itemEntries.length > 0) {
            await db.insert(DeliveryChallanItem).entries(itemEntries);
        }

        return {
            success    : true,
            message    : `Extracted ${itemEntries.length} line item(s)`,
            confidence : extracted.overallConfidence || 0
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 3: createGoodsReceipt
    // Reads the extracted DeliveryChallan + its items, then inside ONE
    // transaction writes:
    //   1. GoodsReceipt header
    //   2. GRItems (one per challan item, matched to master.Materials by code)
    //   3. inventory.StockOverview  — quantity += deliveredQty  (upsert)
    //   4. inventory.StockLedger    — new GoodsIn entry per line
    //   5. procurement.POItems      — receivedQty += deliveredQty, derive status
    //   6. procurement.PurchaseOrders — status → GRDone if all items fully received
    //   7. procurement.DeliveryChallan — status → GR_CREATED, link grn
    // ─────────────────────────────────────────────────────────────────────────
    async _createGoodsReceipt({ data }) {
        const { challanID } = data;
        if (!challanID) return { success: false, grNumber: '', message: 'challanID is required' };

        const db = await cds.connect.to('db');
        const {
            DeliveryChallan, DeliveryChallanItem,
            GoodsReceipt, GRItems,
            PurchaseOrders, POItems
        } = db.entities('shreeCem.procurement');

        const {
            StockOverview, StockLedger
        } = db.entities('shreeCem.inventory');

        const { Materials, Plants, Vendors } = db.entities('shreeCem.master');

        // ── Load challan + items ──────────────────────────────────────────
        const challan = await db.read(DeliveryChallan, challanID);
        if (!challan) return { success: false, grNumber: '', message: 'Challan not found' };
        if (challan.status === 'GR_CREATED') {
            return { success: false, grNumber: '', message: 'GR already created for this challan' };
        }

        const challanItems = await db.read(DeliveryChallanItem)
            .where({ challan_challanID: challanID })
            .orderBy('itemNumber');

        if (!challanItems.length) {
            return { success: false, grNumber: '', message: 'No line items found on challan — extract first' };
        }

        // ── Resolve PO and vendor ─────────────────────────────────────────
        const poNumber = challan.purchaseOrderNo;
        let poRecord = null, vendorRecord = null;

        if (poNumber) {
            const pos = await db.read(PurchaseOrders).where({ poNumber });
            poRecord = pos[0] || null;
        }

        if (poRecord) {
            vendorRecord = await db.read(Vendors, poRecord.vendor_ID);
        }

        // ── Generate GRN number ───────────────────────────────────────────
        const grNumber = await this._nextGRN(db, GoodsReceipt);
        const today    = new Date().toISOString().split('T')[0];

        // ── Single atomic transaction ─────────────────────────────────────
        await db.tx(async tx => {

            // 1. GoodsReceipt header
            await tx.insert(GoodsReceipt).entries({
                ID          : cds.utils.uuid(),
                grnNumber   : grNumber,
                po_ID       : poRecord?.ID || null,
                vendor_ID   : vendorRecord?.ID || null,
                receiptDate : today,
                status      : 'Posted'
            });

            // Read the new GR's ID back so GRItems can reference it
            const grRows = await tx.read(GoodsReceipt).where({ grnNumber: grNumber });
            const grID   = grRows[0].ID;

            // Resolve plant from PO (falls back to first plant)
            const plantID = poRecord?.plant_ID || null;

            for (const item of challanItems) {

                // ── Match material by vendorMaterialCode or description ──
                let materialRecord = null;
                if (item.vendorMaterialCode) {
                    const mats = await tx.read(Materials)
                        .where({ materialCode: item.vendorMaterialCode });
                    materialRecord = mats[0] || null;
                }
                if (!materialRecord && item.materialDescription) {
                    const mats = await tx.read(Materials)
                        .where(`description like '%${item.materialDescription.substring(0, 20)}%'`);
                    materialRecord = mats[0] || null;
                }

                const materialID = materialRecord?.ID || null;

                // 2. GRItems
                await tx.insert(GRItems).entries({
                    ID          : cds.utils.uuid(),
                    grn_ID      : grID,
                    material_ID : materialID,
                    quantity    : item.deliveredQuantity,
                    uom         : item.unitOfMeasure
                });

                if (!plantID || !materialID) continue; // can't update stock without both keys

                // 3. StockOverview — upsert: find existing row for (plant, material)
                const stockRows = await tx.read(StockOverview)
                    .where({ plant_ID: plantID, material_ID: materialID });

                if (stockRows.length > 0) {
                    // Update existing stock row
                    await tx.update(StockOverview, stockRows[0].ID).with({
                        quantity    : stockRows[0].quantity + item.deliveredQuantity,
                        lastUpdated : new Date().toISOString()
                    });
                } else {
                    // No stock row yet — create one
                    await tx.insert(StockOverview).entries({
                        ID          : cds.utils.uuid(),
                        plant_ID    : plantID,
                        material_ID : materialID,
                        quantity    : item.deliveredQuantity,
                        uom         : item.unitOfMeasure,
                        lastUpdated : new Date().toISOString()
                    });
                }

                // 4. StockLedger — always insert a new movement entry
                await tx.insert(StockLedger).entries({
                    ID           : cds.utils.uuid(),
                    plant_ID     : plantID,
                    material_ID  : materialID,
                    movementType : 'GoodsIn',
                    quantity     : item.deliveredQuantity,
                    uom          : item.unitOfMeasure,
                    referenceDoc : grNumber,
                    postingDate  : today
                });

                // 5. POItems — increment receivedQty, recalc open/partial/done
                if (poRecord && materialID) {
                    const poItemRows = await tx.read(POItems)
                        .where({ po_ID: poRecord.ID, material_ID: materialID });

                    if (poItemRows.length > 0) {
                        const poi          = poItemRows[0];
                        const newReceived  = (poi.receivedQty || 0) + item.deliveredQuantity;
                        await tx.update(POItems, poi.ID).with({
                            receivedQty: newReceived
                        });
                    }
                }
            } // end for each challan item

            // 6. PurchaseOrders — set status to GRDone if all PO items fully received
            if (poRecord) {
                const allPOItems = await tx.read(POItems).where({ po_ID: poRecord.ID });
                const allDone    = allPOItems.every(pi => (pi.receivedQty || 0) >= pi.quantity);
                const anyDone    = allPOItems.some(pi =>  (pi.receivedQty || 0) >  0);

                const newPOStatus = allDone ? 'GRDone'
                                  : anyDone ? 'PartialGR'
                                  :           poRecord.status;

                if (newPOStatus !== poRecord.status) {
                    await tx.update(PurchaseOrders, poRecord.ID).with({ status: newPOStatus });
                }
            }

            // 7. DeliveryChallan — mark as GR_CREATED and store GRN reference
            await tx.update(DeliveryChallan, challanID).with({
                status      : 'GR_CREATED',
                remarks     : `GR created: ${grNumber}`
            });

        }); // end tx

        return { success: true, grNumber, message: `GR ${grNumber} posted successfully` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: generate next sequential GRN number  e.g. GRN-2025-002
    // ─────────────────────────────────────────────────────────────────────────
    async _nextGRN(db, GoodsReceipt) {
        const year = new Date().getFullYear();
        const rows = await db.read(GoodsReceipt)
            .columns('grnNumber')
            .where(`grnNumber like 'GRN-${year}-%'`)
            .orderBy({ grnNumber: 'desc' })
            .limit(1);

        if (!rows.length) return `GRN-${year}-001`;
        const last = parseInt(rows[0].grnNumber.split('-')[2], 10);
        return `GRN-${year}-${String(last + 1).padStart(3, '0')}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: BTP Document Information Extraction API call
    // Reads credentials from the bound DIE service via @sap/xsenv
    // ─────────────────────────────────────────────────────────────────────────
    async _callDocumentAI(pdfBuffer, fileName) {
        // Dynamically require so the server starts fine even without binding in dev
        let xsenv;
        try { xsenv = require('@sap/xsenv'); } catch(e) {
            throw new Error('@sap/xsenv not available — bind a DIE service instance');
        }

        const services = xsenv.getServices({ die: { tag: 'document-information-extraction' } });
        const creds    = services.die;

        // Get OAuth token (client credentials)
        const fetch = (...a) => import('node-fetch').then(m => m.default(...a));
        const tokenRes = await (await fetch(
            `${creds.url}/oauth/token?grant_type=client_credentials`,
            {
                method  : 'POST',
                headers : {
                    Authorization  : 'Basic ' + Buffer.from(`${creds.clientid}:${creds.clientsecret}`).toString('base64'),
                    'Content-Type' : 'application/x-www-form-urlencoded'
                }
            }
        )).json();
        const token = tokenRes.access_token;

        // Submit PDF
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', pdfBuffer, { filename: fileName || 'challan.pdf', contentType: 'application/pdf' });
        form.append('options', JSON.stringify({
            extraction: {
                headerFields  : ['documentNumber','documentDate','vendorName','purchaseOrderNumber',
                                 'vehicleNumber','driverName','deliveryAddress','totalQuantity'],
                lineItemFields: ['description','quantity','unitOfMeasure','unitPrice',
                                 'netAmount','materialNumber','batchNumber','hsnCode']
            }
        }));

        const submitRes = await (await fetch(`${creds.serviceUrl}/document/jobs`, {
            method  : 'POST',
            headers : { Authorization: `Bearer ${token}`, ...form.getHeaders() },
            body    : form
        })).json();

        const jobId = submitRes.id;
        if (!jobId) throw new Error('DIE did not return a job ID: ' + JSON.stringify(submitRes));

        // Poll (max 30 s)
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const job = await (await fetch(`${creds.serviceUrl}/document/jobs/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })).json();

            if (job.status === 'DONE')   return this._mapDIEResult(job);
            if (job.status === 'FAILED') throw new Error('DIE job failed: ' + job.message);
        }
        throw new Error('DIE extraction timed out after 30s');
    }

    // Map raw DIE response schema → our internal shape
    _mapDIEResult(job) {
        const getField = (fields, name) =>
            (Array.isArray(fields) ? fields : [])
                .find(f => f.name === name)?.value ?? '';

        const h = job.extraction?.headerFields || [];
        const overallConfidence = job.extraction?.headerFields
            ?.reduce((acc, f) => acc + (f.confidence || 0), 0) /
            (job.extraction?.headerFields?.length || 1);

        const lineItems = (job.extraction?.lineItems || []).map(liFields => ({
            vendorMaterialCode  : getField(liFields, 'materialNumber'),
            materialDescription : getField(liFields, 'description'),
            deliveredQuantity   : parseFloat(getField(liFields, 'quantity'))  || 0,
            unitOfMeasure       : getField(liFields, 'unitOfMeasure') || 'EA',
            unitPrice           : parseFloat(getField(liFields, 'unitPrice')) || 0,
            totalValue          : parseFloat(getField(liFields, 'netAmount')) || 0,
            batchNumber         : getField(liFields, 'batchNumber'),
            hsnCode             : getField(liFields, 'hsnCode'),
            confidence          : liFields.reduce?.((a, f) => a + (f.confidence || 0), 0) / (liFields.length || 1) || 0
        }));

        return {
            challanNumber   : getField(h, 'documentNumber'),
            challanDate     : getField(h, 'documentDate'),
            vendorName      : getField(h, 'vendorName'),
            purchaseOrderNo : getField(h, 'purchaseOrderNumber'),
            vehicleNumber   : getField(h, 'vehicleNumber'),
            driverName      : getField(h, 'driverName'),
            deliveryAddress : getField(h, 'deliveryAddress'),
            totalQuantity   : parseFloat(getField(h, 'totalQuantity')) || 0,
            overallConfidence: Math.round((overallConfidence || 0) * 100) / 100,
            lineItems
        };
    }
};