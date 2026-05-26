sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/erp/customers/managecutomerse/test/integration/pages/CustomersList",
	"com/erp/customers/managecutomerse/test/integration/pages/CustomersObjectPage"
], function (JourneyRunner, CustomersList, CustomersObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/erp/customers/managecutomerse') + '/test/flp.html#app-preview',
        pages: {
			onTheCustomersList: CustomersList,
			onTheCustomersObjectPage: CustomersObjectPage
        },
        async: true
    });

    return runner;
});

