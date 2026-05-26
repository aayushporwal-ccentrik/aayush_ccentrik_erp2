const cds = require('@sap/cds');
const FormData = require('form-data');
const fetch = require('node-fetch');

module.exports = class ProcurementService extends cds.ApplicationService {

    async init() {

        this.on('importDeliveryChallan', async (req) => {
            const { fileContent, fileName } = req.data;

            // ── 1. Extract via DOX ──────────────────────────────────────
            const token = await this._getToken();
            const dox   = await this._callDOX(fileContent, fileName, token);

            const hf    = dox.extraction?.headerFields || [];
            const get   = (n) => hf.find(f => f.name === n)?.value ?? null;

            const challanPO   = get('documentNumber')  // PO number on challan
                             || get('purchaseOrderNumber');
            const challanDate = get('documentDate');
            const vendorName  = get('senderName');

            if (!challanPO) return req.error(422, 'Could not extract PO number from challan');

            // ── 2. Find matching PO in DB ───────────────────────────────
            const { PurchaseOrders, POItems, GoodsReceipt, GRItems, Vendors } = cds.entities;

            const po = await SELECT.one.from(PurchaseOrders)
                .where({ poNumber: challanPO });

            if (!po) return req.error(404,
                `No PO found for challan PO number: ${challanPO}`);

            const poItems = await SELECT.from(POItems)
                .where({ po_ID: po.ID });

            // ── 3. Parse challan line items from DOX ───────────────────
            const challanLines = (dox.extraction?.lineItems || []).map(li => {
                const g = (n) => li.find(f => f.name === n)?.value ?? null;
                return {
                    description : g('description'),
                    quantity    : parseFloat(g('quantity'))  || 0,
                    unitPrice   : parseFloat(g('unitPrice')) || 0,
                    amount      : parseFloat(g('amount'))    || 0
                };
            });

            // ── 4. Compare challan lines vs PO lines ───────────────────
            let grType = 'FULL'; // assume full until proven otherwise
            const matchSummary = poItems.map((poi, i) => {
                const challanLine = challanLines[i] || {};
                const poQty       = parseFloat(poi.quantity) || 0;
                const rcvQty      = challanLine.quantity     || 0;
                const diff        = rcvQty - poQty;
                const gapAmt      = diff * (parseFloat(poi.rate) || 0);

                let lineStatus = 'OK';
                if (diff < 0)      { lineStatus = 'SHORT';  grType = 'PARTIAL'; }
                else if (diff > 0) { lineStatus = 'EXCESS'; grType = 'EXCESS';  }

                return {
                    material_ID  : poi.material_ID,
                    description  : challanLine.description || poi.material_ID,
                    poQty, rcvQty, diff, gapAmt,
                    uom          : poi.uom,
                    rate         : poi.rate,
                    lineStatus
                };
            });

            // ── 5. Create GR header ────────────────────────────────────
            const grnNumber = `GRN-${Date.now()}`;
            const gr = await INSERT.into(GoodsReceipt).entries({
                grnNumber,
                po_ID       : po.ID,
                vendor_ID   : po.vendor_ID,
                receiptDate : challanDate || new Date().toISOString().split('T')[0],
                status      : grType === 'FULL' ? 'Posted' : 'Partial'
            });

            // ── 6. Create GR line items (only received qty) ────────────
            const grItemsToInsert = matchSummary.map(m => ({
                grn_ID      : gr.ID,
                material_ID : m.material_ID,
                quantity    : m.rcvQty,
                uom         : m.uom
            }));
            await INSERT.into(GRItems).entries(grItemsToInsert);

            // ── 7. Update PO status ────────────────────────────────────
            await UPDATE(PurchaseOrders)
                .set({ status: grType === 'FULL' ? 'GRDone' : 'PartialGR' })
                .where({ ID: po.ID });

            return {
                grId         : gr.ID,
                grnNumber,
                poNumber     : challanPO,
                vendorName   : vendorName || '',
                status       : grType,
                matchSummary : JSON.stringify(matchSummary)
            };
        });

        return super.init();
    }

    async _getToken() {
        const res = await fetch(
            `${process.env.DOX_UAA_URL}/oauth/token?grant_type=client_credentials`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.DOX_CLIENT_ID}:${process.env.DOX_CLIENT_SECRET}`
                    ).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        const { access_token } = await res.json();
        return access_token;
    }

    async _callDOX(fileContent, fileName, token) {
        const form = new FormData();
        form.append('file', Buffer.from(fileContent, 'base64'), { filename: fileName });
        form.append('options', JSON.stringify({
            clientId     : 'default',
            documentType : 'deliveryNote',          // DOX type for challan
            extraction   : {
                headerFields  : ['documentNumber','documentDate','senderName',
                                 'purchaseOrderNumber'],
                lineItemFields: ['description','quantity','unitPrice','amount']
            }
        }));

        const submit = await fetch(`${process.env.DOX_API_URL}/document/jobs`, {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${token}`, ...form.getHeaders() },
            body   : form
        });
        const { id } = await submit.json();

        // Poll
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const r   = await fetch(`${process.env.DOX_API_URL}/document/jobs/${id}`,
                { headers: { 'Authorization': `Bearer ${token}` } });
            const job = await r.json();
            if (job.status === 'DONE')   return job;
            if (job.status === 'FAILED') throw new Error('DOX extraction failed');
        }
        throw new Error('Polling timeout');
    }
};