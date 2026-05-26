sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/erp/pr/managepr/test/integration/pages/RequisitionsList",
	"com/erp/pr/managepr/test/integration/pages/RequisitionsObjectPage"
], function (JourneyRunner, RequisitionsList, RequisitionsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/erp/pr/managepr') + '/test/flp.html#app-preview',
        pages: {
			onTheRequisitionsList: RequisitionsList,
			onTheRequisitionsObjectPage: RequisitionsObjectPage
        },
        async: true
    });

    return runner;
});

