using ProcurementService as service from '../../srv/procurement-service';

// ── GoodsReceipt List + ObjectPage annotations ──────────────────────────────
annotate service.GoodsReceipt with @(

    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            { $Type: 'UI.DataField', Label: 'GRN Number',    Value: grnNumber    },
            { $Type: 'UI.DataField', Label: 'Receipt Date',  Value: receiptDate  },
            { $Type: 'UI.DataField', Label: 'Status',        Value: status       },
            { $Type: 'UI.DataField', Label: 'PO Number',     Value: po.poNumber  },
            { $Type: 'UI.DataField', Label: 'Vendor',        Value: vendor.name  },
        ],
    },

    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GeneratedFacet1',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GRItemsFacet',
            Label  : 'GR Items',
            Target : 'items/@UI.LineItem',
        },
    ],

    // CHANGED: merged into single LineItem — removed duplicate block below
    UI.LineItem : [
        { $Type: 'UI.DataField', Label: 'GRN Number',   Value: grnNumber    },
        { $Type: 'UI.DataField', Label: 'Receipt Date', Value: receiptDate  },
        { $Type: 'UI.DataField', Label: 'Status',       Value: status       },
        { $Type: 'UI.DataField', Label: 'PO Number',    Value: po.poNumber  },
        { $Type: 'UI.DataField', Label: 'Vendor',       Value: vendor.name  },
    ],

    UI.HeaderInfo : {
        TypeName       : 'Goods Receipt',
        TypeNamePlural : 'Goods Receipts',
        Title          : { $Type: 'UI.DataField', Value: grnNumber },
        Description    : { $Type: 'UI.DataField', Value: status    },
    },

    UI.SelectionFields : [ grnNumber, status, receiptDate ],
);

// ── GRItems sub-entity annotations ──────────────────────────────────────────
annotate service.GRItems with @(
    UI.LineItem : [
        { $Type: 'UI.DataField', Label: 'Material Code',  Value: material.materialCode  },
        { $Type: 'UI.DataField', Label: 'Description',    Value: material.description   },
        { $Type: 'UI.DataField', Label: 'Quantity',       Value: quantity               },
        { $Type: 'UI.DataField', Label: 'UoM',            Value: uom                    },
    ],
);

// ── Value help for PO ────────────────────────────────────────────────────────
annotate service.GoodsReceipt with {
    po @Common.ValueList : {
        $Type          : 'Common.ValueListType',
        CollectionPath : 'PurchaseOrders',
        Parameters     : [
            { $Type: 'Common.ValueListParameterInOut',       LocalDataProperty: po_ID,    ValueListProperty: 'ID'        },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'poNumber'   },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'orderDate'  },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'status'     },
        ],
    }
};
// REMOVED: duplicate UI.LineItem + DataFieldForAction block — toolbar button handled in manifest instead