// ============================================================
// backend/utils/curriculum.js
// LinguaVoice — Step 5: Adaptive Curriculum
// Defines lesson content tailored by CEFR level.
// ============================================================

const curriculum = {
  // A0 Alphabet Module
  "a0_vowel_sounds": {
    id: "a0_vowel_sounds",
    title: "Vowel Sounds",
    levels: { beginner: { system_prompt: "Teach the basic vowel sounds: A, E, I, O, U. Practice their short and long forms. Use very simple words." } }
  },
  "a0_easy_consonants": {
    id: "a0_easy_consonants",
    title: "Easy Consonants",
    levels: { beginner: { system_prompt: "Teach easy consonants: B, D, G, K, M, N, P, S, T. Contrast them gently." } }
  },
  "a0_hard_consonants": {
    id: "a0_hard_consonants",
    title: "Hard Consonants",
    levels: { beginner: { system_prompt: "Teach tricky English consonants: TH, V/W distinction, short A vs schwa." } }
  },
  "a0_cvc_blending": {
    id: "a0_cvc_blending",
    title: "Blending Sounds",
    levels: { beginner: { system_prompt: "Practice blending consonant-vowel-consonant combinations like cat, dog, sit, run." } }
  },
  "a0_first_words": {
    id: "a0_first_words",
    title: "First 10 Words",
    levels: { beginner: { system_prompt: "Teach first survival words: yes, no, hello, bye, thank you, sorry, please, help, water, stop." } }
  },
  "a0_numbers_survival": {
    id: "a0_numbers_survival",
    title: "Numbers & Survival Phrases",
    levels: { beginner: { system_prompt: "Teach 1-10 and key phrases: I don't understand, Please repeat, Can you speak slowly?" } }
  },

  // A1+ Modules
  "greetings": {
    id: "greetings",
    title: "Greetings & Introductions",
    levels: {
      beginner: { system_prompt: "Teach basic introductions: My name is [name], I am from [country], I work as [job], Nice to meet you. Use very simple vocabulary. Correct basic grammar errors gently." },
      intermediate: { system_prompt: "Practice natural introductions: Discuss background, profession, interests. Challenge student to use present perfect: I have been working as [job] for [time]. Correct grammar and vocabulary range." },
      advanced: { system_prompt: "Advanced introductions: Professional networking language, idiomatic expressions, cultural nuance. Discuss opinions on work and life. Correct only subtle errors." }
    }
  },
  "basic_questions": {
    id: "basic_questions",
    title: "Asking Simple Questions",
    levels: {
      beginner: { system_prompt: "Teach: What is your name?, Where are you from?, How are you?, What do you do?. Basic question formation." },
      intermediate: { system_prompt: "Teach follow-up questions, indirect questions (e.g. Could you tell me...). Keep conversation engaging and naturally inquisitive." },
      advanced: { system_prompt: "Complex question structures, rhetorical questions, debate-style inquiry, challenging assumptions." }
    }
  },
  "work_routine": {
    id: "work_routine",
    title: "My Job and Daily Routine",
    levels: {
      beginner: { system_prompt: "Teach simple job descriptions: I am a [job], I work at [place], I start work at [time], My job is [adjective]." },
      intermediate: { system_prompt: "Discussing career goals, workplace issues, tasks and responsibilities in detail." },
      advanced: { system_prompt: "Professional presentations, negotiation language, discussing industry trends and high-level strategy." }
    }
  },
  "asking_for_help": {
    id: "asking_for_help",
    title: "Can You Help Me?",
    levels: {
      beginner: { system_prompt: "Basic survival phrases: Can you help me?, I don't understand, Can you repeat that?, How do you say [word]?" },
      intermediate: { system_prompt: "Polite requests, understanding formal/informal register, offering assistance." },
      advanced: { system_prompt: "Diplomatic language, resolving conflict, complex problem solving, and nuanced persuasion." }
    }
  }
};

// Map CEFR levels to internal group
function getLevelGroup(cefrLevel) {
  const level = (cefrLevel || "A1").toUpperCase();
  if (["C1", "C2"].includes(level)) return "advanced";
  if (["B1", "B2"].includes(level)) return "intermediate";
  return "beginner"; // A1, A2
}

module.exports = {
  curriculum,
  getLevelGroup
};
