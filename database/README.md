# Database Setup Instructions

## Setup Order

1. **First, run the schema:**
   ```bash
   mysql -u root -p < database/schema.sql
   ```

2. **Then, create admin user with proper password hash:**
   ```bash
   node scripts/create-admin.js
   ```
   This will generate a SQL INSERT statement with a properly hashed password.

3. **Finally, run the seed file (optional, for sample data):**
   ```bash
   mysql -u root -p < database/seed.sql
   ```

## Important Notes

⚠️ **The seed.sql file contains placeholder password hashes!**

Before using the seed data, you MUST:

1. Generate proper password hashes using the script:
   ```bash
   node scripts/create-admin.js
   ```

2. Update the seed.sql file with the generated hashes, OR

3. Manually update the passwords in the database after running seed.sql:
   ```sql
   UPDATE users SET password = 'YOUR_GENERATED_HASH' WHERE email = 'admin@dekodeit.com';
   UPDATE users SET password = 'YOUR_GENERATED_HASH' WHERE email = 'staff@dekodeit.com';
   ```

## Default Credentials (After Proper Hash Setup)

- **Admin User:**
  - Email: admin@dekodeit.com
  - Password: (whatever you set when generating hash)

- **Staff User:**
  - Email: staff@dekodeit.com
  - Password: (whatever you set when generating hash)

## What's Included in seed.sql

- 2 users (1 admin, 1 staff) - **NEEDS PASSWORD HASH UPDATE**
- 5 sample customers
- 1 sample proposal template
- 1 sample invoice template
- 3 sample projects

You can modify or extend the seed data as needed for your testing purposes.

