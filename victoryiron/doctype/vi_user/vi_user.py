
# import frappe
# from frappe.model.document import Document



# class VIUser(Document):
# 	def validate(self):
# 		self.set_full_name()

# 	def autoname(self):
# 		self.name = f"{self.email.lower()}"

# 	def before_save(self):
# 		# Check if the user already exists based on the email
# 		self.email = self.email.lower()
# 		if frappe.db.exists("User", {"email": self.email}):
# 			update_user_details(self)
# 		else:
# 			create_core_user(self)

# 	def set_full_name(self):
# 		"""Set the full name based on available name fields."""
# 		if self.first_name:
# 			if self.middle_name and self.last_name:
# 				self.full_name = f"{self.first_name} {self.middle_name} {self.last_name}"
# 			elif self.last_name:
# 				self.full_name = f"{self.first_name} {self.last_name}"
# 			else:
# 				self.full_name = self.first_name
# 		else:
# 			self.full_name = "Unnamed User"


# def create_core_user(self):
# 	if frappe.db.exists("Role", self.role):
# 		formatted_role = self.role
# 	else:
# 		formatted_role = format_role(self.role)
# 		if not frappe.db.exists("Role", formatted_role):
# 			# Create the role if it doesn't exist
# 			frappe.get_cached_doc({"doctype": "Role", "role_name": formatted_role}).insert()
# 			frappe.msgprint(f"Role {formatted_role} created.")

# 	# Generate a unique username
# 	username = generate_unique_username(self.first_name, self.last_name)

# 	# Prepare the user data
# 	user = frappe.get_doc(
# 		{
# 			"doctype": "User",
# 			"first_name": self.first_name,
# 			"middle_name": self.middle_name,
# 			"last_name": self.last_name,
# 			"email": self.email,
# 			"username": username,
# 			"mobile_no": self.phone,
# 			"gender": self.gender,
# 			"birth_date": self.birthday,
# 			"user_image": self.user_image,
# 			"send_welcome_email": 0,
# 			# "location": self.branch_id,
# 			"roles": [{"role": formatted_role}],
# 		}
# 	)
# 	user.insert()
# 	user.new_password = "root@1234"
# 	user.save()
# 	self.user_link = user.name


# def update_user_details(self):
# 	"""Update existing User details with VI User data."""
# 	user = frappe.get_doc("User", {"email": self.email})

# 	# Update User details
# 	user.first_name = self.first_name
# 	user.middle_name = self.middle_name
# 	user.last_name = self.last_name
# 	user.username = user.username or generate_unique_username(self.first_name, self.last_name)
# 	user.full_name = self.full_name
# 	user.mobile_no = self.phone
# 	user.location = self.branch_id
# 	user.user_image = self.user_image
# 	user.gender = self.gender
# 	user.birth_date = self.birthday

# 	# Update roles if role is changed in CG User
# 	formatted_role = format_role(self.role)
# 	existing_roles = {role.role for role in user.roles}
# 	if formatted_role not in existing_roles:
# 		user.set("roles", [])
# 		user.append("roles", {"role": formatted_role})

# 	user.save()
# 	frappe.msgprint(f"User {self.email} has been updated successfully.", alert=True)


# def format_role(role_name):
# 	"""Format role name to fit the required CG-ROLE format."""
# 	return f"CG-{role_name.replace(' ', '-').upper()}"


# def generate_unique_username(first_name, last_name):
# 	"""
# 	Generates a unique username based on the provided first and last name.
# 	Handles cases where first_name or last_name might be None.
# 	"""
# 	if not first_name:
# 		first_name = ""
# 	if not last_name:
# 		last_name = ""

# 	base_name = first_name.replace(" ", "").lower()
# 	if last_name:
# 		base_name += "." + last_name.replace(" ", "").lower()

# 	# Ensure uniqueness by appending a number if needed
# 	username = base_name
# 	counter = 1
# 	while frappe.db.exists("User", username):
# 		username = f"{base_name}.{counter}"
# 		counter += 1

# 	return username