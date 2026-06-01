sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/erp/vie/managevendorinvoice/model/models",
    "sap/ui/model/json/JSONModel"
], (UIComponent, models, JSONModel) => {
    "use strict";

    return UIComponent.extend("com.erp.vie.managevendorinvoice.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.setModel(new JSONModel({
                selectedInvoice: {},
                paymentForm: {
                    isCheque: false,
                    payingNow: "Rs. 0",
                    balanceAfter: "Rs. 0"
                }
            }), "vendorPayment");

            this.getRouter().initialize();
        }
    });
});