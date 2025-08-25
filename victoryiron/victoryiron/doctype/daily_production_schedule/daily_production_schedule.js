// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Daily Production Schedule", {
// 	refresh(frm) {

// 	},
// });



frappe.ui.form.on("Daily Production Schedule", {
    refresh(frm) {
        console.log("Daily Production Schedule form loaded:", frm.doc.name);
    },
});

// Now catch events in the child table
frappe.ui.form.on("Daily Production Schedule Table", {
    item_name(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        console.log("Item selected:", row.item_name, "Weight:", row.weight);
    },

    planned_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.planned_qty) {
            row.planned_weight = (row.weight * row.planned_qty).toFixed(2);
            console.log("Planned Qty:", row.planned_qty, "→ Planned Weight:", row.planned_weight);
            frm.refresh_field("daily_production_schedule");
        }
    },

    far_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.far_qty) {
            row.far_weight = (row.weight * row.far_qty).toFixed(2);
            console.log("FAR Qty:", row.far_qty, "→ FAR Weight:", row.far_weight);
            frm.refresh_field("daily_production_schedule");
        }
    },

    uncast_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.uncast_qty) {
            row.uncast_weight = (row.weight * row.uncast_qty).toFixed(2);
            console.log("Uncast Qty:", row.uncast_qty, "→ Uncast Weight:", row.uncast_weight);
            frm.refresh_field("daily_production_schedule");
        }
    },

    casting_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.casting_qty) {
            row.casting_weight = (row.weight * row.casting_qty).toFixed(2);
            console.log("Casting Qty:", row.casting_qty, "→ Casting Weight:", row.casting_weight);
        }
        calculate_rejection(row, frm);
        frm.refresh_field("daily_production_schedule");
    },

    finish_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.finish_qty) {
            row.finish_weight = (row.weight * row.finish_qty).toFixed(2);
            console.log("Finish Qty:", row.finish_qty, "→ Finish Weight:", row.finish_weight);
        }
        calculate_rejection(row, frm);
        frm.refresh_field("daily_production_schedule");
    }
});

// Helper for rejection
function calculate_rejection(row, frm) {
    if (row.casting_qty && row.finish_qty) {
        row.rejected_qty = (row.casting_qty - row.finish_qty).toFixed(2);
        row.rejected_weight = (row.rejected_qty * row.weight).toFixed(2);

        if (row.casting_qty > 0) {
            row.rejection = (((row.casting_qty - row.finish_qty) / row.casting_qty) * 100).toFixed(2);
        } else {
            row.rejection = 0.00;
        }

        console.log("Rejected Qty:", row.rejected_qty,
            "Rejected Weight:", row.rejected_weight,
            "Rejection %:", row.rejection);
        frm.refresh_field("daily_production_schedule");
    }
}
