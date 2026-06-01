sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, MessageToast, MessageBox, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("com.erp.vie.managevendorinvoice.controller.PaymentEntry", {
        onInit() {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("RoutePaymentEntry")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(oEvent) {
            const sInvoiceId = oEvent.getParameter("arguments").invoiceId;
            const oHandoffModel = this.getOwnerComponent().getModel("vendorPayment");
            const oSelectedInvoice = oHandoffModel.getProperty("/selectedInvoice");

            this._resetFormControls();

            if (!oSelectedInvoice || oSelectedInvoice.ID !== sInvoiceId) {
                this._loadInvoice(sInvoiceId);
                return;
            }

            this._syncPaymentForm(oSelectedInvoice);
        },

        _loadInvoice(sInvoiceId) {
            const oODataModel = this.getOwnerComponent().getModel();
            const oListBinding = oODataModel.bindList("/Invoices", null, null, [
                new Filter("ID", FilterOperator.EQ, sInvoiceId)
            ]);

            oListBinding.requestContexts(0, 1).then((aContexts) => {
                if (!aContexts.length) {
                    MessageBox.error("Invoice was not found.");
                    this.onNavBack();
                    return;
                }

                const oInvoice = aContexts[0].getObject();
                this.getOwnerComponent().getModel("vendorPayment").setProperty("/selectedInvoice", oInvoice);
                this._syncPaymentForm(oInvoice);
            }).catch((oError) => {
                MessageBox.error("Could not load invoice details.");
                console.error("Invoice detail load failed", oError);
            });
        },

        _syncPaymentForm(oInvoice) {
            const oPaymentModel = this.getOwnerComponent().getModel("vendorPayment");
            oPaymentModel.setProperty("/paymentForm", {
                isCheque: false,
                payingNow: oInvoice.netPayable || "Rs. 0",
                balanceAfter: "Rs. 0"
            });

            this.byId("paymentAmount").setValue(oInvoice.netPayableRaw || 0);
        },

        _resetFormControls() {
            this.byId("paymentMode").setSelectedKey("NONE");
            this.byId("paymentDate").setValue("");
            this.byId("remarks").setValue("");
            this.byId("utrRef").setValue("");
        },

        onNavBack() {
            this.getOwnerComponent().getRouter().navTo("RouteVendorPaymentList");
        },

        onPaymentModeChange(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const sKey = oSelectedItem ? oSelectedItem.getKey() : "NONE";

            this.getOwnerComponent()
                .getModel("vendorPayment")
                .setProperty("/paymentForm/isCheque", sKey === "Cheque");
        },

        onAmountChange(oEvent) {
            const oModel = this.getOwnerComponent().getModel("vendorPayment");
            const nTotal = Number(oModel.getProperty("/selectedInvoice/netPayableRaw") || 0);
            const nPaying = Number(oEvent.getParameter("value") || 0);
            const nBalance = Math.max(0, nTotal - nPaying);

            oModel.setProperty("/paymentForm/payingNow", this._formatINR(nPaying));
            oModel.setProperty("/paymentForm/balanceAfter", this._formatINR(nBalance));
        },

        onCancel() {
            MessageBox.confirm("Discard this payment entry?", {
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        this.onNavBack();
                    }
                }
            });
        },

        onSaveDraft() {
            MessageToast.show("Draft saved locally");
        },

        onSubmitPayment() {
            if (!this._validateForm()) return;

            const oInvoice = this.getOwnerComponent().getModel("vendorPayment").getProperty("/selectedInvoice");
            const sMode = this.byId("paymentMode").getSelectedKey();
            const nAmount = Number(this.byId("paymentAmount").getValue());

            MessageBox.confirm(
                `Submit payment of ${this._formatINR(nAmount)} for ${oInvoice.invoiceId} via ${sMode}?`,
                {
                    title: "Confirm payment",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitPayment(oInvoice, sMode, nAmount);
                        }
                    }
                }
            );
        },

        _submitPayment(oInvoice, sMode, nAmount) {
            const oODataModel = this.getOwnerComponent().getModel();
            const oAction = oODataModel.bindContext("/submitVendorPayment(...)");

            oAction.setParameter("po_ID", oInvoice.po_ID || oInvoice.ID);
            oAction.setParameter("vendor_ID", oInvoice.vendor_ID);
            oAction.setParameter("amount", nAmount);
            oAction.setParameter("mode", sMode);
            oAction.setParameter("paymentDate", this._getPaymentDate());
            oAction.setParameter("remarks", this.byId("remarks").getValue());

            this.getView().setBusy(true);
            oAction.execute().then(() => {
                const oResultContext = oAction.getBoundContext();
                const oResult = oResultContext && oResultContext.getProperty("");

                if (oResult && oResult.success === false) {
                    MessageBox.error(oResult.message || "Payment submission failed.");
                    return;
                }

                MessageToast.show(oResult?.message || "Payment submitted successfully");
                oODataModel.refresh();
                this.onNavBack();
            }).catch((oError) => {
                MessageBox.error("Payment submission failed.");
                console.error("Payment submission failed", oError);
            }).finally(() => {
                this.getView().setBusy(false);
            });
        },

        _validateForm() {
            const aRequired = [
                {
                    control: this.byId("paymentMode"),
                    label: "Payment mode",
                    getValue: (c) => c.getSelectedKey() !== "NONE" ? c.getSelectedKey() : ""
                },
                { control: this.byId("paymentDate"), label: "Payment date", getValue: (c) => c.getValue() },
                { control: this.byId("paymentAmount"), label: "Amount to pay", getValue: (c) => Number(c.getValue()) > 0 }
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
        },

        _getPaymentDate() {
            const oDate = this.byId("paymentDate").getDateValue();
            if (!oDate) return this.byId("paymentDate").getValue();

            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sDay = String(oDate.getDate()).padStart(2, "0");
            return `${sYear}-${sMonth}-${sDay}`;
        },

        _formatINR(nValue) {
            return `Rs. ${Math.round(Number(nValue || 0)).toLocaleString("en-IN")}`;
        }
    });
});
