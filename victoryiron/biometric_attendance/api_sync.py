import frappe
import requests
from datetime import datetime, timedelta


def _find_employee(employee_id: str | None, employee_name: str | None):
	# Try match by full name
	emp = None
	if employee_name:
		emp = frappe.db.get_value(
			"Employee",
			{"status": ["in", ["Active", "Onboarding"]], "employee_name": employee_name},
			["name", "employee_name", "card_number", "holiday_list"],
			as_dict=True,
		)
	# Fallback by card number
	if not emp and employee_id:
		emp = frappe.db.get_value(
			"Employee",
			{"status": ["in", ["Active", "Onboarding"]], "card_number": employee_id},
			["name", "employee_name", "card_number", "holiday_list"],
			as_dict=True,
		)
	return emp


def _is_holiday(employee_holiday_list: str | None, attendance_date: str) -> bool:
	"""Check if the given date is a holiday for the employee's holiday list"""
	if not employee_holiday_list:
		return False

	# Check if the date exists in the Holiday child table of the employee's holiday list
	holiday_exists = frappe.db.exists(
		"Holiday",
		{"parent": employee_holiday_list, "parenttype": "Holiday List", "holiday_date": attendance_date},
	)
	return bool(holiday_exists)


def _upsert_daily_attendance(
	emp_name: str, attendance_date: str, hours: float, in_time: str | None, out_time: str | None
):
	status = "Present" if hours > 0 else "Absent"
	# Avoid duplicate: one Attendance per employee per day
	exists = frappe.db.exists("Attendance", {"employee": emp_name, "attendance_date": attendance_date})
	if exists:
		return False

	doc_fields = {
		"doctype": "Attendance",
		"employee": emp_name,
		"attendance_date": attendance_date,
		"status": status,
	}
	meta = frappe.get_meta("Attendance")
	if in_time:
		if meta.has_field("punch_in_time"):
			doc_fields["punch_in_time"] = in_time
		elif meta.has_field("in_time"):
			doc_fields["in_time"] = in_time
	if out_time:
		if meta.has_field("punch_out_time"):
			doc_fields["punch_out_time"] = out_time
		elif meta.has_field("out_time"):
			doc_fields["out_time"] = out_time

	doc = frappe.get_doc(doc_fields)
	doc.insert(ignore_permissions=True)
	# Submit the Attendance so it doesn't remain in draft
	doc.flags.ignore_permissions = True
	doc.submit()
	frappe.db.commit()
	return True


@frappe.whitelist()
def sync_daily_attendance():
	# Get yesterday's date
	today = datetime.today()
	yesterday = today - timedelta(days=1)
	date_str = yesterday.strftime("%Y-%m-%d")

	url = "http://122.176.24.92:81/Service/Attendance/EmployeeAttendance_PeriodWise"
	params = {"StartDateTime": date_str, "EndDateTime": date_str}

	try:
		response = requests.get(url, params=params, headers={"Accept": "application/json"}, timeout=30)

		if response.status_code == 200:
			res_json = response.json()

			if res_json.get("STATUS") == "true" and "Data" in res_json:
				data = res_json["Data"]
				inserted = 0
				skipped = 0

				for entry in data:
					employee_id = entry.get("Employee_ID")
					employee_name = entry.get("Employee_Name")
					attendance_date = entry.get("Attendance_Date")  # unused
					punch_in_time = entry.get("Punch_In_Time")
					punch_out_time = entry.get("Punch_Out_Time")

					if not employee_id or not punch_in_time:
						continue  # Skip invalid records

					try:
						punch_in_dt = datetime.strptime(punch_in_time, "%Y-%m-%dT%H:%M:%S")
						punch_in_str = punch_in_dt.strftime("%Y-%m-%d %H:%M:%S")

						punch_out_str = None
						if punch_out_time and punch_out_time != "0000-00-00T00:00:00":
							punch_out_dt = datetime.strptime(punch_out_time, "%Y-%m-%dT%H:%M:%S")
							punch_out_str = punch_out_dt.strftime("%Y-%m-%d %H:%M:%S")
					except ValueError:
						print(f"❌ Invalid date format: {punch_in_time}")
						continue

					# Map only to valid Employees and create HR Attendance
					emp = _find_employee(employee_id, employee_name)
					if not emp:
						skipped += 1
						continue

					att_date = datetime.strptime(punch_in_str, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d")

					# Check if this date is a holiday for the employee
					if _is_holiday(emp.get("holiday_list"), att_date):
						print(f"⏭️ Skipping {emp.employee_name} on {att_date} - Holiday")
						skipped += 1
						continue

					hours = 0.0
					if punch_in_str and punch_out_str:
						try:
							hours = (
								datetime.strptime(punch_out_str, "%Y-%m-%d %H:%M:%S")
								- datetime.strptime(punch_in_str, "%Y-%m-%d %H:%M:%S")
							).total_seconds() / 3600.0
						except Exception:
							hours = 0.0

					created = _upsert_daily_attendance(emp.name, att_date, hours, punch_in_str, punch_out_str)
					if created:
						inserted += 1
					else:
						skipped += 1

				print(f"\n✅ Attendance sync complete for {date_str}: Inserted {inserted}, Skipped {skipped}")

			else:
				print(f"❌ API returned STATUS false or no Data: {res_json}")

		else:
			print(f"❌ Failed API call, status code: {response.status_code}")

	except Exception as e:
		print(f"❌ Exception during API sync: {e!s}")


@frappe.whitelist()
def sync_attendance_range(start_date: str | None = None, end_date: str | None = None):
	"""Backfill attendance data over a date range [start_date, end_date] inclusive.

	Dates must be in YYYY-MM-DD. When omitted, defaults to the last 30 days.
	"""
	# Defaults: last 30 days inclusive
	if not end_date:
		end_date = datetime.today().strftime("%Y-%m-%d")
	if not start_date:
		start_date = (datetime.today() - timedelta(days=29)).strftime("%Y-%m-%d")

	start_dt = datetime.strptime(start_date, "%Y-%m-%d")
	end_dt = datetime.strptime(end_date, "%Y-%m-%d")
	if end_dt < start_dt:
		raise frappe.ValidationError("end_date cannot be before start_date")

	url = "http://122.176.24.92:81/Service/Attendance/EmployeeAttendance_PeriodWise"

	total_inserted = 0
	total_skipped = 0

	day_count = (end_dt - start_dt).days + 1
	for i in range(day_count):
		day = start_dt + timedelta(days=i)
		date_str = day.strftime("%Y-%m-%d")
		params = {"StartDateTime": date_str, "EndDateTime": date_str}
		try:
			response = requests.get(url, params=params, headers={"Accept": "application/json"}, timeout=45)
			if response.status_code != 200:
				print(f"❌ {date_str}: API status {response.status_code}")
				continue

			res_json = response.json()
			if not (res_json.get("STATUS") == "true" and "Data" in res_json):
				print(f"❌ {date_str}: STATUS false or no Data")
				continue

			inserted = 0
			skipped = 0
			for entry in res_json["Data"]:
				employee_id = entry.get("Employee_ID")
				employee_name = entry.get("Employee_Name")
				punch_in_time = entry.get("Punch_In_Time")
				punch_out_time = entry.get("Punch_Out_Time")

				if not employee_id or not punch_in_time:
					continue

				try:
					punch_in_dt = datetime.strptime(punch_in_time, "%Y-%m-%dT%H:%M:%S")
					punch_in_str = punch_in_dt.strftime("%Y-%m-%d %H:%M:%S")
					punch_out_str = None
					if punch_out_time and punch_out_time != "0000-00-00T00:00:00":
						punch_out_dt = datetime.strptime(punch_out_time, "%Y-%m-%dT%H:%M:%S")
						punch_out_str = punch_out_dt.strftime("%Y-%m-%d %H:%M:%S")
				except ValueError:
					print(f"❌ {date_str}: invalid date format {punch_in_time}")
					continue

				# Map only to valid Employees and create HR Attendance
				emp = _find_employee(employee_id, employee_name)
				if not emp:
					skipped += 1
					continue

				att_date = datetime.strptime(punch_in_str, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d")

				# Check if this date is a holiday for the employee
				if _is_holiday(emp.get("holiday_list"), att_date):
					print(f"⏭️ Skipping {emp.employee_name} on {att_date} - Holiday")
					skipped += 1
					continue

				hours = 0.0
				if punch_in_str and punch_out_str:
					try:
						hours = (
							datetime.strptime(punch_out_str, "%Y-%m-%d %H:%M:%S")
							- datetime.strptime(punch_in_str, "%Y-%m-%d %H:%M:%S")
						).total_seconds() / 3600.0
					except Exception:
						hours = 0.0

				created = _upsert_daily_attendance(emp.name, att_date, hours, punch_in_str, punch_out_str)
				if created:
					inserted += 1
				else:
					skipped += 1

			total_inserted += inserted
			total_skipped += skipped
			print(f"✅ {date_str}: Inserted {inserted}, Skipped {skipped}")

		except Exception as e:
			print(f"❌ {date_str}: exception during API sync: {e!s}")

	print(
		f"\n✔ Backfill complete {start_date} → {end_date}: Inserted {total_inserted}, Skipped {total_skipped}"
	)
