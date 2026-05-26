sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/erp/vie/managevendorinvoice/model/models", // CHANGED: correct namespace path
    "sap/ui/model/json/JSONModel"                   // ADDED: for vendorPayment model
], (UIComponent, models, JSONModel) => {
    "use strict";

    return UIComponent.extend("com.erp.vie.managevendorinvoice.Component", { // CHANGED: correct namespace
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");

            // ADDED: seed vendorPayment JSON model with mock data
            var oVendorPaymentModel = new JSONModel({
                metrics: {
                    totalOutstanding: "₹18.4L",
                    totalOutstandingCount: 12,
                    overdue: "₹4.2L",
                    overdueCount: 3,
                    paidThisMonth: "₹9.1L",
                    paidThisMonthCount: 7,
                    pendingApproval: "₹5.1L",
                    pendingApprovalCount: 4
                },
                invoices: [
                    {
                        invoiceId: "INV-2024-0041",
                        vendor: "Ramco Cements Ltd",
                        poRef: "PO-1120",
                        grnRef: "GRN-0881",
                        invoiceDate: "10 May 2025",
                        dueDate: "25 May 2025",
                        grossAmount: "₹2,40,000",
                        tds: "₹4,800",
                        cgst: "₹21,600",
                        sgst: "₹21,600",
                        gst: "₹43,200",
                        netPayable: "₹1,92,000",
                        netPayableRaw: 192000,
                        status: "Overdue",
                        statusState: "Error",
                        action: "Pay now"
                    },
                    {
                        invoiceId: "INV-2024-0038",
                        vendor: "ACC Ltd",
                        poRef: "PO-1118",
                        grnRef: "GRN-0892",
                        invoiceDate: "12 May 2025",
                        dueDate: "27 May 2025",
                        grossAmount: "₹1,80,000",
                        tds: "₹3,600",
                        cgst: "₹16,200",
                        sgst: "₹16,200",
                        gst: "₹32,400",
                        netPayable: "₹1,44,000",
                        netPayableRaw: 144000,
                        status: "Approved",
                        statusState: "Success",
                        action: "Pay now"
                    },
                    {
                        invoiceId: "INV-2024-0035",
                        vendor: "Ultratech Logistics",
                        poRef: "PO-1112",
                        grnRef: "GRN-0874",
                        invoiceDate: "05 May 2025",
                        dueDate: "20 May 2025",
                        grossAmount: "₹95,000",
                        tds: "₹1,900",
                        cgst: "₹8,550",
                        sgst: "₹8,550",
                        gst: "₹17,100",
                        netPayable: "₹76,000",
                        netPayableRaw: 76000,
                        status: "Pending",
                        statusState: "Warning",
                        action: "Approve"
                    },
                    {
                        invoiceId: "INV-2024-0031",
                        vendor: "Bharat Electricals",
                        poRef: "PO-1104",
                        grnRef: "GRN-0861",
                        invoiceDate: "01 May 2025",
                        dueDate: "16 May 2025",
                        grossAmount: "₹3,10,000",
                        tds: "₹6,200",
                        cgst: "₹27,900",
                        sgst: "₹27,900",
                        gst: "₹55,800",
                        netPayable: "₹2,48,000",
                        netPayableRaw: 248000,
                        status: "Partial",
                        statusState: "Warning",
                        action: "Pay balance"
                    },
                    {
                        invoiceId: "INV-2024-0028",
                        vendor: "Shree Polymers",
                        poRef: "PO-1098",
                        grnRef: "GRN-0849",
                        invoiceDate: "28 Apr 2025",
                        dueDate: "13 May 2025",
                        grossAmount: "₹72,000",
                        tds: "₹1,440",
                        cgst: "₹6,480",
                        sgst: "₹6,480",
                        gst: "₹12,960",
                        netPayable: "₹57,600",
                        netPayableRaw: 57600,
                        status: "Paid",
                        statusState: "Success",
                        action: "View"
                    }
                ],
                selectedInvoice: {},  // ADDED: handoff slot for PaymentEntry view
                paymentForm: {
                    isCheque: false,
                    payingNow: "₹0",
                    balanceAfter: "₹0"
                }
            });
            this.setModel(oVendorPaymentModel, "vendorPayment");

            this.getRouter().initialize();
        }
    });
});