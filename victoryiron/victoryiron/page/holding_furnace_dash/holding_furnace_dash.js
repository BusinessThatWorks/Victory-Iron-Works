frappe.pages['holding-furnace-dash'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Holding Furnace Dashboard',
		single_column: true
	});

    // render html template
    $(frappe.render_template("holding_furnace_dash", {})).appendTo(page.body);

	// date controls
    const from_control = frappe.ui.form.make_control({
        parent: page.body.find(".hf-filter-from"),
        df: {
            fieldtype: "Date",
            label: "From Date",
            change() {
                load_dashboard();   // ✅ auto load
            }
        },
        render_input: true
    });

    const to_control = frappe.ui.form.make_control({
        parent: page.body.find(".hf-filter-to"),
        df: {
            fieldtype: "Date",
            label: "To Date",
            change() {
                load_dashboard();   // ✅ auto load
            }
        },
        render_input: true
    });

    // ✅ clear button
    page.body.on("click", ".hf-clear-btn", function () {
    from_control.set_value(null);
    to_control.set_value(null);
    reset_dashboard();   // ✅ direct zero

});

	function load_dashboard() {

    const from_date = from_control.get_value();
    const to_date = to_control.get_value();

    // ❌ dono date nahi → zero state
    if (!from_date || !to_date) {
        reset_dashboard();
        return;
    }

    frappe.call({
        method: "victoryiron.api.holding_furnace_dashboard.get_holding_furnace_dashboard",
        args: {
            from_date,
            to_date
        },
        callback: function (r) {
            if (!r.message) return;

            render_summary(r.message.summary);
            render_ladle_table(r.message.ladle_rows);
        }
    });
}
function reset_dashboard() {

    render_summary({});          // sab 0 ho jayega
    render_ladle_table([]);      // empty table
}

};
function fmtInt(val) {
    return Number(val || 0).toLocaleString("en-IN");
}

function fmtDec(val, digits) {
    return Number(val || 0).toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function render_summary(s) {
	 $("#kpi-metal-in").text(fmtInt(s.metal_in) + " Kg");
    $("#kpi-metal-out").text(fmtInt(s.metal_out) + " Kg");
    $("#kpi-discharge").text(fmtInt(s.discharge_count));
	$("#kpi-count").text(fmtInt(s.count));

$("#kpi-furnace-unit").text(fmtDec(s.furnace_unit_total, 3));
$("#kpi-cooling-unit").text(fmtDec(s.cooling_tower_total, 3));

$("#add-carbon").text(fmtInt(s.carbon_total));
$("#add-fesi").text(fmtInt(s.fesi_total));
$("#add-crc").text(fmtInt(s.crc_total));
$("#add-femn").text(fmtInt(s.femn_total));

$("#ladle-fesimg").text(fmtDec(s.fesimg_total, 2));
$("#ladle-inoculant").text(fmtDec(s.inoculant_total, 2));
$("#ladle-punching").text(fmtInt(s.punching_total));

}
function render_ladle_table(rows) {
    // Cleanup previous state
    $(document).off("click.treatmentPopup");
    $("#hf-table").off("click").empty();
    
    window.ladle_rows_data = rows;

    const columns = [
        { name: "Ladle", width: 160, format: (v) => v ? `<a href="/app/ladle-metal/${v}" target="_blank">${v}</a>` : "-" },
        { name: "Grade", width: 100 },
        { name: "Ladle ID", width: 100 },
        { name: "Temp", width: 80 },
        { name: "Start Time", width: 100 },
        { name: "Weight (kg)", width: 100 },
        { name: "FeSiMg", width: 80 },
        { name: "Inoculant", width: 80 },
        { name: "Punching", width: 80 },
        { name: "Destination", width: 120 },
        { 
            name: "Fracture", 
            width: 80,
            format: (v) => {
                if (!v || v === "-") return "-";
                if (v.toLowerCase() === "ok") {
                    return `<div style="text-align: center;"><span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500;">OK</span></div>`;
                }
                return v;
            }
        },
        { 
            name: "Treatment ID", 
            width: 140, 
            format: (v) => v && v !== "-" 
                ? `<span class="treatment-link" style="color: #2490ef; cursor: pointer; text-decoration: underline;" data-treatment="${v}">${v}</span>` 
                : "-"
        },
    ];

    const data = rows.map(r => [
        r.ladle_name || "-",
        r.grade_type || "-",
        r.ladle_id || "-",
        r.treatment_before_temp || "-",
        r.start_time || "-",
        r.total_weight_in_kg || "-",
        r.fesimg || "-",
        r.inoculant || "-",
        r.punching || "-",
        r.destination || "-",
        r.facture_test || "-",
        r.treatment_id || "-"
    ]);

    new frappe.DataTable("#hf-table", {
        columns: columns,
        data: data,
        layout: "fluid",
        inlineFilters: true
    });

    // Attach click handler
    $("#hf-table").on("click", ".treatment-link", function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const treatmentId = $(this).data("treatment");
        const rowData = window.ladle_rows_data.find(r => r.treatment_id === treatmentId);
        
        if (rowData?.treatment_data) {
            show_treatment_popup(treatmentId, rowData.treatment_data);
        }
    });
}

function show_treatment_popup(treatment_id, data) {
    const fields = [
        {label: "C", value: data.c},
        {label: "Si", value: data.si},
        {label: "Mn", value: data.mn},
        {label: "P", value: data.p},
        {label: "Mg", value: data.mg},
        {label: "CE", value: data.ce},
        {label: "CS", value: data.cs},
        {label: "Perlite", value: data.perlite_},
        {label: "Ferrite", value: data.ferrite_}
    ];
    
    const rows = fields.map(f => 
        `<tr><td><strong>${f.label}</strong></td><td>${f.value || "-"}</td></tr>`
    ).join("");
    
    const content = `
        <div class="treatment-popup-content">
            <table class="table table-bordered">${rows}</table>
        </div>
    `;

    frappe.msgprint({
        title: `Treatment: ${treatment_id}`,
        message: content,
        indicator: "blue"
    });
}

