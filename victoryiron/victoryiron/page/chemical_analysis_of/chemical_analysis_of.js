frappe.pages["chemical-analysis-of"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Chemical Analysis of Casting Metal",
		single_column: true,
	});
	frappe.require("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");

	$(frappe.render_template("chemical_analysis_of")).appendTo(page.body);
	$("#from_date, #to_date").on("change", function () {
		load_data();
	});
	$("#export_excel").on("click", export_excel);

	$("#clear_btn").on("click", function () {
		$("#from_date").val("");
		$("#to_date").val("");
		load_data();
	});
	load_data();
};

function load_data() {
	let from = $("#from_date").val();
	let to = $("#to_date").val();

	frappe.call({
		method: "victoryiron.api.chemical_analysis.get_furnace_bath", // <- next step
		args: {
			from_date: from || null,
			to_date: to || null,
		},
		callback: function (r) {
			render_table(r.message || []);
		},
	});
}
function formatTimeToAMPM(time) {
	if (!time) return "";
	let [h, m, s] = time.split(":");
	h = parseInt(h);
	let ampm = h >= 12 ? "PM" : "AM";
	h = h % 12 || 12;
	return `${h}:${m} ${ampm}`;
}
function render_table(data) {
	let tbody = $("#result_table tbody");
	tbody.empty();
	if (!data.length) {
		tbody.append(`
        <tr>
            <td colspan="15" class="text-center text-muted">
                No records found
            </td>
        </tr>
    `);
		return;
	}

	data.forEach((row) => {
		tbody.append(`
            <tr>
				<td><a href="/app/furnace-bath/${row.name}" >${row.name}</a></td>
                <td>${row.date || "-"}</td>
                <td>${formatTimeToAMPM(row.time)}</td>
                <td>${row.sample_id || "-"}</td>
                <td>${row.grade || "-"}</td>
                <td>${row.c || "-"}</td>
                <td>${row.si || "-"}</td>
				<td>${row.mn || "-"}</td>
                <td>${row.cs || "-"}</td>
                <td>${row.p || "-"}</td>
                <td>${row.mg || "-"}</td>
				<td>${row.perlite_ || "-"}</td>
				<td>${row.ferrite_ || "-"}</td>
				<td>${row.nodularity_ || "-"}</td>
				<td>${row.nodule_count || "-"}</td>
            </tr>
        `);
	});
}
function export_excel(){
    let table = document.querySelector("#result_table");

    if(!table){
        frappe.msgprint("No data available to export");
        return;
    }

    show_export_message();

    setTimeout(() => {
        try {
            let wb = XLSX.utils.book_new();
            let sheet = XLSX.utils.table_to_sheet(table);

            XLSX.utils.book_append_sheet(wb, sheet, "Chemical Analysis");

            XLSX.writeFile(
                wb,
                `Chemical_Analysis_${frappe.datetime.get_today()}.xlsx`
            );
        } catch (e) {
            frappe.msgprint({
                title: "Export Failed",
                message: e.message || "Something went wrong while exporting",
                indicator: "red"
            });
        } finally {
            hide_export_message();
        }
    }, 100); // allow UI to repaint
}

let export_dialog = null;

function show_export_message(){
    export_dialog = frappe.msgprint({
        title: "Exporting",
        message: `
            <div style="display:flex;align-items:center;gap:10px">
                <i class="fa fa-spinner fa-spin"></i>
                <span>
                    Preparing Excel…<br>
                    This may take some time. Download will start shortly.
                </span>
            </div>
        `,
        indicator: "blue"
    });
}

function hide_export_message(){
    if(export_dialog && export_dialog.hide){
        export_dialog.hide();
        export_dialog = null;
    }
}
