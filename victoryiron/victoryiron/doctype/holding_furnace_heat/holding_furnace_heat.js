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
    if (!frm.doc.date) {
        frappe.msgprint(__("Please select a date first"));
        return;
    }

    // table_fjdd - Source: Cupola, Destination: Holding Furnace
    fetch_and_populate_ladle_rows(frm, "Cupola", "Holding Furnace", "table_fjdd");

    // table_ibpu - Source: Holding Furnace (destination not needed)
    fetch_and_populate_ladle_rows(frm, "Holding Furnace", null, "table_ibpu");

    // Other tables - no change
    fetch_and_populate_furnace_bath_rows(frm);
    fetch_and_populate_treatment_rows(frm);
}

function fetch_and_populate_ladle_rows(frm, source, destination, childfield) {
    let args = {
        date: frm.doc.date,
        source: source
    };
    
    // Add destination only if provided
    if (destination) {
        args.destination = destination;
    }

    frappe.call({
        method: "victoryiron.victoryiron.doctype.holding_furnace_heat.holding_furnace_heat.get_ladle_metal_ids",
        args: args,
        callback: function (r) {
            if (!r.message || r.message.length === 0) {
                let msg = destination 
                    ? __("No records found for Source: {0} → Destination: {1}", [source, destination])
                    : __("No records found for Source: {0}", [source]);
                frappe.msgprint(msg);
                return;
            }

            let ladle_metal_docs = r.message;

            frm.clear_table(childfield);

            ladle_metal_docs.forEach(function (doc) {
                let row = frm.add_child(childfield);
                row.ladle_metal_id = doc.name;
                row.total_weight_in_kg = doc.total_weight_in_kg;
                row.start_time = doc.start_time;
                row.end_time = doc.end_time;

                // For table_ibpu only
                if (childfield === "table_ibpu") {
                    if (doc.ladle_type) row.ladle_id = doc.ladle_type;
                    if (doc.grade_type) row.grade_type = doc.grade_type;
                }
            });

            frm.refresh_field(childfield);

            // Calculate total weight
            let totalWeight = 0;
            ladle_metal_docs.forEach(function (doc) {
                totalWeight += parseFloat(doc.total_weight_in_kg) || 0;
            });

            // Set total based on childfield
            if (childfield === "table_fjdd") {
                frm.set_value("total_metal_recieved", totalWeight);
            } else if (childfield === "table_ibpu") {
                frm.set_value("total_metal_discharged", totalWeight);
            }

            let displayName = childfield === "table_fjdd" ? "Metal Recieved" : "Metal Discharged";

            frappe.show_alert({
                message: __("{0} record(s) added to {1}", [ladle_metal_docs.length, displayName]),
                indicator: 'green'
            }, 5);
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

// frappe.ui.form.on("Holding Furnace Heat", {
frappe.ui.form.on("Holding Furnace Heat", {
    refresh(frm) {
        if(frm.doc.date){
            update_ladle_totals(frm);
        }
    },
    date(frm){                     // 👈 date change = auto update
        update_ladle_totals(frm);
    }
});

function update_ladle_totals(frm){
    if(!frm.doc.date) return;

    frappe.call({
        method: "victoryiron.victoryiron.doctype.holding_furnace_heat.holding_furnace_heat.get_ladle_totals",
        args: { date: frm.doc.date },   // 👈 no default today
        callback(r){
            let d = r.message || {};

            frm.set_value("punching", d.punching || 0);
            frm.set_value("inoculant", d.inoculant || 0);
            frm.set_value("fesimg", d.fesimg || 0);
        }
    });
}

frappe.ui.form.on("Holding Furnace Heat", {
    furnace_meter_reading_start: calculate_units,
    furnace_meter_reading_end: calculate_units,
    cooling_tower_meter_reading_start: calculate_units,
    cooling_tower_meter_reading_end: calculate_units
});

function calculate_units(frm) {
    let furnace_units = 0;
    let cooling_units = 0;

    if (frm.doc.furnace_meter_reading_start && frm.doc.furnace_meter_reading_end) {
        furnace_units =
            frm.doc.furnace_meter_reading_end -
            frm.doc.furnace_meter_reading_start;
    }

    if (frm.doc.cooling_tower_meter_reading_start && frm.doc.cooling_tower_meter_reading_end) {
        cooling_units =
            frm.doc.cooling_tower_meter_reading_end -
            frm.doc.cooling_tower_meter_reading_start;
    }

    frm.set_value("total_furnace_unit_consumed", furnace_units);
    frm.set_value("total_cooling_tower_unit_consumed", cooling_units);
    frm.set_value("total_units", furnace_units + cooling_units);
}