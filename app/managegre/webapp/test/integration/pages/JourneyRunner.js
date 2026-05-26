sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/erp/gr/managegre/test/integration/pages/GoodsReceiptList",
	"com/erp/gr/managegre/test/integration/pages/GoodsReceiptObjectPage",
	"com/erp/gr/managegre/test/integration/pages/GRItemsObjectPage"
], function (JourneyRunner, GoodsReceiptList, GoodsReceiptObjectPage, GRItemsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/erp/gr/managegre') + '/test/flp.html#app-preview',
        pages: {
			onTheGoodsReceiptList: GoodsReceiptList,
			onTheGoodsReceiptObjectPage: GoodsReceiptObjectPage,
			onTheGRItemsObjectPage: GRItemsObjectPage
        },
        async: true
    });

    return runner;
});

