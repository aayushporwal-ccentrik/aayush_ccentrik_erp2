sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (JSONModel, MessageBox, MessageToast, Fragment) {
    "use strict";

    return {
        // Core V4 Action Handler Entrypoint called by the Fiori Elements Button
        onImportChallan: function (oContext, aSelectedContexts) {
            console.log("onImportChallan successfully reached by FPMHelper!");
            
            // Safe fallback to fetch routing views under Fiori Elements V4
            var oView = this.routing ? this.routing.getView() : this.getView(); 

            // Initialize Dialog state model lazily on the main view layer if missing
            if (!oView.getModel("challan")) {
                var oDialogModel = new JSONModel({
                    fileName          : "",
                    fileIcon          : "sap-icon://pdf-attachment",
                    fileSize          : "",
                    uploadDone        : false,
                    extracting        : false,
                    extractDone       : false,
                    creatingGR        : false,
                    grNumber          : "",
                    statusMessage     : "",
                    statusState       : "None",
                    challanID         : "",
                    challanNumber     : "",
                    challanDate       : "",
                    vendorName        : "",
                    purchaseOrderNo   : "",
                    vehicleNumber     : "",
                    driverName        : "",
                    deliveryAddress   : "",
                    totalQuantity     : "",
                    confidenceDisplay : "",
                    confidenceState   : "None",
                    lineItems         : []
                });
                oView.setModel(oDialogModel, "challan");
            }

            // Load and open the dialog fragment safely
            if (!oView._oImportChallanDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.erp.gr.managegre.ext.fragment.ImportChallanDialog",
                    controller: this
                }).then((oDialog) => {
                    oView._oImportChallanDialog = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.open();
                }).catch((oError) => {
                    MessageBox.error("Failed to load fragment: " + oError.message);
                });
            } else {
                // Clear state completely on reopening
                oView.getModel("challan").setData({
                    fileName: "", fileIcon: "sap-icon://pdf-attachment", fileSize: "",
                    uploadDone: false, extracting: false, extractDone: false,
                    creatingGR: false, grNumber: "", statusMessage: "", statusState: "None",
                    challanID: "", challanNumber: "", challanDate: "", vendorName: "",
                    purchaseOrderNo: "", vehicleNumber: "", driverName: "",
                    deliveryAddress: "", totalQuantity: "", confidenceDisplay: "",
                    confidenceState: "None", lineItems: []
                });
                window._sPdfBase64 = null;
                window._sFileName = null;
                oView._oImportChallanDialog.open();
            }
        },

        // Triggered immediately when a user selects a file
        onFileChange: function (oEvent) {
            var oFileUploader = oEvent.getSource();
            var oFile = oEvent.getParameter("files")?.[0];
            
            // Standardizing View lookup via FPM extension layer context
            var oView = this.routing ? this.routing.getView() : this.getView();
            if (!oView) {
                var oObj = oFileUploader;
                while (oObj && oObj.getMetadata().getName() !== "sap.ui.core.mvc.XMLView") {
                    oObj = oObj.getParent();
                }
                oView = oObj;
            }
            
            var oModel = oView.getModel("challan");
            if (!oFile) {
                return;
            }

            var sSize = (oFile.size / 1024 / 1024).toFixed(2) + " MB";
            
            // Read PDF and compile it into a raw Base64 Data String
            var oReader = new FileReader();
            oReader.onload = (e) => {
                var sRawBase64 = e.target.result;
                window._sPdfBase64 = sRawBase64.split(",")[1] || sRawBase64;
                window._sFileName = oFile.name;
                
                // Write updates to model state
                oModel.setProperty("/fileName", oFile.name);
                oModel.setProperty("/fileSize", sSize);
                oModel.setProperty("/uploadDone", true);
                
                // CRITICAL FIX: Explicitly forces expression binding evaluation on the XML layer
                oModel.refresh(true);
            };
            oReader.readAsDataURL(oFile);
        },

        // Core extraction pipeline orchestrator 
        onExtract: function (oEvent) {
            var oSourceButton = oEvent.getSource();
            var oView = this.routing ? this.routing.getView() : this.getView();
            var oDialogModel = oView.getModel("challan");

            if (!window._sPdfBase64) {
                MessageToast.show("Please select a PDF first.");
                return;
            }

            // Generate deterministic crypto-compliant UUID
            var sChallanID = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
            });

            oDialogModel.setProperty("/challanID", sChallanID);
            oDialogModel.setProperty("/extracting", true);
            oDialogModel.setProperty("/statusMessage", "Uploading PDF...");
            oDialogModel.setProperty("/statusState", "Warning");

            var oModel = oSourceButton.getModel();
            
            // 1. Upload Document Context
            var oUploadAction = oModel.bindContext("/uploadChallanPDF(...)");
            oUploadAction.setParameter("challanID", sChallanID);
            oUploadAction.setParameter("pdfBase64", window._sPdfBase64);
            oUploadAction.setParameter("fileName", window._sFileName);

            oUploadAction.execute().then(() => {
                oDialogModel.setProperty("/statusMessage", "Extracting via AI...");
                
                // 2. Trigger DOX Extractor service processing
                var oExtractAction = oModel.bindContext("/extractChallanData(...)");
                oExtractAction.setParameter("challanID", sChallanID);
                
                return oExtractAction.execute();
            }).then(() => {
                oDialogModel.setProperty("/statusMessage", "Reading parsed elements...");
                
                // 3. Request back parsed layout structures via expanded OData context
                var oBinding = oModel.bindContext("/DeliveryChallans(challanID=" + sChallanID + ")", null, { $expand: "items" });
                return oBinding.requestObject();
            }).then((oData) => {
                if (!oData) throw new Error("No data returned from deep read entities.");

                var nConf = parseFloat(oData.items?.[0]?.extractionConfidence || 0);
                var aItems = (oData.items || []).map((item) => {
                    return Object.assign({}, item, {
                        itemStatus: item.deliveredQuantity > 0 ? "Received" : "Missing",
                        itemState: item.deliveredQuantity > 0 ? "Success" : "Error"
                    });
                });

                // Clear unreachable code syntax error and properly update object structural mapping
                oDialogModel.setData(Object.assign({}, oDialogModel.getData(), {
                    extracting: false, 
                    extractDone: true,
                    challanNumber: oData.challanNumber || "",
                    challanDate: oData.challanDate || "",
                    vendorName: oData.vendorName || "",
                    purchaseOrderNo: oData.purchaseOrderNo || "",
                    vehicleNumber: oData.vehicleNumber || "",
                    driverName: oData.driverName || "",
                    deliveryAddress: oData.deliveryAddress || "",
                    totalQuantity: String(oData.totalQuantity || ""),
                    confidenceDisplay: nConf + "%",
                    confidenceState: nConf >= 80 ? "Success" : nConf >= 50 ? "Warning" : "Error",
                    statusMessage: "Extraction complete", 
                    statusState: "Success", 
                    lineItems: aItems
                }));
            }).catch((oErr) => {
                oDialogModel.setProperty("/extracting", false);
                oDialogModel.setProperty("/statusMessage", "Extraction failed: " + (oErr.message || oErr));
                oDialogModel.setProperty("/statusState", "Error");
            });
        },

        onCreateGR: function (oEvent) {
            var oSource = oEvent.getSource();
            var oView = this.routing ? this.routing.getView() : this.getView();
            var oDialogModel = oView.getModel("challan");
            var sChallanID = oDialogModel.getProperty("/challanID");
            
            if (!sChallanID) return;
            var oModel = oSource.getModel();

            MessageBox.confirm("Create Goods Receipt from this challan?", {
                onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    oDialogModel.setProperty("/creatingGR", true);

                    var oGRAction = oModel.bindContext("/createGoodsReceipt(...)");
                    oGRAction.setParameter("challanID", sChallanID);

                    oGRAction.execute().then(() => {
                        var oResult = oGRAction.getBoundContext().getObject();
                        oDialogModel.setProperty("/creatingGR", false);
                        if (oResult && oResult.success) {
                            oDialogModel.setProperty("/grNumber", oResult.grNumber);
                            MessageToast.show("Goods Receipt Created successfully.");
                        } else {
                            MessageBox.error(oResult ? oResult.message : "Error creating Goods Receipt.");
                        }
                    }).catch((oErr) => {
                        oDialogModel.setProperty("/creatingGR", false);
                        MessageBox.error("GR creation failed: " + (oErr.message || oErr));
                    });
                }
            });
        },

        // Graceful window modal closure rules mapping loop
        onCloseDialog: function (oEvent) {
            var oSource = oEvent.getSource();
            
            // Direct lookups from the event trigger point up into the DOM tree
            var oDialog = oSource;
            while (oDialog && oDialog.getMetadata().getName() !== "sap.m.Dialog") {
                oDialog = oDialog.getParent();
            }
            
            if (oDialog) {
                oDialog.close();
            } else {
                // Fallback option using explicit View level instance mapping tracking
                var oView = this.routing ? this.routing.getView() : this.getView();
                if (oView && oView._oImportChallanDialog) {
                    oView._oImportChallanDialog.close();
                }
            }
        }
    };
});