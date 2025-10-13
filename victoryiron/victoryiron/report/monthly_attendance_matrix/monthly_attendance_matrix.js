frappe.query_reports["Monthly Attendance Matrix"] = {
    filters: [
        {
            fieldname: "from_date",
            label: "From Date",
            fieldtype: "Date",
            reqd: 1,
            default: frappe.datetime.month_start()
        },
        {
            fieldname: "to_date",
            label: "To Date",
            fieldtype: "Date",
            reqd: 1,
            default: frappe.datetime.month_end()
        },
        {
            fieldname: "employee",
            label: "Employee",
            fieldtype: "Link",
            options: "Employee"
        }
    ]
};


