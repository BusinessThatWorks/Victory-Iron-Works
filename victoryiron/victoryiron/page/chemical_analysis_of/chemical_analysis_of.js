frappe.pages['chemical-analysis-of'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Chemical Analysis of Casting Metal',
        single_column: true
    });

    $(frappe.render_template("chemical_analysis_of")).appendTo(page.body);
	$("#from_date, #to_date").on("change", function(){
        load_data();
    });
    
	 $("#clear_btn").on("click", function(){
        $("#from_date").val("");
        $("#to_date").val("");
        load_data(); 
    });
	load_data();
}

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
function render_table(data){
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

    data.forEach(row => {
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
$("#export_btn").on("click", function () {
    let from = $("#from_date").val();
    let to = $("#to_date").val();

    let url = `/api/method/victoryiron.api.chemical_analysis.export_furnace_bath_excel?from_date=${from || ""}&to_date=${to || ""}`;
    window.open(url);
});

