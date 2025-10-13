import calendar
from datetime import datetime, timedelta
import frappe


def execute(filters=None):
	filters = filters or {}
	# accept either new 'employee' (Link) or legacy 'employee_id' (Data)
	employee = filters.get("employee") or filters.get("employee_id")
	from_date = filters.get("from_date") or frappe.utils.get_first_day(datetime.today()).strftime("%Y-%m-%d")
	to_date = filters.get("to_date") or frappe.utils.get_last_day(datetime.today()).strftime("%Y-%m-%d")

	from_dt = datetime.strptime(from_date, "%Y-%m-%d")
	to_dt = datetime.strptime(to_date, "%Y-%m-%d")
	if to_dt < from_dt:
		raise frappe.ValidationError("To Date cannot be before From Date")

	# compute number of days in selected range
	num_days = (to_dt - from_dt).days + 1

	date_from = f"{from_date} 00:00:00"
	date_to = f"{to_date} 23:59:59"

	# Build columns
	columns = [
		{"label": "Employee ID", "fieldname": "employee_id", "fieldtype": "Data", "width": 140},
		{"label": "Employee Name", "fieldname": "employee_name", "fieldtype": "Data", "width": 200},
	]
	day_labels = []
	for d in range(num_days):
		current_day = from_dt + timedelta(days=d)
		label = f"{current_day.day}"
		fieldname = f"d{d + 1:02d}"
		columns.append({"label": label, "fieldname": fieldname, "fieldtype": "Data", "width": 40})
		day_labels.append((current_day.date(), fieldname))
	columns.append({"label": "Total Present", "fieldname": "total_present", "fieldtype": "Int", "width": 120})
	columns.append(
		{"label": "% Present", "fieldname": "%_present", "fieldtype": "Percent", "width": 110, "precision": 0}
	)

	conditions = ["attendance_date >= %s", "attendance_date <= %s"]
	params = [from_date, to_date]
	if employee:
		# Support partial matching for both employee ID and name
		conditions.append("(employee like %s or employee_name like %s)")
		like_val = f"%{employee}%"
		params.extend([like_val, like_val])
	where = " and ".join(conditions)

	# Get in/out per employee per day from HR Attendance
	rows = frappe.db.sql(
		f"""
		select employee as employee_id,
		       employee_name,
		       attendance_date as day,
		       coalesce(punch_in_time, in_time) as first_in,
		       coalesce(punch_out_time, out_time) as last_out,
		       status
		from `tabAttendance`
       where {where}
		order by employee, attendance_date
       """,
		params,
		as_dict=True,
	)

	# Assemble per employee matrix
	by_emp = {}
	for r in rows:
		emp = by_emp.setdefault(
			r.employee_id,
			{
				"employee_id": r.employee_id,
				"employee_name": r.employee_name,
				**{fn: "" for _, fn in day_labels},
				"total_present": 0,
				"%_present": 0.0,
			},
		)
		hours = 0.0
		if r.first_in and r.last_out:
			hours = round((r.last_out - r.first_in).total_seconds() / 3600.0, 1)
		status = "P" if (r.status == "Present" or hours > 0.0) else "A"
		# map exact date to index
		try:
			idx = (datetime.strptime(str(r.day), "%Y-%m-%d").date() - from_dt.date()).days + 1
			if 1 <= idx <= num_days:
				emp[f"d{idx:02d}"] = status
		except Exception:
			pass
		if status == "P":
			emp["total_present"] += 1

	# Finalize percentages and ensure employees with no rows can still show (if needed)
	for emp in by_emp.values():
		emp["%_present"] = round((emp["total_present"] / num_days) * 100.0, 0)

	data = list(by_emp.values())
	return columns, data
