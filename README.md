# Remix of Office Pass

Office Visitor Logbook Management System with RFID (Lovable.dev Prompt)

Build a modern, secure, and responsive Office Visitor Logbook Management System for recording office visitors. The system should use RFID technology to identify returning visitors and minimize manual data entry. It should provide an efficient workflow for office staff while ensuring that only authorized administrators can manage visitor records and generate reports.

Objective

Develop a visitor logbook where only administrators can log in and access the system. Visitors do not have accounts. Each visitor may be assigned an RFID card that uniquely identifies them on future visits.

The system should automatically recognize returning visitors through RFID, record each visit, and maintain a complete visitor history.

Tech Stack

Use:

React

TypeScript

Tailwind CSS

shadcn/ui

Supabase

PostgreSQL

Supabase Authentication

React Router

TanStack Query

SheetJS (xlsx) for Excel export

jsPDF + AutoTable for PDF export

Recharts for dashboard analytics

Generate clean, modular, and production-ready code.

Authentication

Only administrators can access the system.

Features:

Secure administrator login

Session persistence

Protected routes

Logout

Change password

There should be no public registration or visitor login.

Dashboard

Display:

Visitors Today

Visitors This Week

Visitors This Month

Visitors Currently Inside

Recent Visitor Logs

Most Common Visit Purposes

Charts showing visitor trends

Quick "Register Visitor" button

RFID Visitor Identification

Each visitor can be assigned a unique RFID card.

When an RFID card is scanned:

Read the RFID UID automatically.

Search the Visitors database.

If the RFID exists:

Automatically identify the visitor.

Auto-fill their information.

Display the visitor profile.

If the RFID is not registered:

Prompt the administrator to register the visitor.

Save the RFID UID with the visitor's profile.

Support:

USB HID RFID readers (keyboard emulation)

Modular RFID service for future hardware compatibility

Visitor Registration

For first-time visitors, collect:

Full Name

Organization / Company (optional)

Contact Number (optional)

Email (optional)

Person or Office to Visit

Purpose of Visit

Remarks (optional)

Automatically save:

RFID UID

Date

Time In

Administrator

Created At

Returning Visitors

When a registered RFID card is scanned:

Automatically populate:

Full Name

Company

Contact Number

Email

The administrator only needs to enter:

Person or Office to Visit

Purpose of Visit

Remarks

Then click Check In to save the visit.

Visitor Logbook

Every visit should create a new log entry containing:

Log ID

RFID UID

Visitor Name

Company

Contact Number

Office or Person Visited

Purpose of Visit

Date

Time In

Time Out

Visit Duration (calculated automatically)

Status (Inside / Checked Out)

Remarks

Administrator

Created At

Updated At

Check In / Check Out

When a visitor arrives:

Record Time In

Status = Inside

When the visitor leaves:

Administrator clicks Check Out

Record Time Out

Automatically calculate visit duration

Status = Checked Out

Administrator Permissions

Only authenticated administrators can:

Register new visitors

Register RFID cards

Edit visitor information

Edit visitor log entries

Delete visitor records

Delete visitor log entries

Check visitors out

View reports

Export reports to Excel (.xlsx)

Export reports to PDF

Export reports to CSV

No other users or visitors can perform these actions.

Search & Filters

Search by:

Visitor Name

RFID UID

Company

Person Visited

Purpose

Filter by:

Date

Date Range

Status

Company

Office Visited

Sort by:

Newest

Oldest

Name

Time In

Time Out

Reports

Create a Reports page.

Allow filtering by:

Today

Yesterday

This Week

This Month

This Year

Custom Date Range

Each report should include:

Visitor Name

RFID UID

Company

Office Visited

Purpose

Date

Time In

Time Out

Visit Duration

Status

Remarks

Display summary statistics:

Total Visitors

Visitors Currently Inside

Average Visit Duration

Most Common Visit Purpose

Excel Export

Only administrators can export reports.

Requirements:

Export filtered results only

Microsoft Excel (.xlsx)

Professional report title

Report period

Styled header row

Auto-sized columns

Proper date/time formatting

Summary section

Filename format:

Visitor_Report_YYYY-MM-DD.xlsx

PDF & CSV Export

Only administrators can generate PDF and CSV reports.

Database Tables

admins

id

email

created_at

visitors

id

rfid_uid (unique)

full_name

company

contact_number

email

created_at

updated_at

visitor_logs

id

visitor_id

office_to_visit

purpose

remarks

visit_date

time_in

time_out

duration

status

created_by

created_at

updated_at

audit_logs

id

admin_id

action

description

created_at

Implement proper relationships, indexing, and Supabase RLS policies.

User Interface

Create a clean and professional office dashboard with:

Sidebar

Top navigation

Dashboard cards

Search bar

Responsive data tables

Modal dialogs

Pagination

Toast notifications

Loading skeletons

Empty states

Light/Dark mode

Optimize for desktop, tablet, and mobile devices.

Security

Implement:

Administrator-only authentication

Protected routes

Supabase Authentication

Row Level Security (RLS)

Password hashing

Input validation

SQL injection protection

XSS protection

Audit Logs

Record administrator actions, including:

Login

Logout

Visitor registration

RFID registration

Visitor updates

Visitor deletion

Check Out

Excel export

PDF export

CSV export

Each audit log should include the administrator and timestamp.

Code Quality

Generate:

Reusable React components

TypeScript interfaces

Custom hooks

Organized folder structure

Proper error handling

Loading states

Environment variable support

Clean, maintainable code

Final Deliverables

Generate a fully functional application including:

Complete Supabase database schema

SQL migration scripts

Row Level Security (RLS) policies

Administrator authentication

RFID-based visitor identification

Visitor registration

Visitor check-in/check-out

Visitor history

Dashboard analytics

Search and filtering

Administrator-only editing and deletion of records

Administrator-only Excel, PDF, and CSV report exports

Audit logging

Sample seed data

The final application should be modern, responsive, secure, and optimized for office use. The workflow should allow an administrator to scan a visitor's RFID card, automatically identify returning visitors, register new visitors when necessary, record the purpose of each visit, track check-in and check-out times, maintain a complete visitor history, and generate professional reports.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/247173e3-391f-4c5b-9aa1-658e97ecc257).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
