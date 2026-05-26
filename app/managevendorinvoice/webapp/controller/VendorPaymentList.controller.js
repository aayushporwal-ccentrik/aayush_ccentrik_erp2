sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], (Controller, Filter, FilterOperator, MessageToast) => {
    "use strict";

    return Controller.extend("com.erp.vie.managevendorinvoice.controller.VendorPaymentList", { // CHANGED: correct namespace

        onInit() {
            // ADDED: route handler not needed here; model is set on Component
        },

        // ADDED: live search across vendor name and invoice ID
        onSearch(oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
            const aFilters = sQuery ? [new Filter({
                filters: [
                    new Filter("vendor", FilterOperator.Contains, sQuery),
                    new Filter("invoiceId", FilterOperator.Contains, sQuery)
                ],
                and: false
            })] : [];
            this._applyFilters(aFilters);
        },

        // ADDED: status dropdown filter
        onStatusFilterChange(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            this._applyFilters(sKey ? [new Filter("status", FilterOperator.EQ, sKey)] : []);
        },

        // ADDED: vendor dropdown filter
        onVendorFilterChange(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            this._applyFilters(sKey ? [new Filter("vendor", FilterOperator.EQ, sKey)] : []);
        },

        // ADDED: shared helper — applies filters to the table items binding
        _applyFilters(aFilters) {
            this.byId("invoiceTable").getBinding("items").filter(aFilters);
        },

        // ADDED: KPI tile press pre-filters the table by status
        onFilterStatus(sStatus) {
            this.byId("statusFilter").setSelectedKey(sStatus);
            this._applyFilters(sStatus ? [new Filter("status", FilterOperator.EQ, sStatus)] : []);
        },

        // ADDED: row press navigation
        onInvoicePress(oEvent) {
            this._navigateToEntry(oEvent.getSource().getBindingContext("vendorPayment"));
        },

        // ADDED: action button (Pay now / Approve / View) inside each row
        onActionPress(oEvent) {
            this._navigateToEntry(oEvent.getSource().getBindingContext("vendorPayment"));
        },

        // ADDED: table selection change
        onInvoiceSelect(oEvent) {
            this._navigateToEntry(oEvent.getParameter("listItem").getBindingContext("vendorPayment"));
        },

        // ADDED: write selectedInvoice + reset paymentForm, then route
        _navigateToEntry(oCtx) {
            const oModel = this.getOwnerComponent().getModel("vendorPayment");
            const oInvoice = oCtx.getObject();
            oModel.setProperty("/selectedInvoice", oInvoice);
            oModel.setProperty("/paymentForm", {
                isCheque: false,
                payingNow: oInvoice.netPayable,
                balanceAfter: "₹0"
            });
            this.getOwnerComponent().getRouter().navTo("RoutePaymentEntry", { // CHANGED: matches route name in manifest
                invoiceId: oInvoice.invoiceId
            });
        },

        // ADDED: placeholder for new payment creation
        onNewPayment() {
            MessageToast.show("New payment flow — coming soon");
        }

    });
});