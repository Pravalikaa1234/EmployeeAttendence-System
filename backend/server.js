
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const Employee = require("./models/Employee");
const Attendance = require("./models/Attendance");
const User = require("./models/User");

const app = express();

app.use(cors());
app.use(express.json());

// Protect application APIs. Login, initial admin setup and health remain public.
function requireAuth(req, res, next) {
  if (req.path === "/health" || req.path === "/auth/login" || req.path === "/auth/setup-admin") return next();

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Your session expired. Please log in again." });
  }
}
app.use("/api", requireAuth);

app.get("/", (req, res) => {
  res.send("Employee Attendance API is running!");
});

app.get("/api/health", (req, res) => {
  res.json({ message: "Backend is working" });
});

// EMPLOYEE APIs

app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.post("/api/employees", async (req, res) => {
  try {
    const { employeeId, name, email, department, position } = req.body;

    if (
      !employeeId?.trim() ||
      !name?.trim() ||
      !email?.trim() ||
      !department?.trim() ||
      !position?.trim()
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    if (!/^\d{3}$/.test(employeeId.trim())) {
      return res.status(400).json({ message: "Employee ID must contain exactly 3 digits (for example, 101)." });
    }

    const existingEmployee = await Employee.findOne({
      $or: [
        { employeeId: employeeId.trim() },
        { email: email.trim().toLowerCase() },
      ],
    });

    if (existingEmployee) {
      if (
        existingEmployee.employeeId.toLowerCase() ===
        employeeId.trim().toLowerCase()
      ) {
        return res.status(409).json({
          message: "This employee ID already exists.",
        });
      }

      return res.status(409).json({
        message: "This email address is already registered.",
      });
    }

    const employee = await Employee.create({
      employeeId,
      name,
      email,
      department,
      position,
    });

    res.status(201).json(employee);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Employee ID or email already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Add employee error:", error.message);
    res.status(500).json({
      message: "Could not add employee. Please try again.",
    });
  }
});


app.put("/api/employees/:id", async (req, res) => {
  try {
    const { employeeId, name, email, department, position } = req.body;

    if (
      !employeeId?.trim() ||
      !name?.trim() ||
      !email?.trim() ||
      !department?.trim() ||
      !position?.trim()
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    if (!/^\d{3}$/.test(employeeId.trim())) {
      return res.status(400).json({ message: "Employee ID must contain exactly 3 digits (for example, 101)." });
    }

    const existingEmployee = await Employee.findOne({
      _id: { $ne: req.params.id },
      $or: [
        { employeeId: employeeId.trim() },
        { email: email.trim().toLowerCase() },
      ],
    });

    if (existingEmployee) {
      if (
        existingEmployee.employeeId.toLowerCase() ===
        employeeId.trim().toLowerCase()
      ) {
        return res.status(409).json({
          message: "This employee ID already exists.",
        });
      }

      return res.status(409).json({
        message: "This email address is already registered.",
      });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { employeeId, name, email, department, position },
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found.",
      });
    }

    res.json(employee);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Employee ID or email already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Update employee error:", error.message);
    res.status(500).json({
      message: "Could not update employee. Please try again.",
    });
  }
});


// Resign an employee without deleting their record or attendance history.
app.patch("/api/employees/:id/resign", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { status: "Resigned", resignationDate: new Date().toISOString().slice(0, 10) },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    res.json({ message: "Employee marked as resigned. Attendance history has been preserved.", employee });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/employees/:id/reactivate", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { status: "Active", resignationDate: null },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    res.json({ message: "Employee reactivated successfully.", employee });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ATTENDANCE APIs

// Get attendance for a date; defaults to today
app.get("/api/attendance", async (req, res) => {
  try {
    const date = req.query.date ||
      new Date().toISOString().slice(0, 10);

    const records = await Attendance.find({ date })
      .populate("employee", "employeeId name department position")
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save or update attendance for one employee on a date
app.post("/api/attendance", async (req, res) => {
  try {
    const { employeeId, date, status } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        message: "Employee, date and status are required",
      });
    }

    if (!["Present", "Absent", "Late"].includes(status)) {
      return res.status(400).json({
        message: "Status must be Present, Absent or Late",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date))) {
      return res.status(400).json({
        message: "Date must be in YYYY-MM-DD format",
      });
    }

    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (date > todayString) {
      return res.status(400).json({ message: "Attendance cannot be marked for a future date." });
    }

    const employee = await Employee.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }
    if (employee.status === "Resigned") {
      return res.status(400).json({ message: "Attendance cannot be marked for a resigned employee." });
    }

    const record = await Attendance.findOneAndUpdate(
      { employee: employee._id, date },
      { employee: employee._id, date, status },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DASHBOARD STATISTICS

app.get("/api/dashboard", async (req, res) => {
  try {
    const date = req.query.date ||
      new Date().toISOString().slice(0, 10);

    const totalEmployees = await Employee.countDocuments({ $or: [{ status: "Active" }, { status: { $exists: false } }] });
    const records = await Attendance.find({ date });

    const present = records.filter(
      (record) => record.status === "Present"
    ).length;

    const absent = records.filter(
      (record) => record.status === "Absent"
    ).length;

    const late = records.filter(
      (record) => record.status === "Late"
    ).length;

    res.json({
      totalEmployees,
      present,
      absent,
      late,
      notMarked: Math.max(
        0,
        totalEmployees - present - absent - late
      ),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/reports/attendance", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (
      !startDate ||
      !endDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
      startDate > endDate
    ) {
      return res.status(400).json({
        message: "Provide a valid startDate and endDate.",
      });
    }

    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (startDate > todayString) {
      return res.status(400).json({ message: "Start date cannot be in the future." });
    }
    const effectiveEndDate = endDate > todayString ? todayString : endDate;
    const employees = await Employee.find().lean();

    const records = await Attendance.find({
      date: { $gte: startDate, $lte: effectiveEndDate },
    }).lean();

    const report = employees.map((employee) => {
      const employeeRecords = records.filter(
        (record) => String(record.employee) === String(employee._id)
      );

      const present = employeeRecords.filter(
        (record) => record.status === "Present"
      ).length;

      const late = employeeRecords.filter(
        (record) => record.status === "Late"
      ).length;

      const absent = employeeRecords.filter(
        (record) => record.status === "Absent"
      ).length;

      const totalMarked = present + late + absent;

      return {
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        present,
        late,
        absent,
        totalMarked,
        attendancePercentage:
          totalMarked === 0
            ? 0
            : Number((((present + late) / totalMarked) * 100).toFixed(1)),
      };
    });

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/insights", async (req, res) => {
  try {
    const employees = await Employee.find().lean();
    const records = await Attendance.find().lean();

    const insights = [];

    for (const employee of employees) {
      const employeeRecords = records.filter(
        (record) =>
          String(record.employee) === String(employee._id)
      );

      const present = employeeRecords.filter(
        (record) => record.status === "Present"
      ).length;

      const late = employeeRecords.filter(
        (record) => record.status === "Late"
      ).length;

      const absent = employeeRecords.filter(
        (record) => record.status === "Absent"
      ).length;

      const totalMarked = present + late + absent;

      const percentage =
        totalMarked === 0
          ? 0
          : ((present + late) / totalMarked) * 100;

      if (totalMarked === 0) {
        insights.push({
          employeeId: employee.employeeId,
          name: employee.name,
          type: "No Attendance Recorded",
          message: "Attendance has not been marked for this employee.",
        });
      } else if (percentage < 75) {
        insights.push({
          employeeId: employee.employeeId,
          name: employee.name,
          type: "Low Attendance",
          message: `Attendance is ${percentage.toFixed(1)}%, below 75%.`,
        });
      }

      if (late >= 3) {
        insights.push({
          employeeId: employee.employeeId,
          name: employee.name,
          type: "Repeated Late Arrivals",
          message: `Late arrival recorded ${late} times.`,
        });
      }
    }

    res.json(insights);
  } catch (error) {
    console.error("Insights error:", error.message);
    res.status(500).json({
      message: "Could not generate attendance insights.",
    });
  }
});

/* AUTHENTICATION ROUTES */

// Create the first Admin account
app.post("/api/auth/setup-admin", async (req, res) => {
  try {
    if (
      !process.env.ADMIN_SETUP_KEY ||
      req.headers["x-setup-key"] !== process.env.ADMIN_SETUP_KEY
    ) {
      return res.status(403).json({ message: "Invalid setup key" });
    }

    if (await User.exists({ role: "Admin" })) {
      return res.status(403).json({
        message: "Admin account has already been created"
      });
    }

    const { email, password } = req.body;

    if (!email?.trim() || !password || password.length < 8) {
      return res.status(400).json({
        message: "Enter an email and a password of at least 8 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        message: "This email is already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      email: normalizedEmail,
      passwordHash,
      role: "Admin",
      employee: null
    });

    res.status(201).json({
      message: "Admin account created successfully. You can now log in."
    });
  } catch (error) {
    console.error("Admin setup error:", error.message);
    res.status(500).json({ message: "Could not create Admin account" });
  }
});


// Log in
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is missing from .env"
      });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        employee: user.employee
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Login failed" });
  }
});

// START SERVER

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(process.env.PORT || 5000, () => {
      console.log("Server running on port 5000");
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });
