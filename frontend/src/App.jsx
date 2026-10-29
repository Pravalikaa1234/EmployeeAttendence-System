import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";
const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function api(path, options = {}, token = localStorage.getItem("attendanceToken")) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

const DEPARTMENTS = [
  "Administration",
  "Customer Support",
  "Data Analytics",
  "Design",
  "Engineering",
  "Finance & Accounting",
  "Human Resources",
  "Information Technology (IT)",
  "Legal",
  "Logistics & Supply Chain",
  "Marketing",
  "Operations",
  "Procurement",
  "Production",
  "Quality Assurance",
  "Research & Development",
  "Sales",
  "Security",
  "Training & Development",
];

const blankEmployee = { employeeId: "", name: "", email: "", department: "", position: "" };

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (mode === "setup") {
        const result = await api("/auth/setup-admin", {
          method: "POST",
          headers: { "x-setup-key": setupKey },
          body: JSON.stringify({ email, password }),
        }, null);
        setMode("login");
        setError(result.message || "Admin account created. Please log in.");
      } else {
        const result = await api("/auth/login", {
          method: "POST", body: JSON.stringify({ email, password }),
        }, null);
        localStorage.setItem("attendanceToken", result.token);
        localStorage.setItem("attendanceUser", JSON.stringify(result.user));
        onLogin(result.user);
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="login-screen">
    <div className="login-art">
      <div className="brand-mark">A</div>
      <p className="eyebrow">ATTENDEASE · WORKSPACE</p>
      <h1>People first.<br/>Every day counted.</h1>
      <p className="login-description">A clearer view of your workforce, attendance, and team activity — all in one place.</p>
      <div className="login-points"><span>✓ Reliable attendance records</span><span>✓ Reports up to today</span><span>✓ Employee history preserved</span></div>
    </div>
    <form className="login-card" onSubmit={submit}>
      <div className="small-brand">ATTENDEASE</div>
      <h2>{mode === "login" ? "Welcome back" : "Create admin account"}</h2>
      <p className="muted">{mode === "login" ? "Sign in to manage your attendance workspace." : "One-time setup for the first administrator."}</p>
      <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@company.com" required autoComplete="username"/></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete={mode==="login"?"current-password":"new-password"}/></label>
      {mode === "setup" && <label>Admin setup key<input value={setupKey} onChange={e=>setSetupKey(e.target.value)} placeholder="Enter key from backend .env" required/></label>}
      {error && <div className="form-message">{error}</div>}
      <button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in →" : "Create account →"}</button>
      <button type="button" className="link-button" onClick={()=>{setMode(mode==="login"?"setup":"login");setError("");}}>{mode==="login"?"First time? Set up the admin account":"Back to sign in"}</button>
      <p className="security-note"><span>●</span> Secure access to your workspace</p>
    </form>
  </div>;
}

function App() {
  const [user, setUser] = useState(() => {
    try { return localStorage.getItem("attendanceToken") ? JSON.parse(localStorage.getItem("attendanceUser") || "null") : null; }
    catch { return null; }
  });
  const [page, setPage] = useState("Dashboard");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ totalEmployees: 0, present: 0, absent: 0, late: 0, notMarked: 0 });
  const [insights, setInsights] = useState([]);
  const [date, setDate] = useState(todayString());
  const [reportStart, setReportStart] = useState(todayString());
  const [reportEnd, setReportEnd] = useState(todayString());
  const [reportData, setReportData] = useState([]);
  const [form, setForm] = useState(blankEmployee);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [showResigned, setShowResigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAll(selectedDate = date) {
    setLoading(true); setError("");
    try {
      const [emp, att, dashboard, insight] = await Promise.all([
        api("/employees"), api(`/attendance?date=${selectedDate}`),
        api(`/dashboard?date=${selectedDate}`), api("/insights")
      ]);
      setEmployees(emp); setAttendance(att); setStats(dashboard); setInsights(insight);
    } catch (e) {
      setError(e.message);
      if (e.message.toLowerCase().includes("log in") || e.message.toLowerCase().includes("session")) logout();
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user) loadAll(date); }, [user]);
  function logout() {
    localStorage.removeItem("attendanceToken"); localStorage.removeItem("attendanceUser");
    setUser(null); setEmployees([]); setAttendance([]);
  }
  async function changeDate(value) {
    if (value > todayString()) { setError("You cannot view or mark attendance for a future date."); return; }
    setDate(value); setError("");
    try {
      const [att, dashboard] = await Promise.all([api(`/attendance?date=${value}`), api(`/dashboard?date=${value}`)]);
      setAttendance(att); setStats(dashboard);
    } catch(e) { setError(e.message); }
  }
  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === "employeeId" ? value.replace(/\D/g, "").slice(0, 3) : value }));
  }
  async function saveEmployee(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (!/^\d{3}$/.test(form.employeeId)) { setError("Employee ID must be exactly 3 digits, for example 101."); return; }
    try {
      await api(editingId ? `/employees/${editingId}` : "/employees", {
        method: editingId ? "PUT" : "POST", body: JSON.stringify(form)
      });
      setForm(blankEmployee); setEditingId(null); await loadAll(date);
      setMessage(editingId ? "Employee updated." : "Employee added successfully.");
    } catch(e) { setError(e.message); }
  }
  async function changeEmploymentStatus(employee) {
    const resigning = employee.status !== "Resigned";
    if (!window.confirm(resigning
      ? `Mark ${employee.name} as resigned? Their attendance history will be kept.`
      : `Reactivate ${employee.name}?`)) return;
    try {
      await api(`/employees/${employee._id}/${resigning ? "resign" : "reactivate"}`, { method: "PATCH", body: JSON.stringify({}) });
      await loadAll(date); setMessage(resigning ? "Employee marked as resigned. Past records are preserved." : "Employee reactivated.");
    } catch(e) { setError(e.message); }
  }
  async function markAttendance(employeeId, status) {
    try {
      await api("/attendance", { method: "POST", body: JSON.stringify({ employeeId, date, status }) });
      await loadAll(date); setMessage("Attendance saved.");
    } catch(e) { setError(e.message); }
  }
  async function loadReport() {
    setError(""); setMessage("");
    if (reportStart > todayString()) { setError("Start date cannot be in the future."); return; }
    if (reportStart > reportEnd) { setError("Start date must be on or before end date."); return; }
    try {
      const data = await api(`/reports/attendance?startDate=${reportStart}&endDate=${reportEnd > todayString() ? todayString() : reportEnd}`);
      setReportData(data); setMessage(`Report generated through ${reportEnd > todayString() ? todayString() : reportEnd}.`);
    } catch(e) { setError(e.message); }
  }
  const activeEmployees = employees.filter(e => e.status !== "Resigned");
  const filteredEmployees = employees.filter(e => (showResigned ? e.status === "Resigned" : e.status !== "Resigned")
    && (employeeFilter === "All" || e.department === employeeFilter)
    && `${e.employeeId} ${e.name} ${e.email}`.toLowerCase().includes(search.toLowerCase()));
  const marked = stats.present + stats.absent + stats.late;
  const attendanceRate = marked ? Math.round(((stats.present + stats.late) / marked) * 100) : 0;
  const nav = [{name:"Dashboard",icon:"▦"},{name:"Employees",icon:"♙"},{name:"Attendance",icon:"◷"},{name:"Reports",icon:"▤"}];

  if (!user) return <Login onLogin={setUser}/>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark small">A</span><div><b>AttendEase</b><small>WORKSPACE</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.name} className={page===n.name?"nav-item selected":"nav-item"} onClick={()=>{setPage(n.name);setError("");setMessage("");}}><span className="nav-icon">{n.icon}</span>{n.name}{page===n.name&&<span className="nav-active"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon">✦</div><b>Need a hand?</b><p>Keep your team records clean and up to date.</p></div><div className="profile"><div className="avatar">{(user.email||"A").slice(0,1).toUpperCase()}</div><div className="profile-info"><b>{user.email}</b><small>{user.role || "Admin"}</small></div><button title="Log out" onClick={logout} className="logout">↪</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><span className="today-pill"><span className="live-dot"/> System active</span><div className="top-avatar">{(user.email||"A").slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><p className="eyebrow">{page==="Dashboard"?"OVERVIEW":page==="Employees"?"PEOPLE DIRECTORY":page==="Attendance"?"DAILY TRACKING":"ANALYTICS & EXPORTS"}</p><h1>{page==="Dashboard"?"Good day, Admin":page}</h1><p className="subheading">{page==="Dashboard"?"Here’s what’s happening with your team today.":page==="Employees"?"Manage your people and preserve their employment history.":page==="Attendance"?"Record daily attendance for active employees.":"Review attendance records for any period up to today."}</p></div>{page==="Dashboard"&&<div className="date-chip"><span>▦</span><input type="date" max={todayString()} value={date} onChange={e=>changeDate(e.target.value)}/></div>}</div>
        {error&&<div className="alert error"><span>!</span>{error}<button onClick={()=>setError("")}>×</button></div>}
        {message&&<div className="alert success"><span>✓</span>{message}<button onClick={()=>setMessage("")}>×</button></div>}
        {loading&&<div className="loading-line">Refreshing workspace…</div>}

        {page==="Dashboard"&&<div className="dashboard">
          <div className="metric-grid">
            <div className="metric-card"><div className="metric-top"><span>Total active employees</span><span className="metric-icon purple">♙</span></div><div className="metric-value">{stats.totalEmployees}</div><div className="metric-foot"><span className="foot-dot purple-dot"/>Current workforce</div></div>
            <div className="metric-card"><div className="metric-top"><span>Present</span><span className="metric-icon green">✓</span></div><div className="metric-value">{stats.present}</div><div className="metric-foot"><span className="positive">{stats.totalEmployees?Math.round(stats.present/stats.totalEmployees*100):0}%</span> of active employees</div></div>
            <div className="metric-card"><div className="metric-top"><span>Absent</span><span className="metric-icon orange">◷</span></div><div className="metric-value">{stats.absent}</div><div className="metric-foot"><span className="foot-dot orange-dot"/>Needs follow-up</div></div>
            <div className="metric-card"><div className="metric-top"><span>Late arrivals</span><span className="metric-icon blue">↗</span></div><div className="metric-value">{stats.late}</div><div className="metric-foot"><span className="foot-dot blue-dot"/>Today's late entries</div></div>
          </div>
          <div className="content-grid">
            <section className="surface attendance-summary"><div className="section-head"><div><h2>Today's attendance</h2><p>Attendance overview for {date}</p></div><button className="text-action" onClick={()=>setPage("Attendance")}>View records ↗</button></div>
              <div className="rate-wrap"><div className="rate-number">{attendanceRate}<small>%</small></div><div className="rate-copy"><b>Attendance rate</b><p>Based on marked attendance</p></div><div className="rate-ring" style={{"--rate":`${attendanceRate*3.6}deg`}}><div>{attendanceRate}%</div></div></div>
              <div className="progress-track"><span style={{width:`${attendanceRate}%`}}/></div>
              <div className="legend-row"><span><i className="legend green-bg"/>Present <b>{stats.present}</b></span><span><i className="legend orange-bg"/>Absent <b>{stats.absent}</b></span><span><i className="legend blue-bg"/>Late <b>{stats.late}</b></span><span><i className="legend gray-bg"/>Not marked <b>{stats.notMarked}</b></span></div>
            </section>
            <section className="surface quick-actions"><div className="section-head"><div><h2>Quick actions</h2><p>Common tasks, one click away</p></div></div>
              <button className="action-row" onClick={()=>{setPage("Employees");setEditingId(null);setForm(blankEmployee);}}><span className="action-icon purple">＋</span><span><b>Add employee</b><small>Create a new employee record</small></span><strong>›</strong></button>
              <button className="action-row" onClick={()=>setPage("Attendance")}><span className="action-icon green">✓</span><span><b>Mark attendance</b><small>Record today's team status</small></span><strong>›</strong></button>
              <button className="action-row" onClick={()=>setPage("Reports")}><span className="action-icon blue">▤</span><span><b>Generate report</b><small>Review attendance by date range</small></span><strong>›</strong></button>
            </section>
          </div>
          <section className="surface"><div className="section-head"><div><h2>Recent attendance</h2><p>Latest records for the selected date</p></div><button className="text-action" onClick={()=>setPage("Attendance")}>See all ↗</button></div>
            {attendance.length===0?<div className="empty-state"><span>◷</span><b>No attendance recorded yet</b><p>Open Daily Attendance to record today's status.</p><button className="primary" onClick={()=>setPage("Attendance")}>Mark attendance</button></div>:<div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>{attendance.slice(0,8).map(r=><tr key={r._id}><td><div className="employee-cell"><span className="table-avatar">{r.employee?.name?.slice(0,1)||"?"}</span><span><b>{r.employee?.name||"Unknown"}</b><small>ID {r.employee?.employeeId||"—"}</small></span></div></td><td>{r.employee?.department||"—"}</td><td>{r.date}</td><td><span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>)}</tbody></table></div>}
          </section>
          <section className="surface"><div className="section-head"><div><h2>Attendance insights</h2><p>Automatic reminders based on saved records</p></div><span className="count-pill">{insights.length} alerts</span></div>{insights.length===0?<p className="muted padded">No attendance alerts at the moment.</p>:<div className="insights-list">{insights.slice(0,5).map((i,n)=><div className="insight" key={`${i.employeeId}-${i.type}-${n}`}><span className="insight-mark">!</span><div><b>{i.type} · {i.name} ({i.employeeId})</b><p>{i.message}</p></div></div>)}</div>}</section>
        </div>}

        {page==="Employees"&&<div className="stack">
          <section className="surface"><div className="section-head"><div><h2>{editingId?"Edit employee":"Add an employee"}</h2><p>Employee IDs must contain exactly three digits.</p></div>{editingId&&<button className="secondary" onClick={()=>{setEditingId(null);setForm(blankEmployee);}}>Cancel edit</button>}</div>
            <form onSubmit={saveEmployee} className="employee-form">
              <label>Employee ID<input name="employeeId" value={form.employeeId} onChange={handleChange} placeholder="101" inputMode="numeric" pattern="[0-9]{3}" maxLength={3} minLength={3} required/><small>Exactly 3 digits, e.g. 101</small></label>
              <label>Full name<input name="name" value={form.name} onChange={handleChange} placeholder="Employee full name" required/></label>
              <label>Email address<input name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@company.com" required/></label>
              <label>Department<select name="department" value={form.department} onChange={handleChange} required><option value="">Select department</option>{[...new Set([...DEPARTMENTS, ...employees.map(e => e.department).filter(Boolean)])].map(department => <option key={department} value={department}>{department}</option>)}</select></label>
              <label>Job position<input name="position" value={form.position} onChange={handleChange} placeholder="Software Engineer" required/></label>
              <div className="form-buttons"><button className="primary">{editingId?"Save changes":"＋ Add employee"}</button></div>
            </form>
          </section>
          <section className="surface"><div className="section-head"><div><h2>Employee directory</h2><p>{employees.length} employee records · history is never deleted when someone resigns</p></div><button className="secondary" onClick={()=>setShowResigned(v=>!v)}>{showResigned?"Show active employees":"View resigned employees"}</button></div>
            <div className="filters"><input placeholder="Search ID, name or email…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)}><option value="All">All departments</option>{[...new Set(employees.map(e=>e.department))].filter(Boolean).map(d=><option key={d}>{d}</option>)}</select></div>
            <div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>POSITION</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{filteredEmployees.map(e=><tr key={e._id}><td><div className="employee-cell"><span className="table-avatar">{e.name.slice(0,1).toUpperCase()}</span><span><b>{e.name}</b><small>ID {e.employeeId} · {e.email}</small></span></div></td><td>{e.department}</td><td>{e.position}</td><td><span className={`status-badge ${(e.status||"Active").toLowerCase()}`}>{e.status||"Active"}</span></td><td><div className="table-actions"><button className="mini-action" onClick={()=>{setEditingId(e._id);setForm({employeeId:e.employeeId,name:e.name,email:e.email,department:e.department,position:e.position});window.scrollTo({top:0,behavior:"smooth"});}}>Edit</button><button className="mini-action" onClick={()=>changeEmploymentStatus(e)}>{e.status==="Resigned"?"Reactivate":"Mark resigned"}</button></div></td></tr>)}{filteredEmployees.length===0&&<tr><td colSpan="5" className="empty-cell">No employees found.</td></tr>}</tbody></table></div>
          </section>
        </div>}

        {page==="Attendance"&&<div className="stack"><section className="surface"><div className="section-head"><div><h2>Daily attendance</h2><p>Attendance can only be marked for today or a past date.</p></div><div className="date-chip"><span>▦</span><input type="date" max={todayString()} value={date} onChange={e=>changeDate(e.target.value)}/></div></div><div className="attendance-toolbar"><span>{activeEmployees.length} active employees</span><span>{marked} of {stats.totalEmployees} marked</span></div><div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>CURRENT STATUS</th><th>MARK STATUS</th></tr></thead><tbody>{activeEmployees.map(e=>{const rec=attendance.find(r=>r.employee?._id===e._id);return <tr key={e._id}><td><div className="employee-cell"><span className="table-avatar">{e.name.slice(0,1).toUpperCase()}</span><span><b>{e.name}</b><small>ID {e.employeeId}</small></span></div></td><td>{e.department}</td><td>{rec?<span className={`status-badge ${rec.status.toLowerCase()}`}>{rec.status}</span>:<span className="muted">Not marked</span>}</td><td><div className="mark-buttons">{["Present","Late","Absent"].map(status=><button key={status} className={`mark-btn ${status.toLowerCase()} ${rec?.status===status?"chosen":""}`} onClick={()=>markAttendance(e._id,status)} disabled={date>todayString()}>{status}</button>)}</div></td></tr>})}{activeEmployees.length===0&&<tr><td colSpan="4" className="empty-cell">No active employees. Add an employee to begin.</td></tr>}</tbody></table></div></section></div>}

        {page==="Reports"&&<div className="stack"><section className="surface"><div className="section-head"><div><h2>Attendance report</h2><p>Reports are limited to records up to today. Resigned employees remain available in historical reports.</p></div></div><div className="report-filters"><label>Start date<input type="date" max={todayString()} value={reportStart} onChange={e=>setReportStart(e.target.value)}/></label><label>End date<input type="date" max={todayString()} value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></label><button className="primary report-button" onClick={loadReport}>Generate report ↗</button></div><div className="report-note">Showing records from <b>{reportStart}</b> through <b>{reportEnd>todayString()?todayString():reportEnd}</b>.</div></section>
          <section className="surface"><div className="section-head"><div><h2>Report results</h2><p>{reportData.length} employee records, including resigned employees with past attendance</p></div></div><div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>PRESENT</th><th>LATE</th><th>ABSENT</th><th>ATTENDANCE RATE</th></tr></thead><tbody>{reportData.map(item=><tr key={item.employeeId}><td><b>{item.name}</b><small className="block-muted">ID {item.employeeId}</small></td><td>{item.department}</td><td>{item.present}</td><td>{item.late}</td><td>{item.absent}</td><td><div className="percentage-cell"><span>{item.attendancePercentage}%</span><div className="mini-progress"><i style={{width:`${item.attendancePercentage}%`}}/></div></div></td></tr>)}{reportData.length===0&&<tr><td colSpan="6" className="empty-cell">Choose a date range and click Generate report.</td></tr>}</tbody></table></div></section></div>}
        <footer className="footer"><span>AttendEase · Employee Attendance Management</span><span>Records are stored securely in your database</span></footer>
      </div>
    </main>
  </div>;
}

export default App;
