# AttendEase — Employee Attendance Management System

## Required software
- Node.js 20.19+ (recommended for the included Vite version)
- MongoDB Community Server running locally

## 1. Configure backend
Open a terminal in `EmployeeAttendanceSystem/backend` and run:
```bash
npm install
```
Open `backend/.env`. Change `JWT_SECRET` to a long random private value. `ADMIN_SETUP_KEY=264` is a one-time setup key for the first admin account; change it before using this outside a classroom demo.

Start the backend:
```bash
npm run dev
```
It should run on `http://localhost:5000`. Keep this terminal open.

## 2. Configure frontend
Open a second terminal in `EmployeeAttendanceSystem/frontend`:
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually `http://localhost:5173`).

## 3. First login
On the login page, select **First time? Set up the admin account**.
- Enter your admin email.
- Enter a password with at least 8 characters.
- Enter the setup key from `backend/.env` (`ADMIN_SETUP_KEY`).
Then sign in using the same email and password.

## Features included
- Responsive dashboard with workforce cards, attendance rate, quick actions, recent records and alerts.
- Employee ID validation: exactly 3 digits, enforced in the frontend and backend.
- Reports stop at today's date; future start dates are rejected.
- Future attendance cannot be marked.
- Resigned employees are retained and their attendance history remains available in reports; no hard-delete action is provided.
- Login using hashed passwords and JWT-protected application API routes.

## Notes
- This update intentionally excludes `node_modules`; run `npm install` in both `backend` and `frontend`.
- Existing employee records with IDs that are not exactly three digits will remain in the database but must be corrected before editing them. Back up your database before making schema or project changes.
- This classroom version has one admin setup flow. Keep `.env` private and do not publish it.
