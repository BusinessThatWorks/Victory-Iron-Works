// Copyright (c) 2025, beetashokechakraborty and contributors
// For license information, please see license.txt

// frappe.query_reports["New Procurement Tracker"] = {
// 	"filters": [

// 	]
// };




frappe.query_reports["New Procurement Tracker"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"reqd": 1,
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1)
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"reqd": 1,
			"default": frappe.datetime.get_today()
		},
		{
			"fieldname": "item_code",
			"label": __("Item"),
			"fieldtype": "Link",
			"options": "Item"
		},
		{
			"fieldname": "supplier",
			"label": __("Supplier"),
			"fieldtype": "Link",
			"options": "Supplier"
		},
		{
			"fieldname": "show_all",
			"label": __("Show All Records (Including Draft)"),
			"fieldtype": "Check",
			"default": 0
		}
	]
};