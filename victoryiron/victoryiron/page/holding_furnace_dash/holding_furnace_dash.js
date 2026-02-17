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


    // function load_dashboard() {
    //     frappe.call({
    //         method: "victoryiron.api.holding_furnace_dashboard.get_holding_furnace_dashboard",
    //         args: {
    //             from_date: from_control.get_value(),
    //             to_date: to_control.get_value()
    //         },
    //         callback: function (r) {
    //             if (!r.message) return;

    //             render_summary(r.message.summary);
    //             render_ladle_table(r.message.ladle_rows);
    //         }
    //     });
    // }
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
// function render_table(rows) {

//     $("#hf-table").empty();

//     const columns = [
//         "Date",
//         "Lining",
//         "Metal In",
//         "Metal Out",
//         "Units",
//         "Carbon",
//         "FeSi",
//         "CRC"
//     ];

//     const data = rows.map(r => [
//         r.date,
//         r.furnace_lining_noid,
//         r.total_metal_recieved,
//         r.total_metal_discharged,
//         r.total_units,
//         r.carbon_in_kg,
//         r.fe_silicon_in_kg,
//         r.crc_in_kg
//     ]);

//     new frappe.DataTable("#hf-table", {
//         columns: columns,
//         data: data,
//         layout: "fluid"
//     });
// }
function render_ladle_table(rows) {

    $("#hf-table").empty();

    const columns = [
        { name: "Ladle", width: 160, format: v =>
            `<a href="/app/ladle-metal/${v}" target="_blank">${v}</a>`
        },
        "Grade",
        "Ladle ID",
        "Temp",
        "Start Time",
        "Weight (kg)",
        "FeSiMg",
        "Inoculant",
        "Punching",
        
        "Destination",
		"Fracture",
    ];

    const data = rows.map(r => [
        r.ladle_name,
        r.grade_type,
        r.ladle_id,
        r.treatment_before_temp,
        r.start_time,
        r.total_weight_in_kg,
        r.fesimg,
        r.inoculant,
        r.punching,
		r.destination,
        r.facture_test
        
    ]);

    new frappe.DataTable("#hf-table", {
        columns: columns,
        data: data,
        layout: "fluid",
		inlineFilters: true  
    });
}

