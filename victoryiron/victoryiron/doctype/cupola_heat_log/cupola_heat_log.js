// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Cupola Heat log", {
// 	refresh(frm) {
//
// 	},
// });

const DEFAULT_RETURN_ITEMS = [
	"Hard Coke",
	"Flux Lime Stone",
	"PIG - Less then 1.0 - Grade",
	"Pig Iron",
	"Sand Pig Iron",
	"DS Block",
	"Ferro Manganese",
	"Ferro Silicon",
	"CI Foundry Return",
	"DI Foundry Return",
	"MS Scrap",
	"MS CI Scrap",
	"Mould Box Scrap",
];
const CONSUMPTION_TABLE = "consumption_table";
const RETURN_ITEM_SET = new Set(
	[
		"CI Foundry Return",
		"DI Foundry Return",
		"Pig Iron",
		"PIG - Less then 1.0 - Grade",
		"Sand Pig Iron",
		"Mould Box Scrap",
		"MS Scrap",
		"MS CI Scrap",
	].map((i) => i.toLowerCase())
);

frappe.ui.form.on("Cupola Heat log", {
	// Ensure default items exist when form loads or refreshes
	onload: async function (frm) {
		await add_default_consumption_items(frm);
	},
	refresh: async function (frm) {
		await add_default_consumption_items(frm);
	},

	// When child table changes: recalc parent totals
	consumption_table_add: function (frm, cdt, cdn) {
		update_child_totals(frm);
	},
	consumption_table_remove: function (frm, cdt, cdn) {
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
				// Auto-calculate total_valuation when item changes
				calculate_row_total_valuation(frm, cdt, cdn);
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
		// DO NOT recalculate total_valuation here - it may be manually entered
		// Only update parent totals by reading existing values
		update_child_totals(frm);
	},

	valuation_rate: function (frm, cdt, cdn) {
		// Auto-calculate total_valuation when rate changes
		calculate_row_total_valuation(frm, cdt, cdn);
		update_child_totals(frm);
	},

	// Ensure parent total updates if total_valuation is edited directly
	total_valuation: function (frm, cdt, cdn) {
		// User manually changed total_valuation - just update parent totals
		update_child_totals(frm);
	},
});

/**
 * Calculate and set total_valuation for a row based on qty * rate
 * Only call this when you want to OVERWRITE the total_valuation
 */
function calculate_row_total_valuation(frm, cdt, cdn) {
	let row = frappe.get_doc(cdt, cdn);
	let qty = parseFloat(row.quantity) || 0;
	let rate = parseFloat(row.valuation_rate) || 0;
	let total = qty * rate;
	frappe.model.set_value(cdt, cdn, "total_valuation", total);
}

/**
 * Update parent totals by aggregating child table values
 * IMPORTANT: This function only READS child values and WRITES to parent
 * It does NOT modify any child row values
 */
function update_child_totals(frm) {
	let total_qty = 0;
	let total_val = 0;
	let return_qty = 0;

	// Read-only aggregation - do NOT modify child rows
	(frm.doc.consumption_table || []).forEach((row) => {
		const qty = parseFloat(row.quantity) || 0;
		const val = parseFloat(row.total_valuation) || 0;

		total_qty += qty;
		total_val += val;

		// Only sum CI/DI Foundry Return quantities
		const item_key = (row.item_name || row.item_code || "").trim().toLowerCase();
		if (RETURN_ITEM_SET.has(item_key)) {
			return_qty += qty;
		}
	});

	// Update parent fields only - using set_value to avoid triggering child refresh
	frm.set_value("total_charge_mix_quantity", return_qty); // CI/DI returns only
	frm.set_value("total_charge_mix_calculation", total_val);

	// Only refresh parent fields, NOT the child table
	frm.refresh_fields(["total_charge_mix_quantity", "total_charge_mix_calculation"]);
}

// Insert CI/DI Foundry Return rows when missing
async function add_default_consumption_items(frm) {
	// prevent overlapping calls on the same form instance
	if (frm._adding_default_consumption_items) return;
	frm._adding_default_consumption_items = true;

	try {
		const rows = frm.doc[CONSUMPTION_TABLE] || [];
		const existing = new Set(
			rows
				.map((r) => (r.item_name || r.item_code || "").trim().toLowerCase())
				.filter(Boolean)
		);

		for (const label of DEFAULT_RETURN_ITEMS) {
			if (existing.has(label.toLowerCase())) continue;

			const item = await fetch_item_by_label(label);
			if (!item?.name) {
				frappe.msgprint({
					title: __("Item not found"),
					message: __(`Could not find Item with code/name "${label}".`),
					indicator: "red",
				});
				continue;
			}

			frm.add_child(CONSUMPTION_TABLE, {
				item_name: item.name,
				uom: item.stock_uom,
			});
			console.log(item.name);

		}
		

		frm.refresh_field(CONSUMPTION_TABLE);
	} finally {
		frm._adding_default_consumption_items = false;
	}
}

// Fetch Item by code or name (exact first, then a case-insensitive like)
async function fetch_item_by_label(label) {
	const key = (label || "").trim();
	if (!key) return null;

	// exact item_code
	const by_code = await frappe.db.get_value("Item", { item_code: key }, [
		"name",
		"item_name",
		"stock_uom",
		"disabled",
	]);
	if (by_code?.name && !by_code.disabled) return by_code;

	// exact item_name
	const by_name = await frappe.db.get_value("Item", { item_name: key }, [
		"name",
		"item_name",
		"stock_uom",
		"disabled",
	]);
	if (by_name?.name && !by_name.disabled) return by_name;

	// case-insensitive fallback search
	const like_hits = await frappe.db.get_list("Item", {
		fields: ["name", "item_name", "stock_uom", "disabled"],
		filters: { disabled: 0 },
		or_filters: [
			["item_code", "like", `%${key}%`],
			["item_name", "like", `%${key}%`],
		],
		limit: 1,
	});
	return like_hits && like_hits.length ? like_hits[0] : null;
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
		frm.set_value("total_melting_hours", "0hr0min");
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

		let hours = Math.floor(diff_seconds / 3600);
		let minutes = Math.floor((diff_seconds % 3600) / 60);
		let seconds = Math.floor(diff_seconds % 60);

		// Format as hr/min (example: 1hr4min)
		let hr_min_string = `${hours}hr ${minutes}min`;

		// Set the calculated value in hr/min format
		frm.set_value("total_melting_hours", hr_min_string);

		// Calculate decimal hours for logging
		let decimal_hours = (diff_seconds / 3600).toFixed(2);
	} catch (error) {
		frm.set_value("total_melting_hours", "0hr0min");
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
