/**
 * script.js — موقع توليد الأدعية
 * يستخدم Groq Chat Completions API
 *
 * ⚠️ تنبيه أمني مهم:
 * وضع مفتاح API مباشرة في كود الواجهة الأمامية غير آمن في بيئة الإنتاج.
 * الحل الصحيح: استخدم backend أو serverless function (مثل Vercel Edge Functions,
 * Netlify Functions, Cloudflare Workers) يستقبل الطلب من المتصفح ثم يتواصل مع Groq
 * مع إخفاء المفتاح في متغيرات البيئة (Environment Variables).
 *
 * للتشغيل المحلي فقط: ضع مفتاحك في المتغير أدناه.
 */

// ─── الإعدادات ───────────────────────────────────────────────────────────────


/**
 * 🤖 النموذج المستخدم — يمكن تغييره بسهولة
 * خيارات شائعة في Groq:
 *   "llama-3.1-70b-versatile"   ← جودة عالية (افتراضي)
 *   "llama-3.1-8b-instant"      ← أسرع
 *   "gemma2-9b-it"              ← بديل جيد
 */
const MODEL = "grok-4.3";


/** الحد الأقصى للتوكنات في الرد */
const MAX_TOKENS = 900;

/** درجة الإبداع (0 = حرفي، 1 = إبداعي، 0.7 مناسب للأدعية) */
const TEMPERATURE = 0.75;


// ─── البرومبت النظامي للذكاء الاصطناعي ──────────────────────────────────────

const SYSTEM_PROMPT = `أنت مساعد متخصص في صياغة الأدعية باللغة العربية بأسلوب إيماني هادئ، واضح، مؤثر، وغير متكلف.

مهمتك: كتابة دعاء مناسب لحاجة المستخدم.

قواعد مهمة:
- اعتمد في المعاني على الأدعية النبوية الصحيحة والمعاني الشرعية العامة.
- لا تنسب حديثاً للنبي ﷺ إلا إذا كنت متأكداً تماماً من صحته.
- لا تخترع آيات قرآنية أو أحاديث نبوية.
- يمكنك استخدام أدعية مشهورة مثل:
  "اللهم إني أسألك الهدى والتقى والعفاف والغنى"
  "اللهم أعني على ذكرك وشكرك وحسن عبادتك"
  "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار"
  "اللهم إنك عفو تحب العفو فاعف عني"

أسلوب الكتابة:
- اكتب الدعاء بصيغة مناسبة لرجل مسلم.
- اجعل الدعاء متوسط الطول، حوالي 4 إلى 6 فقرات قصيرة.
- اتبع هذا النمط في الصياغة:
  "اللهم يا واسع الفضل، يا كريم يا رحيم، أسألك من فضلك..."
  "اللهم ارزقني..."
  "اللهم اصرف عني..."
  "اللهم اجعل..."
  "اللهم بارك لي..."
- كل فقرة تبدأ بـ "اللهم" أو "ربنا" أو "يا رب".
- لا تكتب أسلوباً وعظياً طويلاً.
- لا تكتب شرحاً أو مقدمة قبل الدعاء.
- لا تضع عناوين أو ترقيم.
- اكتب الدعاء مباشرة بشكل منسق، كل فقرة في سطر منفصل.
- اختم الدعاء بـ "آمين" أو "برحمتك يا أرحم الراحمين".`;


// ─── عناصر الواجهة ───────────────────────────────────────────────────────────

const userNeedTextarea = document.getElementById("user-need");
const generateBtn      = document.getElementById("generate-btn");
const loadingState     = document.getElementById("loading-state");
const errorMessage     = document.getElementById("error-message");
const errorText        = document.getElementById("error-text");
const resultSection    = document.getElementById("result-section");
const duaOutput        = document.getElementById("dua-output");
const copyBtn          = document.getElementById("copy-btn");
const copyFeedback     = document.getElementById("copy-feedback");
const charCount        = document.getElementById("char-count");


// ─── حالة التطبيق ─────────────────────────────────────────────────────────────

let isLoading = false;


// ─── عداد الأحرف ─────────────────────────────────────────────────────────────

userNeedTextarea.addEventListener("input", () => {
  const len = userNeedTextarea.value.length;
  charCount.textContent = `${len} / 500`;

  // تلوين العداد عند الاقتراب من الحد
  if (len >= 450) {
    charCount.style.color = "#e07060";
  } else if (len >= 350) {
    charCount.style.color = "#d4a030";
  } else {
    charCount.style.color = "";
  }
});


// ─── إرسال بـ Ctrl+Enter ─────────────────────────────────────────────────────

userNeedTextarea.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    handleGenerate();
  }
});


// ─── زر توليد الدعاء ─────────────────────────────────────────────────────────

generateBtn.addEventListener("click", handleGenerate);


// ─── الدالة الرئيسية ─────────────────────────────────────────────────────────

async function handleGenerate() {
  // منع الإرسال إذا كان يتحمل
  if (isLoading) return;

  // تنظيف النص من المسافات الزائدة
  const rawInput = userNeedTextarea.value;
  const userNeed = rawInput.trim().replace(/\s+/g, " ");

  // التحقق: لا يُرسل الطلب إذا كان المربع فارغاً
  if (!userNeed) {
    showError("من فضلك اكتب حاجتك أولاً قبل الضغط على الزر.");
    userNeedTextarea.focus();
    return;
  }


  // بدء التحميل
  setLoadingState(true);
  hideError();
  hideResult();

  try {
    const dua = await fetchDua(userNeed);
    showResult(dua);
  } catch (err) {
    handleError(err);
  } finally {
    setLoadingState(false);
  }
}


// ─── استدعاء Groq API ─────────────────────────────────────────────────────────

async function fetchDua(userNeed) {
  const response = await fetch("/api/dua", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userNeed }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "حدث خطأ أثناء توليد الدعاء.");
  }

  return data.dua;
}




// ─── دوال التحكم في الواجهة ──────────────────────────────────────────────────

/** تفعيل/تعطيل حالة التحميل */
function setLoadingState(loading) {
  isLoading = loading;

  if (loading) {
    loadingState.classList.remove("hidden");
    generateBtn.disabled = true;
    generateBtn.querySelector(".btn-text").textContent = "جارٍ الكتابة...";
  } else {
    loadingState.classList.add("hidden");
    generateBtn.disabled = false;
    generateBtn.querySelector(".btn-text").textContent = "اكتب الدعاء";
  }
}

/** عرض رسالة خطأ */
function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.remove("hidden");
}

/** إخفاء رسالة الخطأ */
function hideError() {
  errorMessage.classList.add("hidden");
  errorText.textContent = "";
}

/** عرض نتيجة الدعاء */
function showResult(dua) {
  duaOutput.textContent = dua;
  resultSection.classList.remove("hidden");
  copyFeedback.classList.add("hidden");

  // تمرير تلقائي نحو النتيجة
  setTimeout(() => {
    resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 100);
}

/** إخفاء قسم النتيجة */
function hideResult() {
  resultSection.classList.add("hidden");
  duaOutput.textContent = "";
}

/** معالجة الأخطاء المختلفة */
function handleError(err) {
  console.error("[Dua Generator] Error:", err);

  let message = "حدث خطأ غير متوقع. يرجى المحاولة مجدداً.";

  if (err instanceof TypeError && err.message.includes("fetch")) {
    message = "لا يوجد اتصال بالإنترنت أو تعذّر الوصول إلى الخادم. تحقق من اتصالك.";
  } else if (err.message) {
    message = err.message;
  }

  showError(message);
}


// ─── زر النسخ ─────────────────────────────────────────────────────────────────

copyBtn.addEventListener("click", async () => {
  const text = duaOutput.textContent;
  if (!text) return;

  try {
    // محاولة استخدام Clipboard API الحديثة
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback للمتصفحات القديمة
      fallbackCopyText(text);
    }
    showCopyFeedback();
  } catch (err) {
    console.warn("[Dua Generator] Copy failed:", err);
    try {
      fallbackCopyText(text);
      showCopyFeedback();
    } catch {
      showError("تعذّر النسخ. يرجى تحديد النص يدوياً ونسخه.");
    }
  }
});

/** Fallback للنسخ عبر textarea مؤقت */
function fallbackCopyText(text) {
  const tmp = document.createElement("textarea");
  tmp.value = text;
  tmp.style.cssText = "position:fixed;top:-9999px;right:-9999px;opacity:0;";
  document.body.appendChild(tmp);
  tmp.focus();
  tmp.select();
  document.execCommand("copy");
  document.body.removeChild(tmp);
}

/** إظهار تأكيد النسخ ثم إخفاؤه */
function showCopyFeedback() {
  copyFeedback.classList.remove("hidden");
  copyBtn.querySelector(".copy-text").textContent = "تم ✓";
  copyBtn.style.color = "var(--gold-light)";

  setTimeout(() => {
    copyFeedback.classList.add("hidden");
    copyBtn.querySelector(".copy-text").textContent = "نسخ";
    copyBtn.style.color = "";
  }, 2500);
}


// ─── تهيئة أولية ─────────────────────────────────────────────────────────────
