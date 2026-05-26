console.log("GRListExt FILE LOADED");

sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Label",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/ObjectStatus",
    "sap/ui/core/HTML",
    "sap/ui/unified/FileUploader"
], function (ControllerExtension, Dialog, Button, VBox, HBox, Text, Title,
             Label, MessageToast, MessageBox,
             Table, Column, ColumnListItem, ObjectStatus, HTML, FileUploader) {
    "use strict";

    return ControllerExtension.extend(
        "com.erp.gr.managegre.ext.controller.GRListExt", {

        override: {
            onInit: function () {
                console.log("GRListExt controller loaded successfully");
            }
        },

        onImportChallan: function () {
            console.log("onImportChallan called");
            this._base64   = null;
            this._fileName = null;

            var oFileUploader = new FileUploader({
                width       : "100%",
                fileType    : ["pdf", "jpg", "jpeg", "png"],
                uploadEnabled: false,
                change      : this._onFileChanged.bind(this)
            });

            this._fileUploader = oFileUploader;

            this._extractBtn = new Button({
                text   : "Extract & Generate GR",
                type   : "Emphasized",
                enabled: false,
                press  : this._onExtract.bind(this)
            });

            var oDialog = new Dialog({
                title        : "Import Delivery Challan",
                contentWidth : "480px",
                content: [
                    new VBox({
                        class: "sapUiSmallMargin",
                        items: [
                            new Text({ text: "Select the vendor delivery challan PDF or image. Extract button activates once file is selected." }),
                            new HTML({ content: "<div style='height:12px'/>" }),
                            oFileUploader
                        ]
                    })
                ],
                beginButton: this._extractBtn,
                endButton: new Button({
                    text : "Cancel",
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });

            this._importDialog = oDialog;
            oDialog.open();
        },

        _onFileChanged: function (oEvent) {
            var oFiles = oEvent.getParameter("files");
            if (!oFiles || !oFiles[0]) return;

            var oFile  = oFiles[0];
            var reader = new FileReader();
            var that   = this;

            reader.onload = function (e) {
                that._base64   = e.target.result.split(",")[1];
                that._fileName = oFile.name;
                that._extractBtn.setEnabled(true);
                MessageToast.show("File ready: " + oFile.name);
            };
            reader.onerror = function () {
                MessageBox.error("Could not read file.");
            };
            reader.readAsDataURL(oFile);
        },

        _onExtract: function () {
            var that = this;
            if (!this._base64) {
                MessageToast.show("No file loaded.");
                return;
            }

            this._extractBtn.setEnabled(false);
            this._extractBtn.setText("Extracting...");

            fetch("/procurement/importDeliveryChallan", {
                method : "POST",
                headers: { "Content-Type": "application/json" },
                body   : JSON.stringify({
                    fileContent: that._base64,
                    fileName   : that._fileName
                })
            })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (!res.ok) throw new Error(data.error && data.error.message || "Extraction failed");
                    return data;
                });
            })
            .then(function (result) {
                that._importDialog.close();
                that._showGRResult(result);
            })
            .catch(function (err) {
                MessageBox.error("Error: " + err.message);
                that._extractBtn.setEnabled(true);
                that._extractBtn.setText("Extract & Generate GR");
            });
        },

        _showGRResult: function (result) {
            var that    = this;
            var summary = [];
            try { summary = JSON.parse(result.matchSummary || "[]"); } catch(e) {}

            var oTable = new Table({
                columns: [
                    new Column({ header: new Text({ text: "Material"       }) }),
                    new Column({ header: new Text({ text: "PO Qty"         }) }),
                    new Column({ header: new Text({ text: "Received Qty"   }) }),
                    new Column({ header: new Text({ text: "Difference"     }) }),
                    new Column({ header: new Text({ text: "Gap Amount (₹)" }) }),
                    new Column({ header: new Text({ text: "Status"         }) })
                ]
            });

            var stateMap = { OK: "Success", SHORT: "Error",      EXCESS: "Warning"  };
            var labelMap = { OK: "Full Match" };

            summary.forEach(function (line) {
                var label = line.lineStatus === "SHORT"
                    ? "Short by "  + Math.abs(line.diff) + " " + line.uom
                    : line.lineStatus === "EXCESS"
                        ? "Excess by " + line.diff + " " + line.uom
                        : "Full Match";

                oTable.addItem(new ColumnListItem({
                    cells: [
                        new Text({ text: line.description || "—" }),
                        new Text({ text: line.poQty  + " " + line.uom }),
                        new Text({ text: line.rcvQty + " " + line.uom }),
                        new Text({ text: (line.diff > 0 ? "+" : "") + line.diff }),
                        new Text({ text: line.gapAmt !== 0
                            ? "₹ " + Math.abs(line.gapAmt).toFixed(2) : "—" }),
                        new ObjectStatus({
                            text : label,
                            state: stateMap[line.lineStatus] || "None"
                        })
                    ]
                }));
            });

            var grState = result.status === "FULL" ? "Success" : "Warning";

            var oResultDialog = new Dialog({
                title        : "GR Generated — " + result.grnNumber,
                contentWidth : "820px",
                content: [
                    new VBox({
                        class: "sapUiSmallMargin",
                        items: [
                            new HBox({
                                justifyContent: "SpaceBetween",
                                items: [
                                    new VBox({ items: [
                                        new Label({ text: "PO Number" }),
                                        new Text({ text: result.poNumber || "—" }),
                                        new HTML({ content: "<div style='height:8px'/>" }),
                                        new Label({ text: "Vendor" }),
                                        new Text({ text: result.vendorName || "—" })
                                    ]}),
                                    new VBox({ items: [
                                        new Label({ text: "GRN Number" }),
                                        new Text({ text: result.grnNumber }),
                                        new HTML({ content: "<div style='height:8px'/>" }),
                                        new Label({ text: "GR Type" }),
                                        new ObjectStatus({
                                            text : result.status + " GR",
                                            state: grState
                                        })
                                    ]})
                                ]
                            }),
                            new HTML({ content: "<hr style='margin:14px 0;border-color:#e0e0e0'/>" }),
                            new Title({ text: "Line Item Comparison", level: "H5" }),
                            new HTML({ content: "<div style='height:8px'/>" }),
                            oTable
                        ]
                    })
                ],
                beginButton: new Button({
                    text : "Download GR Slip",
                    type : "Emphasized",
                    icon : "sap-icon://download",
                    press: function () { that._downloadGR(result, summary); }
                }),
                endButton: new Button({
                    text : "Close",
                    press: function () {
                        oResultDialog.close();
                        try { that.base.getExtensionAPI().refresh(); } catch(e) {}
                    }
                }),
                afterClose: function () { oResultDialog.destroy(); }
            });

            oResultDialog.open();
        },

        _downloadGR: function (result, summary) {
            var rows = summary.map(function (l) {
                var color = l.lineStatus === "SHORT"  ? "#c0392b"
                          : l.lineStatus === "EXCESS" ? "#e67e22" : "#27ae60";
                var label = l.lineStatus === "SHORT"  ? "Short"
                          : l.lineStatus === "EXCESS" ? "Excess" : "Full Match";
                return "<tr>"
                    + "<td>" + (l.description || "—") + "</td>"
                    + "<td>" + l.poQty  + " " + l.uom + "</td>"
                    + "<td>" + l.rcvQty + " " + l.uom + "</td>"
                    + "<td style='color:" + color + "'>" + (l.diff > 0 ? "+" : "") + l.diff + " " + l.uom + "</td>"
                    + "<td>" + (l.gapAmt !== 0 ? "₹ " + Math.abs(l.gapAmt).toFixed(2) : "—") + "</td>"
                    + "<td>" + label + "</td>"
                    + "</tr>";
            }).join("");

            var bg    = result.status === "FULL" ? "#d4edda" : "#fff3cd";
            var color = result.status === "FULL" ? "#155724" : "#856404";
            var date  = new Date().toLocaleDateString("en-IN");

            var html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
                + "<style>"
                + "body{font-family:Arial,sans-serif;font-size:12px;margin:30px}"
                + ".top{display:flex;justify-content:space-between;margin-bottom:20px}"
                + ".co{font-size:18px;font-weight:bold;color:#003e6b}"
                + ".badge{padding:4px 12px;border-radius:4px;font-weight:bold;background:" + bg + ";color:" + color + "}"
                + ".meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;background:#f0f4f8;padding:12px;border-radius:4px;margin-bottom:16px}"
                + ".meta label{font-size:10px;color:#666;display:block}"
                + ".meta span{font-weight:bold}"
                + "table{width:100%;border-collapse:collapse}"
                + "th{background:#003e6b;color:#fff;padding:8px;text-align:left}"
                + "td{padding:7px 8px;border-bottom:1px solid #dee2e6}"
                + "tr:nth-child(even) td{background:#f8f9fa}"
                + ".foot{margin-top:40px;display:flex;justify-content:space-between}"
                + ".sig{border-top:1px solid #333;width:160px;text-align:center;padding-top:4px;font-size:10px;color:#555}"
                + "</style></head><body>"
                + "<div class='top'>"
                +   "<div><div class='co'>Shree Cem</div><div style='color:#555'>Goods Receipt Slip</div></div>"
                +   "<div style='text-align:right'>"
                +     "<div style='font-size:20px;font-weight:bold'>" + result.grnNumber + "</div>"
                +     "<div>" + date + "</div>"
                +     "<span class='badge'>" + result.status + " GR</span>"
                +   "</div>"
                + "</div>"
                + "<div class='meta'>"
                +   "<div><label>PO Number</label><span>" + result.poNumber + "</span></div>"
                +   "<div><label>Vendor</label><span>"    + (result.vendorName || "—") + "</span></div>"
                +   "<div><label>GR Status</label><span>" + result.status + "</span></div>"
                + "</div>"
                + "<table><thead><tr>"
                +   "<th>Material</th><th>PO Qty</th><th>Received Qty</th>"
                +   "<th>Difference</th><th>Gap Amount</th><th>Status</th>"
                + "</tr></thead><tbody>" + rows + "</tbody></table>"
                + "<div class='foot'>"
                +   "<div class='sig'>Store Incharge</div>"
                +   "<div class='sig'>Verified By</div>"
                +   "<div class='sig'>Authorised By</div>"
                + "</div>"
                + "</body></html>";

            var blob = new Blob([html], { type: "text/html" });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement("a");
            a.href     = url;
            a.download = "GR_" + result.grnNumber + "_" + new Date().toISOString().split("T")[0] + ".html";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });
});