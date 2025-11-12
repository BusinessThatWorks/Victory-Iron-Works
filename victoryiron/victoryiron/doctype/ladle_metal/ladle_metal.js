// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ladle Metal", {
    refresh(frm) {
        console.log("Step 1: Ladle Metal form loaded/refreshed");
    },
});

// Event listener for charge_id field in child table "Ladle Metal Received From Cupola"
frappe.ui.form.on("Ladle Metal Received From Cupola", {
    start_time: function (frm, cdt, cdn) {
        console.log("Time Step 1: start_time event listener triggered");
        calculate_duration(frm, cdt, cdn);
    },

    end_time: function (frm, cdt, cdn) {
        console.log("Time Step 1: end_time event listener triggered");
        calculate_duration(frm, cdt, cdn);
    },

    charge_id: function (frm, cdt, cdn) {
        console.log("Step 1: Event listener triggered for charge_id field");
        console.log("Step 2: Parameters received - frm:", frm, "cdt:", cdt, "cdn:", cdn);

        // Get the row data
        let row = locals[cdt][cdn];
        console.log("Step 3: Row data retrieved from locals:", row);

        // Log the charge_id value
        let charge_id_value = row.charge_id;
        console.log("Step 4: charge_id value:", charge_id_value);

        // Check if charge_id has a value
        if (!charge_id_value) {
            console.log("Step 5: charge_id is empty, skipping fetch");
            return;
        }

        console.log("Step 6: Starting to fetch Cupola Heat log document with name:", charge_id_value);

        // Fetch the Cupola Heat log document
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Cupola Heat log",
                name: charge_id_value
            },
            callback: function (r) {
                console.log("Step 7: Response received from frappe.client.get");

                if (r.message) {
                    console.log("Step 8: Cupola Heat log document found:", r.message);
                    console.log("Step 9: Document name:", r.message.name);

                    // Get the consumption_table from the fetched document
                    let consumption_table_rows = r.message.consumption_table || [];
                    console.log("Step 10: consumption_table rows found:", consumption_table_rows);
                    console.log("Step 11: Number of rows:", consumption_table_rows.length);

                    if (consumption_table_rows.length > 0) {
                        console.log("Step 12: First row sample:", JSON.stringify(consumption_table_rows[0], null, 2));

                        // Get current row count before adding new rows
                        let current_row_count = (frm.doc.table_zvhx || []).length;
                        console.log("Step 13: Current table_zvhx rows count before adding:", current_row_count);

                        // Copy each row from consumption_table to table_zvhx (append, don't clear)
                        consumption_table_rows.forEach(function (source_row, index) {
                            console.log(`Step 14.${index + 1}: Processing row ${index + 1} from charge_id ${charge_id_value}:`, source_row);

                            // Create a new row in table_zvhx (this appends, doesn't replace)
                            let new_row = frm.add_child("table_zvhx");
                            console.log(`Step 15.${index + 1}: Created new row in table_zvhx`);

                            // Copy all the required fields
                            new_row.item_name = source_row.item_name || null;
                            console.log(`Step 16.${index + 1}: Set item_name:`, new_row.item_name);

                            new_row.quantity = source_row.quantity || 0;
                            console.log(`Step 17.${index + 1}: Set quantity:`, new_row.quantity);

                            new_row.valuation_rate = source_row.valuation_rate || 0;
                            console.log(`Step 18.${index + 1}: Set valuation_rate:`, new_row.valuation_rate);

                            new_row.uom = source_row.uom || null;
                            console.log(`Step 19.${index + 1}: Set uom:`, new_row.uom);

                            new_row.store_stock = source_row.store_stock || 0;
                            console.log(`Step 20.${index + 1}: Set store_stock:`, new_row.store_stock);

                            new_row.total_valuation = source_row.total_valuation || 0;
                            console.log(`Step 21.${index + 1}: Set total_valuation:`, new_row.total_valuation);

                            console.log(`Step 22.${index + 1}: Complete row data:`, JSON.stringify(new_row, null, 2));
                        });

                        console.log("Step 23: All rows from charge_id", charge_id_value, "copied to table_zvhx");

                        // Group rows by item_name and aggregate values
                        group_rows_by_item_name(frm);
                        console.log("Step 24: Grouped rows by item_name");

                        // Refresh the table field
                        frm.refresh_field("table_zvhx");
                        console.log("Step 25: Refreshed table_zvhx field");

                        let final_row_count = (frm.doc.table_zvhx || []).length;
                        console.log("Step 26: Final table_zvhx rows count after grouping:", final_row_count);
                        console.log("Step 27: Added", (final_row_count - current_row_count), "new rows (after grouping)");
                    } else {
                        console.log("Step 12: No rows found in consumption_table for charge_id:", charge_id_value);
                    }
                } else {
                    console.log("Step 8: Cupola Heat log document not found for charge_id:", charge_id_value);
                }
            },
            error: function (r) {
                console.log("Step 7: Error fetching Cupola Heat log:", r);
            }
        });
    }
});

// Function to group rows by item_name and aggregate values
function group_rows_by_item_name(frm) {
    console.log("Grouping Step 1: Starting to group rows by item_name");

    let all_rows = frm.doc.table_zvhx || [];
    console.log("Grouping Step 2: Total rows before grouping:", all_rows.length);

    if (all_rows.length === 0) {
        console.log("Grouping Step 3: No rows to group");
        return;
    }

    // Create a map to group rows by item_name
    let grouped_map = {};

    // Group rows by item_name
    all_rows.forEach(function (row, index) {
        console.log(`Grouping Step 4.${index + 1}: Processing row ${index + 1} with item_name:`, row.item_name);

        let item_name = row.item_name || '';

        if (!grouped_map[item_name]) {
            // First occurrence of this item_name
            grouped_map[item_name] = {
                item_name: row.item_name,
                uom: row.uom,
                quantity: parseFloat(row.quantity || 0),
                valuation_rate: parseFloat(row.valuation_rate || 0),
                total_valuation: parseFloat(row.total_valuation || 0),
                store_stock: parseFloat(row.store_stock || 0),
                count: 1  // Track how many rows we're grouping
            };
            console.log(`Grouping Step 5.${index + 1}: Created new group for item_name:`, item_name);
        } else {
            // Item already exists, aggregate values
            console.log(`Grouping Step 6.${index + 1}: Item_name ${item_name} already exists, aggregating values`);

            let existing = grouped_map[item_name];

            // Sum quantity
            existing.quantity += parseFloat(row.quantity || 0);
            console.log(`Grouping Step 7.${index + 1}: Updated quantity:`, existing.quantity);

            // Average valuation_rate (calculate running average)
            let total_rate = (existing.valuation_rate * existing.count) + parseFloat(row.valuation_rate || 0);
            existing.count += 1;
            existing.valuation_rate = total_rate / existing.count;
            console.log(`Grouping Step 8.${index + 1}: Updated valuation_rate (average):`, existing.valuation_rate);

            // Sum total_valuation
            existing.total_valuation += parseFloat(row.total_valuation || 0);
            console.log(`Grouping Step 9.${index + 1}: Updated total_valuation:`, existing.total_valuation);

            // Take latest store_stock (or you can sum if needed)
            existing.store_stock = parseFloat(row.store_stock || 0);
            console.log(`Grouping Step 10.${index + 1}: Updated store_stock:`, existing.store_stock);
        }
    });

    console.log("Grouping Step 11: Grouping complete. Number of unique items:", Object.keys(grouped_map).length);
    console.log("Grouping Step 12: Grouped data:", JSON.stringify(grouped_map, null, 2));

    // Clear the table
    frm.clear_table("table_zvhx");
    console.log("Grouping Step 13: Cleared table_zvhx");

    // Add grouped rows back
    Object.keys(grouped_map).forEach(function (item_name, index) {
        let grouped_data = grouped_map[item_name];
        console.log(`Grouping Step 14.${index + 1}: Adding grouped row for item_name:`, item_name);

        let new_row = frm.add_child("table_zvhx");
        new_row.item_name = grouped_data.item_name;
        new_row.uom = grouped_data.uom;
        new_row.quantity = grouped_data.quantity;
        new_row.valuation_rate = grouped_data.valuation_rate;
        new_row.total_valuation = grouped_data.total_valuation;
        new_row.store_stock = grouped_data.store_stock;

        console.log(`Grouping Step 15.${index + 1}: Added grouped row:`, JSON.stringify(new_row, null, 2));
    });

    console.log("Grouping Step 16: All grouped rows added. Final count:", frm.doc.table_zvhx.length);
}

// Function to calculate duration from start_time and end_time
function calculate_duration(frm, cdt, cdn) {
    console.log("Duration Step 1: Starting duration calculation");
    console.log("Duration Step 2: Parameters - cdt:", cdt, "cdn:", cdn);

    // Get the row data
    let row = locals[cdt][cdn];
    console.log("Duration Step 3: Row data retrieved:", row);

    let start_time = row.start_time;
    let end_time = row.end_time;

    console.log("Duration Step 4: start_time value:", start_time);
    console.log("Duration Step 5: end_time value:", end_time);

    // Check if both times are present
    if (!start_time || !end_time) {
        console.log("Duration Step 6: Missing start_time or end_time, clearing duration");
        frappe.model.set_value(cdt, cdn, 'duration', null);
        return;
    }

    console.log("Duration Step 7: Both times present, calculating difference");

    // Parse time strings (format: "HH:mm:ss" or "HH:mm")
    function parse_time(time_str) {
        console.log("Duration Step 8: Parsing time string:", time_str);
        let parts = time_str.split(':');
        let hours = parseInt(parts[0]) || 0;
        let minutes = parseInt(parts[1]) || 0;
        let seconds = parseInt(parts[2]) || 0;
        console.log("Duration Step 9: Parsed - hours:", hours, "minutes:", minutes, "seconds:", seconds);
        return { hours: hours, minutes: minutes, seconds: seconds };
    }

    let start = parse_time(start_time);
    let end = parse_time(end_time);

    console.log("Duration Step 10: Start time object:", start);
    console.log("Duration Step 11: End time object:", end);

    // Convert to total seconds
    let start_seconds = start.hours * 3600 + start.minutes * 60 + start.seconds;
    let end_seconds = end.hours * 3600 + end.minutes * 60 + end.seconds;

    console.log("Duration Step 12: Start total seconds:", start_seconds);
    console.log("Duration Step 13: End total seconds:", end_seconds);

    // Calculate difference
    let diff_seconds = end_seconds - start_seconds;

    // Handle case where end_time is on the next day (if end < start, assume next day)
    if (diff_seconds < 0) {
        console.log("Duration Step 14: End time is before start time, assuming next day");
        diff_seconds += 24 * 3600; // Add 24 hours
    }

    console.log("Duration Step 15: Difference in seconds:", diff_seconds);

    // Convert back to hours, minutes, seconds
    let duration_hours = Math.floor(diff_seconds / 3600);
    let remaining_seconds = diff_seconds % 3600;
    let duration_minutes = Math.floor(remaining_seconds / 60);
    let duration_secs = remaining_seconds % 60;

    console.log("Duration Step 16: Calculated duration - hours:", duration_hours, "minutes:", duration_minutes, "seconds:", duration_secs);

    // Format as "HH:mm:ss"
    let duration_str = String(duration_hours).padStart(2, '0') + ':' +
        String(duration_minutes).padStart(2, '0') + ':' +
        String(duration_secs).padStart(2, '0');

    console.log("Duration Step 17: Formatted duration string:", duration_str);

    // Set the duration value
    frappe.model.set_value(cdt, cdn, 'duration', duration_str);
    console.log("Duration Step 18: Duration set in the row");
}
