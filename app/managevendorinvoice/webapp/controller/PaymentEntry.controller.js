sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (Controller, MessageToast, MessageBox) => {
    "use strict";

    // ADDED: new controller for payment entry form
    return Controller.extend("com.erp.vie.managevendorinvoice.controller.PaymentEntry", {

        onInit() {
            // ADDED: attach route matched so view refreshes on every navigation
            this.getOwnerComponent()
                .getRouter()
                .getRoute("RoutePaymentEntry") // CHANGED: matches route name in manifest
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(oEvent) {
            // ADDED: hook for future OData read by invoiceId
            const sInvoiceId = oEvent.getParameter("arguments").invoiceId;
            console.log("PaymentEntry opened for:", sInvoiceId);
        },

        // ADDED: back button
        onNavBack() {
            this.getOwnerComponent().getRouter().navTo("RouteVendorPaymentList");
        },

        // ADDED: toggle cheque fields when mode changes
        onPaymentModeChange(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            this.getOwnerComponent()
                .getModel("vendorPayment")
                .setProperty("/paymentForm/isCheque", sKey === "Cheque");
        },

        // ADDED: live breakdown recalculation as amount changes
        onAmountChange(oEvent) {
            const oModel = this.getOwnerComponent().getModel("vendorPayment");
            const nTotal = oModel.getProperty("/selectedInvoice/netPayableRaw") || 0;
            const nPaying = parseFloat(oEvent.getParameter("value")) || 0;
            const nBalance = Math.max(0, nTotal - nPaying);
            oModel.setProperty("/paymentForm/payingNow", "₹" + nPaying.toLocaleString("en-IN"));
            oModel.setProperty("/paymentForm/balanceAfter", "₹" + nBalance.toLocaleString("en-IN"));
        },

        // ADDED: cancel with confirmation dialog
        onCancel() {
            MessageBox.confirm("Discard this payment entry?", {
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        this.getOwnerComponent().getRouter().navTo("RouteVendorPaymentList");
                    }
                }
            });
        },

        // ADDED: save draft (stub for PATCH /VendorPayments draft)
        onSaveDraft() {
            MessageToast.show("Draft saved successfully");
        },

        // ADDED: validate + confirm + submit
        onSubmitPayment() {
            if (!this._validateForm()) return;

            const oModel = this.getOwnerComponent().getModel("vendorPayment");
            const oInvoice = oModel.getProperty("/selectedInvoice");
            const sMode = this.byId("paymentMode").getSelectedKey();
            const sAmount = this.byId("paymentAmount").getValue();

            MessageBox.confirm(
                `Submit payment of ₹${parseInt(sAmount).toLocaleString("en-IN")} for ${oInvoice.invoiceId} via ${sMode}?`,
                {
                    title: "Confirm payment",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            // ADDED: stub — replace with OData POST in real app
                            MessageToast.show("Payment submitted. Voucher & TDS certificate will be generated.");
                            this.getOwnerComponent().getRouter().navTo("RouteVendorPaymentList");
                        }
                    }
                }
            );
        },

        // ADDED: required-field validation, sets ValueState on each control
        _validateForm() {
            const aRequired = [
                { control: this.byId("paymentMode"),   label: "Payment mode",   getValue: (c) => c.getSelectedKey() },
                { control: this.byId("paymentDate"),   label: "Payment date",   getValue: (c) => c.getValue() },
                { control: this.byId("paymentAmount"), label: "Amount to pay",  getValue: (c) => c.getValue() }
            ];
            let bValid = true;
            aRequired.forEach(({ control, label, getValue }) => {
                if (!getValue(control)) {
                    control.setValueState("Error");
                    control.setValueStateText(`${label} is required`);
                    bValid = false;
                } else {
                    control.setValueState("None");
                }
            });
            if (!bValid) MessageToast.show("Please fill all required fields.");
            return bValid;
        }

    });
});