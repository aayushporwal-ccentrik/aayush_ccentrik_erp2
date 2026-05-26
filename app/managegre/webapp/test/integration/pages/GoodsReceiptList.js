sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'com.erp.gr.managegre',
            componentId: 'GoodsReceiptList',
            contextPath: '/GoodsReceipt'
        },
        CustomPageDefinitions
    );
});