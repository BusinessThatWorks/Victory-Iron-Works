// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Cupola Heat Log", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('Cupola Heat Log', {
    // When child table changes: recalc parent
    consumption_table_add: function (frm, cdt, cdn) {
        console.log('Row added to consumption_table');
        update_child_totals(frm);
    },
    consumption_table_remove: function (frm, cdt, cdn) {
        console.log('Row removed from consumption_table');
        update_child_totals(frm);
    }
});
frappe.ui.form.on('Consumption Table', {
    item_name: function (frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        console.log(`item_name changed to ${row.item_name} in row ${cdn}`);

        if (!row.item_name) {
            frappe.model.set_value(cdt, cdn, 'valuation_rate', 0);
            frappe.model.set_value(cdt, cdn, 'total_valuation', 0);
            return;
        }
        
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item",
                filters: { item_name: row.item_name },
                fieldname: "valuation_rate"
            },
            callback: function (r) {
                let rate = 0;
                if (r.message) {
                    rate = r.message.valuation_rate || 0;
                }
                frappe.model.set_value(cdt, cdn, 'valuation_rate', rate);
                console.log(`Fetched valuation_rate for ${row.item_name}: ${rate}`);
                update_row_total_valuation(frm, cdt, cdn);
                update_child_totals(frm);
            }
        });

        // Call your store stock API
        frappe.call({
            method: "victoryiron.api.get_store_stock.get_store_stock",
            args: { item_name: row.item_name },
            callback: function (r) {
                let stock = r.message || 0;
                frappe.model.set_value(cdt, cdn, 'store_stock', stock);
                console.log(`Fetched store_stock for ${row.item_name}: ${stock}`);
            }
        });
    },

    quantity: function (frm, cdt, cdn) {
        console.log(`quantity changed in row ${cdn}`);
        update_row_total_valuation(frm, cdt, cdn);
        update_child_totals(frm);
    },

    valuation_rate: function (frm, cdt, cdn) {
        console.log(`valuation_rate changed in row ${cdn}`);
        update_row_total_valuation(frm, cdt, cdn);
        update_child_totals(frm);
    }
});

function update_row_total_valuation(frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);
    let qty = parseFloat(row.quantity) || 0;
    let rate = parseFloat(row.valuation_rate) || 0;
    let total = qty * rate;
    frappe.model.set_value(cdt, cdn, 'total_valuation', total);
    console.log(`Row ${cdn} total_valuation updated: ${qty} * ${rate} = ${total}`);
}

function update_child_totals(frm) {
    let total_qty = 0;
    let total_val = 0;

    (frm.doc.consumption_table || []).forEach(row => {
        total_qty += parseFloat(row.quantity) || 0;
        total_val += parseFloat(row.total_valuation) || 0;
    });

    frm.set_value('total_charge_mix_quantity', total_qty);
    frm.set_value('total_charge_mix_calculation', total_val);

    console.log(`Updated parent totals: total_charge_mix_quantity = ${total_qty}, total_charge_mix_calculation = ${total_val}`);
    frm.refresh_fields(['total_charge_mix_quantity', 'total_charge_mix_calculation']);
}
