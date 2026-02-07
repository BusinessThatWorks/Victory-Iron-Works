frappe.ui.form.on("Production Tooling", {
    refresh(frm) {
        calculate_weights_and_yield(frm);
    },

    bunch_weight(frm) {
        calculate_weights_and_yield(frm);
    }
});

frappe.ui.form.on("Pattern Item Details", {
    cavity(frm, cdt, cdn) {
        calculate_weights_and_yield(frm);
    },
    casting_weight(frm, cdt, cdn) {
        calculate_weights_and_yield(frm);
    },
    // table_mfno_remove(frm) {
    //     calculate_weights_and_yield(frm);
    // }
});

function calculate_weights_and_yield(frm) {
    let total_casting_weight = 0;

    (frm.doc.table_mfno || []).forEach(row => {
        const cavity = row.cavity || 0;
        const casting_weight = row.casting_weight || 0;
        total_casting_weight += cavity * casting_weight;
    });

    frm.set_value("total_casting_weight", total_casting_weight);

    const bunch_weight = frm.doc.bunch_weight || 0;
    const runner_riser_weight = bunch_weight - total_casting_weight;

    frm.set_value("runner_riser_weight", runner_riser_weight);

    // ✅ Yield %
    let yield_percent = 0;
    if (bunch_weight > 0) {
        yield_percent = (total_casting_weight / bunch_weight) * 100;
    }

    // Optional rounding to 2 decimals
    yield_percent = flt(yield_percent, 2);

    frm.set_value("yield", yield_percent);
}

function update_bunch_weight(frm) {
    let total = 0;

    (frm.doc.table_mfno || []).forEach(row => {
        // total += flt(row.bunch_weight_in_kg);
        total += flt(row.bunch_weight_in_kg) * flt(row.cavity);
    });

    frm.set_value("bunch_weight", total);
}

// When child value changes
frappe.ui.form.on("Pattern Item Details", {
    bunch_weight_in_kg(frm, cdt, cdn) {
        update_bunch_weight(frm);
        calculate_weights_and_yield(frm);
    },
    cavity(frm, cdt, cdn) {
        update_bunch_weight(frm);
        calculate_weights_and_yield(frm);
    },
    table_mfno_remove(frm) {
        update_bunch_weight(frm);
        calculate_weights_and_yield(frm);
    }
});

// Also recalc on form load / refresh
frappe.ui.form.on("Production Tooling", {
    refresh(frm) {
        update_bunch_weight(frm);
    }
});

