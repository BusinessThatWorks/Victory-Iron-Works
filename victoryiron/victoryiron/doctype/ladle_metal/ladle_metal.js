// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ladle Metal", {
    refresh: function (frm) {
        // Set visibility correctly on load/refresh
        toggle_treatment_tab(frm);
        calculate_duration(frm);
        // grade_type should always be visible
        frm.toggle_display("grade_type", true);
    },

    source: function (frm) {
        // Toggle treatment tab when source changes
        toggle_treatment_tab(frm);
    },

    grade_type: function (frm) {
        // Toggle treatment tab when grade_type changes
        toggle_treatment_tab(frm);
    },

    start_time: function (frm) {
        // Recalculate duration when start time changes
        calculate_duration(frm);
    },

    end_time: function (frm) {
        // Recalculate duration when end time changes
        calculate_duration(frm);
    }
});

// Show Treatment tab + fields only when source == "Holding Furnace" AND grade_type == "DI"
function toggle_treatment_tab(frm) {
    const show = frm.doc.source === "Holding Furnace" && frm.doc.grade_type === "DI";

    // Tab Break itself
    frm.toggle_display("treatment_tab", show);

    // Fields inside that tab (excluding grade_type which is always visible)
    const treatment_fields = [
        "treatment_before_temp",
        "treatment_no",
        "punching",
        "inoculant",
        "fesimg"
    ];

    treatment_fields.forEach((fieldname) => {
        frm.toggle_display(fieldname, show);
    });
}

// duration = end_time - start_time (HH:MM:SS)
function calculate_duration(frm) {
    const start_time = frm.doc.start_time;
    const end_time = frm.doc.end_time;

    if (!start_time || !end_time) {
        frm.set_value("duration", "");
        return;
    }

    const toSeconds = (t) => {
        const parts = String(t).split(":").map(p => parseInt(p, 10) || 0);
        const [h = 0, m = 0, s = 0] = parts;
        return h * 3600 + m * 60 + s;
    };

    const start_sec = toSeconds(start_time);
    const end_sec = toSeconds(end_time);

    if (end_sec < start_sec) {
        frm.set_value("duration", "");
        frappe.msgprint(__("End Time cannot be before Start Time."));
        return;
    }

    let diff = end_sec - start_sec;

    const hours = Math.floor(diff / 3600);
    diff %= 3600;
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;

    const pad = (n) => String(n).padStart(2, "0");
    const duration_str = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    frm.set_value("duration", duration_str);
}