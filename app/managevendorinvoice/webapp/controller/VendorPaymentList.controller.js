sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, Filter, FilterOperator, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("com.erp.vie.managevendorinvoice.controller.VendorPaymentList", {
        onInit: function () {
            this.getView().setModel(new JSONModel({
                totalOutstanding: "Rs. 0.0L",
                totalOutstandingCount: 0,
                overdue: "Rs. 0.0L",
                overdueCount: 0,
                paidThisMonth: "Rs. 0.0L",
                paidThisMonthCount: 0,
                pendingApproval: "Rs. 0.0L",
                pendingApprovalCount: 0
            }), "kpiModel");

            this._sSearchQuery = "";
            this._sStatusKey = "";
            this._sVendorKey = "";

            this.getOwnerComponent().getRouter()
                .getRoute("RouteVendorPaymentList")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._loadMetrics();

            var oTableBinding = this.byId("invoiceTable").getBinding("items");
            if (oTableBinding) {
                oTableBinding.refresh();
            }
        },

        _loadMetrics: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oKPIModel = this.getView().getModel("kpiModel");
            var oMetricsContext = oModel.bindContext("/getPaymentMetrics(...)");

            oMetricsContext.execute().then(function () {
                var oBoundContext = oMetricsContext.getBoundContext();
                if (oBoundContext) {
                    return oBoundContext.requestObject().then(function (oData) {
                        if (oData) {
                            oKPIModel.setData(oData);
                        }
                    });
                }
            }).catch(function (oError) {
                MessageToast.show("Could not load payment metrics");
                console.error("Payment metric load failed", oError);
            });
        },

        onSearch: function (oEvent) {
            this._sSearchQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            this._applyCombinedFilters();
        },

        onStatusFilterChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            this._sStatusKey = oSelectedItem ? oSelectedItem.getKey() : "";
            this._applyCombinedFilters();
        },

        onVendorFilterChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            this._sVendorKey = oSelectedItem ? oSelectedItem.getKey() : "";
            this._applyCombinedFilters();
        },

        onFilterStatus: function (sStatus) {
            this._sStatusKey = sStatus || "";

            var oStatusSelect = this.byId("statusFilter");
            if (oStatusSelect) {
                oStatusSelect.setSelectedKey(this._sStatusKey);
            }

            this._applyCombinedFilters();
        },

        _applyCombinedFilters: function () {
            var aCombinedFilters = [];

            if (this._sSearchQuery && this._sSearchQuery.trim()) {
                aCombinedFilters.push(new Filter({
                    filters: [
                        new Filter("vendor", FilterOperator.Contains, this._sSearchQuery),
                        new Filter("invoiceId", FilterOperator.Contains, this._sSearchQuery)
                    ],
                    and: false
                }));
            }

            if (this._sStatusKey && this._sStatusKey.trim()) {
                aCombinedFilters.push(new Filter("status", FilterOperator.EQ, this._sStatusKey));
            }

            if (this._sVendorKey && this._sVendorKey.trim()) {
                aCombinedFilters.push(new Filter("vendor", FilterOperator.EQ, this._sVendorKey));
            }

            var oBinding = this.byId("invoiceTable").getBinding("items");
            if (oBinding) {
                oBinding.filter(aCombinedFilters.length ? new Filter({
                    filters: aCombinedFilters,
                    and: true
                }) : []);
            }
        },

        onInvoicePress: function (oEvent) {
            this._navigateToEntry(oEvent.getSource().getBindingContext());
        },

        onActionPress: function (oEvent) {
            this._navigateToEntry(oEvent.getSource().getBindingContext());
        },

        onInvoiceSelect: function (oEvent) {
            var oListItem = oEvent.getParameter("listItem");
            if (oListItem) {
                this._navigateToEntry(oListItem.getBindingContext());
            }
        },

        _navigateToEntry: function (oCtx) {
            if (!oCtx) {
                MessageToast.show("Invoice data is still loading");
                return;
            }

            var oInvoice = oCtx.getObject();
            var oVendorPaymentModel = this.getOwnerComponent().getModel("vendorPayment");

            oVendorPaymentModel.setProperty("/selectedInvoice", oInvoice);
            oVendorPaymentModel.setProperty("/paymentForm", {
                isCheque: false,
                payingNow: oInvoice.netPayable,
                balanceAfter: "Rs. 0"
            });

            this.getOwnerComponent().getRouter().navTo("RoutePaymentEntry", {
                invoiceId: oInvoice.ID
            });
        },

        onNewPayment: function () {
            MessageToast.show("Select an invoice to create a payment");
        }
    });
});
