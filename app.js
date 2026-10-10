// ============================================================================
// info cc 404 — منصة ملفات مهندس دولة في الإعلام الآلي (G1 إلى G10)
// ============================================================================

// 1) إعدادات Supabase — أدخل مفاتيحك الخاصة من Project Settings > API
const SUPABASE_URL = "https://ubqezeogtzesrkyvicnc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_EbY0t9yKdz2vb-L09ddA_Q_bie0CCci";

const BUCKET = "course-files";
const GROUPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KINDS = {
  cours: "Cours",
  td: "TD",
  tp: "TP",
  exam: "Examen",
  autre: "Autre"
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// فحص تفعيل المفاتيح أو استخدام وضع تجريبي
const isConfigured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PUT_YOUR");
let db = null;

if (isConfigured && window.supabase) {
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn("Supabase init error:", err);
  }
}

// حالة التطبيق
let currentUser = null;
let userGroupNo = null;
let isAdmin = false;
let files = [];
let isSignupMode = false;
let activeGroupFilter = "";

function say(el, text, ok = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? "var(--success)" : "var(--danger)";
}

// ============================================================================
// 2) المصادقة (Auth: Login & Signup with Group No)
// ============================================================================
$("#tabLoginBtn").onclick = () => setAuthMode(false);
$("#tabSignupBtn").onclick = () => setAuthMode(true);

function setAuthMode(signup) {
  isSignupMode = signup;
  $("#tabLoginBtn").classList.toggle("active", !signup);
  $("#tabSignupBtn").classList.toggle("active", signup);
  $("#groupSignupGroup").style.display = signup ? "block" : "none";
  $("#authSubmitBtn").textContent = signup ? "إنشاء حساب" : "دخول";
  $("#password").autocomplete = signup ? "new-password" : "current-password";
  say($("#authMsg"), "");
}

$("#authForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const msg = $("#authMsg");

  if (!email || !password) {
    return say(msg, "يرجى إدخال البريد الإلكتروني وكلمة السر.");
  }

  say(msg, "جاري المعالجة...", true);

  if (!db) return say(msg, "ما زال ما حطيتش مفاتيح Supabase في app.js.");

  if (isSignupMode) {
    const selectedGroupNo = parseInt($("#signupGroup").value, 10);
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { group_no: selectedGroupNo }
      }
    });

    if (error) return say(msg, "خطأ: " + error.message);

    if (!data.session) {
      say(msg, "تم إنشاء الحساب! تفقّد بريدك الإلكتروني لتأكيد التسجيل.", true);
    }
  } else {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) return say(msg, "خطأ: البريد أو كلمة السر غير صحيحة.");
  }
};

$("#logoutBtn").onclick = async () => {
  if (db) await db.auth.signOut();
};

if (db) {
  db.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;
    setTimeout(() => (session ? onUserSignedIn(session) : onUserSignedOut()), 0);
  });
}

async function onUserSignedIn(session = null) {
  if (session && session.user) {
    currentUser = session.user;
    userGroupNo = currentUser.user_metadata?.group_no ? parseInt(currentUser.user_metadata.group_no, 10) : null;

    // التحقق من صلاحية الأدمن
    try {
      const { data } = await db
        .from("admins")
        .select("user_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      isAdmin = !!data;
    } catch (e) {
      isAdmin = false;
    }
  }

  // تحديث واجهة المستخدم بعد الدخول
  $("#authBox").style.display = "none";
  $("#heroLoggedInBadge").style.display = "block";
  $("#logoutBtn").style.display = "inline-flex";
  $("#groups-section").style.display = "block";
  $("#files-section").style.display = "block";
  $("#navGroupsLink").style.display = "inline-flex";
  $("#navAdminLink").style.display = isAdmin ? "inline-flex" : "none";
  $("#admin-section").style.display = isAdmin ? "block" : "none";

  await loadFiles();

  // تحديد فوج الطالب المسجل تلقائياً في الفلتر إذا وجد
  if (userGroupNo) {
    activeGroupFilter = String(userGroupNo);
    $("#fGroup").value = String(userGroupNo);
    highlightGroupCard(userGroupNo);
    filterAndDrawFiles();
  }
}

function onUserSignedOut() {
  currentUser = null;
  userGroupNo = null;
  isAdmin = false;
  $("#authBox").style.display = "block";
  $("#heroLoggedInBadge").style.display = "none";
  $("#logoutBtn").style.display = "none";
  $("#groups-section").style.display = "none";
  $("#files-section").style.display = "none";
  $("#navGroupsLink").style.display = "none";
  $("#navAdminLink").style.display = "none";
  $("#admin-section").style.display = "none";
}

// ============================================================================
// 3) تحميل وعرض الملفات (Files & Group Logic)
// ============================================================================
async function loadFiles() {
  if (!db) return;
  const { data, error } = await db.from("files").select("*").order("created_at", { ascending: false });
  if (error) {
    $("#filesList").innerHTML = `<div class="empty-box">تعذر جلب الملفات: ${escapeHtml(error.message)}</div>`;
    return;
  }
  files = data || [];

  // تحديث الإحصائيات
  $("#statFiles").textContent = files.length;
  const distinctSubjects = [...new Set(files.map((f) => f.subject))].filter(Boolean);
  $("#statSubjects").textContent = distinctSubjects.length;

  // ملء الفلاتر
  fillSelect($("#fSem"), [...new Set(files.map((f) => f.semester))].filter(Boolean).sort(), "كل السداسيات");
  fillSelect($("#fSubject"), distinctSubjects.sort(), "كل المواد");
  fillSelect($("#fKind"), Object.keys(KINDS), "كل الأنواع", (k) => KINDS[k]);

  fillGroupSelect($("#fGroup"), "كل الأفواج (G1 - G10)");
  fillGroupSelect($("#upGroup"), "كل الأفواج (All groups)");

  renderGroupsGrid();
  filterAndDrawFiles();
}

function fillSelect(sel, values, defaultLabel, labelFn = (v) => v) {
  const keep = sel.value;
  sel.length = 0;
  sel.add(new Option(defaultLabel, ""));
  values.forEach((v) => sel.add(new Option(labelFn(v), v)));
  sel.value = values.includes(keep) ? keep : "";
}

function fillGroupSelect(sel, defaultLabel) {
  const keep = sel.value;
  sel.length = 0;
  sel.add(new Option(defaultLabel, ""));
  GROUPS.forEach((g) => {
    sel.add(new Option(`Groupe ${g} (G${g})`, String(g)));
  });
  sel.value = keep;
}

// بطاقات الأفواج العشرة (G1 إلى G10)
function renderGroupsGrid() {
  const container = $("#groupsGrid");
  container.innerHTML = "";

  GROUPS.forEach((num) => {
    const card = document.createElement("div");
    card.className = "group-card" + (activeGroupFilter === String(num) ? " active" : "");
    card.setAttribute("data-group", String(num));

    // عدد الملفات المتاحة لهذا الفوج (ملفات الفوج + الملفات العامة الموجهة للكل)
    const count = files.filter((f) => f.group_no === num || f.group_no === null).length;

    card.innerHTML = `
      <div class="group-card-code">G${num}</div>
      <div class="group-card-name">الفوج ${num}</div>
      <div class="group-card-count">${count} ملف</div>
    `;

    card.onclick = () => {
      if (activeGroupFilter === String(num)) {
        // إلغاء الفلترة إذا نقر عليه مجدداً
        activeGroupFilter = "";
        $("#fGroup").value = "";
        card.classList.remove("active");
      } else {
        activeGroupFilter = String(num);
        $("#fGroup").value = String(num);
        highlightGroupCard(num);
      }
      filterAndDrawFiles();
      location.href = "#files-section";
    };

    container.append(card);
  });
}

function highlightGroupCard(num) {
  $$(".group-card").forEach((card) => {
    card.classList.toggle("active", card.getAttribute("data-group") === String(num));
  });
}

// تصفية ورسم الملفات
function filterAndDrawFiles() {
  const q = ($("#q").value || "").trim().toLowerCase();
  const sem = $("#fSem").value;
  const sub = $("#fSubject").value;
  const kind = $("#fKind").value;
  const grp = $("#fGroup").value; // "1".."10" or ""

  const rows = files.filter((f) => {
    const matchQ = !q || f.title.toLowerCase().includes(q) || (f.subject && f.subject.toLowerCase().includes(q));
    const matchSem = !sem || f.semester === sem;
    const matchSub = !sub || f.subject === sub;
    const matchKind = !kind || f.kind === kind;

    // منطق الفوج: إذا تم اختيار فوج، نعرض ملفات ذلك الفوج بالإضافة للملفات العامة (group_no === null)
    let matchGroup = true;
    if (grp) {
      const gNum = parseInt(grp, 10);
      matchGroup = f.group_no === gNum || f.group_no === null;
    }

    return matchQ && matchSem && matchSub && matchKind && matchGroup;
  });

  $("#filesCount").textContent = `${rows.length} ملف متوفر`;
  const container = $("#filesList");
  container.innerHTML = "";

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon">📂</div>
        <strong style="color: var(--text-main); font-size: 1.05rem;">لم يتم العثور على أي ملفات</strong>
        <p style="margin: 6px 0 14px;">جرب تعديل كلمات البحث أو اختيار 'كل المواد' لإظهار المزيد من النتائج.</p>
        <button class="btn btn-secondary btn-sm" onclick="window.resetFilters()">إعادة ضبط الفلاتر</button>
      </div>
    `;
    return;
  }

  rows.forEach((f) => container.append(createFileRow(f)));
}

function createFileRow(f) {
  const row = document.createElement("div");
  row.className = "file-row";

  const kindLabel = KINDS[f.kind] || f.kind;
  const isRecent = f.created_at && (Date.now() - new Date(f.created_at).getTime() < 7 * 86400000);
  const groupLabel = f.group_no ? `G${f.group_no}` : "كل الدفعة";
  const dateStr = f.created_at ? new Date(f.created_at).toLocaleDateString("fr-DZ") : "";

  row.innerHTML = `
    <div class="file-row-left">
      <span class="badge-kind ${escapeHtml(f.kind)}">${kindLabel}</span>
      <div class="file-main">
        <div class="file-title-wrap">
          <span class="file-title">${escapeHtml(f.title)}</span>
          ${isRecent ? '<span class="badge-new">جديد</span>' : ''}
        </div>
        <div class="file-meta">
          <span>${escapeHtml(f.subject)}</span>
          <span>·</span>
          <span>${escapeHtml(f.semester)}</span>
          <span>·</span>
          <span class="file-group-chip">${groupLabel}</span>
          <span>·</span>
          <span>${dateStr}</span>
        </div>
      </div>
    </div>
    <div class="file-row-right">
      <button class="btn btn-primary btn-sm open-btn">فتح</button>
      ${isAdmin ? '<button class="btn btn-danger btn-sm del-btn">حذف</button>' : ''}
    </div>
  `;

  row.querySelector(".open-btn").onclick = () => openFile(f);
  if (isAdmin) {
    row.querySelector(".del-btn").onclick = () => removeFile(f);
  }

  return row;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.resetFilters = () => {
  $("#q").value = "";
  $("#fSem").value = "";
  $("#fSubject").value = "";
  $("#fKind").value = "";
  $("#fGroup").value = "";
  activeGroupFilter = "";
  $$(".group-card").forEach((c) => c.classList.remove("active"));
  filterAndDrawFiles();
};

$("#resetFiltersBtn").onclick = window.resetFilters;

["#q", "#fSem", "#fSubject", "#fKind"].forEach((s) => {
  $(s).addEventListener("input", filterAndDrawFiles);
});

$("#fGroup").addEventListener("input", (e) => {
  activeGroupFilter = e.target.value;
  if (activeGroupFilter) {
    highlightGroupCard(parseInt(activeGroupFilter, 10));
  } else {
    $$(".group-card").forEach((c) => c.classList.remove("active"));
  }
  filterAndDrawFiles();
});

// فتح / تحميل الملف برابط موقع آمن
async function openFile(f) {
  if (!db) return;
  try {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(f.path, 3600);
    if (error) return alert("تعذر فتح الملف: " + error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert("حدث خطأ: " + err.message);
  }
}

// حذف الملف (للأدمن)
async function removeFile(f) {
  if (!confirm("هل أنت متأكد من حذف «" + f.title + "»؟")) return;

  if (!db) return;
  try {
    await db.storage.from(BUCKET).remove([f.path]);
  } catch (e) {
    console.warn("Storage remove warning:", e);
  }

  const { error } = await db.from("files").delete().eq("id", f.id);
  if (error) return alert("خطأ في حذف الملف: " + error.message);
  await loadFiles();
}

// ============================================================================
// 4) رفع الملفات (Admin Upload)
// ============================================================================
$("#upForm").onsubmit = async (e) => {
  e.preventDefault();
  const file = $("#upFile").files[0];
  const msg = $("#upMsg");
  if (!file) return;

  say(msg, "جاري رفع الملف إلى التخزين...", true);

  const ext = file.name.includes(".") ? "." + file.name.split(".").pop().toLowerCase() : "";
  const cleanBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45) || "file";
  const path = `${Date.now()}_${cleanBase}${ext}`;

  const title = $("#upTitle").value.trim();
  const subject = $("#upSubject").value.trim();
  const semester = $("#upSem").value;
  const kind = $("#upKind").value;
  const grpVal = $("#upGroup").value;
  const group_no = grpVal ? parseInt(grpVal, 10) : null;

  if (!db) return say(msg, "ما زال ما حطيتش مفاتيح Supabase في app.js.");

  const { error: upErr } = await db.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (upErr) return say(msg, "خطأ في رفع الملف: " + upErr.message);

  const { error: insErr } = await db.from("files").insert({
    title,
    subject,
    semester,
    kind,
    group_no,
    path
  });

  if (insErr) {
    await db.storage.from(BUCKET).remove([path]);
    return say(msg, "خطأ في تسجيل الملف: " + insErr.message);
  }

  say(msg, "تم الرفع بنجاح ✓", true);
  e.target.reset();
  setTimeout(() => {
    say(msg, "");
    loadFiles();
  }, 1000);
};

// بدء التشغيل
document.addEventListener("DOMContentLoaded", () => {
  if (!db) {
    $("#configBanner").style.display = "block";
    onUserSignedOut();
  }
});
