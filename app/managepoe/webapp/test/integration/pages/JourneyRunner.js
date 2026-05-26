sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/erp/po/managepoe/test/integration/pages/PurchaseOrdersList",
	"com/erp/po/managepoe/test/integration/pages/PurchaseOrdersObjectPage",
	"com/erp/po/managepoe/test/integration/pages/POItemsObjectPage"
], function (JourneyRunner, PurchaseOrdersList, PurchaseOrdersObjectPage, POItemsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/erp/po/managepoe') + '/test/flp.html#app-preview',
        pages: {
			onThePurchaseOrdersList: PurchaseOrdersList,
			onThePurchaseOrdersObjectPage: PurchaseOrdersObjectPage,
			onThePOItemsObjectPage: POItemsObjectPage
        },
        async: true
    });

    return runner;
});

