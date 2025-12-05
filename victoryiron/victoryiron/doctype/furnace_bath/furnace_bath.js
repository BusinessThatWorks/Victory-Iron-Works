// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Furnace Bath", {
    refresh: function (frm) {
        // Set visibility correctly on load/refresh
        toggle_treatment_section(frm);
    },

    sample_type: function (frm) {
        // Toggle treatment section when sample_type changes
        toggle_treatment_section(frm);
    }
});

// Show Treatment section + mg field only when sample_type == "Treatment"
function toggle_treatment_section(frm) {
    const show = frm.doc.sample_type === "Treatment";

    // Section Break itself
    frm.toggle_display("treatment_bath_test_section", show);

    // mg field inside that section
    frm.toggle_display("mg", show);
}
