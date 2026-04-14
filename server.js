require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const https = require('https');
const path       = require('path');
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
// ══════════════════════════════════════════════════
// MONGODB CONNECTION
// ══════════════════════════════════════════════════
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(e => console.error('❌ Error MongoDB:', e.message));
 
// ══════════════════════════════════════════════════
// SCHEMAS
// ══════════════════════════════════════════════════
const StudentSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  category:   { type: String, required: true, enum: ['curso','escuela','club'] },
  group_name: { type: String, required: true },
  email:      { type: String, default: '' },
  created_at: { type: String, default: () => new Date().toISOString().replace('T',' ').substring(0,19) }
});
 
const ScheduleSchema = new mongoose.Schema({
  lab:        { type: String, required: true },
  day:        { type: Number, required: true },
  start_time: { type: String, required: true },
  end_time:   { type: String, required: true }
});
 
const SeatSchema = new mongoose.Schema({
  reservation_id:   { type: String, required: true },
  pc_key:           { type: String, required: true },
  student_id:       { type: String, default: '' },
  student_name:     { type: String, required: true },
  student_group:    { type: String, default: '' },
  student_category: { type: String, default: '' }
});
 
const ReservationSchema = new mongoose.Schema({
  lab:           { type: String, required: true },
  lab_name:      { type: String, required: true },
  teacher:       { type: String, required: true },
  teacher_email: { type: String, default: '' },
  date:          { type: String, required: true },
  start_time:    { type: String, required: true },
  end_time:      { type: String, required: true },
  subject:       { type: String, default: '' },
  topic:         { type: String, default: '' },
  created_at:    { type: String, default: () => new Date().toISOString().replace('T',' ').substring(0,19) }
});
 
const ConfigSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: String, default: '' }
});
 
const Student     = mongoose.model('Student',     StudentSchema);
const Schedule    = mongoose.model('Schedule',    ScheduleSchema);
const Seat        = mongoose.model('Seat',        SeatSchema);
const Reservation = mongoose.model('Reservation', ReservationSchema);
const Config      = mongoose.model('Config',      ConfigSchema);
 
// ══════════════════════════════════════════════════
// CONFIG HELPERS
// ══════════════════════════════════════════════════
async function getConfig() {
  const rows = await Config.find();
  const cfg = {
    smtp_user:'', smtp_pass:'', admin_email:'',
    admin_hs_email:'', admin_ms_email:'', admin_primary_email:''
  };
  // Prioridad: variables de entorno > base de datos
  cfg.smtp_user           = process.env.SMTP_USER           || rows.find(r=>r.key==='smtp_user')?.value           || '';
  cfg.smtp_pass           = process.env.SMTP_PASS           || rows.find(r=>r.key==='smtp_pass')?.value           || '';
  cfg.admin_email         = process.env.ADMIN_EMAIL         || rows.find(r=>r.key==='admin_email')?.value         || '';
  cfg.admin_hs_email      = process.env.ADMIN_HS_EMAIL      || rows.find(r=>r.key==='admin_hs_email')?.value      || '';
  cfg.admin_ms_email      = process.env.ADMIN_MS_EMAIL      || rows.find(r=>r.key==='admin_ms_email')?.value      || '';
  cfg.admin_primary_email = process.env.ADMIN_PRIMARY_EMAIL || rows.find(r=>r.key==='admin_primary_email')?.value || '';
  return cfg;
}
 
// ══════════════════════════════════════════════════
// EMAIL
// ══════════════════════════════════════════════════
async function sendNotification(reservation, seats) {
  const cfg = await getConfig();
  const resendKey = process.env.RESEND_API_KEY || '';
  if (!resendKey) return { sent: false, reason: 'RESEND_API_KEY no configurada' };
 
  const labAdminEmails = {
    hs: cfg.admin_hs_email, ms: cfg.admin_ms_email, primary: cfg.admin_primary_email
  };
  const recipients = [
    cfg.admin_email,
    labAdminEmails[reservation.lab],
    reservation.teacher_email
  ].filter(e => e && e.includes('@'));
 
  if (!recipients.length) return { sent: false, reason: 'Sin destinatarios' };
 
  const [y,m,d] = reservation.date.split('-');
  const fechaFmt = `${d}/${m}/${y}`;
 
  const seatsHtml = seats.map(s =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${s.pc_key.toUpperCase()}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${s.student_name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#666">${s.student_group} (${s.student_category})</td>
    </tr>`).join('');
 
  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff;border:1px solid #e0e3ea;border-radius:12px;overflow:hidden;">
    <div style="background:#185FA5;padding:24px 28px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">🖥 Nueva Reserva de Laboratorio</h1>
      <p style="color:#B5D4F4;margin:6px 0 0;font-size:14px;">${reservation.lab_name}</p>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;width:160px;">Laboratorio</td><td style="font-weight:600">${reservation.lab_name}</td></tr>
        <tr><td style="color:#666;padding:6px 0;">Profesor</td><td style="font-weight:600">${reservation.teacher}</td></tr>
        <tr><td style="color:#666;padding:6px 0;">Fecha</td><td style="font-weight:600">${fechaFmt}</td></tr>
        <tr><td style="color:#666;padding:6px 0;">Horario</td><td style="font-weight:600">${reservation.start_time} – ${reservation.end_time}</td></tr>
        <tr><td style="color:#666;padding:6px 0;">Materia</td><td style="font-weight:600">${reservation.subject||'—'}</td></tr>
        <tr><td style="color:#666;padding:6px 0;">Tema a abarcar</td><td style="font-weight:600">${reservation.topic||'—'}</td></tr>
        <tr><td style="color:#666;padding:6px 0;">Equipos asignados</td><td style="font-weight:600">${seats.length}</td></tr>
      </table>
      <h3 style="font-size:14px;color:#333;margin-bottom:10px;border-bottom:2px solid #e0e3ea;padding-bottom:8px;">Distribución de equipos</h3>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <thead>
          <tr style="background:#f4f6f9;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #e0e3ea;">Equipo</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #e0e3ea;">Estudiante</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;border-bottom:2px solid #e0e3ea;">Grupo / Categoría</th>
          </tr>
        </thead>
        <tbody>${seatsHtml}</tbody>
      </table>
      <p style="font-size:12px;color:#aaa;margin-top:20px;padding-top:14px;border-top:1px solid #eee;">
        Correo generado automáticamente — Sistema de Reservas de Laboratorios
      </p>
    </div>
  </div>`;
 
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass }
    });
    await transporter.sendMail({
      from:    `"Reserva Laboratorios" <${cfg.smtp_user}>`,
      to:      [...new Set(recipients)].join(', '),
      subject: `📅 Nueva reserva — ${reservation.lab_name} | ${fechaFmt} ${reservation.start_time}`,
      html
    });
    return { sent: true };
  } catch(e) {
    console.error('Error email:', e.message);
    return { sent: false, reason: e.message };
  }
}
 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
 
// ══════════════════════════════════════════════════
// CONFIG API
// ══════════════════════════════════════════════════
app.get('/api/config', async (req, res) => {
  const cfg = await getConfig();
  res.json({ ...cfg, smtp_pass: cfg.smtp_pass ? '••••••••' : '' });
});
 
app.post('/api/config', async (req, res) => {
  const keys = ['smtp_user','smtp_pass','admin_email','admin_hs_email','admin_ms_email','admin_primary_email'];
  for (const key of keys) {
    if (req.body[key] !== undefined) {
      if (key === 'smtp_pass' && req.body[key] === '••••••••') continue;
      await Config.findOneAndUpdate({ key }, { key, value: req.body[key] }, { upsert: true });
    }
  }
  res.json({ ok: true });
});
 
app.post('/api/config/test-email', async (req, res) => {
  const resendKey = process.env.RESEND_API_KEY || '';
  if (!resendKey) return res.status(400).json({ error: 'RESEND_API_KEY no configurada en Render' });
  const cfg = await getConfig();
  const to = cfg.admin_email || cfg.smtp_user;
  if (!to) return res.status(400).json({ error: 'Configura al menos el correo del administrador' });
  try {
    const body = JSON.stringify({
      from: 'Reserva Laboratorios <onboarding@resend.dev>',
      to: [to],
      subject: 'Prueba — Sistema de Reservas de Laboratorios',
      html: '<p style="font-family:Arial,sans-serif;font-size:16px;">Correo de prueba enviado correctamente desde el Sistema de Reservas.</p>'
    });
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          if (r.statusCode >= 200 && r.statusCode < 300) resolve(data);
          else reject(new Error(`Resend ${r.statusCode}: ${data}`));
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});
 
// ══════════════════════════════════════════════════
// STUDENTS
// ══════════════════════════════════════════════════
app.get('/api/students', async (req, res) => {
  const list = await Student.find().sort({ name: 1 });
  res.json(list);
});
 
app.post('/api/students', async (req, res) => {
  const { name, category, group_name, email } = req.body;
  if (!name || !category || !group_name)
    return res.status(400).json({ error: 'Nombre, categoría y grupo son requeridos' });
  const exists = await Student.findOne({ name: new RegExp('^'+name.trim()+'$','i') });
  if (exists) return res.status(400).json({ error: 'Ya existe un estudiante con ese nombre' });
  const doc = await Student.create({ name: name.trim(), category, group_name: group_name.trim(), email: (email||'').trim() });
  res.json(doc);
});
 
app.put('/api/students/:id', async (req, res) => {
  const { name, category, group_name, email } = req.body;
  if (!name || !category || !group_name)
    return res.status(400).json({ error: 'Nombre, categoría y grupo son requeridos' });
  const doc = await Student.findByIdAndUpdate(req.params.id,
    { name: name.trim(), category, group_name: group_name.trim(), email: (email||'').trim() },
    { new: true }
  );
  res.json(doc);
});
 
app.delete('/api/students/:id', async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
 
app.post('/api/students/promote', async (req, res) => {
  const { from, to, category } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'Ingresa grupo actual y nuevo' });
  const query = { group_name: new RegExp('^'+from.trim()+'$','i') };
  if (category) query.category = category;
  const r = await Student.updateMany(query, { $set: { group_name: to.trim() } });
  res.json({ updated: r.modifiedCount });
});
 
// ══════════════════════════════════════════════════
// SCHEDULES
// ══════════════════════════════════════════════════
app.get('/api/schedules', async (req, res) => {
  const list = await Schedule.find().sort({ lab:1, day:1, start_time:1 });
  res.json(list);
});
 
app.post('/api/schedules', async (req, res) => {
  const { lab, day, start_time, end_time } = req.body;
  if (!lab || day===undefined || !start_time || !end_time)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  const doc = await Schedule.create({ lab, day: Number(day), start_time, end_time });
  res.json(doc);
});
 
app.delete('/api/schedules/:id', async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
 
// ══════════════════════════════════════════════════
// RESERVATIONS
// ══════════════════════════════════════════════════
app.get('/api/reservations', async (req, res) => {
  const reservations = await Reservation.find().sort({ date:-1, start_time:-1 });
  const allSeats     = await Seat.find();
  res.json(reservations.map(r => ({
    ...r.toObject(),
    _id: r._id.toString(),
    seats: allSeats.filter(s => s.reservation_id === r._id.toString())
  })));
});
 
app.post('/api/reservations', async (req, res) => {
  const { lab, lab_name, teacher, teacher_email, date, start_time, end_time, subject, topic, seats } = req.body;
  if (!lab || !teacher || !date || !start_time || !end_time)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (!seats || !Object.keys(seats).length)
    return res.status(400).json({ error: 'Asigna al menos un estudiante a un equipo' });
 
  const saved = await Reservation.create({
    lab, lab_name, teacher, teacher_email: teacher_email||'',
    date, start_time, end_time, subject: subject||'', topic: topic||''
  });
 
  const resId    = saved._id.toString();
  const newSeats = [];
  for (const [pcKey, student] of Object.entries(seats)) {
    const seat = await Seat.create({
      reservation_id:   resId,
      pc_key:           pcKey,
      student_id:       student._id || '',
      student_name:     student.name,
      student_group:    student.group_name || '',
      student_category: student.category  || ''
    });
    newSeats.push(seat.toObject());
  }
 
  sendNotification({ ...saved.toObject(), _id: resId }, newSeats).then(r => {
    if (r.sent) console.log('✅ Correo enviado');
    else console.log('⚠ Correo no enviado:', r.reason);
  });
 
  res.json({ ...saved.toObject(), _id: resId, seats: newSeats });
});
 
app.delete('/api/reservations/:id', async (req, res) => {
  await Seat.deleteMany({ reservation_id: req.params.id });
  await Reservation.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
 
// ══════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n  ✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`  🌐 http://localhost:${PORT}\n`);
});
