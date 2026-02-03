# Copyright (c) 2025, Victory Iron and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt
import calendar
from datetime import datetime, timedelta

import erpnext
from frappe.query_builder.functions import Count

salary_slip = frappe.qb.DocType("Salary Slip")
salary_detail = frappe.qb.DocType("Salary Detail")
salary_component = frappe.qb.DocType("Salary Component")


def get_weekly_off_days(employee, start_date, end_date):
    """Calculate weekly off days for an employee in the given date range"""
    try:
        # Get employee's holiday list
        holiday_list = frappe.db.get_value("Employee", employee, "holiday_list")
        if not holiday_list:
            frappe.log_error(f"No holiday list found for employee {employee}", "Weekly Off Debug")
            return 0.0

        # Get weekly off days from Holiday List
        weekly_off_days = frappe.db.get_value("Holiday List", holiday_list, "weekly_off")
        if not weekly_off_days:
            frappe.log_error(
                f"No weekly_off field found in Holiday List {holiday_list} for employee {employee}",
                "Weekly Off Debug",
            )
            return 0.0

        frappe.log_error(
            f"Employee {employee}: Holiday List={holiday_list}, Weekly Off Days={weekly_off_days}",
            "Weekly Off Debug",
        )

        # Parse the weekly off days (comma-separated string like "Sunday,Monday")
        off_days = [day.strip() for day in weekly_off_days.split(",")]

        # Convert day names to numbers (Monday=0, Sunday=6)
        day_numbers = []
        day_mapping = {
            "Monday": 0,
            "Tuesday": 1,
            "Wednesday": 2,
            "Thursday": 3,
            "Friday": 4,
            "Saturday": 5,
            "Sunday": 6,
        }
        for day in off_days:
            if day in day_mapping:
                day_numbers.append(day_mapping[day])

        if not day_numbers:
            return 0.0

        # Count occurrences of these weekdays in the date range
        # Convert date objects to datetime objects if needed
        if isinstance(start_date, str):
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        else:
            start_dt = datetime.combine(start_date, datetime.min.time())

        if isinstance(end_date, str):
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        else:
            end_dt = datetime.combine(end_date, datetime.min.time())

        count = 0
        current_date = start_dt
        while current_date <= end_dt:
            # Get weekday (Monday=0, Sunday=6)
            weekday = current_date.weekday()
            if weekday in day_numbers:
                count += 1
            current_date += timedelta(days=1)

        frappe.log_error(
            f"Employee {employee}: Date range {start_date} to {end_date}, Day numbers {day_numbers}, Count {count}",
            "Weekly Off Debug",
        )
        return float(count)

    except Exception as e:
        frappe.log_error(f"Error calculating weekly off for {employee}: {str(e)}")
        return 0.0


def execute(filters=None):
    if not filters:
        filters = {}

    currency = None
    if filters.get("currency"):
        currency = filters.get("currency")
    company_currency = erpnext.get_company_currency(filters.get("company"))

    salary_slips = get_salary_slips(filters, company_currency)
    if not salary_slips:
        return [], []

    earning_types, ded_types = get_earning_and_deduction_types(salary_slips)
    columns = get_columns(earning_types, ded_types)

    ss_earning_map = get_salary_slip_details(salary_slips, currency, company_currency, "earnings")
    ss_ded_map = get_salary_slip_details(salary_slips, currency, company_currency, "deductions")
    
    # Get full_amount mapping for both earnings and deductions
    ss_earning_full_amount_map = get_salary_slip_full_amount_details(salary_slips, currency, company_currency, "earnings")
    ss_ded_full_amount_map = get_salary_slip_full_amount_details(salary_slips, currency, company_currency, "deductions")

    doj_map = get_employee_doj_map()

    data = []
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    for ss in salary_slips:
        # Calculate weekly off days based on the filter date range
        weekly_off_count = get_weekly_off_days(ss.employee, from_date, to_date)

        # Attendance-based counts within the filter date range
        present_count, on_leave_count, absent_count = get_attendance_counts(
            ss.employee, from_date, to_date
        )

        # Inclusive total days in the filter range
        total_days_in_range = get_inclusive_days(from_date, to_date)

        row = {
            "salary_slip_id": ss.name,
            "employee": ss.employee,
            "employee_name": ss.employee_name,
            "actual_days_present": float(present_count),
            "weekly_off": weekly_off_count,
            "authorised_leave": float(on_leave_count),
            "unauthorised_leave": float(absent_count),
            "total_days_payable": float(total_days_in_range),
            "data_of_joining": doj_map.get(ss.employee),
            "branch": ss.branch,
            "department": ss.department,
            "designation": ss.designation,
            "company": ss.company,
            "start_date": ss.start_date,
            "end_date": ss.end_date,
            "leave_without_pay": ss.leave_without_pay,
            "absent_days": ss.absent_days,
            "payment_days": ss.payment_days,
            "currency": currency or company_currency,
            "total_loan_repayment": ss.total_loan_repayment,
        }

        update_column_width(ss, columns)

        # Add regular amount for earnings
        for e in earning_types:
            row.update({frappe.scrub(e): ss_earning_map.get(ss.name, {}).get(e)})
        
        # Add full_amount for earnings
        for e in earning_types:
            row.update({frappe.scrub(e) + "_full_amount": ss_earning_full_amount_map.get(ss.name, {}).get(e)})

        # Add regular amount for deductions
        for d in ded_types:
            row.update({frappe.scrub(d): ss_ded_map.get(ss.name, {}).get(d)})
        
        # Add full_amount for deductions
        for d in ded_types:
            row.update({frappe.scrub(d) + "_full_amount": ss_ded_full_amount_map.get(ss.name, {}).get(d)})

        if currency == company_currency:
            row.update(
                {
                    "gross_pay": flt(ss.gross_pay) * flt(ss.exchange_rate),
                    "total_deduction": flt(ss.total_deduction) * flt(ss.exchange_rate),
                    "net_pay": flt(ss.net_pay) * flt(ss.exchange_rate),
                }
            )

        else:
            row.update(
                {"gross_pay": ss.gross_pay, "total_deduction": ss.total_deduction, "net_pay": ss.net_pay}
            )

        data.append(row)

    return columns, data


def get_inclusive_days(from_date, to_date):
    """Return inclusive number of days between two dates represented as YYYY-MM-DD strings or date objects."""
    try:
        if isinstance(from_date, str):
            start_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
        else:
            start_dt = from_date

        if isinstance(to_date, str):
            end_dt = datetime.strptime(to_date, "%Y-%m-%d").date()
        else:
            end_dt = to_date

        if not start_dt or not end_dt:
            return 0
        return (end_dt - start_dt).days + 1 if end_dt >= start_dt else 0
    except Exception:
        return 0


def get_attendance_counts(employee, from_date, to_date):
    """Return tuple (present_count, on_leave_count, absent_count) for an employee within date range."""
    attendance = frappe.qb.DocType("Attendance")
    # Count Present
    present_q = (
        frappe.qb.from_(attendance)
        .where(
            (attendance.employee == employee)
            & (attendance.attendance_date >= from_date)
            & (attendance.attendance_date <= to_date)
            & (attendance.status == "Present")
        )
        .select(Count(attendance.name))
    )
    # Count On Leave
    on_leave_q = (
        frappe.qb.from_(attendance)
        .where(
            (attendance.employee == employee)
            & (attendance.attendance_date >= from_date)
            & (attendance.attendance_date <= to_date)
            & (attendance.status == "On Leave")
        )
        .select(Count(attendance.name))
    )
    # Count Absent
    absent_q = (
        frappe.qb.from_(attendance)
        .where(
            (attendance.employee == employee)
            & (attendance.attendance_date >= from_date)
            & (attendance.attendance_date <= to_date)
            & (attendance.status == "Absent")
        )
        .select(Count(attendance.name))
    )

    try:
        present = present_q.run()[0][0] if present_q else 0
        on_leave = on_leave_q.run()[0][0] if on_leave_q else 0
        absent = absent_q.run()[0][0] if absent_q else 0
    except Exception:
        present, on_leave, absent = 0, 0, 0

    return present, on_leave, absent


def get_earning_and_deduction_types(salary_slips):
    salary_component_and_type = {_("Earning"): [], _("Deduction"): []}

    for salary_component in get_salary_components(salary_slips):
        component_type = get_salary_component_type(salary_component)
        salary_component_and_type[_(component_type)].append(salary_component)

    return sorted(salary_component_and_type[_("Earning")]), sorted(salary_component_and_type[_("Deduction")])


def update_column_width(ss, columns):
    if ss.branch is not None:
        columns[3].update({"width": 120})
    if ss.department is not None:
        columns[4].update({"width": 120})
    if ss.designation is not None:
        columns[5].update({"width": 120})
    if ss.leave_without_pay is not None:
        columns[9].update({"width": 120})


def get_columns(earning_types, ded_types):
    columns = [
        {
            "label": _("Salary Slip ID"),
            "fieldname": "salary_slip_id",
            "fieldtype": "Link",
            "options": "Salary Slip",
            "width": 150,
        },
        # {
        #     "label": _("Employee"),
        #     "fieldname": "employee",
        #     "fieldtype": "Link",
        #     "options": "Employee",
        #     "width": 120,
        # },
        {
            "label": _("Employee Name"),
            "fieldname": "employee_name",
            "fieldtype": "Data",
            "width": 140,
        },
		# {
        #     "label": _("Total No of Days Payable"),
        #     "fieldname": "total_days_payable",
        #     "fieldtype": "Float",
        #     "width": 150,
        # },
        {
            "label": _("Actual Days Present"),
            "fieldname": "actual_days_present",
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "label": _("Authorised Leave"),
            "fieldname": "authorised_leave",
            "fieldtype": "Float",
            "width": 150,
        },
		{
            "label": _("Weekly Off"),
            "fieldname": "weekly_off",
            "fieldtype": "Float",
            "width": 100,
        },
        # {
        #     "label": _("Unauthorised Leave"),
        #     "fieldname": "unauthorised_leave",
        #     "fieldtype": "Float",
        #     "width": 170,
        # },
        {
            "label": _("Payment Days"),
            "fieldname": "payment_days",
            "fieldtype": "Float",
            "width": 120,
        },
        # {
        #     "label": _("Absent Days"),
        #     "fieldname": "absent_days",
        #     "fieldtype": "Float",
        #     "width": 50,
        # },
        # {
        #     "label": _("Date of Joining"),
        #     "fieldname": "data_of_joining",
        #     "fieldtype": "Date",
        #     "width": 80,
        # },
        # {
        #     "label": _("Branch"),
        #     "fieldname": "branch",
        #     "fieldtype": "Link",
        #     "options": "Branch",
        #     "width": -1,
        # },
        # {
        #     "label": _("Department"),
        #     "fieldname": "department",
        #     "fieldtype": "Link",
        #     "options": "Department",
        #     "width": -1,
        # },
        # {
        #     "label": _("Designation"),
        #     "fieldname": "designation",
        #     "fieldtype": "Link",
        #     "options": "Designation",
        #     "width": 120,
        # },
        # {
        #     "label": _("Company"),
        #     "fieldname": "company",
        #     "fieldtype": "Link",
        #     "options": "Company",
        #     "width": 120,
        # },
        # {
        #     "label": _("Start Date"),
        #     "fieldname": "start_date",
        #     "fieldtype": "Data",
        #     "width": 80,
        # },
        # {
        #     "label": _("End Date"),
        #     "fieldname": "end_date",
        #     "fieldtype": "Data",
        #     "width": 80,
        # },
        {
            "label": _("Leave Without Pay"),
            "fieldname": "leave_without_pay",
            "fieldtype": "Float",
            "width": 150,
        },
    ]

    # Add columns for regular amount and full_amount for earnings
    # for earning in earning_types:
    #     # Regular amount column
    #     columns.append(
    #         {
    #             "label": earning,
    #             "fieldname": frappe.scrub(earning),
    #             "fieldtype": "Currency",
    #             "options": "currency",
    #             "width": 120,
    #         }
    #     )
    #     # Full amount column
    #     columns.append(
    #         {
    #             "label": f"{earning} (Full Amount)",
    #             "fieldname": frappe.scrub(earning) + "_full_amount",
    #             "fieldtype": "Currency",
    #             "options": "currency",
    #             "width": 120,
    #         }
    #     )
    # Add columns for full_amount first for earnings
    for earning in earning_types:
        columns.append(
            {
                "label": f"{earning} (Full Amount)",
                "fieldname": frappe.scrub(earning) + "_full_amount",
                "fieldtype": "Currency",
                "options": "currency",
                "width": 120,
            }
        )

    # Add columns for regular amount after for earnings
    for earning in earning_types:
        columns.append(
            {
                "label": earning,
                "fieldname": frappe.scrub(earning),
                "fieldtype": "Currency",
                "options": "currency",
                "width": 120,
            }
        )


    columns.append(
        {
            "label": _("Gross Pay"),
            "fieldname": "gross_pay",
            "fieldtype": "Currency",
            "options": "currency",
            "width": 120,
        }
    )

    # Add columns for regular amount and full_amount for deductions
    # for deduction in ded_types:
    #     # Regular amount column
    #     columns.append(
    #         {
    #             "label": deduction,
    #             "fieldname": frappe.scrub(deduction),
    #             "fieldtype": "Currency",
    #             "options": "currency",
    #             "width": 120,
    #         }
    #     )
    #     # Full amount column
    #     columns.append(
    #         {
    #             "label": f"{deduction} (Full Amount)",
    #             "fieldname": frappe.scrub(deduction) + "_full_amount",
    #             "fieldtype": "Currency",
    #             "options": "currency",
    #             "width": 120,
    #         }
    #     )
    # Add columns for full_amount first for deductions
    for deduction in ded_types:
        columns.append(
            {
                "label": f"{deduction} (Full Amount)",
                "fieldname": frappe.scrub(deduction) + "_full_amount",
                "fieldtype": "Currency",
                "options": "currency",
                "width": 120,
            }
        )

    # Add columns for regular amount after for deductions
    for deduction in ded_types:
        columns.append(
            {
                "label": deduction,
                "fieldname": frappe.scrub(deduction),
                "fieldtype": "Currency",
                "options": "currency",
                "width": 120,
            }
        )


    columns.extend(
        [
            {
                "label": _("Loan Repayment"),
                "fieldname": "total_loan_repayment",
                "fieldtype": "Currency",
                "options": "currency",
                "width": 120,
            },
            {
                "label": _("Total Deduction"),
                "fieldname": "total_deduction",
                "fieldtype": "Currency",
                "options": "currency",
                "width": 120,
            },
            {
                "label": _("Net Pay"),
                "fieldname": "net_pay",
                "fieldtype": "Currency",
                "options": "currency",
                "width": 120,
            },
            {
                "label": _("Currency"),
                "fieldtype": "Data",
                "fieldname": "currency",
                "options": "Currency",
                "hidden": 1,
            },
        ]
    )
    return columns


def get_salary_components(salary_slips):
    return (
        frappe.qb.from_(salary_detail)
        .where((salary_detail.amount != 0) & (salary_detail.parent.isin([d.name for d in salary_slips])))
        .select(salary_detail.salary_component)
        .distinct()
    ).run(pluck=True)


def get_salary_component_type(salary_component):
    return frappe.db.get_value("Salary Component", salary_component, "type", cache=True)


def get_salary_slips(filters, company_currency):
    doc_status = {"Draft": 0, "Submitted": 1, "Cancelled": 2}

    query = frappe.qb.from_(salary_slip).select(salary_slip.star)

    if filters.get("docstatus"):
        query = query.where(salary_slip.docstatus == doc_status[filters.get("docstatus")])

    if filters.get("from_date"):
        query = query.where(salary_slip.start_date >= filters.get("from_date"))

    if filters.get("to_date"):
        query = query.where(salary_slip.end_date <= filters.get("to_date"))

    if filters.get("company"):
        query = query.where(salary_slip.company == filters.get("company"))

    if filters.get("employee"):
        query = query.where(salary_slip.employee == filters.get("employee"))

    if filters.get("department"):
        query = query.where(salary_slip.department == filters.get("department"))

    if filters.get("branch"):
        query = query.where(salary_slip.branch == filters.get("branch"))

    if filters.get("designation"):
        query = query.where(salary_slip.designation == filters.get("designation"))

    if filters.get("currency") and filters.get("currency") != company_currency:
        query = query.where(salary_slip.currency == filters.get("currency"))

    salary_slips = query.run(as_dict=1)

    return salary_slips or []


def get_employee_doj_map():
    employee = frappe.qb.DocType("Employee")

    result = (frappe.qb.from_(employee).select(employee.name, employee.date_of_joining)).run()

    return frappe._dict(result)


def get_salary_slip_details(salary_slips, currency, company_currency, component_type):
    salary_slips = [ss.name for ss in salary_slips]

    result = (
        frappe.qb.from_(salary_slip)
        .join(salary_detail)
        .on(salary_slip.name == salary_detail.parent)
        .where((salary_detail.parent.isin(salary_slips)) & (salary_detail.parentfield == component_type))
        .select(
            salary_detail.parent,
            salary_detail.salary_component,
            salary_detail.amount,
            salary_slip.exchange_rate,
        )
    ).run(as_dict=1)

    ss_map = {}

    for d in result:
        ss_map.setdefault(d.parent, frappe._dict()).setdefault(d.salary_component, 0.0)
        if currency == company_currency:
            ss_map[d.parent][d.salary_component] += flt(d.amount) * flt(
                d.exchange_rate if d.exchange_rate else 1
            )
        else:
            ss_map[d.parent][d.salary_component] += flt(d.amount)

    return ss_map


def get_salary_slip_full_amount_details(salary_slips, currency, company_currency, component_type):
    salary_slips = [ss.name for ss in salary_slips]

    result = (
        frappe.qb.from_(salary_slip)
        .join(salary_detail)
        .on(salary_slip.name == salary_detail.parent)
        .where((salary_detail.parent.isin(salary_slips)) & (salary_detail.parentfield == component_type))
        .select(
            salary_detail.parent,
            salary_detail.salary_component,
            salary_detail.custom_full_amount,  # Changed from amount to custom_full_amount
            salary_slip.exchange_rate,
        )
    ).run(as_dict=1)

    ss_map = {}

    for d in result:
        ss_map.setdefault(d.parent, frappe._dict()).setdefault(d.salary_component, 0.0)
        if currency == company_currency:
            ss_map[d.parent][d.salary_component] += flt(d.custom_full_amount) * flt(
                d.exchange_rate if d.exchange_rate else 1
            )
        else:
            ss_map[d.parent][d.salary_component] += flt(d.custom_full_amount)

    return ss_map