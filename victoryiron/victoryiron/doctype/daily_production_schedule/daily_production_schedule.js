// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Daily Production Schedule", {
// 	refresh(frm) {

// 	},
// });

// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Daily Production Schedule", {
// 	refresh(frm) {

// 	},
// });



// frappe.ui.form.on("Daily Production Schedule", {
//     refresh(frm) {
//         console.log("Daily Production Schedule form loaded:", frm.doc.name);
//     },
// });

// // Now catch events in the child table
// frappe.ui.form.on("Daily Production Schedule Table", {
//     item_name(frm, cdt, cdn) {
//         let row = locals[cdt][cdn];
//         console.log("Item selected:", row.item_name, "Weight:", row.weight);
//     },

//     planned_qty(frm, cdt, cdn) {
//         let row = locals[cdt][cdn];
//         if (row.weight && row.planned_qty) {
//             row.planned_weight = (row.weight * row.planned_qty).toFixed(2);
//             console.log("Planned Qty:", row.planned_qty, "→ Planned Weight:", row.planned_weight);
//             frm.refresh_field("daily_production_schedule");
//         }
//     },

//     far_qty(frm, cdt, cdn) {
//         let row = locals[cdt][cdn];
//         if (row.weight && row.far_qty) {
//             row.far_weight = (row.weight * row.far_qty).toFixed(2);
//             console.log("FAR Qty:", row.far_qty, "→ FAR Weight:", row.far_weight);
//             frm.refresh_field("daily_production_schedule");
//         }
//     },

//     uncast_qty(frm, cdt, cdn) {
//         let row = locals[cdt][cdn];
//         if (row.weight && row.uncast_qty) {
//             row.uncast_weight = (row.weight * row.uncast_qty).toFixed(2);
//             console.log("Uncast Qty:", row.uncast_qty, "→ Uncast Weight:", row.uncast_weight);
//             frm.refresh_field("daily_production_schedule");
//         }
//     },

//     casting_qty(frm, cdt, cdn) {
//         let row = locals[cdt][cdn];
//         if (row.weight && row.casting_qty) {
//             row.casting_weight = (row.weight * row.casting_qty).toFixed(2);
//             console.log("Casting Qty:", row.casting_qty, "→ Casting Weight:", row.casting_weight);
//         }
//         calculate_rejection(row, frm);
//         frm.refresh_field("daily_production_schedule");
//     },

//     finish_qty(frm, cdt, cdn) {
//         let row = locals[cdt][cdn];
//         if (row.weight && row.finish_qty) {
//             row.finish_weight = (row.weight * row.finish_qty).toFixed(2);
//             console.log("Finish Qty:", row.finish_qty, "→ Finish Weight:", row.finish_weight);
//         }
//         calculate_rejection(row, frm);
//         frm.refresh_field("daily_production_schedule");
//     }
// });

// // Helper for rejection
// function calculate_rejection(row, frm) {
//     if (row.casting_qty && row.finish_qty) {
//         row.rejected_qty = (row.casting_qty - row.finish_qty).toFixed(2);
//         row.rejected_weight = (row.rejected_qty * row.weight).toFixed(2);

//         if (row.casting_qty > 0) {
//             row.rejection = (((row.casting_qty - row.finish_qty) / row.casting_qty) * 100).toFixed(2);
//         } else {
//             row.rejection = 0.00;
//         }

//         console.log("Rejected Qty:", row.rejected_qty,
//             "Rejected Weight:", row.rejected_weight,
//             "Rejection %:", row.rejection);
//         frm.refresh_field("daily_production_schedule");
//     }
// }




frappe.ui.form.on("Daily Production Schedule", {
    refresh(frm) {
        console.log("Daily Production Schedule loaded:", frm.doc.name);
    },
});

// Child table events
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
            update_totals(frm);
        }
    },

    far_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.far_qty) {
            row.far_weight = (row.weight * row.far_qty).toFixed(2);
            console.log("FAR Qty:", row.far_qty, "→ FAR Weight:", row.far_weight);
            frm.refresh_field("daily_production_schedule");
            update_totals(frm);
        }
    },

    uncast_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.uncast_qty) {
            row.uncast_weight = (row.weight * row.uncast_qty).toFixed(2);
            console.log("Uncast Qty:", row.uncast_qty, "→ Uncast Weight:", row.uncast_weight);
            frm.refresh_field("daily_production_schedule");
            update_totals(frm);
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
        update_totals(frm);
    },

    finish_qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight && row.finish_qty) {
            row.finish_weight = (row.weight * row.finish_qty).toFixed(2);
            console.log("Finish Qty:", row.finish_qty, "→ Finish Weight:", row.finish_weight);
        }
        calculate_rejection(row, frm);
        frm.refresh_field("daily_production_schedule");
        update_totals(frm);
    }
});

// Helper for rejection
function calculate_rejection(row, frm) {
    if (row.casting_qty && row.finish_qty) {
        row.rejected_qty = (row.casting_qty - row.finish_qty).toFixed(2);
        row.rejected_weight = (row.rejected_qty * row.weight).toFixed(2);

        if (row.casting_qty > 0) {
            row.rejection_ = (((row.casting_qty - row.finish_qty) / row.casting_qty) * 100).toFixed(2);
        } else {
            row.rejection_ = 0.00;
        }

        console.log("Rejected Qty:", row.rejected_qty,
            "Rejected Weight:", row.rejected_weight,
            "Rejection %:", row.rejection_);
    }
}

// Helper to update totals in parent
function update_totals(frm) {
    let totals = {
        total_planned_weight: 0,
        total_far_weight: 0,
        total_uncast_weight: 0,
        total_casting_weight: 0,
        total_finish_weight: 0,
        total_rejected_weight: 0
    };

    (frm.doc.daily_production_schedule || []).forEach(row => {
        totals.total_planned_weight += parseFloat(row.planned_weight || 0);
        totals.total_far_weight += parseFloat(row.far_weight || 0);
        totals.total_uncast_weight += parseFloat(row.uncast_weight || 0);
        totals.total_casting_weight += parseFloat(row.casting_weight || 0);
        totals.total_finish_weight += parseFloat(row.finish_weight || 0);
        totals.total_rejected_weight += parseFloat(row.rejected_weight || 0);
    });

    // Only set values if the fields exist in the doctype
    const field_mapping = {
        "planned_weight": "total_planned_weight",
        "far_weight": "total_far_weight",
        "uncast_weight": "total_uncast_weight",
        "casting_weight": "total_casting_weight",
        "finish_weight": "total_finish_weight",
        "rejected_weight": "total_rejected_weight"
    };

    Object.keys(field_mapping).forEach(fieldname => {
        if (frm.fields_dict[fieldname]) {
            frm.set_value(fieldname, totals[field_mapping[fieldname]].toFixed(2));
        }
    });

    console.log("Updated Totals:", totals);
}
