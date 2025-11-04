(function () {
    if (!erpnext || !erpnext.accounts || !erpnext.accounts.PurchaseInvoice) return;
    if (erpnext.accounts.__vi_pi_refresh_patched__) return;

    const Controller = erpnext.accounts.PurchaseInvoice;
    const originalRefresh = Controller.prototype.refresh;

    Controller.prototype.refresh = function (doc) {
        originalRefresh.call(this, doc);

        if (this.frm.doc && this.frm.doc.docstatus === 0) {
            try {
                this.frm.remove_custom_button(__('Purchase Receipt'), __('Get Items From'));
            } catch (e) { }

            const me = this;
            this.frm.add_custom_button(__('Purchase Receipt'), function () {
                erpnext.utils.map_current_doc({
                    method: 'erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_purchase_invoice',
                    source_doctype: 'Purchase Receipt',
                    target: me.frm,
                    setters: {
                        supplier: me.frm.doc.supplier || undefined,
                        posting_date: undefined,
                        custom_invoice_no: undefined,
                    },
                    get_query_filters: {
                        docstatus: 1,
                        status: ['not in', ['Closed', 'Completed', 'Return Issued']],
                        company: me.frm.doc.company,
                        is_return: 0,
                    },
                });
            }, __('Get Items From'));
        }
    };

    erpnext.accounts.__vi_pi_refresh_patched__ = true;
})();



