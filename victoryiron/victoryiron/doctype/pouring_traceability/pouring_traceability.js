// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pouring Traceability", {
    refresh: function (frm) {
        // Re-populate item options for existing rows on form load
        setTimeout(() => {
            frm.doc.pouring_traceability?.forEach((row) => {
                if (row.mould_batch_id) {
                    populate_item_options(frm, row.name, row.mould_batch_id, row.item_name);
                }
            });
            frm.refresh_field("pouring_traceability");
        }, 500);
    },

    onload: function (frm) {
        // Also populate on initial load
        frm.doc.pouring_traceability?.forEach((row) => {
            if (row.mould_batch_id) {
                populate_item_options(frm, row.name, row.mould_batch_id, row.item_name);
            }
        });
    },
});

frappe.ui.form.on("Pouring Traceability Table", {
    // When row is opened/rendered
    form_render: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.mould_batch_id) {
            populate_item_options(frm, cdn, row.mould_batch_id, row.item_name);
        }
    },

    // When mould_batch_id is selected
    mould_batch_id: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        // Clear previous values
        frappe.model.set_value(cdt, cdn, "item_name", "");
        frappe.model.set_value(cdt, cdn, "box_created_from", 0);
        frappe.model.set_value(cdt, cdn, "box_created_to", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
        frappe.model.set_value(cdt, cdn, "available_quantity", 0);

        if (row.mould_batch_id) {
            populate_item_options(frm, cdn, row.mould_batch_id, null);
        }
    },

    // When item_name is selected
    item_name: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.mould_batch_id && row.item_name) {
            fetch_item_details(frm, cdt, cdn, row.mould_batch_id, row.item_name);
        }
    },
});

// Populate item_name dropdown based on mould_batch_id
function populate_item_options(frm, cdn, mould_batch_id, existing_value) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.pouring_traceability.pouring_traceability.get_items_from_mould_batch",
        args: {
            mould_batch_id: mould_batch_id,
        },
        async: false, // Synchronous to ensure options load before user interacts
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                let options = ["", ...r.message];
                let options_str = options.join("\n");

                // Method 1: Update via grid field
                let grid = frm.fields_dict.pouring_traceability.grid;
                let grid_row = grid.grid_rows_by_docname[cdn];

                if (grid_row) {
                    // Update the field definition
                    let field = grid_row.get_field("item_name");
                    if (field) {
                        field.df.options = options_str;
                        field.refresh();
                    }

                    // Also update in docfield for persistence
                    let docfield = frappe.meta.get_docfield(
                        "Pouring Traceability Table",
                        "item_name",
                        frm.doc.name
                    );
                    if (docfield) {
                        docfield.options = options_str;
                    }

                    // Restore existing value
                    if (existing_value && options.includes(existing_value)) {
                        frappe.model.set_value(
                            grid_row.doc.doctype,
                            cdn,
                            "item_name",
                            existing_value
                        );
                    }
                }
            }
        },
    });
}

// Fetch item details when item is selected
function fetch_item_details(frm, cdt, cdn, mould_batch_id, item_name) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.pouring_traceability.pouring_traceability.get_item_details_from_mould_batch",
        args: {
            mould_batch_id: mould_batch_id,
            item_name: item_name,
        },
        callback: function (r) {
            if (r.message) {
                let data = r.message;

                frappe.model.set_value(cdt, cdn, "box_created_from", data.start_no || 0);
                frappe.model.set_value(cdt, cdn, "box_created_to", data.end_no || 0);
                frappe.model.set_value(cdt, cdn, "total_cast_weight", data.total_cast_weight || 0);
                frappe.model.set_value(cdt, cdn, "total_bunch_weight", data.total_bunch_weight || 0);
                frappe.model.set_value(cdt, cdn, "available_quantity", data.total_good_mould_qty || 0);
            }
        },
    });
}