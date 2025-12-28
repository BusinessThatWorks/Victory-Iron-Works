let filters = { from_date: null, to_date: null };
let active_tab = "details";

frappe.pages['cupola-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Cupola Dashboard',
        single_column: true
    });

    // Load HTML directly from file
    $(page.body).empty().append($(`
        <div class="cupola-dashboard">

            <div class="filters mb-3">
                <div id="date-filters"></div>
            </div>

            <ul class="nav nav-tabs mt-3" id="cupola-tabs">
                <li class="nav-item"><a class="nav-link active" data-tab="details">Details</a></li>
                <li class="nav-item"><a class="nav-link" data-tab="firingprep">Firing Prep</a></li>
                <li class="nav-item"><a class="nav-link" data-tab="consumption">Consumption</a></li>
            </ul>

            <div class="tab-content mt-3">
                <div class="tab-pane active" id="tab-details"></div>
                <div class="tab-pane" id="tab-firingprep"></div>
                <div class="tab-pane" id="tab-consumption"></div>
            </div>

        </div>
    `));

    build_filters(page);
    register_tab_switch();
    reload_active_tab();
};

function build_filters(page){
    // Create filter container FIRST
    let filter_html = $(`
        <div class="row" id="filter-row">
            <div class="col-md-3" id="from_wrap"></div>
            <div class="col-md-3" id="to_wrap"></div>
            <div class="col-md-2" id="clear_wrap"></div>
        </div>
    `);

    $(".filters #date-filters").append(filter_html);

    // Create fields (these go in page.fields_dict automatically)
    page.add_field({
        label:"From Date", fieldtype:"Date", fieldname:"from_date",
        change(val){ filters.from_date = val; reload_active_tab(); }
    });

    page.add_field({
        label:"To Date", fieldtype:"Date", fieldname:"to_date",
        change(val){ filters.to_date = val; reload_active_tab(); }
    });

    page.add_field({
        label:"Clear Filter", fieldtype:"Button", fieldname:"clear_button",
        click(){
            filters = {from_date:null,to_date:null};
            $('input[data-fieldname="from_date"]').val('');
            $('input[data-fieldname="to_date"]').val('');
            reload_active_tab();
        }
    });

    // Now move them manually to filter section (AFTER they are created)
    $("#from_wrap").append(page.fields_dict.from_date.$wrapper);
    $("#to_wrap").append(page.fields_dict.to_date.$wrapper);
    $("#clear_wrap").append(page.fields_dict.clear_button.$wrapper);
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
    if(active_tab === "consumption") load_consumption_tab();
}

function load_details_tab(){
    frappe.call({
        method:"victoryiron.api.cupola_heat_dashboard.get_cupola_details",
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
        method:"victoryiron.api.cupola_heat_dashboard.get_cupola_consumption",
        args:filters,
        callback(r){
            $("#tab-consumption").html(render_consumption_html(r.message));
        }
    });
}
function render_details_html(data){
    return `
    <table class="table table-bordered">
        <thead><tr>
            <th>Date</th><th>Charge No</th><th>Grade</th><th>Time</th>
            <th>Cupola Temp</th><th>Temp Time</th>
        </tr></thead>
        <tbody>
            ${data.map(r=>`
                <tr>
                    <td>${r.date}</td>
                    <td>${r.charge_no}</td>
                    <td>${r.grade}</td>
                    <td>${r.time}</td>
                    <td>${r.cupola_temp}</td>
                    <td>${r.temp_time}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>`;
}

function render_firing_html(data){
    return `
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
    </table>`;
}

function render_consumption_html(data){
    return `
    <table class="table table-bordered">
    <thead><tr>
        <th>Date</th><th>Item</th><th>Quantity</th><th>UOM</th>
        <th>Rate</th><th>Total</th>
    </tr></thead>
    <tbody>
        ${data.map(r=>`
        <tr>
            <td>${r.date}</td>
            <td>${r.item_name}</td>
            <td>${r.quantity}</td>
            <td>${r.uom}</td>
            <td>${r.valuation_rate}</td>
            <td>${r.total_valuation}</td>
        </tr>
        `).join('')}
    </tbody>
    </table>`;
}

function render_consumption_summary(data){
    if(!data || !data.length){
        return `<p>No records found</p>`;
    }

    // All item column keys
    let keys = Object.keys(data[0]).filter(k=>k!=="date");

    return `
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
    </table>`;
}

