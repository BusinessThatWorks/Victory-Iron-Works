(function () {
    if (!erpnext || !erpnext.accounts || !erpnext.accounts.SalesInvoiceController) return;
    if (erpnext.accounts.__vi_si_sales_order_btn_patched__) return;

    const Controller = erpnext.accounts.SalesInvoiceController;

    // Override sales_order_btn method
    Controller.prototype.sales_order_btn = function () {
        var me = this;
        this.$sales_order_btn = this.frm.add_custom_button(
            __("Sales Order"),
            function () {
                erpnext.utils.map_current_doc({
                    method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
                    source_doctype: "Sales Order",
                    target: me.frm,
                    setters: {
                        customer: me.frm.doc.customer || undefined,
                        po_no: me.frm.doc.po_no || undefined,
                        custom_chamong_po_number: me.frm.doc.custom_chamong_po_number || undefined,
                    },
                    get_query_filters: {
                        docstatus: 1,
                        status: ["not in", ["Closed", "On Hold"]],
                        per_billed: ["<", 99.99],
                        company: me.frm.doc.company,
                    },
                    allow_child_item_selection: true,
                    child_fieldname: "items",
                    child_columns: ["item_code", "item_name", "qty", "amount", "billed_amt"],
                });
            },
            __("Get Items From")
        );
    };

    erpnext.accounts.__vi_si_sales_order_btn_patched__ = true;
})();

