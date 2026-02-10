// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Cupola Log", {
// 	refresh(frm) {

// 	},
// });




frappe.ui.form.on("Cupola Log", {
    refresh(frm) {
        // Nothing on refresh for now
    },
}); 

// Child table field triggers
frappe.ui.form.on("Cupola Consumption Table", {
    pig__10(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    pig__10_to_15(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    pig__15_to_20(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    pig__20_to_25(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    pig___25_(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    ci_fr(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    di_fr(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    mould_box_scrap(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    ms_scrap(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); },
    m_ci_scrap(frm, cdt, cdn) { calculate_total(frm, cdt, cdn); }
});

function calculate_total(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    let fields = [
        "pig__10",
        "pig__10_to_15",
        "pig__15_to_20",
        "pig__20_to_25",
        "pig___25_",
        "ci_fr",
        "di_fr",
        "mould_box_scrap",
        "ms_scrap",
        "m_ci_scrap"
    ];

    let total = 0;
    fields.forEach(f => {
        total += flt(row[f]);
    });

    total = flt(total, 2);  // round to 2 decimals

    console.log("Row:", cdn, "Calculated Total:", total);

    frappe.model.set_value(cdt, cdn, "total", total);
}
