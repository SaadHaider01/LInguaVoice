// ============================================================
// frontend/src/config/languages.js
// All language-related constants for native language selection,
// zero-knowledge detection, bilingual ratios, and font loading.
// ============================================================

export const LANGUAGES = [
  { key: "hindi",    flag: "🇮🇳", english: "Hindi",    native: "हिन्दी",   rtl: false },
  { key: "urdu",     flag: "🇵🇰", english: "Urdu",     native: "اردو",     rtl: true  },
  { key: "bengali",  flag: "🇧🇩", english: "Bengali",  native: "বাংলা",    rtl: false },
  { key: "tamil",    flag: "🇮🇳", english: "Tamil",    native: "தமிழ்",    rtl: false },
  { key: "telugu",   flag: "🇮🇳", english: "Telugu",   native: "తెలుగు",   rtl: false },
  { key: "marathi",  flag: "🇮🇳", english: "Marathi",  native: "मराठी",    rtl: false },
  { key: "punjabi",  flag: "🇮🇳", english: "Punjabi",  native: "ਪੰਜਾਬੀ",   rtl: false },
  { key: "arabic",   flag: "🇸🇦", english: "Arabic",   native: "عربي",     rtl: true  },
  { key: "spanish",  flag: "🇪🇸", english: "Spanish",  native: "Español",  rtl: false },
  { key: "mandarin", flag: "🇨🇳", english: "Mandarin", native: "普通话",    rtl: false },
  { key: "other_lang", flag: "🌐", english: "Other",    native: "Other",    rtl: false },
];

// Label for the zero-knowledge checkbox — rendered in native language
export const ZERO_KNOWLEDGE_LABELS = {
  hindi:    "मुझे अंग्रेज़ी बिल्कुल नहीं आती",
  urdu:     "مجھے انگریزی بالکل نہیں آتی",
  bengali:  "আমি একদমই ইংরেজি জানি না",
  tamil:    "எனக்கு ஆங்கிலம் சிறிதும் தெரியாது",
  telugu:   "నాకు ఇంగ్లీష్ అస్సలు రాదు",
  marathi:  "मला इंग्रजी अजिबात येत नाही",
  punjabi:  "ਮੈਨੂੰ ਅੰਗਰੇਜ਼ੀ ਬਿਲਕੁਲ ਨਹੀਂ ਆਉਂਦੀ",
  arabic:   "لا أعرف الإنجليزية على الإطلاق",
  spanish:  "No sé nada de inglés",
  mandarin: "我完全不懂英语",
  other_lang: "I don't know any English",
};

// Confirmation message shown when zero-knowledge checkbox is ticked
export const ZERO_KNOWLEDGE_CONFIRMATIONS = {
  hindi:    "कोई बात नहीं! हम बिल्कुल शुरुआत से शुरू करेंगे।",
  urdu:     "کوئی بات نہیں! ہم بالکل شروع سے شروع کریں گے۔",
  bengali:  "কোনো সমস্যা নেই! আমরা একদম শুরু থেকে শুরু করব।",
  tamil:    "பரவாயில்லை! நாம் முதலிலிருந்து தொடங்குவோம்।",
  telugu:   "పర్వాలేదు! మనం మొదటి నుండి ప్రారంభిద్దాం.",
  marathi:  "काळजी नको! आपण अगदी सुरुवातीपासून सुरू करू.",
  punjabi:  "ਕੋਈ ਗੱਲ ਨਹੀਂ! ਅਸੀਂ ਬਿਲਕੁਲ ਸ਼ੁਰੂ ਤੋਂ ਸ਼ੁਰੂ ਕਰਾਂਗੇ।",
  arabic:   "لا بأس! سنبدأ من الصفر تمامًا.",
  spanish:  "¡No hay problema! Empezaremos desde el principio.",
  mandarin: "没关系！我们将从头开始。",
  other_lang: "No problem! We'll start from the very beginning.",
};

// Dynamic subheading shown below language selection grid after language is picked
export const LANGUAGE_SUBHEADINGS = {
  hindi:    "आपकी भाषा चुनी गई: हिन्दी",
  urdu:     "آپ کی زبان منتخب ہوئی: اردو",
  bengali:  "আপনার ভাষা নির্বাচন করা হয়েছে: বাংলা",
  tamil:    "உங்கள் மொழி தேர்ந்தெடுக்கப்பட்டது: தமிழ்",
  telugu:   "మీ భాష ఎంచుకోబడింది: తెలుగు",
  marathi:  "तुमची भाषा निवडली गेली: मराठी",
  punjabi:  "ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਚੁਣੀ ਗਈ: ਪੰਜਾਬੀ",
  arabic:   "تم اختيار لغتك: عربي",
  spanish:  "Tu idioma seleccionado: Español",
  mandarin: "已选择您的语言：普通话",
  other_lang: "Language selected: Other",
};

// A0 lesson UI button labels in native language
export const A0_BUTTON_LABELS = {
  ready: {
    hindi:    "तैयार हूँ",
    urdu:     "تیار ہوں",
    bengali:  "প্রস্তুত",
    tamil:    "தயார்",
    telugu:   "సిద్ధంగా ఉన్నాను",
    marathi:  "तयार आहे",
    punjabi:  "ਤਿਆਰ ਹਾਂ",
    arabic:   "أنا مستعد",
    spanish:  "Estoy listo",
    mandarin: "我准备好了",
    other_lang: "I'm Ready",
  },
  listen_again: {
    hindi:    "दोबारा सुनें",
    urdu:     "دوبارہ سنیں",
    bengali:  "আবার শুনুন",
    tamil:    "மீண்டும் கேளுங்கள்",
    telugu:   "మళ్ళీ వినండి",
    marathi:  "पुन्हा ऐका",
    punjabi:  "ਦੁਬਾਰਾ ਸੁਣੋ",
    arabic:   "استمع مرة أخرى",
    spanish:  "Escuchar de nuevo",
    mandarin: "再听一遍",
    other_lang: "Listen Again",
  },
  start_learning: {
    hindi:    "सीखना शुरू करें",
    urdu:     "سیکھنا شروع کریں",
    bengali:  "শেখা শুরু করুন",
    tamil:    "கற்கத் தொடங்குங்கள்",
    telugu:   "నేర్చుకోవడం ప్రారంభించండి",
    marathi:  "शिकणे सुरू करा",
    punjabi:  "ਸਿੱਖਣਾ ਸ਼ੁਰੂ ਕਰੋ",
    arabic:   "ابدأ التعلم",
    spanish:  "Comenzar a aprender",
    mandarin: "开始学习",
    other_lang: "Start Learning",
  },
};

// Bilingual ratio for Groq prompt injection
export const BILINGUAL_RATIO = {
  A0: { native: 100, english: 0   },
  A1: { native: 70,  english: 30  },
  A2: { native: 50,  english: 50  },
  B1: { native: 20,  english: 80  },
  B2: { native: 0,   english: 100 },
  C1: { native: 0,   english: 100 },
  C2: { native: 0,   english: 100 },
};

// Google Fonts mapping per language (null = Latin script, no extra font needed)
export const LANGUAGE_FONTS = {
  hindi:    "Noto+Sans+Devanagari",
  urdu:     "Noto+Nastaliq+Urdu",
  bengali:  "Noto+Sans+Bengali",
  tamil:    "Noto+Sans+Tamil",
  telugu:   "Noto+Sans+Telugu",
  marathi:  "Noto+Sans+Devanagari",
  punjabi:  "Noto+Sans+Gurmukhi",
  arabic:   "Noto+Naskh+Arabic",
  spanish:  null,
  mandarin: "Noto+Sans+SC",
  other_lang: null,
};
