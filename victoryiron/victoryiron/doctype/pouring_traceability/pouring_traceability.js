// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pouring Traceability", {
    refresh: function (frm) {
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
        frm.doc.pouring_traceability?.forEach((row) => {
            if (row.mould_batch_id) {
                populate_item_options(frm, row.name, row.mould_batch_id, row.item_name);
            }
        });
    },
});

frappe.ui.form.on("Pouring Traceability Table", {
    form_render: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.mould_batch_id) {
            populate_item_options(frm, cdn, row.mould_batch_id, row.item_name);
        }
    },

    mould_batch_id: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        // Clear previous values
        frappe.model.set_value(cdt, cdn, "item_name", "");
        frappe.model.set_value(cdt, cdn, "cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "bunch_weight", 0);
        frappe.model.set_value(cdt, cdn, "box_created_from", 0);
        frappe.model.set_value(cdt, cdn, "box_created_to", 0);
        frappe.model.set_value(cdt, cdn, "box_poured_from", 0);
        frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
        frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);

        if (row.mould_batch_id) {
            populate_item_options(frm, cdn, row.mould_batch_id, null);
        }
    },

    item_name: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.mould_batch_id && row.item_name) {
            fetch_item_details(frm, cdt, cdn, row);
            fetch_item_details(frm, cdt, cdn, row);
        }
    },

    box_poured_from: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },

    box_poured_till: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },

    box_poured_from: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },

    box_poured_till: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },
});

// Populate item_name dropdown
// Populate item_name dropdown
function populate_item_options(frm, cdn, mould_batch_id, existing_value) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.pouring_traceability.pouring_traceability.get_items_from_mould_batch",
        args: { mould_batch_id: mould_batch_id },
        async: false,
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                let options = ["", ...r.message];
                let options_str = options.join("\n");

                let grid = frm.fields_dict.pouring_traceability.grid;
                let grid_row = grid.grid_rows_by_docname[cdn];

                if (grid_row) {
                    let field = grid_row.get_field("item_name");
                    if (field) {
                        field.df.options = options_str;
                        field.refresh();
                    }

                    let docfield = frappe.meta.get_docfield(
                        "Pouring Traceability Table",
                        "item_name",
                        frm.doc.name
                    );
                    if (docfield) {
                        docfield.options = options_str;
                    }

                    if (existing_value && options.includes(existing_value)) {
                        frappe.model.set_value(grid_row.doc.doctype, cdn, "item_name", existing_value);
                        frappe.model.set_value(grid_row.doc.doctype, cdn, "item_name", existing_value);
                    }
                }
            }
        },
    });
}

// Fetch item details when item is selected
function fetch_item_details(frm, cdt, cdn, current_row) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.pouring_traceability.pouring_traceability.get_item_details_from_mould_batch",
        args: {
            mould_batch_id: current_row.mould_batch_id,
            item_name: current_row.item_name,
        },
        callback: function (r) {
            if (r.message) {
                let data = r.message;

                // Set basic details
                frappe.model.set_value(cdt, cdn, "cast_weight", data.cast_weight || 0);
                frappe.model.set_value(cdt, cdn, "bunch_weight", data.bunch_weight || 0);
                // Set basic details
                frappe.model.set_value(cdt, cdn, "cast_weight", data.cast_weight || 0);
                frappe.model.set_value(cdt, cdn, "bunch_weight", data.bunch_weight || 0);
                frappe.model.set_value(cdt, cdn, "box_created_from", data.start_no || 0);
                frappe.model.set_value(cdt, cdn, "box_created_to", data.end_no || 0);
                // Clear poured values
                frappe.model.set_value(cdt, cdn, "box_poured_from", 0);
                frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
                frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
                frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
                frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
            }
        },
    });
}


// Calculate parent totals
function calculate_parent_totals(frm) {
    let total_cast = 0;
    let total_bunch = 0;

    frm.doc.pouring_traceability?.forEach((row) => {
        total_cast += row.total_cast_weight || 0;
        total_bunch += row.total_bunch_weight || 0;
    });

    frm.set_value("total_cast_weight", total_cast);
    frm.set_value("total_bunch_weight", total_bunch);
}