import frappe

@frappe.whitelist()
def get_furnace_bath(from_date=None,to_date=None):
    conditions=""
    values=[]

    if from_date and to_date:
        conditions=" where date between %s and %s "
        values=[from_date,to_date]

    data = frappe.db.sql(f"""
        select 
            name,date,time,sample_id,grade,c,si,mn,p,ce,mg,perlite_,ferrite_,nodularity_,nodule_count,creation
        from `tabFurnace Bath` {conditions}
        order by creation asc
    """,values,as_dict=True)

    return data
