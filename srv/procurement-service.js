const cds = require('@sap/cds');

module.exports = class ProcurementService extends cds.ApplicationService {
    async init() {
        this.on('uploadChallanPDF', this._uploadChallanPDF.bind(this));
        this.on('extractChallanData', this._extractChallanData.bind(this));
        this.on('createGoodsReceipt', this._createGoodsReceipt.bind(this));
        this.on('submitVendorPayment', this._submitVendorPayment.bind(this));
        this.on('getPaymentMetrics', this._getPaymentMetrics.bind(this));

        const { Invoices } = this.entities;
        this.on('READ', Invoices, this._onReadInvoices.bind(this));

        return super.init();
    }
    async _uploadChallanPDF({ data }) {
        const { challanID, pdfBase64, fileName } = data;
        if (!challanID || !pdfBase64) {
            return { success: false, message: 'challanID and pdfBase64 are required' };
        }

        const db = await cds.connect.to('db'); 
        const { DeliveryChallan } = db.entities('shreeCem.procurement');
        
        // 1. Safely check for existing records using explicit CQN SELECT
        const existing = await db.run(SELECT.from(DeliveryChallan).where({ challanID }));
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const timestamp = new Date().toISOString();
        const user = cds.context?.user?.id || 'system';

        if (existing.length > 0) {
            // 2. Explicit Update
            await db.run(
                UPDATE(DeliveryChallan)
                .set({
                    pdfContent: pdfBuffer,
                    pdfFileName: fileName || 'challan.pdf',
                    status: 'PENDING',
                    createdAt: timestamp,
                    createdBy: user
                })
                .where({ challanID })
            );
        } else {
            // 3. Explicit CQN Insert 
            await db.run(
                INSERT.into(DeliveryChallan).entries({
                    challanID: challanID,
                    pdfContent: pdfBuffer,
                    pdfFileName: fileName || 'challan.pdf',
                    status: 'PENDING',
                    createdAt: timestamp,
                    createdBy: user,
                    items: [] // 🟢 MATCHED TO SCHEMA: Keeps the compiler happy during creation!
                })
            );
        }

        return { success: true, message: 'PDF uploaded successfully' };
    }
    async _extractChallanData({ data }) {
        const { challanID } = data;
        if (!challanID) return { success: false, message: 'challanID is required', confidence: 0 };

        const db = await cds.connect.to('db');
        const { DeliveryChallan, DeliveryChallanItem } = db.entities('shreeCem.procurement');

        const challan = await db.read(DeliveryChallan, challanID);
        if (!challan) return { success: false, message: 'Challan not found', confidence: 0 };
        if (!challan.pdfContent) return { success: false, message: 'No PDF uploaded yet', confidence: 0 };

        let extracted;
        try {
            extracted = await this._callDocumentAI(challan.pdfContent, challan.pdfFileName);
        } catch (err) {
            return { success: false, message: `AI extraction failed: ${err.message}`, confidence: 0 };
        }

        await db.update(DeliveryChallan, challanID).with({
            challanNumber: extracted.challanNumber || challan.challanNumber,
            challanDate: extracted.challanDate || challan.challanDate,
            vendorName: extracted.vendorName || challan.vendorName,
            purchaseOrderNo: extracted.purchaseOrderNo || challan.purchaseOrderNo,
            vehicleNumber: extracted.vehicleNumber || challan.vehicleNumber,
            driverName: extracted.driverName || challan.driverName,
            deliveryAddress: extracted.deliveryAddress || challan.deliveryAddress,
            totalQuantity: extracted.totalQuantity || challan.totalQuantity,
            status: 'EXTRACTED'
        });

        await db.delete(DeliveryChallanItem).where({ challan_challanID: challanID });

        const itemEntries = (extracted.lineItems || []).map((li, idx) => ({
            itemID: cds.utils.uuid(),
            challan_challanID: challanID,
            itemNumber: idx + 1,
            vendorMaterialCode: li.vendorMaterialCode || '',
            materialDescription: li.materialDescription || li.description || '',
            deliveredQuantity: li.deliveredQuantity || li.quantity || 0,
            unitOfMeasure: li.unitOfMeasure || li.uom || 'EA',
            batchNumber: li.batchNumber || '',
            hsnCode: li.hsnCode || '',
            unitPrice: li.unitPrice || 0,
            totalValue: li.totalValue || (li.quantity * li.unitPrice) || 0,
            extractionConfidence: li.confidence || extracted.overallConfidence || 0
        }));

        if (itemEntries.length) {
            await db.insert(DeliveryChallanItem).entries(itemEntries);
        }

        return {
            success: true,
            message: `Extracted ${itemEntries.length} line item(s)`,
            confidence: extracted.overallConfidence || 0
        };
    }

    async _createGoodsReceipt({ data }) {
        const { challanID } = data;
        if (!challanID) return { success: false, grNumber: '', message: 'challanID is required' };

        const db = await cds.connect.to('db');
        const {
            DeliveryChallan, DeliveryChallanItem, GoodsReceipt, GRItems, PurchaseOrders, POItems
        } = db.entities('shreeCem.procurement');
        const { StockOverview, StockLedger } = db.entities('shreeCem.inventory');
        const { Materials, Vendors } = db.entities('shreeCem.master');

        const challan = await db.read(DeliveryChallan, challanID);
        if (!challan) return { success: false, grNumber: '', message: 'Challan not found' };
        if (challan.status === 'GR_CREATED') {
            return { success: false, grNumber: '', message: 'GR already created for this challan' };
        }

        const challanItems = await db.read(DeliveryChallanItem)
            .where({ challan_challanID: challanID })
            .orderBy('itemNumber');

        if (!challanItems.length) {
            return { success: false, grNumber: '', message: 'No line items found on challan - extract first' };
        }

        const poNumber = challan.purchaseOrderNo;
        let poRecord = null;
        let vendorRecord = null;

        if (poNumber) {
            const pos = await db.read(PurchaseOrders).where({ poNumber });
            poRecord = pos[0] || null;
        }
        if (poRecord) {
            vendorRecord = await db.read(Vendors, poRecord.vendor_ID);
        }

        const grNumber = await this._nextGRN(db, GoodsReceipt);
        const today = new Date().toISOString().slice(0, 10);

        await db.tx(async tx => {
            await tx.insert(GoodsReceipt).entries({
                ID: cds.utils.uuid(),
                grnNumber: grNumber,
                po_ID: poRecord?.ID || null,
                vendor_ID: vendorRecord?.ID || null,
                receiptDate: today,
                status: 'Posted'
            });

            const grRows = await tx.read(GoodsReceipt).where({ grnNumber: grNumber });
            const grID = grRows[0].ID;
            const plantID = poRecord?.plant_ID || null;

            for (const item of challanItems) {
                let materialRecord = null;
                if (item.vendorMaterialCode) {
                    const mats = await tx.read(Materials).where({ materialCode: item.vendorMaterialCode });
                    materialRecord = mats[0] || null;
                }
                if (!materialRecord && item.materialDescription) {
                    const search = item.materialDescription.substring(0, 20).replace(/'/g, "''");
                    const mats = await tx.read(Materials).where(`description like '%${search}%'`);
                    materialRecord = mats[0] || null;
                }

                const materialID = materialRecord?.ID || null;

                await tx.insert(GRItems).entries({
                    ID: cds.utils.uuid(),
                    grn_ID: grID,
                    material_ID: materialID,
                    quantity: item.deliveredQuantity,
                    uom: item.unitOfMeasure
                });

                if (!plantID || !materialID) continue;

                const stockRows = await tx.read(StockOverview).where({ plant_ID: plantID, material_ID: materialID });
                if (stockRows.length) {
                    await tx.update(StockOverview, stockRows[0].ID).with({
                        quantity: Number(stockRows[0].quantity || 0) + Number(item.deliveredQuantity || 0),
                        lastUpdated: new Date().toISOString()
                    });
                } else {
                    await tx.insert(StockOverview).entries({
                        ID: cds.utils.uuid(),
                        plant_ID: plantID,
                        material_ID: materialID,
                        quantity: item.deliveredQuantity,
                        uom: item.unitOfMeasure,
                        lastUpdated: new Date().toISOString()
                    });
                }

                await tx.insert(StockLedger).entries({
                    ID: cds.utils.uuid(),
                    plant_ID: plantID,
                    material_ID: materialID,
                    movementType: 'GoodsIn',
                    quantity: item.deliveredQuantity,
                    uom: item.unitOfMeasure,
                    referenceDoc: grNumber,
                    postingDate: today
                });

                if (poRecord && materialID) {
                    const poItemRows = await tx.read(POItems).where({ po_ID: poRecord.ID, material_ID: materialID });
                    if (poItemRows.length) {
                        const poi = poItemRows[0];
                        await tx.update(POItems, poi.ID).with({
                            receivedQty: Number(poi.receivedQty || 0) + Number(item.deliveredQuantity || 0)
                        });
                    }
                }
            }

            if (poRecord) {
                const allPOItems = await tx.read(POItems).where({ po_ID: poRecord.ID });
                const allDone = allPOItems.every(pi => Number(pi.receivedQty || 0) >= Number(pi.quantity || 0));
                const anyDone = allPOItems.some(pi => Number(pi.receivedQty || 0) > 0);
                const newPOStatus = allDone ? 'GRDone' : anyDone ? 'PartialGR' : poRecord.status;

                if (newPOStatus !== poRecord.status) {
                    await tx.update(PurchaseOrders, poRecord.ID).with({ status: newPOStatus });
                }
            }

            await tx.update(DeliveryChallan, challanID).with({
                status: 'GR_CREATED',
                remarks: `GR created: ${grNumber}`
            });
        });

        return { success: true, grNumber, message: `GR ${grNumber} posted successfully` };
    }

    async _onReadInvoices(req) {
        const invoices = await this._buildInvoices(req);
        return this._applyInvoiceWhere(invoices, req.query?.SELECT?.where);
    }

    async _getPaymentMetrics(req) {
        const invoices = await this._buildInvoices(req);
        const counts = { Overdue: 0, Approved: 0, Pending: 0, Paid: 0 };
        const sums = { totalOutstanding: 0, overdue: 0, paidThisMonth: 0, pendingApproval: 0 };

        for (const inv of invoices) {
            const amount = Number(inv.netPayableRaw || 0);
            if (inv.status !== 'Paid') sums.totalOutstanding += amount;

            if (inv.status === 'Overdue') {
                counts.Overdue += 1;
                sums.overdue += amount;
            } else if (inv.status === 'Paid') {
                counts.Paid += 1;
                sums.paidThisMonth += amount;
            } else if (inv.status === 'Pending') {
                counts.Pending += 1;
                sums.pendingApproval += amount;
            } else {
                counts.Approved += 1;
            }
        }

        return {
            totalOutstanding: this._formatLakhs(sums.totalOutstanding),
            totalOutstandingCount: counts.Overdue + counts.Approved + counts.Pending,
            overdue: this._formatLakhs(sums.overdue),
            overdueCount: counts.Overdue,
            paidThisMonth: this._formatLakhs(sums.paidThisMonth),
            paidThisMonthCount: counts.Paid,
            pendingApproval: this._formatLakhs(sums.pendingApproval),
            pendingApprovalCount: counts.Pending
        };
    }

    async _submitVendorPayment(req) {
        const { data } = req;
        const { po_ID, vendor_ID, amount, mode, paymentDate, remarks } = data;
        const numericAmount = Number(amount || 0);

        if (!po_ID || !vendor_ID) {
            return { success: false, paymentNumber: '', message: 'PO and vendor are required' };
        }
        if (!numericAmount || numericAmount <= 0) {
            return { success: false, paymentNumber: '', message: 'Payment amount must be greater than zero' };
        }
        if (!mode || mode === 'NONE') {
            return { success: false, paymentNumber: '', message: 'Payment mode is required' };
        }
        if (!paymentDate) {
            return { success: false, paymentNumber: '', message: 'Payment date is required' };
        }

        const tx = cds.tx(req);
        const { VendorPayments, PurchaseOrders } = cds.entities('shreeCem.procurement');
        const paymentNumber = await this._nextPaymentNumber(tx, VendorPayments);

        await tx.run(INSERT.into(VendorPayments).entries({
            ID: cds.utils.uuid(),
            paymentNumber,
            vendor_ID,
            po_ID,
            paymentDate,
            amount: numericAmount,
            mode,
            status: 'Paid'
        }));

        await tx.run(UPDATE(PurchaseOrders, po_ID).with({
            status: 'Invoiced',
            modifiedAt: new Date().toISOString(),
            modifiedBy: cds.context?.user?.id || 'system'
        }));

        return {
            success: true,
            paymentNumber,
            message: `Payment ${paymentNumber} posted successfully`
        };
    }

    async _buildInvoices(req) {
        const tx = cds.tx(req);
        const { PurchaseOrders, VendorPayments, GoodsReceipt } = this.entities;

        const purchaseOrders = await tx.run(
            SELECT.from(PurchaseOrders, po => {
                po.ID, po.poNumber, po.orderDate, po.status, po.vendor_ID,
                po.vendor(v => { v.ID, v.name }),
                po.items(item => { item.amount })
            })
        );
        const payments = await tx.run(SELECT.from(VendorPayments));
        const receipts = await tx.run(SELECT.from(GoodsReceipt).columns('po_ID', 'grnNumber'));
        const today = new Date();

        return purchaseOrders.map((po, index) => {
            const gross = (po.items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const cgst = gross * 0.09;
            const sgst = gross * 0.09;
            const gst = cgst + sgst;
            const tds = gross * 0.02;
            const netPayable = gross + gst - tds;
            const payment = payments.find(p => p.po_ID === po.ID);
            const receipt = receipts.find(gr => gr.po_ID === po.ID);
            const baseDate = po.orderDate ? new Date(po.orderDate) : today;
            const dueDate = new Date(baseDate);
            dueDate.setDate(baseDate.getDate() + 15);

            let status = po.status === 'GRDone' ? 'Approved' : po.status || 'Pending';
            let statusState = 'None';
            let action = 'Pay now';

            if (payment || po.status === 'Invoiced') {
                status = 'Paid';
                statusState = 'Success';
                action = 'View';
            } else if (dueDate < today) {
                status = 'Overdue';
                statusState = 'Error';
            } else if (status === 'Open' || status === 'Pending') {
                status = 'Pending';
                statusState = 'Warning';
                action = 'Approve';
            } else if (status === 'Approved') {
                statusState = 'Success';
            } else if (status === 'PartialGR') {
                status = 'Partial';
                statusState = 'Warning';
                action = 'Pay balance';
            }

            return {
                ID: po.ID,
                invoiceId: `INV-${baseDate.getFullYear()}-${String(index + 1).padStart(4, '0')}`,
                vendor: po.vendor?.name || 'Unknown Supplier',
                vendor_ID: po.vendor_ID || po.vendor?.ID,
                po_ID: po.ID,
                poRef: po.poNumber,
                grnRef: receipt?.grnNumber || '',
                invoiceDate: this._toDate(baseDate),
                dueDate: this._toDate(dueDate),
                grossAmount: this._formatINR(gross),
                cgst: this._formatINR(cgst),
                sgst: this._formatINR(sgst),
                tds: this._formatINR(tds),
                gst: this._formatINR(gst),
                netPayable: this._formatINR(netPayable),
                netPayableRaw: Math.round(netPayable * 100) / 100,
                status,
                statusState,
                action
            };
        });
    }

    _applyInvoiceWhere(invoices, where = []) {
        if (!Array.isArray(where) || where.length === 0) return invoices;

        const equals = this._extractWhereEquals(where);
        const contains = this._extractWhereContains(where);

        return invoices.filter(invoice => {
            const equalsMatch = equals.every(({ field, value }) => String(invoice[field] ?? '') === String(value));
            const containsMatch = contains.every(({ field, value }) =>
                String(invoice[field] ?? '').toLowerCase().includes(String(value).toLowerCase())
            );
            return equalsMatch && containsMatch;
        });
    }

    _extractWhereEquals(where) {
        const filters = [];
        for (let i = 0; i < where.length - 2; i += 1) {
            if (where[i]?.ref && where[i + 1] === '=' && where[i + 2]?.val !== undefined) {
                filters.push({ field: where[i].ref[0], value: where[i + 2].val });
            }
        }
        return filters;
    }

    _extractWhereContains(where) {
        const filters = [];
        for (let i = 0; i < where.length; i += 1) {
            const token = where[i];
            if (token?.func === 'contains' && token.args?.[0]?.ref && token.args?.[1]?.val !== undefined) {
                filters.push({ field: token.args[0].ref[0], value: token.args[1].val });
            }
        }
        return filters;
    }

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

    async _nextPaymentNumber(db, VendorPayments) {
        const year = new Date().getFullYear();
        const rows = await db.read(VendorPayments)
            .columns('paymentNumber')
            .where(`paymentNumber like 'PAY-${year}-%'`)
            .orderBy({ paymentNumber: 'desc' })
            .limit(1);

        if (!rows.length) return `PAY-${year}-001`;
        const last = parseInt(rows[0].paymentNumber.split('-')[2], 10);
        return `PAY-${year}-${String(last + 1).padStart(3, '0')}`;
    }

    _formatINR(value) {
        return `Rs. ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
    }

    _formatLakhs(value) {
        return `Rs. ${(Number(value || 0) / 100000).toFixed(1)}L`;
    }

    _toDate(value) {
        return new Date(value).toISOString().slice(0, 10);
    }

    async _callDocumentAI(pdfBuffer, fileName) {
        let xsenv;
        try {
            xsenv = require('@sap/xsenv');
        } catch (e) {
            throw new Error('@sap/xsenv not available - bind a DIE service instance');
        }

        const services = xsenv.getServices({ die: { tag: 'document-information-extraction' } });
        const creds = services.die;
        const fetch = (...a) => import('node-fetch').then(m => m.default(...a));
        const tokenRes = await (await fetch(
            `${creds.url}/oauth/token?grant_type=client_credentials`,
            {
                method: 'POST',
                headers: {
                    Authorization: 'Basic ' + Buffer.from(`${creds.clientid}:${creds.clientsecret}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        )).json();
        const token = tokenRes.access_token;

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', pdfBuffer, { filename: fileName || 'challan.pdf', contentType: 'application/pdf' });
        form.append('options', JSON.stringify({
            extraction: {
                headerFields: [
                    'documentNumber', 'documentDate', 'vendorName', 'purchaseOrderNumber',
                    'vehicleNumber', 'driverName', 'deliveryAddress', 'totalQuantity'
                ],
                lineItemFields: [
                    'description', 'quantity', 'unitOfMeasure', 'unitPrice',
                    'netAmount', 'materialNumber', 'batchNumber', 'hsnCode'
                ]
            }
        }));

        const submitRes = await (await fetch(`${creds.serviceUrl}/document/jobs`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
            body: form
        })).json();

        const jobId = submitRes.id;
        if (!jobId) throw new Error('DIE did not return a job ID: ' + JSON.stringify(submitRes));

        for (let i = 0; i < 15; i += 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const job = await (await fetch(`${creds.serviceUrl}/document/jobs/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })).json();

            if (job.status === 'DONE') return this._mapDIEResult(job);
            if (job.status === 'FAILED') throw new Error('DIE job failed: ' + job.message);
        }
        throw new Error('DIE extraction timed out after 30s');
    }

_mapDIEResult(job) {
        // Safe field lookup helper
        const getField = (fields, name) =>
            (Array.isArray(fields) ? fields : []).find(f => f.name === name)?.value ?? '';

        const h = job.extraction?.headerFields || [];
        
        // Calculate header confidence safely
        const overallConfidence = h.length 
            ? h.reduce((acc, f) => acc + (f.confidence || 0), 0) / h.length 
            : 0;

        // 🟢 FIX: Handle the true nested array structure of DIE Line Items
        const extractedLineItems = (job.extraction?.lineItems || []).map(item => {
            // Document AI separates properties inside an inner array (often called 'properties' or 'fields')
            const fieldsArray = item.properties || item.fields || [];
            
            // Calculate item-level confidence safely from the array
            const itemConfidence = fieldsArray.length
                ? fieldsArray.reduce((a, f) => a + (f.confidence || 0), 0) / fieldsArray.length
                : 0;

            return {
                vendorMaterialCode: getField(fieldsArray, 'materialNumber'),
                materialDescription: getField(fieldsArray, 'description'),
                deliveredQuantity: parseFloat(getField(fieldsArray, 'quantity')) || 0,
                unitOfMeasure: getField(fieldsArray, 'unitOfMeasure') || 'EA',
                unitPrice: parseFloat(getField(fieldsArray, 'unitPrice')) || 0,
                totalValue: parseFloat(getField(fieldsArray, 'netAmount')) || 0,
                batchNumber: getField(fieldsArray, 'batchNumber'),
                hsnCode: getField(fieldsArray, 'hsnCode'),
                confidence: Math.round(itemConfidence * 100) / 100
            };
        });

        return {
            challanNumber: getField(h, 'documentNumber'),
            challanDate: getField(h, 'documentDate'),
            vendorName: getField(h, 'vendorName'),
            purchaseOrderNo: getField(h, 'purchaseOrderNumber'),
            vehicleNumber: getField(h, 'vehicleNumber'),
            driverName: getField(h, 'driverName'),
            deliveryAddress: getField(h, 'deliveryAddress'),
            totalQuantity: parseFloat(getField(h, 'totalQuantity')) || 0,
            overallConfidence: Math.round((overallConfidence || 0) * 100) / 100,
            lineItems: extractedLineItems
        };
    }
};
