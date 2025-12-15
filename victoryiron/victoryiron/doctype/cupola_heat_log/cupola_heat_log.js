// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Cupola Heat log", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Cupola Heat log", {
	// When child table changes: recalc parent totals
	consumption_table_add: function (frm, cdt, cdn) {
		console.log("Row added to consumption_table");
		update_child_totals(frm);
	},
	consumption_table_remove: function (frm, cdt, cdn) {
		console.log("Row removed from consumption_table");
		update_child_totals(frm);
	},

	// Calculate total melting hours when blower_on_for_melting changes
	blower_on_for_melting: function (frm) {
		calculate_total_melting_hours(frm);
	},

	// Calculate total melting hours when cupola_drop_at changes
	cupola_drop_at: function (frm) {
		calculate_total_melting_hours(frm);
	},
});
frappe.ui.form.on("Consumption Table", {
	item_name: function (frm, cdt, cdn) {
		let row = frappe.get_doc(cdt, cdn);
		console.log(`item_name changed to ${row.item_name} in row ${cdn}`);

		if (!row.item_name) {
			frappe.model.set_value(cdt, cdn, "valuation_rate", 0);
			frappe.model.set_value(cdt, cdn, "total_valuation", 0);
			return;
		}
		// Fetch valuation_rate from Item doctype
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Item",
				filters: { item_name: row.item_name },
				fieldname: "valuation_rate",
			},
			callback: function (r) {
				let rate = 0;
				if (r.message) {
					rate = r.message.valuation_rate || 0;
				}
				frappe.model.set_value(cdt, cdn, "valuation_rate", rate);
				console.log(`Fetched valuation_rate for ${row.item_name}: ${rate}`);
				update_row_total_valuation(frm, cdt, cdn);
				update_child_totals(frm);
			},
		});

		// Call your store stock API
		frappe.call({
			method: "victoryiron.api.get_store_stock.get_store_stock",
			args: { item_name: row.item_name },
			callback: function (r) {
				let stock = r.message || 0;
				frappe.model.set_value(cdt, cdn, "store_stock", stock);
				console.log(`Fetched store_stock for ${row.item_name}: ${stock}`);
			},
		});
	},

	quantity: function (frm, cdt, cdn) {
		console.log(`quantity changed in row ${cdn}`);
		update_row_total_valuation(frm, cdt, cdn);
		update_child_totals(frm);
	},

	valuation_rate: function (frm, cdt, cdn) {
		console.log(`valuation_rate changed in row ${cdn}`);
		update_row_total_valuation(frm, cdt, cdn);
		update_child_totals(frm);
	},
});

function update_row_total_valuation(frm, cdt, cdn) {
	let row = frappe.get_doc(cdt, cdn);
	let qty = parseFloat(row.quantity) || 0;
	let rate = parseFloat(row.valuation_rate) || 0;
	let total = qty * rate;
	frappe.model.set_value(cdt, cdn, "total_valuation", total);
	console.log(`Row ${cdn} total_valuation updated: ${qty} * ${rate} = ${total}`);
}

function update_child_totals(frm) {
	let total_qty = 0;
	let total_val = 0;

	(frm.doc.consumption_table || []).forEach((row) => {
		total_qty += parseFloat(row.quantity) || 0;
		total_val += parseFloat(row.total_valuation) || 0;
	});

	frm.set_value("total_charge_mix_quantity", total_qty);
	frm.set_value("total_charge_mix_calculation", total_val);

	console.log(
		`Updated parent totals: total_charge_mix_quantity = ${total_qty}, total_charge_mix_calculation = ${total_val}`
	);
	frm.refresh_fields(["total_charge_mix_quantity", "total_charge_mix_calculation"]);
}

/**
 * Calculate Total Melting Hours based on the difference between
 * Blower On for Melting and Cupola Drop At times
 */
function calculate_total_melting_hours(frm) {
	// Get the time values
	let blower_on = frm.doc.blower_on_for_melting;
	let cupola_drop = frm.doc.cupola_drop_at;

	// If either field is empty, set total melting hours to 0
	if (!blower_on || !cupola_drop) {
		frm.set_value("total_melting_hours", "0:00:00");
		console.log("One or both time fields are empty. Total melting hours set to 0.");
		return;
	}

	try {
		// Convert time strings to Date objects for calculation
		// Time format in Frappe is typically "HH:MM:SS"
		let start_time = parse_time_to_seconds(blower_on);
		let end_time = parse_time_to_seconds(cupola_drop);

		// Calculate difference in seconds
		let diff_seconds = end_time - start_time;

		// Handle case where cupola_drop_at is before blower_on_for_melting
		// This could happen if the operation spans midnight
		if (diff_seconds < 0) {
			// Add 24 hours (86400 seconds) to handle midnight crossing
			diff_seconds += 86400;
		}

		// Don't allow negative values (additional safety check)
		if (diff_seconds < 0) {
			diff_seconds = 0;
		}

		// Convert seconds back to HH:MM:SS format
		let hours = Math.floor(diff_seconds / 3600);
		let minutes = Math.floor((diff_seconds % 3600) / 60);
		let seconds = Math.floor(diff_seconds % 60);

		// Format as HH:MM:SS
		let time_string =
			String(hours).padStart(2, "0") +
			":" +
			String(minutes).padStart(2, "0") +
			":" +
			String(seconds).padStart(2, "0");

		// Set the calculated value
		frm.set_value("total_melting_hours", time_string);

		// Calculate decimal hours for logging
		let decimal_hours = (diff_seconds / 3600).toFixed(2);
		console.log(`Total Melting Hours calculated: ${time_string} (${decimal_hours} hours)`);
	} catch (error) {
		console.error("Error calculating total melting hours:", error);
		frm.set_value("total_melting_hours", "0:00:00");
		frappe.msgprint({
			title: __("Calculation Error"),
			message: __(
				"There was an error calculating the total melting hours. Please check the time values."
			),
			indicator: "red",
		});
	}
}

/**
 * Helper function to parse time string (HH:MM:SS or HH:MM) to total seconds
 */
function parse_time_to_seconds(time_str) {
	if (!time_str) return 0;

	// Handle both "HH:MM:SS" and "HH:MM" formats
	let parts = time_str.split(":");
	let hours = parseInt(parts[0]) || 0;
	let minutes = parseInt(parts[1]) || 0;
	let seconds = parseInt(parts[2]) || 0;

	return hours * 3600 + minutes * 60 + seconds;
}
