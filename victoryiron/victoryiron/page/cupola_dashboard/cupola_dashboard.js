let filters = { from_date: null, to_date: null };
let active_tab = "details";

frappe.pages['cupola-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Cupola Dashboard',
        single_column: true
    });
    frappe.require("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
   $('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">').appendTo("head");
    $('<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>').appendTo("head");


    // Load HTML directly from file
    $(page.body).empty().append($(`
        <div class="cupola-dashboard">

            <div class="filters mb-3">
                <div id="date-filters"></div>
            </div>

            <ul class="nav nav-tabs mt-3" id="cupola-tabs">
                <li class="nav-item"><a class="nav-link active" data-tab="details">Details</a></li>
                <li class="nav-item"><a class="nav-link" data-tab="firingprep">Firing Prep</a></li>
                <li class="nav-item"><a class="nav-link" data-tab="consumption_summary">Consumption Summary</a></li>
            </ul>

            <div class="tab-content mt-3">
                <div class="tab-pane active" id="tab-details"></div>
                <div class="tab-pane" id="tab-firingprep"></div>
                 <div class="tab-pane" id="tab-consumption_summary"></div>
            </div>

        </div>
    `));

    build_filters(page);
    register_tab_switch();
    reload_active_tab();
    // UI Fix for Filter Row
    $(`<style>
    .cupola-dashboard { padding: 10px 20px; }

    #cupola-tabs .nav-link {
        font-weight: 600; padding: 8px 18px;
    }

    #cupola-tabs .nav-link.active {
        background: #1d74f5; color: #fff !important; border-radius:4px;
    }
    
    #filter-row .form-control { height: 36px; }

    table.table-sm td, table.table-sm th{
        padding: 4px 6px !important;
        font-size: 13px;
        white-space: nowrap;
    }

    tbody tr:hover { background:#f9f9f9; }

    thead { background:#eaeaea; }
</style>`).appendTo("head");


};

function build_filters(page){
    let html = `
        <div>
            <div class="row align-items-end" id="filter-row">

                <div class="col-md-2">
                    <label>From Date</label>
                    <input type="text" id="from_date" class="form-control">
                </div>

                <div class="col-md-2">
                    <label>To Date</label>
                    <input type="text" id="to_date" class="form-control">
                </div>

                <div class="col-md-2">
                    <button class="btn btn-danger w-100" id="clear_filters">Clear</button>
                </div>

                <div class="col-md-2">
                    <button class="btn btn-success w-100" id="export_excel">Export Excel</button>
                </div>

            </div>
        </div>
    `;

    $("#date-filters").html(html);

    // Keep Flatpickr instances
    let fromPicker, toPicker;

    setTimeout(()=>{
        fromPicker = flatpickr("#from_date", { 
            dateFormat: "Y-m-d", 
            allowInput: true, 
            altInput: true, 
            altFormat: "d M Y", 
            onChange: function(dates, dateStr){ 
                filters.from_date = dateStr; 
                reload_active_tab(); 
            } 
        });

        toPicker = flatpickr("#to_date", { 
            dateFormat: "Y-m-d", 
            allowInput: true, 
            altInput: true, 
            altFormat: "d M Y", 
            onChange: function(dates, dateStr){ 
                filters.to_date = dateStr; 
                reload_active_tab(); 
            } 
        });
    }, 500);

    // Clear button now also clears Flatpickr selections
    $("#clear_filters").on("click", ()=>{
        if(fromPicker) fromPicker.clear();
        if(toPicker) toPicker.clear();
        filters = {from_date:null, to_date:null};
        reload_active_tab();
    });

    // Excel export button
    $("#export_excel").on("click", export_excel_workbook);
}


function table_to_sheet(selector){
    let table = document.querySelector(selector);
    if(!table) return null;
    return XLSX.utils.table_to_sheet(table);
}
function export_excel_workbook(){

    // Ensure all tabs are loaded first
    load_details_tab();
    load_firing_tab();
    load_consumption_summary_tab();

    setTimeout(()=>{   // small delay so tables render if not loaded
        let wb = XLSX.utils.book_new();

        let sheet1 = table_to_sheet("#tab-details table");
        let sheet2 = table_to_sheet("#tab-firingprep table");
        let sheet3 = table_to_sheet("#tab-consumption_summary table");

        if(sheet1) XLSX.utils.book_append_sheet(wb, sheet1, "Details");
        if(sheet2) XLSX.utils.book_append_sheet(wb, sheet2, "Firing Prep");
        if(sheet3) XLSX.utils.book_append_sheet(wb, sheet3, "Consumption Summary");

        XLSX.writeFile(wb, `Cupola_Dashboard_${frappe.datetime.get_today()}.xlsx`);
    }, 600);
}

function register_tab_switch(){
    $("#cupola-tabs .nav-link").on("click", function(){
        $("#cupola-tabs .nav-link").removeClass("active");
        $(this).addClass("active");

        $(".tab-pane").removeClass("active");
        $(`#tab-${$(this).data("tab")}`).addClass("active");

        active_tab = $(this).data("tab");
        reload_active_tab();
    });
}

function reload_active_tab(){
    if(active_tab === "details") load_details_tab();
    if(active_tab === "firingprep") load_firing_tab();
    // if(active_tab === "consumption") load_consumption_tab();
    if(active_tab === "consumption_summary") load_consumption_summary_tab();
}

function load_details_tab(){
    frappe.call({
        method:"victoryiron.api.cupola_heat_dashboard.get_cupola_details_with_consumption",
        args:filters,
        callback(r){
            $("#tab-details").html(render_details_html(r.message));
        }
    });
}

function load_firing_tab(){
    frappe.call({
        method:"victoryiron.api.cupola_heat_dashboard.get_cupola_firingprep",
        args:filters,
        callback(r){
            $("#tab-firingprep").html(render_firing_html(r.message));
        }
    });
}
function load_consumption_tab(){
    frappe.call({
        method:"victoryiron.api.cupola_heat_dashboard.get_cupola_consumption_pivot",
        args:filters,
        callback(r){
            $("#tab-consumption").html(render_consumption_pivot(r.message));
        }
    });
}

function render_details_html(response){

    let data = response.rows;
    let itemCols = response.item_order;

    // Insert Coke Type after Hard Coke (keep your logic same)
    let cokeIndex = itemCols.indexOf("Hard_Coke") + 1;
    if(cokeIndex > 0){
        itemCols.splice(cokeIndex, 0, "coke_type");
    }

    // ---------------------- TOTAL ROW CALC ----------------------
    let totals = {};

    // Initialize totals for all item columns to 0
    itemCols.forEach(c => totals[c] = 0);

    let total_qty = 0;
    let total_valuation = 0;

    data.forEach(row => {

        itemCols.forEach(col => {
            let v = parseFloat(row[col]) || 0;
            totals[col] += v;
        });

        total_qty += parseFloat(row.total_charge_mix_quantity) || 0;
        total_valuation += parseFloat(row.total_charge_mix_calculation) || 0;
    });
    // ------------------------------------------------------------

    return `
    <div class="table-responsive" style="overflow-x:auto; max-width:100%;">
    <table class="table table-bordered table-sm">
        <thead>
            <tr>
                <th>Cupola Heat ID</th>
                <th>Charge No</th>
                <th>Grade</th>
               ${itemCols.map(c => `<th>${formatHeader(c)}</th>`).join("")}

                <th>Total Quantity</th>
                <th>Total Valuation Cost</th>
            </tr>
        </thead>

        <tbody>
            ${data.map(r=>`
                <tr>
                    <td><a target="_blank" href="/app/cupola-heat-log/${r.name}">${r.name}</a></td>
                    <td>${r.charge_no ?? "-"}</td>
                    <td>${r.grade ?? "-"}</td>
                    ${itemCols.map(c => `<td>${formatCell(r[c], c)}</td>`).join("")}
                    <td>${formatCell(r.total_charge_mix_quantity)}</td>
                    <td>${formatCell(r.total_charge_mix_calculation)}</td>
                </tr>
            `).join("")}

            <!-- ================= TOTAL ROW ================= -->
            <tr style="font-weight:bold; background:#f6f6f6">
                <td colspan="3" class="text-center">TOTAL</td>
                ${itemCols.map(c => `<td>${totals[c]}</td>`).join("")}
                <td>${total_qty}</td>
                <td>${total_valuation}</td>
            </tr>
            <!-- ============================================== -->

        </tbody>
    </table>
    </div>`;
}
function formatHeader(str){
    str = str.replace(/_/g," ");   // remove underscores

    // split words and format each
    return str.split(" ").map(w => {
        if(w.length <= 2) return w.toUpperCase();             // DS, CI, DI, MS...
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
}

function formatCell(val){
    if(val == null || val === "" || val === undefined) return "-";
    if(!isNaN(val) && Number(val) === 0) return "-";   // Zero → hyphen
    return val;
}

function render_firing_html(data){
    return `
    <div class="table-responsive" style="overflow-x:auto; max-width:100%;">
    <table class="table table-bordered">
    <thead><tr>
        <th>Date</th><th>Ignition Start</th><th>Ignition End</th><th>Light Up</th>
        <th>Metal Out</th><th>Blower On</th><th>Drop</th>
        <th>Coke:Metal</th><th>Coke:Lime</th>
        <th>Melting Hrs</th><th>Melting Hrs Metal Out</th>
        <th>Avg Rate Blower</th><th>Avg Rate Metal</th>
        <th>Bricks</th><th>Wood</th><th>Steam Coal</th>
    </tr></thead>
    <tbody>
        ${data.map(r=>`
        <tr>
            <td>${r.date}</td>
            <td>${r.ignition_start_time}</td>
            <td>${r.ignition_end_time}</td>
            <td>${r.light_up}</td>
            <td>${r.metal_out_at}</td>
            <td>${r.blower_on_for_melting}</td>
            <td>${r.cupola_drop_at}</td>
            <td>${r.coke_metal_ratio}</td>
            <td>${r.coke_limestone_ratio}</td>
            <td>${r.total_melting_hours}</td>
            <td>${r.total_melting_hours_metal_out}</td>
            <td>${r.average_melting_rate}</td>
            <td>${r.average_melting_rate_metal_out}</td>
            <td>${r.fire_bricks}</td>
            <td>${r.fire_wood}</td>
            <td>${r.stream_coal}</td>
        </tr>
        `).join('')}
    </tbody>
    </table>
    </div>`;
}

function render_consumption_summary(data){
    
    // All item column keys
    let keys = Object.keys(data[0]).filter(k=>k!=="date");

    return `
    <div class="table-responsive" style="overflow-x:auto; max-width:100%;">
    <table class="table table-bordered">
        <thead>
            <tr>
                <th>Date</th>
                ${keys.map(k=>`<th>${k.replace("_qty"," Qty").replace("_total"," Total")}</th>`).join("")}
            </tr>
        </thead>
        <tbody>
            ${data.map(row=>`
                <tr>
                    <td>${row.date}</td>
                    ${keys.map(k=>`<td>${row[k] ?? "-"}</td>`).join("")}
                </tr>
            `).join("")}
        </tbody>
    </table>
    </div>`;
}

function load_consumption_summary_tab(){
    frappe.call({
        method:"victoryiron.api.cupola_heat_dashboard.get_cupola_consumption_summary",
        args:filters,
        callback(r){
            $("#tab-consumption_summary").html(render_consumption_summary(r.message));
        }
    });
}
