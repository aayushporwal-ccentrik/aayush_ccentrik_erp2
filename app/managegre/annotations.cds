using ProcurementService as srv from '../../srv/procurement-service';

// ─── GR List Report ───────────────────────────────────────────────────────────
annotate srv.GoodsReceipt with @(

    UI.SelectionFields: [ status, receiptDate ],

    UI.LineItem: [
        // ── Columns ──
        { Value: grnNumber,        Label: 'GRN Number'    },
        { Value: po.poNumber,      Label: 'PO Number'     },
        { Value: vendor.vendorName,Label: 'Vendor'        },
        { Value: receiptDate,      Label: 'Receipt Date'  },
        { Value: status,           Label: 'Status'        }
    ],

    UI.HeaderInfo: {
        TypeName      : 'Goods Receipt',
        TypeNamePlural: 'Goods Receipts',
        Title        : { Value: grnNumber },
        Description  : { Value: po.poNumber }
    }
);

// ─── GR Object Page ───────────────────────────────────────────────────────────
annotate srv.GoodsReceipt with @(
    UI.FieldGroup #Header: {
        Label: 'Header Details',
        Data : [
            { Value: grnNumber,         Label: 'GRN Number'   },
            { Value: po.poNumber,       Label: 'PO Number'    },
            { Value: vendor.vendorName, Label: 'Vendor'       },
            { Value: receiptDate,       Label: 'Receipt Date' },
            { Value: status,            Label: 'Status'       }
        ]
    },
    UI.Facets: [
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Header Details',
            Target: '@UI.FieldGroup#Header'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Line Items',
            Target: 'items/@UI.LineItem'
        }
    ]
);

// ─── GR Items (shown in object page facet) ────────────────────────────────────
annotate srv.GRItems with @(
    UI.LineItem: [
        { Value: material.materialName, Label: 'Material'  },
        { Value: quantity,              Label: 'Quantity'  },
        { Value: uom,                   Label: 'UOM'       }
    ]
);

// ─── Status value help colors ─────────────────────────────────────────────────
annotate srv.GoodsReceipt with {
    status @(
        UI.ValueCellCriticality: {
            $EnumMember: 'UI.CriticalityType/Positive'
        },
        Common.ValueList: {
            CollectionPath: 'GoodsReceipt',
            Parameters: [{ 
                $Type            : 'Common.ValueListParameterOut',
                LocalDataProperty: status,
                ValueListProperty: 'status'
            }]
        }
    )
};