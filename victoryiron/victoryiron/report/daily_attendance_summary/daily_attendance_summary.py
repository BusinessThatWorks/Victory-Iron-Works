import frappe
from datetime import datetime, timedelta


def execute(filters=None):
	filters = filters or {}
	date_str = filters.get("date") or (datetime.today() - timedelta(days=1)).strftime("%Y-%m-%d")
	employee = filters.get("employee")

	columns = [
		{"label": "Employee ID", "fieldname": "employee_id", "fieldtype": "Data", "width": 140},
		{"label": "Employee Name", "fieldname": "employee_name", "fieldtype": "Data", "width": 200},
		{"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 110},
		{"label": "First In", "fieldname": "first_in", "fieldtype": "Datetime", "width": 160},
		{"label": "Last Out", "fieldname": "last_out", "fieldtype": "Datetime", "width": 160},
		{"label": "Hours", "fieldname": "hours", "fieldtype": "Float", "width": 100, "precision": 1},
	]

	params = [date_str]
	where = "attendance_date = %s"
	if employee:
		where += " and employee = %s"
		params.append(employee)

	rows = frappe.db.sql(
		f"""
		select
			employee as employee_id,
			employee_name,
			status,
			coalesce(punch_in_time, in_time) as first_in,
			coalesce(punch_out_time, out_time) as last_out
		from `tabAttendance`
		where {where}
		order by employee
		""",
		params,
		as_dict=True,
	)

	data = []
	for r in rows:
		hours = 0.0
		if r.first_in and r.last_out:
			diff = (r.last_out - r.first_in).total_seconds()
			hours = round(diff / 3600.0, 1)
		status = r.status or ("Absent" if hours == 0.0 else "Present")
		data.append(
			{
				"employee_id": r.employee_id,
				"employee_name": r.employee_name,
				"status": status,
				"first_in": r.first_in,
				"last_out": r.last_out,
				"hours": hours,
			}
		)

	return columns, data
