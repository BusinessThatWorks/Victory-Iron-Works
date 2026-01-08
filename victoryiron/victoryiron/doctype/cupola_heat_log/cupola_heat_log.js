console.log("Cupola Heat log JS loaded");

const DEFAULT_RETURN_ITEMS = [
	"Hard Coke",
	"Flux Lime Stone",
	"Sand Pig Iron",
	"Pig Iron",
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

	onload: async function (frm) {
        if (frm.is_new()) {
            await add_default_consumption_items(frm);
        }
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

//fetch store stock for consumption items
frappe.ui.form.on("Consumption Table", {
	item_name(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		console.log("🟡 item_name changed:", row.item_name);

		if (!row.item_name) {
			console.log("⚠️ item_name empty, setting stock 0");
			frappe.model.set_value(cdt, cdn, "store_stock", 0);
			return;
		}

		console.log("📞 Calling get_store_stock API...");

		frappe.call({
			method: "victoryiron.api.get_store_stock.get_store_stock",
			args: {
				item_name: row.item_name
			},
			callback: function (r) {
				console.log("✅ API response:", r);

				frappe.model.set_value(
					cdt,
					cdn,
					"store_stock",
					flt(r.message)
				);
			},
			error: function (err) {
				console.error("❌ API error:", err);
			}
		});
	}
});




async function add_default_consumption_items(frm) {
	if (frm.doc.consumption_table?.length) return;

	const r = await frappe.call({
		method: "victoryiron.victoryiron.doctype.cupola_heat_log.cupola_heat_log.get_cupola_consumption_items"
	});

	(r.message || []).forEach(item => {
		const row = frm.add_child("consumption_table", {
			item_name: item.name,
			uom: item.stock_uom,
			valuation_rate: item.valuation_rate
		});
		fetch_store_stock_for_row(frm, row);
	});
	refresh_field(CONSUMPTION_TABLE);
}
function fetch_store_stock_for_row(frm, row) {
	if (!row.item_name) return;

	frappe.call({
		method: "victoryiron.api.get_store_stock.get_store_stock",
		args: {
			item_name: row.item_name
		},
		callback: function (r) {
			frappe.model.set_value(
				row.doctype,
				row.name,
				"store_stock",
				flt(r.message)
			);
		}
	});
}

//end calculating total valuation cost - 
frappe.ui.form.on("Consumption Table", {
	quantity(frm, cdt, cdn) {
		update_row_total_and_parent(frm, cdt, cdn);
	},
	valuation_rate(frm, cdt, cdn) {
		update_row_total_and_parent(frm, cdt, cdn);
	},
	after_delete(frm) {
		recalculate_parent_total(frm);
	}
});
function update_row_total_and_parent(frm, cdt, cdn) {
	const row = locals[cdt][cdn];

	// 1️⃣ Calculate row total
	const qty = flt(row.quantity);
	const rate = flt(row.valuation_rate);
	const total = qty * rate;

	// 2️⃣ Update child row
	frappe.model.set_value(cdt, cdn, "total_valuation", total);

	// 3️⃣ Update parent field total_charge_mix_calculation
	let parent_total = 0;
	(frm.doc.consumption_table || []).forEach(r => {
		parent_total += flt(r.total_valuation);
	});

	// 4️⃣ Set parent field (no full refresh needed)
	frm.set_value("total_charge_mix_calculation", parent_total);
}
function recalculate_parent_total(frm) {
	let total = 0;

	(frm.doc.consumption_table || []).forEach(r => {
		total += flt(r.total_valuation);
	});

	frm.model.set_value("total_charge_mix_calculation", total);
}
const CHARGE_MIX_ITEM_SET = new Set([
	"pig iron",
	"sand pig iron",
	"ci foundry return",
	"di foundry return",
	"mould box scrap",
	"ms scrap",
	"ms ci scrap"
]);
frappe.ui.form.on("Consumption Table", {
	quantity(frm) {
		recalculate_charge_mix_quantity(frm);
	},
	item_name(frm) {
		recalculate_charge_mix_quantity(frm);
	},
	
});
function recalculate_charge_mix_quantity(frm) {
	let total_qty = 0;

	(frm.doc.consumption_table || []).forEach(row => {
		const item = (row.item_name || row.item_code || "")
			.trim()
			.toLowerCase();

		if (CHARGE_MIX_ITEM_SET.has(item)) {
			total_qty += flt(row.quantity);
		}
	});

	frm.set_value("total_charge_mix_quantity", total_qty);
}

/**
 * Calculate Total Melting Hours based on the difference between
 * Blower On for Melting and Cupola Drop At times
 */
//blower metling hours
function calculate_total_melting_hours(frm) {
	// Get the time values
	let blower_on = frm.doc.blower_on_for_melting;
	let cupola_drop = frm.doc.cupola_drop_at;

	// If either field is empty, set total melting hours to 0
	if (!blower_on || !cupola_drop) {
		frm.set_value("total_melting_hours", "0 hr 0 min");
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
		let hr_min_string = `${hours} hr ${minutes} min`;

		// Set the calculated value in hr/min format
		frm.set_value("total_melting_hours", hr_min_string);

		// Calculate decimal hours for logging
		let decimal_hours = (diff_seconds / 3600).toFixed(2);
	} catch (error) {
		frm.set_value("total_melting_hours", "0 hr 0 min");
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

//cupola heat log average melting rate calculation
function parse_melting_hours(value) {
	if (!value) return 0;

	// Expected format: "Xhr Ymin"
	let hours = 0;
	let minutes = 0;

	const hrMatch = value.match(/(\d+)\s*hr/);
	const minMatch = value.match(/(\d+)\s*min/);

	if (hrMatch) {
		hours = parseInt(hrMatch[1]);
	}

	if (minMatch) {
		minutes = parseInt(minMatch[1]);
	}

	return hours + minutes / 60;
}
frappe.ui.form.on("Cupola Heat log", {
	firingprep_details(frm) {
		if (frm.doc.firingprep_details) {
			calculate_avg_melting_rate(frm);
			calculate_coke_metal_ratio(frm);
			calculate_flux_metal_ratio(frm);
		} else {
			frm.set_value("average_melting_rate", 0);
			frm.set_value("melting", "");
			frm.set_value("lime_stone", "");
		}
	},

	total_melting_hours(frm) {
		if (frm.doc.firingprep_details) {
			calculate_avg_melting_rate(frm);
		}
	},
});
function calculate_avg_melting_rate(frm) {
	console.log("calculate_avg_melting_rate loaded");

	if (!frm.doc.date) {
		frappe.msgprint(__("Please select Date first"));
		// Uncheck the checkbox
		frm.set_value("firingprep_details", 0);
		return;
	}

	const melting_hours = parse_melting_hours(frm.doc.total_melting_hours);

	if (!melting_hours || melting_hours === 0) {
		frm.set_value("average_melting_rate", 0);
		return;
	}

	frappe.call({
		method: "victoryiron.victoryiron.doctype.cupola_heat_log.cupola_heat_log.get_day_total_charge",
		args: {
			date: frm.doc.date,
		},
		callback: function (r) {
			if (r.message !== undefined) {
				const total_qty = flt(r.message);
				const avg_rate_kg = total_qty / melting_hours;
				const avg_rate_ton = avg_rate_kg / 1000;

				frm.set_value("average_melting_rate", avg_rate_ton.toFixed(2) + " tons");
			}
		},
	});
}
//cupola heat log average melting rate calculation end

//cupola heat log hard cok ratio calculation
function calculate_coke_metal_ratio(frm) {
	console.log("calculate_coke_metal_ratio loaded");
	if (!frm.doc.date) return;

	frappe.call({
		method: "victoryiron.victoryiron.doctype.cupola_heat_log.cupola_heat_log.get_coke_metal_ratio",
		args: {
			date: frm.doc.date,
		},
		callback: function (r) {
			if (r.message !== undefined) {
				if (r.message === 0) {
					frm.set_value("melting", "0");
				} else {
					frm.set_value("melting", `1 : ${r.message}`);
				}
			}
		},
	});
}
//cupola heat log hard coke ratio calculation end

function calculate_flux_metal_ratio(frm) {
	if (!frm.doc.date) return;

	frappe.call({
		method: "victoryiron.victoryiron.doctype.cupola_heat_log.cupola_heat_log.get_flux_metal_ratio",
		args: {
			date: frm.doc.date,
		},
		callback: function (r) {
			if (r.message !== undefined) {
				if (r.message === 0) {
					frm.set_value("lime_stone", "0");
				} else {
					frm.set_value("lime_stone", `1 : ${r.message}`);
				}
			}
		},
	});
}
frappe.ui.form.on("Cupola Heat log", {
	metal_out_at: function (frm) {
		calculate_total_melting_hours_metal_out(frm);
	},
	cupola_drop_at: function (frm) {
		calculate_total_melting_hours_metal_out(frm);
	},
	total_melting_hours_metal_out: function (frm) {
		calculate_avg_melting_rate_metal_out(frm);
	},
});

function calculate_total_melting_hours_metal_out(frm) {
	let metal_out = frm.doc.metal_out_at;
	let cupola_drop = frm.doc.cupola_drop_at;

	// If either field is empty, set total melting hours to 0
	if (!metal_out || !cupola_drop) {
		frm.set_value("total_melting_hours_metal_out", "0 hr 0 min");
		return;
	}

	try {
		let start_time = parse_time_to_seconds(metal_out);
		let end_time = parse_time_to_seconds(cupola_drop);

		let diff_seconds = end_time - start_time;

		// Handle crossing midnight
		if (diff_seconds < 0) {
			diff_seconds += 86400; // 24 hours in seconds
		}

		// Safety check
		if (diff_seconds < 0) diff_seconds = 0;

		let hours = Math.floor(diff_seconds / 3600);
		let minutes = Math.floor((diff_seconds % 3600) / 60);

		let hr_min_string = `${hours} hr ${minutes} min`;

		frm.set_value("total_melting_hours_metal_out", hr_min_string);
	} catch (error) {
		frm.set_value("total_melting_hours_metal_out", "0 hr 0 min");
		frappe.msgprint({
			title: __("Calculation Error"),
			message: __(
				"There was an error calculating Total Melting Hours (Metal Out). Please check the time values."
			),
			indicator: "red",
		});
	}
}

function calculate_avg_melting_rate_metal_out(frm) {
	console.log("calculate_avg_melting_rate_metal out loaded");

	if (!frm.doc.date) {
		frappe.msgprint(__("Please select Date first"));
		// Uncheck the checkbox
		frm.set_value("firingprep_details", 0);
		return;
	}

	const melting_hours = parse_melting_hours(frm.doc.total_melting_hours_metal_out);

	if (!melting_hours || melting_hours === 0) {
		frm.set_value("average_melting_rate_metal_out", 0);
		return;
	}

	frappe.call({
		method: "victoryiron.victoryiron.doctype.cupola_heat_log.cupola_heat_log.get_day_total_charge",
		args: {
			date: frm.doc.date,
		},
		callback: function (r) {
			if (r.message !== undefined) {
				const total_qty = flt(r.message);
				const avg_rate_kg = total_qty / melting_hours;
				const avg_rate_ton = avg_rate_kg / 1000;

				frm.set_value("average_melting_rate_metal_out", avg_rate_ton.toFixed(2) + " tons");
			}
		},
	});
}
