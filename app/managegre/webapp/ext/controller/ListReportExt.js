sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Fragment) {
    "use strict";

    var oImportDialog;
    var oHostView;
    var sPdfBase64;
    var sFileName;

    function createInitialState() {
        return {
            fileName: "",
            fileIcon: "sap-icon://pdf-attachment",
            fileSize: "",
            uploadDone: false,
            canExtract: false,
            extracting: false,
            extractDone: false,
            previewApproved: false,
            creatingGR: false,
            grNumber: "",
            statusMessage: "",
            statusState: "Information",
            challanID: "",
            challanNumber: "",
            challanDate: "",
            vendorName: "",
            purchaseOrderNo: "",
            vehicleNumber: "",
            driverName: "",
            deliveryAddress: "",
            totalQuantity: "",
            confidenceDisplay: "",
            confidenceState: "None",
            lineItems: []
        };
    }

    var Extension = {
        onImportChallan: function () {
            var oView = this.routing ? this.routing.getView() : this.getView();
            oHostView = oView;

            if (!oView.getModel("challan")) {
                oView.setModel(new JSONModel(createInitialState()), "challan");
            } else {
                Extension._resetDialogState(oView);
            }

            if (!oImportDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.erp.gr.managegre.ext.fragment.ImportChallanDialog",
                    controller: Extension
                }).then(function (oDialog) {
                    oImportDialog = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.setModel(oView.getModel("challan"), "challan");
                    oDialog.open();
                }).catch(function (oError) {
                    MessageBox.error("Failed to load Import Delivery Challan dialog: " + oError.message);
                });
                return;
            }

            oImportDialog.setModel(oView.getModel("challan"), "challan");
            oImportDialog.open();
        },

        onFileChange: function (oEvent) {
            var oView = this._getHostView();
            var oModel = oView.getModel("challan");
            var oFileUploader = oEvent.getSource();
            var aFiles = oEvent.getParameter("files");
            var oFile = aFiles && aFiles[0];

            if (!oFile && oFileUploader.getFocusDomRef && oFileUploader.getFocusDomRef()) {
                oFile = oFileUploader.getFocusDomRef().files && oFileUploader.getFocusDomRef().files[0];
            }

            if (!oFile) {
                this._setStatus(oModel, "No file selected.", "Warning");
                return;
            }

            if (oFile.type && oFile.type !== "application/pdf") {
                this._setStatus(oModel, "Please select a PDF delivery challan.", "Error");
                return;
            }

            var oReader = new FileReader();
            oModel.setProperty("/statusMessage", "Reading selected PDF...");
            oModel.setProperty("/statusState", "Information");
            oModel.setProperty("/canExtract", false);

            oReader.onload = function (oLoadEvent) {
                var sDataUrl = oLoadEvent.target.result || "";
                sPdfBase64 = sDataUrl.split(",")[1] || sDataUrl;
                sFileName = oFile.name;

                oModel.setProperty("/fileName", oFile.name);
                oModel.setProperty("/fileSize", (oFile.size / 1024 / 1024).toFixed(2) + " MB");
                oModel.setProperty("/uploadDone", true);
                oModel.setProperty("/canExtract", !!sPdfBase64);
                oModel.setProperty("/extractDone", false);
                oModel.setProperty("/previewApproved", false);
                oModel.setProperty("/grNumber", "");
                oModel.setProperty("/statusMessage", "PDF ready. Click Extract to read challan data.");
                oModel.setProperty("/statusState", "Success");
            };

            oReader.onerror = function () {
                sPdfBase64 = null;
                sFileName = null;
                oModel.setProperty("/uploadDone", false);
                oModel.setProperty("/canExtract", false);
                oModel.setProperty("/statusMessage", "Could not read the selected file.");
                oModel.setProperty("/statusState", "Error");
            };

            oReader.readAsDataURL(oFile);
        },

onExtract: function (oEvent) {
    var oView = this._getHostView();
    var oDialogModel = oView.getModel("challan");
    var oODataModel = oEvent.getSource().getModel();

    if (!sPdfBase64) {
        MessageToast.show("Please select a PDF first.");
        return;
    }

    var sChallanID = this._uuid();
    oDialogModel.setProperty("/challanID", sChallanID);
    oDialogModel.setProperty("/extracting", true);
    oDialogModel.setProperty("/canExtract", false);
    oDialogModel.setProperty("/extractDone", false);
    oDialogModel.setProperty("/previewApproved", false);
    oDialogModel.setProperty("/statusMessage", "Uploading PDF to CAP database service...");
    oDialogModel.setProperty("/statusState", "Information");

    // 1. Create upload context with an isolated, immediate update group ($direct)
    var oUploadContext = oODataModel.bindContext("/uploadChallanPDF(...)", null, {
        $$updateGroupId: "$direct" 
    });
    oUploadContext.setParameter("challanID", sChallanID);
    oUploadContext.setParameter("pdfBase64", sPdfBase64);
    oUploadContext.setParameter("fileName", sFileName);

    // STEP 1: Execute and finish PDF Upload completely
    oUploadContext.execute().then(function () {
        var oUploadRes = oUploadContext.getBoundContext().getObject();
        if (oUploadRes && oUploadRes.value && oUploadRes.value.success === false) {
            throw new Error(oUploadRes.value.message || "PDF upload failed");
        }

        oDialogModel.setProperty("/statusMessage", "Extracting challan data using BTP Document Information Extraction...");
        
        // STEP 2: Now bind and run extraction (uses regular batch/auto group safely)
        var oExtractContext = oODataModel.bindContext("/extractChallanData(...)");
        oExtractContext.setParameter("challanID", sChallanID);
        
        return oExtractContext.execute().then(function () {
            return oExtractContext.getBoundContext().getObject();
        });
    }).then(function (oExtractRes) {
        if (oExtractRes && oExtractRes.value && oExtractRes.value.success === false) {
            throw new Error(oExtractRes.value.message || "AI extraction failed");
        }

        oDialogModel.setProperty("/statusMessage", "Loading extraction preview...");
        return Extension._readChallanPreview(oODataModel, sChallanID);
    }).then(function (oData) {
        Extension._applyPreview(oDialogModel, oData);
    }).catch(function (oError) {
        oDialogModel.setProperty("/extracting", false);
        oDialogModel.setProperty("/canExtract", true);
        oDialogModel.setProperty("/statusMessage", "Extraction failed: " + (oError.message || oError));
        oDialogModel.setProperty("/statusState", "Error");
    });
},
        onPreviewApprovalChange: function (oEvent) {
            var oView = this._getHostView();
            oView.getModel("challan").setProperty("/previewApproved", oEvent.getParameter("selected"));
        },

        onCreateGR: function (oEvent) {
            var oView = this._getHostView();
            var oDialogModel = oView.getModel("challan");
            var sChallanID = oDialogModel.getProperty("/challanID");

            if (!sChallanID) {
                MessageToast.show("Extract challan data first.");
                return;
            }
            if (!oDialogModel.getProperty("/previewApproved")) {
                MessageToast.show("Review and approve the preview before creating GR.");
                return;
            }

            MessageBox.confirm("Create Goods Receipt from the approved preview?", {
                title: "Create Goods Receipt",
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

                    oDialogModel.setProperty("/creatingGR", true);
                    oDialogModel.setProperty("/statusMessage", "Creating Goods Receipt...");
                    oDialogModel.setProperty("/statusState", "Information");

                    var oGRContext = oEvent.getSource().getModel().bindContext("/createGoodsReceipt(...)");
                    oGRContext.setParameter("challanID", sChallanID);

                    oGRContext.execute().then(function () {
                        oDialogModel.setProperty("/creatingGR", false);
                        var oResult = oGRContext.getBoundContext().getObject();
                        var oValue = oResult ? oResult.value : null;

                        if (oValue && oValue.success) {
                            oDialogModel.setProperty("/grNumber", oValue.grNumber);
                            oDialogModel.setProperty("/statusMessage", oValue.message || "Goods Receipt created.");
                            oDialogModel.setProperty("/statusState", "Success");
                            MessageToast.show("Goods Receipt " + oValue.grNumber + " created.");
                            oEvent.getSource().getModel().refresh();
                            return;
                        }

                        MessageBox.error(oValue ? oValue.message : "Error creating Goods Receipt.");
                    }).catch(function (oError) {
                        oDialogModel.setProperty("/creatingGR", false);
                        oDialogModel.setProperty("/statusMessage", "GR creation failed: " + (oError.message || oError));
                        oDialogModel.setProperty("/statusState", "Error");
                        MessageBox.error("GR creation failed: " + (oError.message || oError));
                    });
                }
            });
        },

        onCloseDialog: function (oEvent) {
            var oDialog = oEvent && oEvent.getSource();

            while (oDialog && oDialog.getMetadata && oDialog.getMetadata().getName() !== "sap.m.Dialog") {
                oDialog = oDialog.getParent();
            }

            if (!oDialog && oImportDialog) {
                oDialog = oImportDialog;
            }

            if (oDialog) {
                oDialog.close();
            }
        },

        _resetDialogState: function (oView) {
            sPdfBase64 = null;
            sFileName = null;
            oView.getModel("challan").setData(createInitialState());
        },

        _getHostView: function () {
            if (oHostView) {
                return oHostView;
            }
            throw new Error("Import dialog host view is not available.");
        },

        _readChallanPreview: function (oModel, sChallanID) {
            var oList = oModel.bindList("/DeliveryChallans", null, null, [
                new Filter("challanID", FilterOperator.EQ, sChallanID)
            ], {
                $expand: "items"
            });

            return oList.requestContexts(0, 1).then(function (aContexts) {
                if (!aContexts.length) {
                    throw new Error("Extracted challan was not found.");
                }
                return aContexts[0].requestObject();
            });
        },

        _applyPreview: function (oDialogModel, oData) {
            var aItems = oData.items || [];
            var nConfidence = aItems.length
                ? aItems.reduce(function (nSum, oItem) {
                    return nSum + Number(oItem.extractionConfidence || 0);
                }, 0) / aItems.length
                : 0;

            var aPreviewItems = aItems.map(function (oItem) {
                return Object.assign({}, oItem, {
                    itemStatus: Number(oItem.deliveredQuantity || 0) > 0 ? "Ready" : "Needs review",
                    itemState: Number(oItem.deliveredQuantity || 0) > 0 ? "Success" : "Warning"
                });
            });

            oDialogModel.setData(Object.assign({}, oDialogModel.getData(), {
                extracting: false,
                canExtract: false,
                extractDone: true,
                previewApproved: false,
                challanNumber: oData.challanNumber || "",
                challanDate: oData.challanDate || "",
                vendorName: oData.vendorName || "",
                purchaseOrderNo: oData.purchaseOrderNo || "",
                vehicleNumber: oData.vehicleNumber || "",
                driverName: oData.driverName || "",
                deliveryAddress: oData.deliveryAddress || "",
                totalQuantity: String(oData.totalQuantity || ""),
                confidenceDisplay: Math.round(nConfidence) + "%",
                confidenceState: nConfidence >= 80 ? "Success" : nConfidence >= 50 ? "Warning" : "Error",
                statusMessage: "Preview ready. Review the extracted data, then approve it to create GR.",
                statusState: "Success",
                lineItems: aPreviewItems
            }));
        },

        _setStatus: function (oModel, sMessage, sState) {
            oModel.setProperty("/statusMessage", sMessage);
            oModel.setProperty("/statusState", sState);
            oModel.setProperty("/canExtract", false);
        },

        _uuid: function () {
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            }
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0;
                var v = c === "x" ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    };

    return Extension;
});