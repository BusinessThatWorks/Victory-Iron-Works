// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Holding Furnace Heat", {
    refresh(frm) {
        // Set up click handler for the button field
        // This ensures it works across different Frappe versions
        if (frm.fields_dict.get_todays_data && frm.fields_dict.get_todays_data.$input) {
            frm.fields_dict.get_todays_data.$input.off('click').on('click', function () {
                get_todays_data(frm);
            });
        }
    },

    get_todays_data: function (frm) {
        // This is triggered when the Button field 'get_todays_data' is clicked
        // (works in some Frappe versions)
        get_todays_data(frm);
    }
});

function get_todays_data(frm) {
    // Validate that date is selected
    if (!frm.doc.date) {
        frappe.msgprint(__("Please select a date first"));
        return;
    }

    // Fetch and populate Cupola → table_fjdd
    fetch_and_populate_ladle_rows(frm, "Cupola", "table_fjdd");

    // Fetch and populate Holding Furnace → table_ibpu
    fetch_and_populate_ladle_rows(frm, "Holding Furnace", "table_ibpu");

    // Fetch and populate Furnace Bath → table_hdkp (only Bath sample_type)
    fetch_and_populate_furnace_bath_rows(frm);

    // Fetch and populate Treatment → table_ljur (only Treatment sample_type)
    fetch_and_populate_treatment_rows(frm);
}

function fetch_and_populate_ladle_rows(frm, source, childfield) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.holding_furnace_heat.holding_furnace_heat.get_ladle_metal_ids",
        args: {
            date: frm.doc.date,
            source: source
        },
        callback: function (r) {
            if (!r.message) {
                return;
            }

            let ladle_metal_docs = r.message;

            if (!Array.isArray(ladle_metal_docs) || ladle_metal_docs.length === 0) {
                frappe.msgprint(
                    __("No Ladle Metal records found for the selected date with source '{0}'", [source])
                );
                return;
            }

            // Clear existing rows in the specific child table
            frm.clear_table(childfield);

            // Add new rows for each Ladle Metal doc and map fields
            ladle_metal_docs.forEach(function (doc) {
                let row = frm.add_child(childfield);
                row.ladle_metal_id = doc.name;
                row.total_weight_in_kg = doc.total_weight_in_kg;
                row.start_time = doc.start_time;
                row.end_time = doc.end_time;

                // Map ladle_id and grade_type for table_ibpu (Holding Furnace source)
                if (childfield === "table_ibpu" && doc.ladle_type) {
                    row.ladle_id = doc.ladle_type;
                }
                if (childfield === "table_ibpu" && doc.grade_type) {
                    row.grade_type = doc.grade_type;
                }
            });

            // Refresh that child table
            frm.refresh_field(childfield);

            // Calculate and set total weight
            let totalWeight = 0;
            ladle_metal_docs.forEach(function (doc) {
                if (doc.total_weight_in_kg) {
                    totalWeight += parseFloat(doc.total_weight_in_kg) || 0;
                }
            });

            // Set the total in parent field based on childfield
            if (childfield === "table_fjdd") {
                frm.set_value("total_metal_recieved", totalWeight);
            } else if (childfield === "table_ibpu") {
                frm.set_value("total_metal_discharged", totalWeight);
            }

            // Determine display name based on childfield
            let displayName = childfield;
            if (childfield === "table_fjdd") {
                displayName = "Metal Recieved";
            } else if (childfield === "table_ibpu") {
                displayName = "Metal Discharged";
            }

            frappe.show_alert({
                message: __("{0} record(s) added to {1}", [ladle_metal_docs.length, displayName]),
                indicator: 'green'
            }, 5);
        },
        error: function (r) {
            frappe.msgprint(
                __("Error fetching data for source {0}: {1}", [source, (r.message || "Unknown error")])
            );
        }
    });
}

function fetch_and_populate_furnace_bath_rows(frm) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.holding_furnace_heat.holding_furnace_heat.get_furnace_bath_ids",
        args: {
            date: frm.doc.date,
            sample_type: "Bath"
        },
        callback: function (r) {
            if (!r.message) {
                return;
            }

            let furnace_bath_ids = r.message;

            if (!Array.isArray(furnace_bath_ids) || furnace_bath_ids.length === 0) {
                frappe.show_alert({
                    message: __("No Furnace Bath records found for the selected date with sample_type 'Bath'"),
                    indicator: 'orange'
                }, 5);
                return;
            }

            // Clear existing rows in the child table
            frm.clear_table("table_hdkp");

            // Add new rows for each Furnace Bath ID
            furnace_bath_ids.forEach(function (bath_id) {
                let row = frm.add_child("table_hdkp");
                row.bath_id = bath_id;
            });

            // Refresh the child table
            frm.refresh_field("table_hdkp");

            frappe.show_alert({
                message: __("{0} Furnace Bath record(s) added to Bath Samples", [furnace_bath_ids.length]),
                indicator: 'green'
            }, 5);
        },
        error: function (r) {
            frappe.msgprint(
                __("Error fetching Furnace Bath data: {0}", [r.message || "Unknown error"])
            );
        }
    });
}

function fetch_and_populate_treatment_rows(frm) {
    frappe.call({
        method: "victoryiron.victoryiron.doctype.holding_furnace_heat.holding_furnace_heat.get_furnace_bath_ids",
        args: {
            date: frm.doc.date,
            sample_type: "Treatment"
        },
        callback: function (r) {
            if (!r.message) {
                return;
            }

            let treatment_ids = r.message;

            if (!Array.isArray(treatment_ids) || treatment_ids.length === 0) {
                frappe.show_alert({
                    message: __("No Furnace Bath records found for the selected date with sample_type 'Treatment'"),
                    indicator: 'orange'
                }, 5);
                return;
            }

            // Clear existing rows in the child table
            frm.clear_table("table_ljur");

            // Add new rows for each Treatment ID
            treatment_ids.forEach(function (treatment_id) {
                let row = frm.add_child("table_ljur");
                row.treatment_id = treatment_id;
            });

            // Refresh the child table
            frm.refresh_field("table_ljur");

            frappe.show_alert({
                message: __("{0} Treatment record(s) added to Treatment Details", [treatment_ids.length]),
                indicator: 'green'
            }, 5);
        },
        error: function (r) {
            frappe.msgprint(
                __("Error fetching Treatment data: {0}", [r.message || "Unknown error"])
            );
        }
    });
}
