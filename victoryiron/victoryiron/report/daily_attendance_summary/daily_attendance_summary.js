frappe.query_reports["Daily Attendance Summary"] = {
    filters: [
        {
            fieldname: "date",
            label: "Date",
            fieldtype: "Date",
            reqd: 1,
            default: frappe.datetime.add_days(frappe.datetime.get_today(), -1)
        },
        {
            fieldname: "employee",
            label: "Employee",
            fieldtype: "Link",
            options: "Employee"
        }
    ]
};


