// ============================================================
// backend/utils/curriculum.js
// LinguaVoice — Step 5: Adaptive Curriculum
// Defines lesson content tailored by CEFR level.
// ============================================================

const curriculum = {
  module1: {
    id: "module1",
    title: "Greetings & Introductions",
    levels: {
      beginner: {   // A1, A2
        system_prompt: "Teach basic introductions: My name is [name], I am from [country], I work as [job], Nice to meet you. Use very simple vocabulary. Correct basic grammar errors gently.",
      },
      intermediate: {  // B1, B2
        system_prompt: "Practice natural introductions: Discuss background, profession, interests. Challenge student to use present perfect: I have been working as [job] for [time]. Correct grammar and vocabulary range.",
      },
      advanced: {   // C1, C2
        system_prompt: "Advanced introductions: Professional networking language, idiomatic expressions, cultural nuance. Discuss opinions on work and life. Correct only subtle errors.",
      }
    }
  },
  module2: {
    id: "module2",
    title: "Asking Simple Questions",
    levels: {
      beginner: {
        system_prompt: "Teach: What is your name?, Where are you from?, How are you?, What do you do?. Basic question formation.",
      },
      intermediate: {
        system_prompt: "Teach follow-up questions, indirect questions (e.g. Could you tell me...). Keep conversation engaging and naturally inquisitive.",
      },
      advanced: {
        system_prompt: "Complex question structures, rhetorical questions, debate-style inquiry, challenging assumptions.",
      }
    }
  },
  module3: {
    id: "module3",
    title: "My Job and Daily Routine",
    levels: {
      beginner: {
        system_prompt: "Teach simple job descriptions: I am a [job], I work at [place], I start work at [time], My job is [adjective].",
      },
      intermediate: {
        system_prompt: "Discussing career goals, workplace issues, tasks and responsibilities in detail.",
      },
      advanced: {
        system_prompt: "Professional presentations, negotiation language, discussing industry trends and high-level strategy.",
      }
    }
  },
  module4: {
    id: "module4",
    title: "Can You Help Me?",
    levels: {
      beginner: {
        system_prompt: "Basic survival phrases: Can you help me?, I don't understand, Can you repeat that?, How do you say [word]?",
      },
      intermediate: {
        system_prompt: "Polite requests, understanding formal/informal register, offering assistance.",
      },
      advanced: {
        system_prompt: "Diplomatic language, resolving conflict, complex problem solving, and nuanced persuasion.",
      }
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
