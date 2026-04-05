# Prime Paper Company - User Manual & AI Reference

This document serves as a comprehensive user manual and development reference for the **Prime Paper Company** web application. It describes every page, function, and feature available in the system.

## 1. Landing Page
**Path:** `/`
**Component:** `LandingPage`

The Landing Page is the public face of Prime Paper Company. It is accessible to everyone without logging in.

### Features
- **Hero Section**: A high-impact introduction to the system's core value proposition.
- **Get Started CTA**: Redirects new users to the Signup page.
- **View Dashboard**: Smarlty detects if a user is already logged in and provides a direct link to the app dashboard.

---

## 2. Dashboard
**Path:** `/dashboard`
**Component:** `DashboardClient`

The Dashboard is the central hub for authenticated users, providing a high-level overview of the company's financial and operational status.

### Features
- **Top Unpaid Companies:** Lists companies with outstanding balances. Displays company name and total outstanding balance in EGP.
- **Revenue vs. Payments Bar Chart:** Visually represents total revenue alongside total payments received, tracked month by month.
- **Recent Deliveries Table:** A quick view of the most recent shipments. Includes a link to view all deliveries.

---

## 3. Authentication
**Paths:** `/auth/login`, `/auth/signup`, `/auth/forgot-password`

The system provides a complete authentication suite.

### Features
- **Public Signup**: Allows new staff to create accounts. By default, new signups are granted the `dev` role for development purposes.
- **Secure Login**: Standard email/password entry.
- **Manual Forgot Password**: Instead of automated emails, users submit a "Reset Request" which is tracked globally as a ticket for administrators to resolve manually.

---

## 2. Companies
**Path:** `/companies`
**Component:** `CompaniesClient`

This section is used to manage the client profiles (B2B customers) that Prime Paper Company does business with.

### Features & Operations
- **List Companies:** Displays all registered companies in a table with columns for Name, Contact Person, Phone, Address, and Notes.
- **Add New Company:** Opens a dialog to create a new client. Includes fields for:
  - `Name` (Required text)
  - `Contact Person` (Optional text)
  - `Phone` (Optional telephone number, LTR)
  - `Address` (Optional text)
  - `Notes` (Optional multiline text)
- **Edit Company:** Allows updating any of the fields for an existing company profile.
- **Delete Company:** Permanently removes a company from the system (requires confirmation).

---

## 3. Deliveries
**Path:** `/deliveries`
**Component:** `DeliveriesClient`

The Deliveries page tracks all outgoing shipments and sales made to companies.

### Features & Operations
- **List Deliveries:** Displays a table with columns for Delivery Date, Company Name, Selling Price (EGP), Payment Status, Notes, and Actions.
- **View Delivery Details:** Dedicated button (Eye icon) to view deeper details `/deliveries/[id]`.
- **Add New Delivery:** Complex form for creating a new delivery record:
  - `Date` (Required date selection, defaults to today)
  - `Company` (Required dropdown selection of existing companies)
  - `Selling Price` (Required number, total price in EGP)
  - `Payment Status` (Dropdown: Paid, Partial, Unpaid)
  - `Items` (Dynamic list where users can add multiple products to the delivery. Each item requires selecting an existing Product from inventory, and specifying the Quantity).
  - `Notes` (Optional multiline text)
- **Delete Delivery:** Removes a delivery record (requires confirmation). Deleting a delivery also triggers a system recalculation of Dashboard statistics.

---

## 4. Products (Inventory)
**Path:** `/products`
**Component:** `ProductsClient`

This page manages the actual manufactured paper products ready for sale. Products are linked to the raw materials out of which they were created.

### Features & Operations
- **List Products:** Table displaying Date Produced, Raw Material source (Supplier), Length (m), Width (cm), Weight (kg), and Quantity.
- **Add New Product:** Opens a dialog to enter a new product batch into inventory:
  - `Date Produced` (Required date, defaults to today)
  - `Raw Material` (Optional dropdown linking to a specific raw material shipment)
  - `Length (m)` (Required number, up to 2 decimal places)
  - `Width (cm)` (Required number, up to 2 decimal places)
  - `Weight (kg)` (Required number, up to 2 decimal places)
  - `Quantity` (Required integer, defaults to 1)
  - `Notes` (Optional multiline text)
- **Edit Product:** Allows modifications to the dimensions, weight, quantity, or raw material linkage of an existing product.
- **Delete Product:** Removes a product batch from the system (requires confirmation).

---

## 5. Raw Materials
**Path:** `/raw-materials`
**Component:** `RawMaterialsClient`

This module manages the incoming stock of raw materials (like pulp, chemicals, etc.) purchased from suppliers to produce paper.

### Features & Operations
- **List Raw Materials:** Displays a table of Date Received, Supplier Name, Weight in Tons, Total Cost (EGP), Cost per Ton (calculated dynamically), and Notes.
- **Add New Raw Material:** Dialog form to register a new shipment:
  - `Date Received` (Required date, defaults to today)
  - `Supplier Name` (Required text)
  - `Weight in Tons` (Required number, up to 3 decimal places)
  - `Total Cost (EGP)` (Required number, up to 2 decimal places)
  - `Notes` (Optional multiline text)
- **Edit Raw Material:** Allows updating any of the existing fields for a specific raw material shipment.
- **Delete Raw Material:** Removes the raw material record from the system (requires confirmation).

---

## 6. Settings
**Path:** `/settings`
**Component:** `SettingsPage`

A configuration page for application-level preferences.

### Features & Operations
- **Language Toggle:** Allows the user to switch the system language interface between **English** and **Arabic**. 
- **Under the Hood:** Sets a `locale` cookie valid for one year and reloads the page to apply the selected localization string sets via `next-intl`.

---

## 8. Admin Portal (Invite & Resets)
**Path:** `/invite`
**Component:** `InviteClient`

An administrative suite for managing the platform's team and security. Restricted to `dev` and `admin` roles.

### Tab 1: Invite User
- **Create User Form:** 
  - `Name`, `Email`, `Password`, and `Role` (**Admin** or **Viewer**).
- **Functionality:** Securely creates the user profile in the database via Better Auth Admin API.

### Tab 2: Password Resets
- **Ticket Queue:** Displays all pending password reset requests from the public "Forgot Password" page.
- **Manual Resolution:** Admins can enter a new password for the user, update the credential via the Admin API, and mark the ticket as resolved.

---

## AI & Developer Reference

- **Architecture:** The application leverages the **Next.js App Router** with a **tRPC** backend following an Onion Architecture logic layer.
- **Styling:** Built extensively with **Tailwind CSS** and **Shadcn UI** components. Features are highly optimized with responsive variants, LTR/RTL support (`dir="ltr"` explicit enforcement where applicable like numbers/passwords), and modern glassmorphic overlays (`bg-background/95 backdrop-blur`).
- **State Management & Fetching:** Utilizing React Query through the `api.useUtils()` TRPC wrapper for query invalidations (e.g., automatically refreshing specific tables after a Create/Update/Delete mutation is made).
- **Localization:** Implemented via `next-intl`. Most components fetch strings using the `useTranslations("namespace")` hook on the client-side or `getTranslations("namespace")` on the server-side pages.
- **Security:** Administrative actions like user invitation run through custom session checks (`getSession()`) enforcing rigid scope requirements.
