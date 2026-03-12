// Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

// Items to EXCLUDE from Total Charge Mix (Kg) calculation
const EXCLUDE_FROM_WEIGHT_TOTAL = [
    "Carburiser (D.I)",
    "Ferro Silicon",
    "Ferro Manganese"
];

frappe.ui.form.on("Induction Furnace Heat", {
    refresh(frm) {
        frm.trigger("firingprep_details");
        frm.trigger("material_grade");
    },

    onload(frm) {
        frm.trigger("firingprep_details");
        frm.trigger("material_grade");
        
        // Add default items only for new documents
        if (frm.is_new() && (!frm.doc.charge_mix_component_item || frm.doc.charge_mix_component_item.length === 0)) {
            frappe.call({
                method: "victoryiron.victoryiron.doctype.induction_furnace_heat.induction_furnace_heat.get_default_charge_mix_items",
                callback: function(r) {
                    if (r.message) {
                        r.message.forEach(function(item_data) {
                            frm.add_child("charge_mix_component_item", {
                                item: item_data.item,
                                weight_in_kg: 0,
                                rate: item_data.rate,
                                amount: 0
                            });
                        });
                        frm.refresh_field("charge_mix_component_item");
                    }
                }
            });
        }
        // Add default treatment items only for new documents
        if (frm.is_new() && (!frm.doc.table_bych || frm.doc.table_bych.length === 0)) {
            frappe.call({
                method: "victoryiron.victoryiron.doctype.induction_furnace_heat.induction_furnace_heat.get_default_treatment_mix_items",
                callback: function(r) {
                    if (r.message) {
                        r.message.forEach(function(item_data) {
                            frm.add_child("table_bych", {
                                item: item_data.item,
                                weight_in_kg: 0,
                                rate: item_data.rate,
                                amount: 0
                            });
                        });
                        frm.refresh_field("table_bych");
                    }
                }
            });
        }
    },

    // 1. Checkbox - Hide all tabs except Firing/Prep and Details
    firingprep_details(frm) {
        let hide = frm.doc.firingprep_details ? 1 : 0;
        
        frm.set_df_property("charge_mix_tab", "hidden", hide);
        frm.set_df_property("additional_cost_tab", "hidden", hide);
        frm.set_df_property("extra_tab", "hidden", hide);
        
        frm.refresh_fields();
    },

    // 4. Material Grade - CI hides treatment, DI shows both, Default = CI behavior
    material_grade(frm) {
        let hide_treatment = 1; // Default: hide treatment (CI behavior)
        
        if (frm.doc.material_grade === "DI") {
            hide_treatment = 0; // Show treatment for DI
        }
        
        frm.set_df_property("treatment_consumption_section", "hidden", hide_treatment);
        frm.set_df_property("table_bych", "hidden", hide_treatment);
        frm.set_df_property("section_break_ovpy", "hidden", hide_treatment);
        frm.set_df_property("total_treatment_quantity", "hidden", hide_treatment);
        frm.set_df_property("total_treatment_valuation", "hidden", hide_treatment);
        frm.set_df_property("column_break_ztnm", "hidden", hide_treatment);
        
        frm.refresh_fields();
    },

    // 6. Furnace Running Time Calculation
    furnace_on_time(frm) {
        calculate_furnace_running_time(frm);
    },

    furnace_off_time(frm) {
        calculate_furnace_running_time(frm);
    },

    // 7. Furnace Unit Consumed Calculation
    furnace_meter_reading_start(frm) {
        calculate_furnace_unit_consumed(frm);
    },

    furnace_meter_reading_end(frm) {
        calculate_furnace_unit_consumed(frm);
    },
    
    heat_start_at(frm) {
        calculate_melting_time(frm);
    },

    heat_end_at(frm) {
        calculate_melting_time(frm);
    },
});

// 6. Calculate Furnace Running Time (in hours)
function calculate_furnace_running_time(frm) {
    if (frm.doc.furnace_on_time && frm.doc.furnace_off_time) {
        let on_time = moment(frm.doc.furnace_on_time, "HH:mm:ss");
        let off_time = moment(frm.doc.furnace_off_time, "HH:mm:ss");
        
        let diff_hours = off_time.diff(on_time, 'hours', true);
        
        // Handle next day case (night shift)
        if (diff_hours < 0) {
            diff_hours += 24;
        }
        
        frm.set_value("total_furnace_running_time", diff_hours.toFixed(2) + " Hours");
    }
}

// 7. Calculate Furnace Unit Consumed
function calculate_furnace_unit_consumed(frm) {
    let start = frm.doc.furnace_meter_reading_start;
    let end = frm.doc.furnace_meter_reading_end;
    
    if (start !== null && start !== undefined && end !== null && end !== undefined) {
        let consumed = flt(end) - flt(start);
        frm.set_value("total_furnace_unit_consumed", consumed);
    }
}

// 5. Calculate Charge Mix Totals
// Weight EXCLUDES: Carburiser, Ferro Silicon, Ferro Manganese
// Valuation INCLUDES: All items
function calculate_charge_mix_totals(frm) {
    let total_weight = 0;
    let total_valuation = 0;

    (frm.doc.charge_mix_component_item || []).forEach(row => {
        // Add to valuation (ALL items)
        total_valuation += flt(row.amount);
        
        // Add to weight ONLY if NOT in exclude list
        if (!EXCLUDE_FROM_WEIGHT_TOTAL.includes(row.item)) {
            total_weight += flt(row.weight_in_kg);
        }
    });

    frm.set_value("total_charge_mix_kg", total_weight);
    frm.set_value("total_charge_mix_valuation", total_valuation);
}

// 5. Calculate Treatment Totals
function calculate_treatment_totals(frm) {
    let total_quantity = 0;
    let total_valuation = 0;

    (frm.doc.table_bych || []).forEach(row => {
        total_quantity += flt(row.weight_in_kg);
        total_valuation += flt(row.amount);
    });

    frm.set_value("total_treatment_quantity", total_quantity);
    frm.set_value("total_treatment_valuation", total_valuation);
}

// Calculate Melting Time (Heat End - Heat Start)
function calculate_melting_time(frm) {
    if (frm.doc.heat_start_at && frm.doc.heat_end_at) {
        let start = moment(frm.doc.heat_start_at, "HH:mm:ss");
        let end = moment(frm.doc.heat_end_at, "HH:mm:ss");
        
        let diff_minutes = end.diff(start, 'minutes');
        
        // Handle next day case
        if (diff_minutes < 0) {
            diff_minutes += 1440; // 24 hours in minutes
        }
        
        let hours = Math.floor(diff_minutes / 60);
        let mins = diff_minutes % 60;
        
        // Format as HH:mm:ss for Time field
        let time_str = String(hours).padStart(2, '0') + ":" + String(mins).padStart(2, '0') + ":00";
        frm.set_value("melting_time", time_str);
    }
}

// ============ CHARGE MIX COMPONENT CHILD TABLE ============
frappe.ui.form.on("Charge Mix Component", {
    
    item(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.item) {
            frappe.call({
                method: "victoryiron.victoryiron.doctype.induction_furnace_heat.induction_furnace_heat.get_item_valuation_rate",
                args: { item_code: row.item },
                callback: function(r) {
                    if (r.message !== undefined) {
                        frappe.model.set_value(cdt, cdn, "rate", r.message);
                        if (row.weight_in_kg) {
                            let amount = flt(row.weight_in_kg) * flt(r.message);
                            frappe.model.set_value(cdt, cdn, "amount", amount);
                        }
                        calculate_charge_mix_totals(frm);
                    }
                }
            });
        }
    },

    weight_in_kg(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.rate) {
            let amount = flt(row.weight_in_kg) * flt(row.rate);
            frappe.model.set_value(cdt, cdn, "amount", amount);
        }
        calculate_charge_mix_totals(frm);
    },

    rate(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight_in_kg) {
            let amount = flt(row.weight_in_kg) * flt(row.rate);
            frappe.model.set_value(cdt, cdn, "amount", amount);
        }
        calculate_charge_mix_totals(frm);
    },

    charge_mix_component_item_remove(frm) {
        calculate_charge_mix_totals(frm);
    }
});


// ============ TREATMENT MIX COMPONENT CHILD TABLE ============
frappe.ui.form.on("Treatment Mix Component Table", {
    
    item(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.item) {
            frappe.call({
                method: "victoryiron.victoryiron.doctype.induction_furnace_heat.induction_furnace_heat.get_item_valuation_rate",
                args: { item_code: row.item },
                callback: function(r) {
                    if (r.message !== undefined) {
                        frappe.model.set_value(cdt, cdn, "rate", r.message);
                        if (row.weight_in_kg) {
                            let amount = flt(row.weight_in_kg) * flt(r.message);
                            frappe.model.set_value(cdt, cdn, "amount", amount);
                        }
                        calculate_treatment_totals(frm);
                    }
                }
            });
        }
    },

    weight_in_kg(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.rate) {
            let amount = flt(row.weight_in_kg) * flt(row.rate);
            frappe.model.set_value(cdt, cdn, "amount", amount);
        }
        calculate_treatment_totals(frm);
    },

    rate(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.weight_in_kg) {
            let amount = flt(row.weight_in_kg) * flt(row.rate);
            frappe.model.set_value(cdt, cdn, "amount", amount);
        }
        calculate_treatment_totals(frm);
    },

    table_bych_remove(frm) {
        calculate_treatment_totals(frm);
    }
});