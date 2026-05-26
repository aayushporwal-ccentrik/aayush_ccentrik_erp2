using ProcurementService as service from '../../srv/procurement-service';
annotate service.Requisitions with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'prNumber',
                Value : prNumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'requestDate',
                Value : requestDate,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'prNumber',
            Value : prNumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'requestDate',
            Value : requestDate,
        },
        {
            $Type : 'UI.DataField',
            Label : 'status',
            Value : status,
        },
    ],
);

