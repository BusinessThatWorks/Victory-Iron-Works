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
        frappe.model.set_value(cdt, cdn, "available_quantity", 0);
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
        }
    },

    box_poured_from: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },

    box_poured_till: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },
});

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
                frappe.model.set_value(cdt, cdn, "box_created_from", data.start_no || 0);
                frappe.model.set_value(cdt, cdn, "box_created_to", data.end_no || 0);

                // Get base available from server (cross-doc tracking)
                let base_available = data.available_quantity || 0;

                // Calculate already used in THIS document (previous rows, same item)
                let already_used_in_doc = calculate_used_in_doc_before_row(frm, current_row);

                // Final available for this row
                let final_available = base_available - already_used_in_doc;
                frappe.model.set_value(cdt, cdn, "available_quantity", Math.max(0, final_available));

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

// Calculate how much of this item is already used in previous rows of same doc
function calculate_used_in_doc_before_row(frm, current_row) {
    let used = 0;
    let current_idx = current_row.idx;

    frm.doc.pouring_traceability?.forEach((row) => {
        if (
            row.idx < current_idx &&
            row.mould_batch_id === current_row.mould_batch_id &&
            row.item_name === current_row.item_name
        ) {
            used += row.poured_quantity || 0;
        }
    });

    return used;
}

// Validate and calculate poured values
function validate_and_calculate(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    let box_from = row.box_poured_from || 0;
    let box_till = row.box_poured_till || 0;
    let created_from = row.box_created_from || 0;
    let created_to = row.box_created_to || 0;
    let available_qty = row.available_quantity || 0;

    // If both values not entered yet, just return
    if (!box_from || !box_till) {
        // Calculate partial if only one exists
        if (box_from && !box_till) {
            // Only from entered, no calculation yet
            return;
        }
        if (!box_from && box_till) {
            // Only till entered, no calculation yet
            return;
        }
        // Both empty, reset values
        frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
        calculate_parent_totals(frm);
        return;
    }

    // Validation 1: box_poured_till >= box_poured_from
    if (box_till < box_from) {
        frappe.msgprint({
            title: __("Validation Error"),
            indicator: "red",
            message: __("Box Poured To cannot be less than Box Poured From"),
        });
        frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
        frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
        calculate_parent_totals(frm);
        return;
    }

    // Validation 2: box_poured_from within created range
    if (box_from < created_from || box_from > created_to) {
        frappe.msgprint({
            title: __("Validation Error"),
            indicator: "red",
            message: __(`Box Poured From (${box_from}) must be between ${created_from} and ${created_to}`),
        });
        frappe.model.set_value(cdt, cdn, "box_poured_from", 0);
        frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
        calculate_parent_totals(frm);
        return;
    }

    // Validation 3: box_poured_till within created range
    if (box_till < created_from || box_till > created_to) {
        frappe.msgprint({
            title: __("Validation Error"),
            indicator: "red",
            message: __(`Box Poured To (${box_till}) must be between ${created_from} and ${created_to}`),
        });
        frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
        frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
        calculate_parent_totals(frm);
        return;
    }

    // Calculate poured quantity
    let poured_qty = box_till - box_from + 1;

    // Validation 4: poured quantity <= available quantity
    if (poured_qty > available_qty) {
        frappe.msgprint({
            title: __("Validation Error"),
            indicator: "red",
            message: __(`Poured Quantity (${poured_qty}) cannot exceed Available Quantity (${available_qty})`),
        });
        frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
        frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
        calculate_parent_totals(frm);
        return;
    }

    // All validations passed - calculate values
    let cast_weight = row.cast_weight || 0;
    let bunch_weight = row.bunch_weight || 0;

    frappe.model.set_value(cdt, cdn, "poured_quantity", poured_qty);
    frappe.model.set_value(cdt, cdn, "total_cast_weight", cast_weight * poured_qty);
    frappe.model.set_value(cdt, cdn, "total_bunch_weight", bunch_weight * poured_qty);

    // Calculate parent totals
    calculate_parent_totals(frm);

    // Refresh to show updated values
    frm.refresh_field("pouring_traceability");
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