// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ladle Metal", {
    refresh(frm) {
        console.log("Step 1: Ladle Metal form loaded/refreshed");
    },
});

// Event listener for time fields in child table "Ladle Metal Received From Cupola"
frappe.ui.form.on("Ladle Metal Received From Cupola", {
    start_time: function (frm, cdt, cdn) {
        console.log("Time Step 1: start_time event listener triggered");
        calculate_duration(frm, cdt, cdn);
    },

    end_time: function (frm, cdt, cdn) {
        console.log("Time Step 1: end_time event listener triggered");
        calculate_duration(frm, cdt, cdn);
    }
});

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
