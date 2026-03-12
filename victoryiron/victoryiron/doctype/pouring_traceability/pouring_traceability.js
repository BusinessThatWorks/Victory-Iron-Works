// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pouring Traceability", {
    refresh: function (frm) {
        setup_field_click_handlers(frm);
    },

    onload: function (frm) {
        setup_field_click_handlers(frm);
    },
});

frappe.ui.form.on("Pouring Traceability Table", {
    
    mould_batch_id: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        clear_row_fields(cdt, cdn);

        if (row.mould_batch_id) {
            show_moulding_system_dialog(frm, cdt, cdn, row.mould_batch_id);
        }
    },

    moulding_system: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.moulding_system) {
            frappe.model.set_value(cdt, cdn, "item_name", "");
            frappe.model.set_value(cdt, cdn, "cast_weight", 0);
            frappe.model.set_value(cdt, cdn, "bunch_weight", 0);
            frappe.model.set_value(cdt, cdn, "box_created_from", 0);
            frappe.model.set_value(cdt, cdn, "box_created_to", 0);
            frappe.model.set_value(cdt, cdn, "available_quantity", 0);
            clear_poured_fields(cdt, cdn);
        }
    },

    box_poured_from: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },

    box_poured_till: function (frm, cdt, cdn) {
        validate_and_calculate(frm, cdt, cdn);
    },
});

// ========================
// CLICK HANDLERS - EVENT DELEGATION
// ========================

function setup_field_click_handlers(frm) {
    $(frm.fields_dict.pouring_traceability.grid.wrapper).off("click", "[data-fieldname='moulding_system']");
    $(frm.fields_dict.pouring_traceability.grid.wrapper).off("click", "[data-fieldname='item_name']");

    // Moulding System Click
    $(frm.fields_dict.pouring_traceability.grid.wrapper).on("click", "[data-fieldname='moulding_system']", function (e) {
        e.preventDefault();
        e.stopPropagation();

        let $row = $(this).closest("[data-name]");
        let cdn = $row.attr("data-name");
        let row = locals["Pouring Traceability Table"][cdn];

        if (!row) return;

        if (!row.mould_batch_id) {
            frappe.msgprint(__("Please select Mould Batch ID first"));
            return;
        }

        show_moulding_system_dialog(frm, "Pouring Traceability Table", cdn, row.mould_batch_id);
    });

    // Item Name Click
    $(frm.fields_dict.pouring_traceability.grid.wrapper).on("click", "[data-fieldname='item_name']", function (e) {
        e.preventDefault();
        e.stopPropagation();

        let $row = $(this).closest("[data-name]");
        let cdn = $row.attr("data-name");
        let row = locals["Pouring Traceability Table"][cdn];

        if (!row) return;

        if (!row.mould_batch_id) {
            frappe.msgprint(__("Please select Mould Batch ID first"));
            return;
        }

        if (!row.moulding_system) {
            frappe.msgprint(__("Please select Moulding System first"));
            return;
        }

        show_item_selection_dialog(frm, "Pouring Traceability Table", cdn, row.mould_batch_id, row.moulding_system);
    });

    frm.fields_dict.pouring_traceability.grid.wrapper.find("[data-fieldname='moulding_system']").css("cursor", "pointer");
    frm.fields_dict.pouring_traceability.grid.wrapper.find("[data-fieldname='item_name']").css("cursor", "pointer");
}

// ========================
// HELPER: Calculate already poured in current document
// Now includes start_no and end_no for exact match
// ========================

function get_already_poured_in_doc(frm, mould_batch_id, moulding_system, item_name, start_no, end_no, exclude_cdn) {
    let total_poured = 0;

    frm.doc.pouring_traceability?.forEach((row) => {
        // Skip the current row being edited
        if (row.name === exclude_cdn) return;

        // Match batch, system, item, AND start_no/end_no (exact row match)
        if (
            row.mould_batch_id === mould_batch_id &&
            row.moulding_system === moulding_system &&
            row.item_name === item_name &&
            row.box_created_from === start_no &&
            row.box_created_to === end_no
        ) {
            total_poured += row.poured_quantity || 0;
        }
    });

    return total_poured;
}

// ========================
// DIALOG FUNCTIONS
// ========================

function show_moulding_system_dialog(frm, cdt, cdn, mould_batch_id) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.pouring_traceability.pouring_traceability.get_moulding_systems_from_batch",
        args: { mould_batch_id: mould_batch_id },
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                let options = r.message;

                let d = new frappe.ui.Dialog({
                    title: __("Select Moulding System"),
                    fields: [
                        {
                            label: __("Moulding System"),
                            fieldname: "moulding_system",
                            fieldtype: "Select",
                            options: ["", ...options].join("\n"),
                            reqd: 1,
                        },
                    ],
                    size: "small",
                    primary_action_label: __("Select"),
                    primary_action: function (values) {
                        frappe.model.set_value(cdt, cdn, "moulding_system", values.moulding_system);
                        d.hide();
                        frm.refresh_field("pouring_traceability");

                        setTimeout(() => {
                            show_item_selection_dialog(frm, cdt, cdn, mould_batch_id, values.moulding_system);
                        }, 300);
                    },
                });

                d.show();
            } else {
                frappe.msgprint(__("No moulding systems found in this batch"));
            }
        },
    });
}

function show_item_selection_dialog(frm, cdt, cdn, mould_batch_id, moulding_system) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.pouring_traceability.pouring_traceability.get_items_from_mould_batch",
        args: {
            mould_batch_id: mould_batch_id,
            moulding_system: moulding_system,
        },
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                let items = r.message;

                // Adjust available qty based on already poured in this document
                // Now using start_no and end_no for exact match
                items.forEach((item) => {
                    let already_poured = get_already_poured_in_doc(
                        frm,
                        mould_batch_id,
                        moulding_system,
                        item.item_name,
                        item.start_no,
                        item.end_no,
                        cdn
                    );
                    item.effective_available_qty = Math.max(0, (item.available_qty || 0) - already_poured);
                });

                let table_html = `
                    <div style="max-height: 400px; overflow-y: auto;">
                        <table class="table table-bordered table-hover" style="width:100%; margin:0;">
                            <thead style="position: sticky; top: 0; background: #f5f5f5;">
                                <tr>
                                    <th style="width:40px; text-align:center;">Select</th>
                                    <th>Item Name</th>
                                    <th style="width:80px; text-align:center;">Start No</th>
                                    <th style="width:80px; text-align:center;">End No</th>
                                    <th style="width:100px; text-align:center;">Available Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                items.forEach((item, idx) => {
                    let is_disabled = item.effective_available_qty <= 0;
                    let row_style = is_disabled 
                        ? 'style="background:#ffebee; color:#999;"' 
                        : 'style="cursor:pointer"';
                    let disabled = is_disabled ? 'disabled' : '';
                    
                    table_html += `
                        <tr class="item-row" data-idx="${idx}" ${row_style}>
                            <td style="text-align:center;"><input type="radio" name="item_select" value="${idx}" ${disabled}></td>
                            <td><strong>${item.item_name || ''}</strong></td>
                            <td style="text-align:center;">${item.start_no || 0}</td>
                            <td style="text-align:center;">${item.end_no || 0}</td>
                            <td style="text-align:center;"><strong>${item.effective_available_qty}</strong></td>
                        </tr>
                    `;
                });

                table_html += `</tbody></table></div>`;

                let d = new frappe.ui.Dialog({
                    title: __("Select Item - " + moulding_system),
                    fields: [
                        {
                            fieldtype: "HTML",
                            fieldname: "item_table",
                            options: table_html,
                        },
                    ],
                    size: "large",
                    primary_action_label: __("Select"),
                    primary_action: function () {
                        let selected_idx = d.$wrapper.find('input[name="item_select"]:checked').val();

                        if (selected_idx === undefined) {
                            frappe.msgprint(__("Please select an item"));
                            return;
                        }

                        let selected_item = items[parseInt(selected_idx)];

                        if (selected_item.effective_available_qty <= 0) {
                            frappe.msgprint(__("This item has no available quantity"));
                            return;
                        }

                        frappe.model.set_value(cdt, cdn, "item_name", selected_item.item_name || "");
                        frappe.model.set_value(cdt, cdn, "cast_weight", selected_item.cast_weight || 0);
                        frappe.model.set_value(cdt, cdn, "bunch_weight", selected_item.bunch_weight || 0);
                        frappe.model.set_value(cdt, cdn, "box_created_from", selected_item.start_no || 0);
                        frappe.model.set_value(cdt, cdn, "box_created_to", selected_item.end_no || 0);
                        frappe.model.set_value(cdt, cdn, "available_quantity", selected_item.effective_available_qty);

                        clear_poured_fields(cdt, cdn);
                        d.hide();
                        frm.refresh_field("pouring_traceability");
                    },
                });

                d.$wrapper.on("click", ".item-row", function () {
                    let idx = $(this).attr("data-idx");
                    let item = items[parseInt(idx)];
                    
                    if (item.effective_available_qty <= 0) return;
                    
                    d.$wrapper.find(".item-row").css("background", "");
                    $(this).css("background", "#e8f4fd");
                    $(this).find('input[type="radio"]').prop("checked", true);
                });

                d.$wrapper.on("dblclick", ".item-row", function () {
                    let idx = $(this).attr("data-idx");
                    let item = items[parseInt(idx)];
                    
                    if (item.effective_available_qty <= 0) return;
                    
                    $(this).find('input[type="radio"]').prop("checked", true);
                    d.primary_action();
                });

                d.show();
            } else {
                frappe.msgprint(__("No items found for this moulding system"));
            }
        },
    });
}

// ========================
// HELPER FUNCTIONS
// ========================

function clear_row_fields(cdt, cdn) {
    frappe.model.set_value(cdt, cdn, "moulding_system", "");
    frappe.model.set_value(cdt, cdn, "item_name", "");
    frappe.model.set_value(cdt, cdn, "cast_weight", 0);
    frappe.model.set_value(cdt, cdn, "bunch_weight", 0);
    frappe.model.set_value(cdt, cdn, "box_created_from", 0);
    frappe.model.set_value(cdt, cdn, "box_created_to", 0);
    frappe.model.set_value(cdt, cdn, "available_quantity", 0);
    clear_poured_fields(cdt, cdn);
}

function clear_poured_fields(cdt, cdn) {
    frappe.model.set_value(cdt, cdn, "box_poured_from", 0);
    frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
    frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
    frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
    frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
}

function validate_and_calculate(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    let box_from = row.box_poured_from || 0;
    let box_till = row.box_poured_till || 0;
    let created_from = row.box_created_from || 0;
    let created_to = row.box_created_to || 0;
    let available_qty = row.available_quantity || 0;

    // Get min and max from the range (handles reverse order)
    let range_min = Math.min(created_from, created_to);
    let range_max = Math.max(created_from, created_to);

    // If range is not set, skip validation
    if (range_min === 0 && range_max === 0) {
        return;
    }

    // Validate box_poured_from is within range
    if (box_from && (box_from < range_min || box_from > range_max)) {
        frappe.msgprint(__(`Row #${row.idx}: Box Poured From must be between ${range_min} and ${range_max}`));
        frappe.model.set_value(cdt, cdn, "box_poured_from", 0);
        return;
    }

    // Validate box_poured_till is within range
    if (box_till && (box_till < range_min || box_till > range_max)) {
        frappe.msgprint(__(`Row #${row.idx}: Box Poured To must be between ${range_min} and ${range_max}`));
        frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
        return;
    }

    // Calculate poured quantity (handles both 1-30 and 30-1)
    if (box_from && box_till) {
        let poured_qty = Math.abs(box_till - box_from) + 1;

        // Validate against available quantity
        if (available_qty > 0 && poured_qty > available_qty) {
            frappe.msgprint(__(`Row #${row.idx}: Poured quantity (${poured_qty}) cannot exceed available quantity (${available_qty})`));
            frappe.model.set_value(cdt, cdn, "box_poured_till", 0);
            frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
            return;
        }

        frappe.model.set_value(cdt, cdn, "poured_quantity", poured_qty);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", (row.cast_weight || 0) * poured_qty);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", (row.bunch_weight || 0) * poured_qty);
    } else {
        frappe.model.set_value(cdt, cdn, "poured_quantity", 0);
        frappe.model.set_value(cdt, cdn, "total_cast_weight", 0);
        frappe.model.set_value(cdt, cdn, "total_bunch_weight", 0);
    }

    calculate_parent_totals(frm);
}

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