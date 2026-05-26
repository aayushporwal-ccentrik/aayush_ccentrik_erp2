sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'com.erp.pr.managepr',
            componentId: 'RequisitionsList',
            contextPath: '/Requisitions'
        },
        CustomPageDefinitions
    );
});